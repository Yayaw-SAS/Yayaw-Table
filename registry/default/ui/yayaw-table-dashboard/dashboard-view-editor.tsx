"use client";

import { X } from "lucide-react";
import {
  type RefObject,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/yayaw-table/components/data-table";
import type { TableActions } from "@/components/ui/yayaw-table/providers/table-provider";
import type { DisplayModeRenderers } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import type { DataTableTranslations } from "@/components/ui/yayaw-table/types/translations";
import type { TableViewConfig } from "@/components/ui/yayaw-table/types/view-types";
import type { ViewConfig } from "@/components/ui/yayaw-table/utils/view-config";
import {
  type DashboardViewEdit,
  dashboardViewEdited,
  dashboardViewEditorActions,
  dashboardViewEditorConfig,
  dashboardViewToApply,
  recordDashboardViewReport,
} from "./dashboard-editor-model";
import type { DashboardInlineView } from "./dashboard-schema";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-widget";

export interface DashboardViewEditorProps {
  open: boolean;
  /** The source whose table is the editor. */
  source: DashboardTableSource;
  sourceId: string;
  /** Where the editor starts (`dashboardViewEditStart`). */
  start: DashboardViewEdit;
  /** Under the title: the widget or source edited. */
  subtitle: string;
  label: DashboardLabel;
  locale: string;
  renderers?: DisplayModeRenderers;
  getRowId?: (row: Record<string, unknown>) => string;
  translations?: DataTableTranslations;
  /** "Apply": the view to store in `widget.view` (`dashboardViewToApply`). */
  onApply: (view: DashboardInlineView) => void;
  onClose: () => void;
}

let sessions = 0;

/** One opening: a table of its own, started from the widget's view. */
function ViewEditorSession({
  closeRef,
  getRowId,
  label,
  locale,
  onApply,
  onClose,
  renderers,
  source,
  sourceId,
  start,
  subtitle,
  translations,
}: Omit<DashboardViewEditorProps, "open"> & {
  /** Escape and the dialog's own dismissals ask the session first. */
  closeRef: RefObject<() => void>;
}) {
  const [instanceId] = useState(() => {
    sessions += 1;
    return `view-editor-${sessions}`;
  });
  const [edit, setEdit] = useState(start);
  const [confirming, setConfirming] = useState(false);
  const descriptionId = useId();
  const edited = dashboardViewEdited(edit);
  const config = useMemo(
    () => dashboardViewEditorConfig(source.config),
    [source.config]
  );
  const actions = useMemo(
    () => dashboardViewEditorActions(source.actions) as TableActions,
    [source.actions]
  );
  const initialView = useMemo(
    () => ({ id: null, config: start.initial as TableViewConfig }),
    [start.initial]
  );
  const hostRenderers = source.tableProps?.displayModeRenderers;
  const displayModeRenderers = useMemo(
    () => ({ ...renderers, ...hostRenderers }),
    [hostRenderers, renderers]
  );
  const report = useCallback(
    (view: ViewConfig) =>
      setEdit((current) => recordDashboardViewReport(current, view)),
    []
  );
  const apply = () => {
    const view = dashboardViewToApply(edit);
    if (view) {
      onApply(view);
    }
    onClose();
  };
  const requestClose = () => {
    if (edited) {
      setConfirming(true);
    } else {
      onClose();
    }
  };
  closeRef.current = requestClose;
  return (
    <DialogContent
      aria-describedby={descriptionId}
      className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 max-lg:h-dvh max-lg:w-dvw max-lg:rounded-none max-lg:ring-0 sm:max-w-none"
      data-view-editor=""
      showCloseButton={false}
    >
      <DialogDescription className="sr-only" id={descriptionId}>
        {label("viewEditorDescription")}
      </DialogDescription>
      <header
        className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2 sm:px-4"
        data-view-editor-bar=""
      >
        <div className="min-w-0 flex-1 basis-40">
          <DialogTitle className="truncate font-medium text-base">
            {label("viewEditorTitle")}
          </DialogTitle>
          <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {edited ? (
            <span
              className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground text-xs"
              data-view-editor-status=""
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-amber-500"
              />
              {label("unsavedChanges")}
            </span>
          ) : null}
          <Button
            data-view-editor-apply=""
            disabled={!edited}
            onClick={apply}
            size="sm"
            type="button"
          >
            {label("apply")}
          </Button>
          <Button
            aria-label={label("close")}
            onClick={requestClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div
        className="min-h-0 flex-1 overflow-auto p-3 sm:p-4"
        data-view-editor-table=""
      >
        <DataTable
          displayModeRenderers={displayModeRenderers}
          getRowId={source.tableProps?.getRowId ?? getRowId}
          getTableActions={() => actions}
          getTableConfig={() => config}
          initialView={initialView}
          instanceId={instanceId}
          locale={locale}
          onViewConfigChange={report}
          tableId={instanceId}
          tableType={sourceId}
          translations={source.tableProps?.translations ?? translations}
        />
      </div>
      <AlertDialog
        onOpenChange={(next) => {
          if (!next) {
            setConfirming(false);
          }
        }}
        open={confirming}
      >
        <AlertDialogContent data-view-editor-confirm="">
          <AlertDialogHeader>
            <AlertDialogTitle>{label("discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {label("discardDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              onClick={() => setConfirming(false)}
              type="button"
              variant="outline"
            >
              {label("keepEditing")}
            </Button>
            <Button onClick={onClose} type="button" variant="destructive">
              {label("discard")}
            </Button>
            <Button onClick={apply} type="button">
              {label("applyAndClose")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  );
}

/**
 * "Edit view…": a near full-screen dialog (full screen on phones) whose live
 * table of the source is the editor: its toolbar, filters, sort, columns,
 * display modes and their settings, without URL sync, saved views, selection
 * or record changes. "Apply" stores what the table reports; closing with
 * changes asks first.
 */
export function DashboardViewEditor({
  open,
  ...props
}: DashboardViewEditorProps) {
  const requestClose = useRef<() => void>(props.onClose);
  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={(next) => {
        if (!next) {
          requestClose.current();
        }
      }}
      open={open}
    >
      {open ? <ViewEditorSession {...props} closeRef={requestClose} /> : null}
    </Dialog>
  );
}
