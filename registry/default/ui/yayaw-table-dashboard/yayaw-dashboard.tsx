"use client";

import { Check, Pencil, Plus, RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DisplayModeRenderers } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/components/ui/yayaw-table/types/translations";
import { cn } from "@/lib/utils";
import { BlockContent, type DashboardBlockRegistry } from "./dashboard-block";
import { AddFilterDialog, AddWidgetDialog } from "./dashboard-dialogs";
import { DashboardFilterBar } from "./dashboard-filters";
import {
  type DashboardLoadState,
  errorText,
  tableInfo,
  useDashboardDocument,
  useDashboardRevisions,
  useDashboardSources,
  useSourceViews,
  useViewerFilters,
} from "./dashboard-hooks";
import { KpiWidget } from "./dashboard-kpi";
import type {
  DashboardDirection,
  DashboardLayoutItem,
  DashboardResize,
} from "./dashboard-layout";
import {
  addDashboardFilter,
  type DashboardFilterValue,
  type DashboardLabelKey,
  type DashboardNotice,
  type DashboardOpenViewContext,
  type DashboardStorage,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  dashboardDayValue,
  dashboardFilterRules,
  dashboardFilterValues,
  dashboardLabel,
  dashboardNoticeText,
  dashboardOpenViewContext,
  dashboardTableInstanceId,
  dashboardTranslate,
  dashboardUnavailableText,
  dashboardVisibleSections,
  dashboardWidgetSize,
  dashboardWidgetTitle,
  dashboardWidgetViewId,
  removeDashboardFilter,
  resolveWidgetView,
  setDashboardFilterValue,
  setDashboardText,
  withDashboardFilterValues,
} from "./dashboard-model";
import { DashboardPageTable } from "./dashboard-page-table";
import {
  addDashboardWidget,
  applyDashboardSectionLayout,
  canMoveDashboardWidget,
  canResizeDashboardWidget,
  type Dashboard,
  type DashboardSection,
  type DashboardWidget,
  dashboardText,
  moveDashboardWidget,
  removeDashboardWidget,
  resizeDashboardWidget,
} from "./dashboard-schema";
import {
  type DashboardItemPlacement,
  DashboardSectionView,
} from "./dashboard-section";
import {
  type DashboardSourceLoader,
  type DashboardSources,
  type DashboardWidgetAvailability,
  dashboardSourceIds,
  dashboardUnavailableWidgetIds,
  dashboardWidgetAvailability,
} from "./dashboard-sources";
import {
  type DashboardLabel,
  type DashboardTableSource,
  DashboardWidgetFrame,
  EmbeddedTableWidget,
  NoteWidget,
  WidgetErrorBoundary,
  WidgetMessage,
  WidgetNotice,
} from "./dashboard-widget";

export type {
  DashboardBlock,
  DashboardBlockProps,
  DashboardBlockRegistry,
  DashboardBlockSettingsProps,
} from "./dashboard-block";
export type {
  DashboardDataTableProps,
  DashboardTableSource,
} from "./dashboard-widget";

