"use client";

import { Check, Pencil, Plus, RefreshCw } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DisplayModeRenderers } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/components/ui/yayaw-table/types/translations";
import { cn } from "@/lib/utils";
import { AddFilterDialog, AddWidgetDialog } from "./dashboard-dialogs";
import { DashboardFilterBar } from "./dashboard-filters";
import { KpiWidget } from "./dashboard-kpi";
import type {
  DashboardDirection,
  DashboardLayoutItem,
  DashboardResize,
} from "./dashboard-layout";
import {
  addDashboardFilter,
  type DashboardColumn,
  type DashboardLabelKey,
  type DashboardStorage,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  dashboardColumn,
  dashboardFilterRules,
  dashboardLabel,
  dashboardTranslate,
  dashboardWidgetSize,
  dashboardWidgetTitle,
  dashboardWidgetViewId,
  loadDashboardViews,
  removeDashboardFilter,
  setDashboardFilterValue,
  setDashboardText,
} from "./dashboard-model";
import {
  addDashboardWidget,
  applyDashboardSectionLayout,
  canMoveDashboardWidget,
  canResizeDashboardWidget,
  type Dashboard,
  type DashboardSection,
  type DashboardWidget,
  dashboardText,
  dashboardWidgetSection,
  moveDashboardWidget,
  normalizeDashboard,
  removeDashboardWidget,
  resizeDashboardWidget,
} from "./dashboard-schema";
import {
  type DashboardItemPlacement,
  DashboardSectionView,
} from "./dashboard-section";
import {
  type DashboardLabel,
  type DashboardTableSource,
  DashboardWidgetFrame,
  EmbeddedTableWidget,
  NoteWidget,
  WidgetErrorBoundary,
  WidgetMessage,
} from "./dashboard-widget";

export type { DashboardTableSource } from "./dashboard-widget";

