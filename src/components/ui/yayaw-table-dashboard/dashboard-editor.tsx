"use client";

/**
 * The screen editor's dialogs, in a chunk of their own: `YayawDashboard`
 * loads it (`import()`) when edit mode starts, so readers never download the
 * widget dialog, the source catalogue, the view editor or the filter dialog.
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import type { DisplayModeRenderers } from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/src/components/ui/yayaw-table/types/translations";
import type { DashboardBlockRegistry } from "./dashboard-block";
import { AddFilterDialog } from "./dashboard-dialogs";
import {
  type DashboardEditorRequest,
  dashboardSectionName,
  dashboardSectionWidgetIds,
  dashboardViewEditStart,
  removeDashboardSection,
  setDashboardWidgetView,
  updateDashboardWidget,
} from "./dashboard-editor-model";
import { tableInfo } from "./dashboard-hooks";
import {
  addDashboardFilter,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  dashboardWidgetSize,
} from "./dashboard-model";
import {
  addDashboardWidget,
  type Dashboard,
  type DashboardWidget,
} from "./dashboard-schema";
import type { DashboardSourceLoader } from "./dashboard-sources";
import { DashboardViewEditor } from "./dashboard-view-editor";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-widget";
import { DashboardWidgetDialog } from "./dashboard-widget-dialog";

export interface DashboardEditorLayerProps {
  request: DashboardEditorRequest | null;
  onClose: () => void;
  dashboard: Dashboard;
  update: (change: (current: Dashboard) => Dashboard) => void;
  announce: (message: string) => void;
  loader: DashboardSourceLoader<DashboardTableSource>;
  /** Saved views of the sources loaded, by source. */
  views: Record<string, DashboardView[] | undefined>;
  /** The sources the screen's widgets read: what a new filter can target. */
  filterTables: Record<string, DashboardTableInfo>;
  blocks?: DashboardBlockRegistry;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  renderers?: DisplayModeRenderers;
  getRowId?: (row: Record<string, unknown>) => string;
  tableTranslations?: DataTableTranslations;
  titleOf: (widget: DashboardWidget) => string;
}

const sourceOf = (
  loader: DashboardSourceLoader<DashboardTableSource>,
  id: string | undefined
): DashboardTableSource | undefined => {
  const state = id ? loader.state(id) : undefined;
  return state?.status === "ready" ? state.source : undefined;
};

/** "Remove Overview?": asked before a section and its widgets go. */
function RemoveSectionDialog({
  dashboard,
  label,
  locale,
  onClose,
  onRemove,
  sectionId,
  translate,
}: {
  dashboard: Dashboard;
  label: DashboardLabel;
  locale: string;
  onClose: () => void;
  onRemove: (name: string) => void;
  sectionId?: string;
  translate: DashboardTranslate;
}) {
  const section = dashboard.sections.find((item) => item.id === sectionId);
  const count = section ? dashboardSectionWidgetIds(section).length : 0;
  const name = sectionId
    ? dashboardSectionName(dashboard, sectionId, locale, translate)
    : "";
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={Boolean(section)}
    >
      <AlertDialogContent data-dashboard-dialog="remove-section">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {label("removeSectionTitle", { title: name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {count === 1
              ? label("removeSectionOne")
              : label("removeSectionMany", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {label("cancel")}
          </Button>
          <Button
            onClick={() => onRemove(name)}
            type="button"
            variant="destructive"
          >
            {label("remove")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The editor's dialogs: the widget dialog, the view editor, a new filter, removing a section. */
export function DashboardEditorLayer({
  announce,
  blocks,
  dashboard,
  filterTables,
  getRowId,
  label,
  loader,
  locale,
  onClose,
  renderers,
  request,
  tableTranslations,
  titleOf,
  translate,
  update,
  views,
}: DashboardEditorLayerProps) {
  const widget =
    request?.kind === "editWidget" || request?.kind === "editView"
      ? dashboard.widgets.find((item) => item.id === request.widgetId)
      : undefined;
  const addTo =
    request?.kind === "addWidget"
      ? dashboard.sections.find((section) => section.id === request.sectionId)
      : undefined;
  const widgetDialog =
    request?.kind === "addWidget" || (request?.kind === "editWidget" && widget);
  const viewSource =
    request?.kind === "editView" && widget
      ? sourceOf(loader, widget.tableId)
      : undefined;
  const savedView =
    widget?.viewId && !widget.view
      ? views[widget.tableId ?? ""]?.find((view) => view.id === widget.viewId)
      : undefined;
  return (
    <>
      {widgetDialog ? (
        <DashboardWidgetDialog
          blocks={blocks}
          getRowId={getRowId}
          label={label}
          loader={loader}
          locale={locale}
          onOpenChange={(open) => {
            if (!open) {
              onClose();
            }
          }}
          onSubmit={(next, sourceViews) => {
            if (widget) {
              update((current) =>
                updateDashboardWidget(current, widget.id, next, blocks)
              );
              return;
            }
            const source = sourceOf(loader, next.tableId);
            const block =
              next.block && blocks && Object.hasOwn(blocks, next.block)
                ? blocks[next.block]
                : undefined;
            update((current) =>
              addDashboardWidget(current, next, {
                ...(addTo ? { sectionId: addTo.id } : {}),
                size: dashboardWidgetSize(next, {
                  views: sourceViews,
                  table: source && next.tableId ? tableInfo(next.tableId, source) : undefined,
                  block,
                }),
                ...(blocks ? { blocks } : {}),
              })
            );
          }}
          open
          renderers={renderers}
          tableTranslations={tableTranslations}
          target={
            widget
              ? { mode: "edit", widget }
              : { mode: "add", sectionId: addTo?.id, sectionType: addTo?.type }
          }
          translate={translate}
        />
      ) : null}
      {viewSource && widget?.tableId ? (
        <DashboardViewEditor
          getRowId={getRowId}
          label={label}
          locale={locale}
          onApply={(view) =>
            update((current) =>
              setDashboardWidgetView(current, widget.id, view, savedView?.name)
            )
          }
          onClose={onClose}
          open
          renderers={renderers}
          source={viewSource}
          sourceId={widget.tableId}
          start={dashboardViewEditStart(widget, savedView)}
          subtitle={titleOf(widget)}
          translations={tableTranslations}
        />
      ) : null}
      <AddFilterDialog
        label={label}
        onAdd={(filter) => update((current) => addDashboardFilter(current, filter))}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        open={request?.kind === "addFilter"}
        tables={filterTables}
      />
      <RemoveSectionDialog
        dashboard={dashboard}
        label={label}
        locale={locale}
        onClose={onClose}
        onRemove={(name) => {
          if (request?.kind === "removeSection") {
            update((current) =>
              removeDashboardSection(current, request.sectionId)
            );
            announce(label("sectionRemoved", { title: name }));
          }
          onClose();
        }}
        sectionId={request?.kind === "removeSection" ? request.sectionId : undefined}
        translate={translate}
      />
    </>
  );
}