export interface YayawDashboardProps {
  /**
   * Host storage: `actions.dashboards.list/load/save/remove`. Optional when
   * `dashboard` is given and nobody edits; editing needs `save`.
   */
  actions?: { dashboards: DashboardStorage };
  /** Sources given up front, by id (config, actions, saved views); they win over `sources`. */
  tables?: Record<string, DashboardTableSource>;
  /**
   * The host's lazy catalogue: `list()` for editors, `load(id)` for readers.
   * Only the sources the screen's widgets read are loaded; forbidden, not
   * configured or missing ones show as unavailable (never removed).
   */
  sources?: DashboardSources<DashboardTableSource>;
  /** The host's blocks by key: their schema and component. */
  blocks?: DashboardBlockRegistry;
  /** A document to show instead of loading one (server-fetched, a draft preview, a system screen). */
  dashboard?: unknown;
  /** Dashboard to load; the first one `list()` returns by default. */
  dashboardId?: string;
  /** Whether the user may edit (layout, widgets, filters). Default false. */
  canEdit?: boolean;
  /** Show the dashboard's name (`h2`). Default true. */
  showTitle?: boolean;
  /**
   * Widgets whose source is unavailable, and blocks the host lacks: a muted
   * notice (`show`, the default) or left out of the view, grids closing their
   * gaps (`hide`; never saved so, and shown while editing).
   */
  unavailableWidgets?: "show" | "hide";
  /**
   * Keep the reader's filter values in the URL (`<dashboardId>.<filterId>`)
   * and let full-page tables sync theirs. Default true.
   */
  syncUrl?: boolean;
  /**
   * "Open full view" and "View all" call it (`viewId` null for inline settings
   * and the default view; `context.view` holds a widget's inline view).
   */
  openView?: (
    tableId: string,
    viewId: string | null,
    context?: DashboardOpenViewContext
  ) => void;
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
  /** Called with the dashboard (version 2) after each change of the document (saved or not). */
  onChange?: (dashboard: Dashboard) => void;
  className?: string;
}

const NO_WIDGETS = new Set<string>();

/** What every widget of the screen reads. */
interface Screen {
  /** The document (edit mode changes it). */
  dashboard: Dashboard;
  /** The document with the reader's filter values: what widgets query. */
  shown: Dashboard;
  today: string;
  editing: boolean;
  syncUrl: boolean;
  loader: DashboardSourceLoader<DashboardTableSource>;
  views: Record<string, DashboardView[] | undefined>;
  blocks?: DashboardBlockRegistry;
  filterValues: Record<string, DashboardFilterValue | undefined>;
  revisions: ReturnType<typeof useDashboardRevisions>;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  noticeText: (notice: DashboardNotice) => string;
  renderers?: DisplayModeRenderers;
  renderMarkdown?: (text: string) => ReactNode;
  getRowId?: (row: Record<string, unknown>) => string;
  tableTranslations?: DataTableTranslations;
  openView?: YayawDashboardProps["openView"];
}

const blockOf = (
  blocks: DashboardBlockRegistry | undefined,
  key: string | undefined
) => (blocks && key && Object.hasOwn(blocks, key) ? blocks[key] : undefined);

interface WidgetContentProps {
  screen: Screen;
  widget: DashboardWidget;
  availability: DashboardWidgetAvailability;
  size: { w: number; h: number };
  /** A flow section's widget: its natural height. */
  flow: boolean;
  onViewAll?: () => void;
}

/** Why a source's widget shows nothing yet: loading, a failed load (Retry), unavailable. */
function SourceState({
  availability,
  onRetry,
  screen,
}: {
  availability: DashboardWidgetAvailability;
  onRetry: () => void;
  screen: Screen;
}) {
  const { label } = screen;
  if (availability.status === "unavailable") {
    return (
      <WidgetNotice kind="unavailable" reason={availability.reason}>
        {dashboardUnavailableText(
          availability.reason,
          availability.message,
          screen.locale,
          screen.translate
        )}
      </WidgetNotice>
    );
  }
  if (availability.status === "error") {
    return (
      <WidgetMessage onRetry={onRetry} retryLabel={label("retry")} tone="error">
        {label("widgetError", { error: availability.message })}
      </WidgetMessage>
    );
  }
  return <WidgetMessage>{label("widgetLoading")}</WidgetMessage>;
}

/** A host block, or "Unavailable block" when the host has none by that key. */
function BlockWidget({ flow, screen, size, widget }: WidgetContentProps) {
  const block = blockOf(screen.blocks, widget.block);
  if (!block) {
    return (
      <WidgetNotice kind="unknownBlock">
        {screen.label("unknownBlock")}
      </WidgetNotice>
    );
  }
  return (
    <BlockContent
      block={block}
      editing={screen.editing}
      filters={screen.filterValues}
      locale={screen.locale}
      openView={screen.openView}
      props={{ ...block.defaultProps, ...widget.props }}
      refresh={screen.revisions.refresh}
      revision={screen.revisions.blockRevision}
      size={flow ? undefined : size}
      widgetId={widget.id}
    />
  );
}