export interface YayawDashboardProps {
  /** Host storage: `actions.dashboards.list/load/save/remove`. */
  actions: { dashboards: DashboardStorage };
  /** Tables widgets can show, by id: config, actions and saved views. */
  tables: Record<string, DashboardTableSource>;
  /** Dashboard to load; the first one `list()` returns by default. */
  dashboardId?: string;
  /** Whether the user may edit (layout, widgets, filters). Default false. */
  canEdit?: boolean;
  /** "Open full view" on view and number widgets calls it (`viewId` null for inline settings). */
  openView?: (tableId: string, viewId: string | null) => void;
  /** Renders note text (e.g. markdown); plain text by default. */
  renderMarkdown?: (text: string) => ReactNode;
  /** Optional display modes widgets may use, e.g. `{ chart, calendar }`. */
  displayModeRenderers?: DisplayModeRenderers;
  /** Language of the dashboard, its texts (`{ en, fr }`) and every widget (dates, numbers, labels). */
  locale?: string;
  /** Label overrides keyed `dashboard.<key>`. */
  translations?: Record<string, string>;
  /**
   * The table labels every widget uses (pagination, empty states, menus…), as
   * `DataTable`'s `translations`: pass the page's own, e.g. French ones.
   */
  tableTranslations?: DataTableTranslations;
  getRowId?: (row: Record<string, unknown>) => string;
  /** Called with the dashboard (version 2) after each change (saved or not). */
  onChange?: (dashboard: Dashboard) => void;
  className?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "empty" }
  | { status: "error"; message: string };

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function useDashboard(storage: DashboardStorage, dashboardId?: string) {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const id = dashboardId ?? (await storage.list()).at(0)?.id;
      if (!id) {
        return;
      }
      return normalizeDashboard(await storage.load(id));
    };
    setState({ status: "loading" });
    load()
      .then((loaded) => {
        if (!cancelled) {
          setDashboard(loaded);
          setState({ status: loaded ? "ready" : "empty" });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: errorText(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId, storage]);
  return { dashboard, setDashboard, state };
}

function useTableViews(tables: Record<string, DashboardTableSource>) {
  const [views, setViews] = useState<
    Record<string, DashboardView[] | undefined>
  >({});
  useEffect(() => {
    let cancelled = false;
    for (const [tableId, source] of Object.entries(tables)) {
      loadDashboardViews(source, tableId)
        .catch(() => loadDashboardViews({ views: source.views }, tableId))
        .then((loaded) => {
          if (!cancelled) {
            setViews((current) => ({ ...current, [tableId]: loaded }));
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [tables]);
  return views;
}

const tableInfo = (
  tableId: string,
  source: DashboardTableSource
): DashboardTableInfo => ({
  name: source.name ?? source.config.translations?.keys?.title ?? tableId,
  coloredTags: source.config.table.coloredTags,
  defaultDisplayMode: source.config.table.defaultDisplayMode,
  columns: source.config.columns.definitions.map((column) =>
    dashboardColumn(column as DashboardColumn)
  ),
});

interface WidgetContentProps {
  dashboard: Dashboard;
  widget: DashboardWidget;
  size: { w: number; h: number };
  tables: Record<string, DashboardTableSource>;
  views: Record<string, DashboardView[] | undefined>;
  revision: number;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  tableTranslations?: DataTableTranslations;
  renderers?: DisplayModeRenderers;
  renderMarkdown?: (text: string) => ReactNode;
  getRowId?: (row: Record<string, unknown>) => string;
  onViewAll?: () => void;
  /** A flow section's widget: its natural height. */
  natural: boolean;
}

function WidgetContent(props: WidgetContentProps) {
  const { dashboard, label, tables, views, widget } = props;
  if (widget.type === "note") {
    return (
      <NoteWidget
        emptyLabel={label("emptyNote")}
        renderMarkdown={props.renderMarkdown}
        text={String(widget.settings.text ?? "")}
      />
    );
  }
  if (widget.type === "table" || widget.type === "block") {
    // Full-page tables and host blocks come with the next version of the renderer.
    return (
      <div
        className="flex h-full flex-col"
        data-widget-placeholder={widget.type}
      >
        <WidgetMessage>{label("notAvailableYet")}</WidgetMessage>
      </div>
    );
  }
  const source = widget.tableId ? tables[widget.tableId] : undefined;
  if (!(source && widget.tableId)) {
    return <WidgetMessage tone="error">{label("missingTable")}</WidgetMessage>;
  }
  // Inline settings need no saved view.
  const saved = widget.view ? undefined : widget.viewId;
  const tableViews = views[widget.tableId];
  if (saved && !tableViews) {
    return <WidgetMessage>{label("widgetLoading")}</WidgetMessage>;
  }
  const view = saved
    ? tableViews?.find((item) => item.id === saved)
    : undefined;
  if (saved && !view) {
    return <WidgetMessage tone="error">{label("missingView")}</WidgetMessage>;
  }
  if (widget.type === "kpi") {
    return (
      <KpiWidget
        dashboard={dashboard}
        label={label}
        locale={props.locale}
        revision={props.revision}
        source={source}
        translate={props.translate}
        view={view}
        widget={widget}
      />
    );
  }
  return (
    <EmbeddedTableWidget
      dashboardId={dashboard.id}
      getRowId={props.getRowId}
      label={label}
      locale={props.locale}
      natural={props.natural}
      onViewAll={props.onViewAll}
      renderers={props.renderers}
      revision={props.revision}
      rules={dashboardFilterRules(dashboard, widget)}
      size={props.size}
      source={source}
      translations={props.tableTranslations}
      view={view}
      widget={widget}
    />
  );
}

function DashboardHeader({
  canEdit,
  editing,
  label,
  name,
  onAddWidget,
  onDone,
  onEdit,
  onRefresh,
  onRename,
  saving,
}: {
  canEdit: boolean;
  /** The dashboard's name in its language. */
  name: string;
  editing: boolean;
  label: DashboardLabel;
  onAddWidget: () => void;
  onDone: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  onRename: (name: string) => void;
  saving: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      {editing ? (
        <Input
          aria-label={label("dashboard")}
          className="h-9 max-w-80 flex-1 font-semibold text-lg"
          onChange={(event) => onRename(event.target.value)}
          value={name}
        />
      ) : (
        <h2 className="min-w-0 flex-1 truncate font-semibold text-xl">
          {name || label("dashboard")}
        </h2>
      )}
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <Button onClick={onRefresh} size="sm" type="button" variant="outline">
          <RefreshCw aria-hidden="true" />
          {label("refresh")}
        </Button>
        {editing && (
          <Button
            onClick={onAddWidget}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" />
            {label("addWidget")}
          </Button>
        )}
        {canEdit && editing && (
          <Button disabled={saving} onClick={onDone} size="sm" type="button">
            <Check aria-hidden="true" />
            {saving ? label("saving") : label("done")}
          </Button>
        )}
        {canEdit && !editing && (
          <Button onClick={onEdit} size="sm" type="button" variant="outline">
            <Pencil aria-hidden="true" />
            {label("edit")}
          </Button>
        )}
      </div>
    </header>
  );
}

const hasWidgets = (section: DashboardSection): boolean =>
  section.type === "grid"
    ? section.layout.length > 0
    : section.widgetIds.length > 0;

/**
 * A Notion-like dashboard (JSON version 2): sections in order, each a
 * 4-column grid users arrange in edit mode or a flow of full-width widgets;
 * widgets show views of any table (saved or inline, in any display mode),
 * numbers and notes; dashboard filters reach every targeted table's requests.
 * Older JSON is migrated on load and saved as version 2.
 */
export function YayawDashboard({
  actions,
  canEdit = false,
  className,
  dashboardId,
  displayModeRenderers,
  getRowId,
  locale = "en",
  onChange,
  openView,
  renderMarkdown,
  tableTranslations,
  tables,
  translations,
}: YayawDashboardProps) {
  const storage = actions.dashboards;
  const { dashboard, setDashboard, state } = useDashboard(storage, dashboardId);
  const views = useTableViews(tables);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [addingWidget, setAddingWidget] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const translate = useMemo(
    () => dashboardTranslate(translations),
    [translations]
  );
  const label = useCallback<DashboardLabel>(
    (key: DashboardLabelKey, params) =>
      dashboardLabel(key, locale, translate, params),
    [locale, translate]
  );
  const infos = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(tables).map(([id, source]) => [
          id,
          tableInfo(id, source),
        ])
      ),
    [tables]
  );
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Several changes can land before the next render (grid events): chain them.
  const latest = useRef(dashboard);
  latest.current = dashboard;
  const update = useCallback(
    (change: (current: Dashboard) => Dashboard) => {
      const current = latest.current;
      if (!current) {
        return;
      }
      const next = change(current);
      if (next === current) {
        return;
      }
      latest.current = next;
      setDashboard(next);
      onChangeRef.current?.(next);
    },
    [setDashboard]
  );
  const titleOf = useCallback(
    (widget: DashboardWidget) =>
      dashboardWidgetTitle(widget, {
        locale,
        translate,
        table: widget.tableId ? infos[widget.tableId] : undefined,
        view: views[widget.tableId ?? ""]?.find(
          (view) => view.id === widget.viewId
        ),
      }),
    [infos, locale, translate, views]
  );

  const save = async () => {
    if (!dashboard) {
      return;
    }
    setSaving(true);
    try {
      await storage.save({ ...dashboard, updatedAt: new Date().toISOString() });
      setEditing(false);
      toast.success(label("saved"));
    } catch (error) {
      toast.error(label("saveError", { error: errorText(error) }));
    } finally {
      setSaving(false);
    }
  };

  if (state.status !== "ready" || !dashboard) {
    const message =
      state.status === "error"
        ? label("loadError", { error: state.message })
        : label(state.status === "empty" ? "notFound" : "loading");
    return (
      <div className={cn("yayaw-dashboard", className)} data-dashboard="">
        <WidgetMessage tone={state.status === "error" ? "error" : "muted"}>
          {message}
        </WidgetMessage>
      </div>
    );
  }

  const widgetTables = Object.fromEntries(
    Object.entries(infos).filter(([id]) =>
      dashboard.widgets.some((widget) => widget.tableId === id)
    )
  );
  const renderItem = (
    widgetId: string,
    { flow, phone, titled }: DashboardItemPlacement
  ) => {
    const widget = dashboard.widgets.find((item) => item.id === widgetId);
    if (!widget) {
      return null;
    }
    const title = titleOf(widget);
    const tableId = widget.tableId;
    const open =
      openView && tableId && (widget.type === "view" || widget.type === "kpi")
        ? () => openView(tableId, dashboardWidgetViewId(widget))
        : undefined;
    const section = dashboardWidgetSection(dashboard, widgetId);
    const place =
      section?.type === "grid"
        ? section.layout.find((item) => item.widgetId === widgetId)
        : undefined;
    return (
      <DashboardWidgetFrame
        canMove={(direction) =>
          canMoveDashboardWidget(dashboard, widgetId, direction)
        }
        canResize={(change) =>
          canResizeDashboardWidget(dashboard, widgetId, change)
        }
        draggable={!(phone || flow)}
        editing={editing}
        headingLevel={titled ? 4 : 3}
        label={label}
        onMove={(direction: DashboardDirection) => {
          update((current) =>
            moveDashboardWidget(current, widgetId, direction)
          );
          setAnnouncement(label("moved", { title }));
        }}
        onOpen={open}
        onRemove={() =>
          update((current) => removeDashboardWidget(current, widgetId))
        }
        onResize={(change: DashboardResize) => {
          update((current) => resizeDashboardWidget(current, widgetId, change));
          setAnnouncement(label("resized", { title }));
        }}
        resizable={!flow}
        title={title}
        widget={widget}
      >
        <WidgetErrorBoundary
          fallback={(error, retry) => (
            <WidgetMessage
              onRetry={retry}
              retryLabel={label("retry")}
              tone="error"
            >
              {label("widgetError", { error: error.message })}
            </WidgetMessage>
          )}
        >
          <WidgetContent
            dashboard={dashboard}
            getRowId={getRowId}
            label={label}
            locale={locale}
            natural={flow}
            onViewAll={open}
            renderers={displayModeRenderers}
            renderMarkdown={renderMarkdown}
            revision={revision}
            size={{ w: place?.w ?? 1, h: place?.h ?? 1 }}
            tables={tables}
            tableTranslations={tableTranslations}
            translate={translate}
            views={views}
            widget={widget}
          />
        </WidgetErrorBoundary>
      </DashboardWidgetFrame>
    );
  };

  return (
    <div
      className={cn("yayaw-dashboard flex flex-col gap-4", className)}
      data-dashboard={dashboard.id}
      data-editing={editing ? "" : undefined}
    >
      <DashboardHeader
        canEdit={canEdit}
        editing={editing}
        label={label}
        name={dashboardText(dashboard.name, locale)}
        onAddWidget={() => setAddingWidget(true)}
        onDone={save}
        onEdit={() => setEditing(true)}
        onRefresh={() => setRevision((value) => value + 1)}
        onRename={(name) =>
          update((current) => ({
            ...current,
            name: setDashboardText(current.name, locale, name),
          }))
        }
        saving={saving}
      />
      <DashboardFilterBar
        editing={editing}
        filters={dashboard.filters}
        label={label}
        locale={locale}
        onAddFilter={() => setAddingFilter(true)}
        onChange={(filterId, value) =>
          update((current) => setDashboardFilterValue(current, filterId, value))
        }
        onRemove={(filterId) =>
          update((current) => removeDashboardFilter(current, filterId))
        }
        tables={infos}
        translate={translate}
      />
      {dashboard.widgets.length ? (
        dashboard.sections
          .filter(hasWidgets)
          .map((section) => (
            <DashboardSectionView
              editing={editing}
              key={section.id}
              onLayoutChange={(layout: DashboardLayoutItem[]) =>
                update((current) =>
                  applyDashboardSectionLayout(current, section.id, layout)
                )
              }
              renderItem={renderItem}
              section={section}
              title={dashboardText(section.title, locale)}
            />
          ))
      ) : (
        <WidgetMessage>
          {label(editing ? "emptyEditable" : "empty")}
        </WidgetMessage>
      )}
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
      {editing && (
        <>
          <AddWidgetDialog
            label={label}
            locale={locale}
            onAdd={(widget) =>
              update((current) =>
                addDashboardWidget(current, widget, {
                  size: dashboardWidgetSize(widget, {
                    views: views[widget.tableId ?? ""],
                    table: infos[widget.tableId ?? ""],
                  }),
                })
              )
            }
            onOpenChange={setAddingWidget}
            open={addingWidget}
            tables={infos}
            translate={translate}
            views={views}
          />
          <AddFilterDialog
            label={label}
            onAdd={(filter) =>
              update((current) => addDashboardFilter(current, filter))
            }
            onOpenChange={setAddingFilter}
            open={addingFilter}
            tables={widgetTables}
          />
        </>
      )}
    </div>
  );
}