function WidgetContent(props: WidgetContentProps) {
  const { availability, flow, screen, widget } = props;
  const { label } = screen;
  if (widget.type === "note") {
    return (
      <NoteWidget
        emptyLabel={label("emptyNote")}
        renderMarkdown={screen.renderMarkdown}
        text={String(widget.settings.text ?? "")}
      />
    );
  }
  if (widget.type === "block") {
    return <BlockWidget {...props} />;
  }
  const tableId = widget.tableId;
  const state = tableId ? screen.loader.state(tableId) : undefined;
  if (
    !tableId ||
    availability.status !== "ready" ||
    state?.status !== "ready"
  ) {
    return (
      <SourceState
        availability={availability}
        onRetry={() => {
          if (tableId) {
            screen.loader.retry(tableId).catch(() => undefined);
          }
        }}
        screen={screen}
      />
    );
  }
  const source = state.source;
  const rules = dashboardFilterRules(screen.shown, widget, screen.today);
  if (widget.type === "table") {
    return (
      <DashboardPageTable
        dashboardId={screen.dashboard.id}
        getRowId={screen.getRowId}
        instanceId={dashboardTableInstanceId(screen.dashboard, widget.id)}
        locale={screen.locale}
        noticeText={screen.noticeText}
        onMutated={() => screen.revisions.mutated(tableId)}
        renderers={screen.renderers}
        revision={screen.revisions.pageRevision(tableId)}
        rules={rules}
        screenViewName={
          dashboardText(widget.title, screen.locale) ||
          label("screenDefaultView")
        }
        source={source}
        sourceId={tableId}
        syncUrl={screen.syncUrl}
        translations={screen.tableTranslations}
        widget={widget}
      />
    );
  }
  const resolved = resolveWidgetView(widget, screen.views[tableId]);
  if (resolved.status === "loading") {
    return <WidgetMessage>{label("widgetLoading")}</WidgetMessage>;
  }
  if (resolved.status === "missing") {
    return <WidgetMessage tone="error">{label("missingView")}</WidgetMessage>;
  }
  const revision = screen.revisions.widgetRevision(tableId);
  if (widget.type === "kpi") {
    return (
      <KpiWidget
        dashboard={screen.shown}
        label={label}
        locale={screen.locale}
        noticeText={screen.noticeText}
        revision={revision}
        source={source}
        translate={screen.translate}
        view={resolved.view}
        widget={widget}
      />
    );
  }
  return (
    <EmbeddedTableWidget
      dashboardId={screen.dashboard.id}
      getRowId={screen.getRowId}
      label={label}
      locale={screen.locale}
      natural={flow}
      noticeText={screen.noticeText}
      onViewAll={props.onViewAll}
      renderers={screen.renderers}
      revision={revision}
      rules={rules}
      size={props.size}
      source={source}
      translations={screen.tableTranslations}
      view={resolved.view}
      widget={widget}
    />
  );
}

function DashboardHeader({
  editable,
  editing,
  label,
  name,
  onAddWidget,
  onDone,
  onEdit,
  onRefresh,
  onRename,
  saving,
  showTitle,
}: {
  editable: boolean;
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
  showTitle: boolean;
}) {
  let title: ReactNode = null;
  if (editing) {
    title = (
      <Input
        aria-label={label("dashboard")}
        className="h-9 max-w-80 flex-1 font-semibold text-lg"
        onChange={(event) => onRename(event.target.value)}
        value={name}
      />
    );
  } else if (showTitle) {
    title = (
      <h2 className="min-w-0 flex-1 truncate font-semibold text-xl">
        {name || label("dashboard")}
      </h2>
    );
  }
  return (
    <header className="flex flex-wrap items-center gap-2">
      {title}
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
        {editable && editing && (
          <Button disabled={saving} onClick={onDone} size="sm" type="button">
            <Check aria-hidden="true" />
            {saving ? label("saving") : label("done")}
          </Button>
        )}
        {editable && !editing && (
          <Button onClick={onEdit} size="sm" type="button" variant="outline">
            <Pencil aria-hidden="true" />
            {label("edit")}
          </Button>
        )}
      </div>
    </header>
  );
}

/** The sources whose saved views widgets name, and in edit mode the picker's. */
const viewSourceIds = (dashboard: Dashboard | undefined): string[] => {
  const ids = new Set<string>();
  for (const widget of dashboard?.widgets ?? []) {
    if (widget.tableId && widget.viewId && !widget.view) {
      ids.add(widget.tableId);
    }
  }
  return [...ids];
};

/** What the dashboard knows of the loaded sources, by id. */
const loadedInfos = (
  loader: DashboardSourceLoader<DashboardTableSource>,
  ids: readonly string[]
): Record<string, DashboardTableInfo> => {
  const infos: Record<string, DashboardTableInfo> = {};
  for (const id of ids) {
    const loaded = loader.state(id);
    if (loaded?.status === "ready") {
      infos[id] = tableInfo(id, loaded.source);
    }
  }
  return infos;
};

interface WidgetItemProps {
  screen: Screen;
  widget: DashboardWidget;
  title: string;
  availability: DashboardWidgetAvailability;
  section: DashboardSection;
  placement: DashboardItemPlacement;
  update: (change: (current: Dashboard) => Dashboard) => void;
  announce: (message: string) => void;
}

/** A widget in its frame (a card, or none for a full-page table), its errors contained. */
function WidgetItem({
  announce,
  availability,
  placement,
  screen,
  section,
  title,
  update,
  widget,
}: WidgetItemProps) {
  const { dashboard, label, openView } = screen;
  const { flow, phone, titled } = placement;
  const widgetId = widget.id;
  const tableId = widget.tableId;
  const opens =
    availability.status === "ready" &&
    (widget.type === "view" || widget.type === "kpi");
  const open =
    openView && tableId && opens
      ? () =>
          openView(
            tableId,
            dashboardWidgetViewId(widget),
            dashboardOpenViewContext(widget)
          )
      : undefined;
  const place =
    section.type === "grid"
      ? section.layout.find((item) => item.widgetId === widgetId)
      : undefined;
  const page = widget.type === "table";
  return (
    <DashboardWidgetFrame
      canMove={(direction) =>
        canMoveDashboardWidget(dashboard, widgetId, direction)
      }
      canResize={(change) =>
        canResizeDashboardWidget(dashboard, widgetId, change)
      }
      draggable={!(phone || flow)}
      editing={screen.editing}
      frame={page ? "page" : "card"}
      headingLevel={titled ? 4 : 3}
      label={label}
      onMove={(direction: DashboardDirection) => {
        update((current) => moveDashboardWidget(current, widgetId, direction));
        announce(label("moved", { title }));
      }}
      onOpen={open}
      onRemove={() =>
        update((current) => removeDashboardWidget(current, widgetId))
      }
      onResize={(change: DashboardResize) => {
        update((current) => resizeDashboardWidget(current, widgetId, change));
        announce(label("resized", { title }));
      }}
      resizable={!flow}
      showHeading={page && Boolean(dashboardText(widget.title, screen.locale))}
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
          availability={availability}
          flow={flow}
          onViewAll={open}
          screen={screen}
          size={{ w: place?.w ?? 1, h: place?.h ?? 1 }}
          widget={widget}
        />
      </WidgetErrorBoundary>
    </DashboardWidgetFrame>
  );
}

/** Loading, missing or unreadable document. */
function DashboardLoadMessage({
  className,
  label,
  state,
}: {
  className?: string;
  label: DashboardLabel;
  state: DashboardLoadState;
}) {
  let message = label("loading");
  if (state.status === "error") {
    message = label("loadError", { error: state.message });
  } else if (state.status === "empty") {
    message = label("notFound");
  }
  return (
    <div className={cn("yayaw-dashboard", className)} data-dashboard="">
      <WidgetMessage tone={state.status === "error" ? "error" : "muted"}>
        {message}
      </WidgetMessage>
    </div>
  );
}

/** Labels in the dashboard's language, with the host's overrides. */
function useDashboardLabels(
  locale: string,
  translations?: Record<string, string>
) {
  const translate = useMemo(
    () => dashboardTranslate(translations),
    [translations]
  );
  const label = useCallback<DashboardLabel>(
    (key: DashboardLabelKey, params) =>
      dashboardLabel(key, locale, translate, params),
    [locale, translate]
  );
  const noticeText = useCallback(
    (notice: DashboardNotice) => dashboardNoticeText(notice, locale, translate),
    [locale, translate]
  );
  return { translate, label, noticeText };
}

type DashboardScreenProps = Omit<YayawDashboardProps, "dashboard"> & {
  document: Dashboard;
  setDocument: (dashboard: Dashboard) => void;
};

/** A loaded document: its header, filters, sections and widgets. */
function DashboardScreen({
  actions,
  blocks,
  canEdit = false,
  className,
  displayModeRenderers,
  document: dashboard,
  getRowId,
  locale = "en",
  onChange,
  openView,
  renderMarkdown,
  setDocument,
  showTitle = true,
  sources,
  syncUrl = true,
  tableTranslations,
  tables,
  translations,
  unavailableWidgets = "show",
}: DashboardScreenProps) {
  const storage = actions?.dashboards;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingWidget, setAddingWidget] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const screenIds = useMemo(() => dashboardSourceIds(dashboard), [dashboard]);
  const tableIds = useMemo(() => Object.keys(tables ?? {}), [tables]);
  // Readers load what the screen shows; editors also the tables they may add.
  const loadIds = useMemo(
    () => (editing ? [...new Set([...screenIds, ...tableIds])] : screenIds),
    [editing, screenIds, tableIds]
  );
  const { loader } = useDashboardSources({ ids: loadIds, sources, tables });
  const views = useSourceViews(
    loader,
    editing ? loadIds : viewSourceIds(dashboard)
  );
  const viewer = useViewerFilters(dashboard, syncUrl);
  const revisions = useDashboardRevisions();
  const { label, noticeText, translate } = useDashboardLabels(
    locale,
    translations
  );
  const infos = loadedInfos(loader, loadIds);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Several changes can land before the next render (grid events): chain them.
  const latest = useRef(dashboard);
  latest.current = dashboard;
  const update = useCallback(
    (change: (current: Dashboard) => Dashboard) => {
      const current = latest.current;
      const next = change(current);
      if (next === current) {
        return;
      }
      latest.current = next;
      setDocument(next);
      onChangeRef.current?.(next);
    },
    [setDocument]
  );

  const save = async () => {
    if (!storage) {
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
  const refreshAll = () => {
    revisions.refresh();
    for (const id of screenIds) {
      if (loader.state(id)?.status === "error") {
        loader.retry(id).catch(() => undefined);
      }
    }
  };

  // Edit mode shows and changes the document's default filter values.
  const shown = editing
    ? dashboard
    : withDashboardFilterValues(dashboard, viewer.values);
  const today = dashboardDayValue(new Date());
  const context = {
    state: loader.state,
    hasBlock: (key: string) => Boolean(blockOf(blocks, key)),
  };
  const hides = !editing && unavailableWidgets === "hide";
  const sections = dashboardVisibleSections(
    dashboard.sections,
    hides ? dashboardUnavailableWidgetIds(dashboard, context) : NO_WIDGETS
  );
  const screen: Screen = {
    dashboard,
    shown,
    today,
    editing,
    syncUrl,
    loader,
    views,
    blocks,
    filterValues: dashboardFilterValues(shown, today),
    revisions,
    label,
    locale,
    translate,
    noticeText,
    renderers: displayModeRenderers,
    renderMarkdown,
    getRowId,
    tableTranslations,
    openView,
  };
  const widgets = new Map(
    dashboard.widgets.map((widget) => [widget.id, widget])
  );
  const titleOf = (widget: DashboardWidget) =>
    dashboardWidgetTitle(widget, {
      locale,
      translate,
      table: widget.tableId ? infos[widget.tableId] : undefined,
      view: views[widget.tableId ?? ""]?.find(
        (view) => view.id === widget.viewId
      ),
      block: blockOf(blocks, widget.block),
    });
  const renderItem = (
    widgetId: string,
    section: DashboardSection,
    placement: DashboardItemPlacement
  ) => {
    const widget = widgets.get(widgetId);
    return widget ? (
      <WidgetItem
        announce={setAnnouncement}
        availability={dashboardWidgetAvailability(widget, context)}
        placement={placement}
        screen={screen}
        section={section}
        title={titleOf(widget)}
        update={update}
        widget={widget}
      />
    ) : null;
  };

  return (
    <div
      className={cn("yayaw-dashboard flex flex-col gap-4", className)}
      data-dashboard={dashboard.id}
      data-editing={editing ? "" : undefined}
    >
      <DashboardHeader
        editable={canEdit && Boolean(storage?.save)}
        editing={editing}
        label={label}
        name={dashboardText(dashboard.name, locale)}
        onAddWidget={() => setAddingWidget(true)}
        onDone={save}
        onEdit={() => {
          viewer.clear();
          setEditing(true);
        }}
        onRefresh={refreshAll}
        onRename={(name) =>
          update((current) => ({
            ...current,
            name: setDashboardText(current.name, locale, name),
          }))
        }
        saving={saving}
        showTitle={showTitle}
      />
      <DashboardFilterBar
        editing={editing}
        filters={shown.filters}
        label={label}
        locale={locale}
        onAddFilter={() => setAddingFilter(true)}
        onChange={(filterId, value) => {
          if (editing) {
            update((current) =>
              setDashboardFilterValue(current, filterId, value)
            );
          } else {
            viewer.set(filterId, value);
          }
        }}
        onRemove={(filterId) =>
          update((current) => removeDashboardFilter(current, filterId))
        }
        tables={infos}
        translate={translate}
      />
      {/* Widgets query once the reader's filter values are read from the URL. */}
      {viewer.ready && dashboard.widgets.length
        ? sections.map((section) => (
            <DashboardSectionView
              editing={editing}
              key={section.id}
              onLayoutChange={(layout: DashboardLayoutItem[]) =>
                update((current) =>
                  applyDashboardSectionLayout(current, section.id, layout)
                )
              }
              renderItem={(widgetId, placement) =>
                renderItem(widgetId, section, placement)
              }
              section={section}
              title={dashboardText(section.title, locale)}
            />
          ))
        : null}
      {dashboard.widgets.length ? null : (
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
            tables={Object.fromEntries(
              Object.entries(infos).filter(([id]) => screenIds.includes(id))
            )}
          />
        </>
      )}
    </div>
  );
}

/**
 * A Notion-like dashboard, and the screens of an admin (JSON version 2):
 * sections in order, each a 4-column grid users arrange in edit mode or a
 * flow of full-width widgets. Widgets show views of any source (saved or
 * inline, in any display mode), numbers, notes, full-page tables with their
 * toolbar and URL, and the host's blocks. Sources load lazily from the
 * host's catalogue; unavailable ones show a notice and are never removed.
 * Filters join every targeted request; the values readers pick stay in the
 * URL. Older JSON is migrated on load and saved as version 2.
 */
export function YayawDashboard(props: YayawDashboardProps) {
  const { dashboard, setDashboard, state } = useDashboardDocument({
    blocks: props.blocks,
    dashboardId: props.dashboardId,
    input: props.dashboard,
    storage: props.actions?.dashboards,
  });
  const { label } = useDashboardLabels(
    props.locale ?? "en",
    props.translations
  );
  if (state.status !== "ready" || !dashboard) {
    return (
      <DashboardLoadMessage
        className={props.className}
        label={label}
        state={state}
      />
    );
  }
  return (
    <DashboardScreen
      {...props}
      document={dashboard}
      setDocument={setDashboard}
    />
  );
}
