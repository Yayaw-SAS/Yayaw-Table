// biome-ignore-all lint/a11y/useSemanticElements: the WAI-ARIA treegrid pattern is built from div rows and cells; table elements cannot hold a tree with windowed rows.
// biome-ignore-all lint/a11y/useFocusableInteractive: rows carry the roving tabindex; cells, headers and status rows are not tab stops in a row-focus treegrid.
// biome-ignore-all lint/a11y/useKeyWithClickEvents: rows receive their keys from the treegrid's delegated keydown handler.
"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Eye,
  FolderInput,
  FolderPlus,
  FolderTree,
  Info,
  type LucideIcon,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useIsMobile } from "../hooks/use-mobile";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import {
  FileTreeController,
  type FileTreeControllerOptions,
  type FileTreeEvents,
  type FileTreeMenuKey,
  type FileTreeNotification,
  type FileTreeState,
} from "../utils/filetree-controller";
import {
  attachFileTreeDrag,
  attachFileTreeFileDrop,
  FILETREE_DETAILS_DEFAULT,
} from "../utils/filetree-dom";
import {
  FILETREE_ROOT_TARGET,
  FILETREE_ROW_ATTRIBUTE,
  FILETREE_ROW_HEIGHT,
  FILETREE_UNFILED,
  FILETREE_WINDOW_THRESHOLD,
  type FileTreeColumn,
  type FileTreeHooks,
  type FileTreeNodeRow,
  type FileTreeViewSettings,
  fileTreeDropMark,
  fileTreeGridColumns,
  fileTreeIcon,
  fileTreeLabel,
  fileTreeScrollTo,
  fileTreeSummary,
  fileTreeWindow,
  formatFileTreeValue,
  indentLevel,
  readFileTreeFolderParam,
  type ResolvedFileTreeSettings,
  resolveFileTreeSettings,
  writeFileTreeFolderParam,
} from "../utils/filetree-model";
import { resolveGalleryMedia } from "../utils/media-contract";
import {
  attachMediaThumbnail,
  mediaViewerLabels,
  openMediaViewer,
} from "../utils/media-viewer";
import "../utils/filetree.css";
import "../utils/media-viewer.css";
import {
  FileTreeCloseButton,
  FileTreeDeleteDialog,
  FileTreeIconView,
  FileTreeMoveDialog,
  FileTreeName,
  FileTreeNameInput,
  FileTreeResizeHandle,
  FileTreeStatusRow,
  type Label,
} from "./filetree-parts";

type Row = Record<string, unknown>;
type Context = DisplayModeRenderContext;

const MENU_ICONS: Record<FileTreeMenuKey, LucideIcon> = {
  info: Info,
  preview: Eye,
  open: ExternalLink,
  rename: Pencil,
  move: FolderInput,
  "new-folder": FolderPlus,
  delete: Trash2,
};

const cssEscape = (value: string) =>
  typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value;

function notify(notification: FileTreeNotification) {
  const { message, type, undo, undoLabel } = notification;
  if (type === "error") {
    toast.error(message);
    return;
  }
  const action = undo ? { label: undoLabel ?? "Undo", onClick: undo } : undefined;
  if (type === "info") {
    toast.info(message, { action });
    return;
  }
  toast.success(message, { action });
}

interface ViewModel {
  context: Context;
  settings: ResolvedFileTreeSettings;
  hooks: FileTreeHooks<ReactNode>;
  query: string;
}

function useFileTreeSettings(context: Context): ViewModel {
  const { columns, defaults, listParams } = context;
  const settings = useMemo(
    () =>
      resolveFileTreeSettings(
        columns as FileTreeColumn[],
        defaults as FileTreeViewSettings,
        context.settings as FileTreeViewSettings
      ),
    [columns, defaults, context.settings]
  );
  const hooks = defaults as FileTreeHooks<ReactNode>;
  const query = String(listParams.search ?? "");
  return { context, settings, hooks, query };
}

function controllerOptions(
  model: ViewModel,
  events: FileTreeEvents
): FileTreeControllerOptions {
  const { context, hooks, settings } = model;
  return {
    list: context.list as FileTreeControllerOptions["list"],
    rows: context.rows,
    params: context.listParams,
    settings: {
      ...settings,
      rootLabel: settings.rootLabel ?? context.title,
    },
    hooks,
    getRowId: context.getRowId,
    tree: context.tree,
    patchRow: context.patchRow,
    createRecord: async (values) => {
      const result = await context.createRecord(values);
      return { success: result.ok === true, error: result.ok ? undefined : result.message };
    },
    deleteRow: context.deleteRow,
    canEditRow: context.canEditRow,
    canDeleteRow: context.canDeleteRow,
    canCreate: context.canCreate,
    multiple: context.selection.multiple,
    locale: context.locale,
    translate: (key, fallback) => context.translate(`filetree.${key}`, fallback),
    revision: context.revision,
    events,
  };
}

interface ViewActions {
  openFile: (row: Row) => void;
  focusRow: (id: string) => void;
  setMenuId: (id: string | undefined) => void;
  setDeleteIds: (ids: string[] | undefined) => void;
}

/** One controller per view; its events reach the latest React state through a ref. */
function useFileTreeController(model: ViewModel, actions: ViewActions) {
  const latest = useRef({ model, actions });
  latest.current = { model, actions };
  const events = useMemo<FileTreeEvents>(
    () => ({
      open: (row) => latest.current.actions.openFile(row),
      notify,
      focus: (id) => latest.current.actions.focusRow(id),
      persist: (state) => {
        const { context } = latest.current.model;
        context.updateSettings({ ...context.settings, ...state });
      },
      folder: (id) => {
        const { context } = latest.current.model;
        if (context.syncUrl) {
          writeFileTreeFolderParam(context.tableId, id);
        }
      },
      requestDelete: (ids) => latest.current.actions.setDeleteIds(ids),
      menu: (id) => latest.current.actions.setMenuId(id),
      refresh: () => latest.current.model.context.refresh(),
    }),
    []
  );
  const [controller] = useState(
    () => new FileTreeController(controllerOptions(model, events))
  );
  useEffect(() => {
    controller.setOptions(controllerOptions(latest.current.model, events));
  });
  useEffect(() => {
    const { context } = latest.current.model;
    controller.start(
      context.syncUrl ? readFileTreeFolderParam(context.tableId) : undefined
    );
    return () => controller.dispose();
  }, [controller]);
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );
  return { controller, state };
}

function mediaOf(context: Context, row: Row) {
  return context.media?.enabled
    ? resolveGalleryMedia(row, context.media, context.imageColumn)
    : undefined;
}

/** Media files open in the viewer with their siblings; other records open like a row click. */
function useOpenFile(
  context: Context,
  controllerRef: { current?: FileTreeController },
  settings: ResolvedFileTreeSettings,
  showDetails: (id: string) => void
) {
  const viewer = useRef<ReturnType<typeof openMediaViewer>>(undefined);
  useEffect(() => () => viewer.current?.destroy(), []);
  return useCallback(
    (row: Row) => {
      const controller = controllerRef.current;
      if (!(controller && mediaOf(context, row))) {
        context.openRow(row);
        return;
      }
      const state = controller.getState();
      const files = state.rows
        .filter((item): item is FileTreeNodeRow => item.type === "node" && !item.folder)
        .flatMap((item) => {
          const record = controller.row(item.id);
          return record && mediaOf(context, record) ? [record] : [];
        });
      const items = files.includes(row) ? files : [row, ...files];
      const active = document.activeElement;
      viewer.current?.destroy();
      viewer.current = openMediaViewer({
        items: items.map((item) => ({
          id: context.getRowId(item),
          title: String(item[settings.nameColumn] ?? ""),
          source: mediaOf(context, item),
        })),
        index: items.indexOf(row),
        labels: mediaViewerLabels(context.locale),
        returnFocus: active instanceof HTMLElement ? active : undefined,
        onInfo: showDetails,
      });
    },
    [context, controllerRef, settings.nameColumn, showDetails]
  );
}

/** File tree display mode: folders and files as a tree table, with a details pane. */
export function FileTreeView({ context }: { context: Context }) {
  const model = useFileTreeSettings(context);
  const { settings, hooks, query } = model;
  const isPhone = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<FileTreeController>(undefined);
  const [menuId, setMenuId] = useState<string>();
  const [deleteIds, setDeleteIds] = useState<string[]>();
  const [moveIds, setMoveIds] = useState<string[]>();
  const [pendingFocus, setPendingFocus] = useState<{ id: string }>();
  const [detailsWidth, setDetailsWidth] = useState(FILETREE_DETAILS_DEFAULT);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);
  const label: Label = useCallback(
    (key, params) =>
      fileTreeLabel(
        key,
        context.locale,
        (name, fallback) => context.translate(`filetree.${name}`, fallback),
        params
      ),
    [context]
  );
  const showDetails = useCallback(
    (id: string) => {
      controllerRef.current?.focus(id);
      if (!settings.showDetails) {
        context.updateSettings({ ...context.settings, showDetails: true });
      }
    },
    [context, settings.showDetails]
  );
  const openFile = useOpenFile(context, controllerRef, settings, showDetails);
  const { controller, state } = useFileTreeController(model, {
    openFile,
    focusRow: (id) => setPendingFocus({ id }),
    setMenuId,
    setDeleteIds,
  });
  controllerRef.current = controller;
  useEffect(() => controller.setPhone(isPhone), [controller, isPhone]);

  const windowed = state.rows.length > FILETREE_WINDOW_THRESHOLD;
  const range = windowed
    ? fileTreeWindow({
        count: state.rows.length,
        rowHeight: FILETREE_ROW_HEIGHT,
        scrollTop,
        viewport,
      })
    : { start: 0, end: state.rows.length, before: 0, after: 0 };

  useLayoutEffect(() => {
    if (!pendingFocus) {
      return;
    }
    const index = state.rows.findIndex((row) => row.id === pendingFocus.id);
    const scroller = scrollRef.current;
    if (windowed && scroller && index >= 0) {
      const next = fileTreeScrollTo(index, FILETREE_ROW_HEIGHT, scroller.scrollTop, scroller.clientHeight);
      if (next !== scroller.scrollTop) {
        scroller.scrollTop = next;
        setScrollTop(next);
        return;
      }
    }
    const element = rootRef.current?.querySelector<HTMLElement>(
      `[role="row"][${FILETREE_ROW_ATTRIBUTE}="${cssEscape(pendingFocus.id)}"]`
    );
    element?.focus({ preventScroll: windowed });
    if (!windowed) {
      element?.scrollIntoView?.({ block: "nearest" });
    }
    setPendingFocus(undefined);
  }, [pendingFocus, state.rows, windowed]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const cleanDrag = attachFileTreeDrag(root, controller, () => !isPhone);
    const cleanDrop = attachFileTreeFileDrop(root, controller, () => Boolean(hooks.onDropFiles));
    return () => {
      cleanDrag();
      cleanDrop();
    };
  }, [controller, hooks.onDropFiles, isPhone]);

  // The viewport height matters once the list is windowed.
  useEffect(() => {
    if (windowed) {
      setViewport(scrollRef.current?.clientHeight || 600);
    }
  }, [windowed]);

  const onMenu = (key: FileTreeMenuKey, id: string) => {
    const row = controller.row(id);
    const handlers: Record<FileTreeMenuKey, () => void> = {
      info: () => showDetails(id),
      preview: () => row && openFile(row),
      open: () => row && context.openRow(row),
      rename: () => controller.startRename(id),
      move: () => setMoveIds(controller.actionIds(id)),
      "new-folder": () => controller.startCreateFolder(id),
      delete: () => controller.requestDelete(id),
    };
    handlers[key]();
  };

  const selectable = context.selection.enabled;
  const columns = settings.columns
    .map((id) => context.columns.find((column) => column.id === id))
    .filter((column): column is NonNullable<typeof column> => Boolean(column));
  const grid = fileTreeGridColumns(columns.length, selectable);
  const detailsOpen = settings.showDetails && !isPhone;
  const style = {
    "--ft-columns": grid.full,
    "--ft-columns-compact": grid.compact,
    "--ft-details-width": `${detailsWidth}px`,
  } as CSSProperties;

  return (
    <div
      className="yayaw-ft"
      data-phone={isPhone}
      data-selecting={state.selection.size > 0}
      ref={rootRef}
      style={style}
    >
      <FileTreeHeader
        context={context}
        controller={controller}
        detailsOpen={detailsOpen}
        label={label}
        settings={settings}
        state={state}
      />
      {state.notice ? (
        <div className="yayaw-ft-notice" role="status">
          {state.notice}
        </div>
      ) : null}
      {state.uploads.size ? (
        <div className="yayaw-ft-notice" role="status">
          {label("uploading", {
            count: [...state.uploads.values()].reduce((sum, count) => sum + count, 0),
          })}
        </div>
      ) : null}
      <div className="yayaw-ft-body" data-details={detailsOpen}>
        <div className="yayaw-ft-card">
          <div
            className="yayaw-ft-scroll"
            data-windowed={windowed}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            ref={scrollRef}
          >
            <FileTreeGrid
              columns={columns}
              context={context}
              controller={controller}
              label={label}
              menuId={menuId}
              onMenu={onMenu}
              query={query}
              range={range}
              selectable={selectable}
              setMenuId={setMenuId}
              settings={settings}
              state={state}
            />
          </div>
        </div>
        {detailsOpen ? (
          <FileTreeDetails
            columns={columns}
            context={context}
            controller={controller}
            hooks={hooks}
            label={label}
            onClose={() =>
              context.updateSettings({ ...context.settings, showDetails: false })
            }
            onMenu={onMenu}
            onWidth={setDetailsWidth}
            openFile={openFile}
            settings={settings}
            state={state}
            width={detailsWidth}
          />
        ) : null}
      </div>
      <FileTreeSelectionBar
        controller={controller}
        label={label}
        onMove={setMoveIds}
        state={state}
      />
      <div aria-live="polite" className="yayaw-ft-sr">
        {state.announcement}
      </div>
      {moveIds ? (
        <FileTreeMoveDialog
          controller={controller}
          ids={moveIds}
          label={label}
          onClose={() => setMoveIds(undefined)}
          version={state.version}
        />
      ) : null}
      {deleteIds ? (
        <FileTreeDeleteDialog
          controller={controller}
          ids={deleteIds}
          label={label}
          onClose={() => setDeleteIds(undefined)}
        />
      ) : null}
    </div>
  );
}

function FileTreeHeader({
  context,
  controller,
  detailsOpen,
  label,
  settings,
  state,
}: {
  context: Context;
  controller: FileTreeController;
  detailsOpen: boolean;
  label: Label;
  settings: ResolvedFileTreeSettings;
  state: FileTreeState;
}) {
  const rootLabel = controller.rootLabel();
  const drop = fileTreeDropMark(FILETREE_ROOT_TARGET, state.drag);
  const back = state.phone && state.drillId !== null;
  return (
    <>
      <div className="yayaw-ft-header">
        <div
          className="yayaw-ft-heading"
          data-filetree-id={FILETREE_ROOT_TARGET}
          data-ft-drop={drop}
        >
          <h3 className="yayaw-ft-title">
            {back ? (
              <button
                aria-label={label("back")}
                className="yayaw-ft-icon-button"
                onClick={() => controller.back()}
                title={label("back")}
                type="button"
              >
                <ArrowLeft aria-hidden="true" />
              </button>
            ) : (
              <FolderTree aria-hidden="true" className="size-4" />
            )}
            {rootLabel}
          </h3>
          <p className="yayaw-ft-summary">
            {fileTreeSummary(state.summary, context.locale, (key, fallback) =>
              context.translate(`filetree.${key}`, fallback)
            )}
          </p>
        </div>
        <div className="yayaw-ft-actions">
          <button
            className="yayaw-ft-button"
            disabled={!controller.canCreateFolderIn(controller.newFolderParent()) || state.busy}
            onClick={() => controller.startCreateFolder()}
            type="button"
          >
            <FolderPlus aria-hidden="true" />
            {label("newFolder")}
          </button>
          {state.phone ? null : (
            <>
              <button
                aria-keyshortcuts="Alt+Shift+ArrowDown"
                className="yayaw-ft-button"
                disabled={!state.canExpandAll || state.expanding}
                onClick={() => {
                  controller.expandAll().catch(() => undefined);
                }}
                type="button"
              >
                <ChevronsUpDown aria-hidden="true" />
                {label("expandAll")}
              </button>
              <button
                aria-keyshortcuts="Alt+Shift+ArrowUp"
                className="yayaw-ft-button"
                disabled={!state.canCollapseAll}
                onClick={() => controller.collapseAll()}
                type="button"
              >
                <ChevronsDownUp aria-hidden="true" />
                {label("collapseAll")}
              </button>
              <button
                aria-pressed={detailsOpen}
                className="yayaw-ft-button"
                onClick={() =>
                  context.updateSettings({
                    ...context.settings,
                    showDetails: !settings.showDetails,
                  })
                }
                type="button"
              >
                <PanelRight aria-hidden="true" />
                {label("details")}
              </button>
            </>
          )}
        </div>
      </div>
      <nav aria-label={label("path")} className="yayaw-ft-crumbs">
        <ol>
          {state.crumbs.map((crumb, index) => {
            const last = index === state.crumbs.length - 1;
            return (
              <li key={crumb.id ?? "__root"}>
                <button
                  aria-current={last ? "page" : undefined}
                  onClick={() => {
                    if (state.phone) {
                      controller.drill(crumb.id);
                    } else if (crumb.id) {
                      controller.focus(crumb.id);
                    } else {
                      const first = state.rows.find((row) => row.type === "node");
                      if (first) {
                        controller.focus(first.id);
                      }
                    }
                  }}
                  type="button"
                >
                  {crumb.name}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

function FileTreeSelectionBar({
  controller,
  label,
  onMove,
  state,
}: {
  controller: FileTreeController;
  label: Label;
  onMove: (ids: string[]) => void;
  state: FileTreeState;
}) {
  if (!state.selection.size) {
    return null;
  }
  const ids = [...state.selection];
  return (
    <div className="yayaw-ft-selection">
      <strong>{label("selected", { count: ids.length })}</strong>
      {controller.canMoveIds(ids) ? (
        <button className="yayaw-ft-button" onClick={() => onMove(ids)} type="button">
          <FolderInput aria-hidden="true" />
          {label("moveTo")}
        </button>
      ) : null}
      {controller.canDelete(ids) ? (
        <button
          className="yayaw-ft-button"
          onClick={() => controller.requestDelete()}
          type="button"
        >
          <Trash2 aria-hidden="true" />
          {label("delete")}
        </button>
      ) : null}
      <button
        className="yayaw-ft-button"
        onClick={() => controller.clearSelection()}
        type="button"
      >
        {label("clearSelection")}
      </button>
    </div>
  );
}

interface GridProps {
  columns: Context["columns"];
  context: Context;
  controller: FileTreeController;
  label: Label;
  menuId?: string;
  onMenu: (key: FileTreeMenuKey, id: string) => void;
  query: string;
  range: { start: number; end: number; before: number; after: number };
  selectable: boolean;
  setMenuId: (id: string | undefined) => void;
  settings: ResolvedFileTreeSettings;
  state: FileTreeState;
}

function FileTreeGrid(props: GridProps) {
  const { context, controller, label, range, state } = props;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") !== "row") {
      return;
    }
    if (controller.keydown(event)) {
      event.preventDefault();
    }
  };
  if (state.status === "error") {
    return (
      <div className="yayaw-ft-empty" role="alert">
        {state.error}
      </div>
    );
  }
  const empty =
    state.status === "ready" &&
    state.rows.every((row) => row.type !== "node" && row.type !== "loading" && row.type !== "draft");
  return (
    <div
      aria-busy={state.status === "loading"}
      aria-label={controller.rootLabel()}
      aria-multiselectable={context.selection.multiple}
      className="yayaw-ft-grid"
      onKeyDown={onKeyDown}
      role="treegrid"
    >
      <FileTreeHeadRow {...props} />
      {empty ? (
        <div className="yayaw-ft-empty" role="row">
          <span role="gridcell">{state.searching ? label("noMatches") : label("empty")}</span>
        </div>
      ) : null}
      {range.before ? <div aria-hidden="true" style={{ height: range.before }} /> : null}
      {state.rows.slice(range.start, range.end).map((row) =>
        row.type === "node" ? (
          <FileTreeRow key={row.id} {...props} row={row} />
        ) : (
          <FileTreeStatusRow controller={controller} key={row.id} label={label} row={row} />
        )
      )}
      {range.after ? <div aria-hidden="true" style={{ height: range.after }} /> : null}
    </div>
  );
}

function FileTreeHeadRow({
  columns,
  context,
  controller,
  label,
  selectable,
  settings,
  state,
}: GridProps) {
  const nodes = state.rows.filter((row) => row.type === "node" && row.id !== FILETREE_UNFILED);
  const all = nodes.length > 0 && nodes.every((row) => state.selection.has(row.id));
  const sort = settings.sort;
  const toggleSort = (id: string) => {
    const next =
      sort?.id === id
        ? { id, desc: !sort.desc }
        : { id, desc: false };
    context.updateSettings({ ...context.settings, sort: next });
  };
  const sortCell = (id: string, text: string, align?: "end") => {
    const active = sort?.id === id || (!sort && id === settings.nameColumn);
    const desc = active && Boolean(sort?.desc);
    let ariaSort: "ascending" | "descending" | undefined;
    if (active) {
      ariaSort = desc ? "descending" : "ascending";
    }
    const Arrow = desc ? ArrowDown : ArrowUp;
    return (
      <div
        aria-sort={ariaSort}
        className="yayaw-ft-cell"
        data-align={align}
        data-optional={id === settings.nameColumn ? undefined : true}
        key={id}
        role="columnheader"
      >
        <button
          aria-label={label("sortBy", { name: text })}
          className="yayaw-ft-sort"
          onClick={() => toggleSort(id)}
          tabIndex={-1}
          type="button"
        >
          {text}
          {active ? <Arrow aria-hidden="true" /> : null}
        </button>
      </div>
    );
  };
  return (
    <div className="yayaw-ft-row yayaw-ft-head" role="row">
      {selectable ? (
        <div className="yayaw-ft-cell yayaw-ft-check" role="columnheader">
          <Checkbox
            aria-label={label("selectAll")}
            checked={all}
            disabled={!(context.selection.multiple && nodes.length)}
            onCheckedChange={(checked) =>
              checked ? controller.selectAll() : controller.clearSelection()
            }
            tabIndex={-1}
          />
        </div>
      ) : null}
      {sortCell(settings.nameColumn, label("name"))}
      {columns.map((column) =>
        sortCell(
          column.id,
          column.header ?? column.id,
          column.id === settings.sizeColumn || column.type === "number" ? "end" : undefined
        )
      )}
      <div className="yayaw-ft-cell yayaw-ft-menu" role="columnheader">
        <span className="yayaw-ft-sr">{label("actions")}</span>
      </div>
    </div>
  );
}

function cellText(
  controller: FileTreeController,
  context: Context,
  settings: ResolvedFileTreeSettings,
  column: Context["columns"][number],
  row: FileTreeNodeRow
): string {
  if (row.id === FILETREE_UNFILED) {
    return "--";
  }
  return formatFileTreeValue(controller.row(row.id)?.[column.id], column as FileTreeColumn, {
    locale: context.locale,
    settings,
    folder: row.folder,
    folderSize: controller.folderSize(row.id),
  });
}

type RowProps = GridProps & { row: FileTreeNodeRow };

function rowIcon({ context, controller, row, settings }: RowProps) {
  if (row.id === FILETREE_UNFILED) {
    return { kind: row.expanded ? ("folder-open" as const) : ("folder" as const) };
  }
  return fileTreeIcon(controller.row(row.id) ?? {}, {
    folder: row.folder,
    expanded: row.expanded,
    nameColumn: settings.nameColumn,
    media: context.media,
    imageColumn: context.imageColumn,
    getIcon: (context.defaults as FileTreeHooks).getIcon,
  });
}

function FileTreeRowCheck({ controller, label, row, state }: RowProps) {
  const shiftRef = useRef(false);
  return (
    <div
      className="yayaw-ft-cell yayaw-ft-check"
      onClickCapture={(event) => {
        shiftRef.current = event.shiftKey;
      }}
      role="gridcell"
    >
      {row.id === FILETREE_UNFILED ? null : (
        <Checkbox
          aria-label={`${label("selectRow")} ${row.name}`}
          checked={state.selection.has(row.id)}
          onCheckedChange={() => {
            controller.toggleSelected(row.id, shiftRef.current);
            shiftRef.current = false;
          }}
          onClick={(event) => event.stopPropagation()}
          tabIndex={-1}
        />
      )}
    </div>
  );
}

function FileTreeRowName(props: RowProps) {
  const { controller, label, query, row, state } = props;
  const count =
    !state.searching && row.folder && row.childCount ? row.childCount : undefined;
  const expandable = row.folder && row.hasChildren && !state.phone;
  return (
    <div className="yayaw-ft-cell yayaw-ft-name" role="gridcell">
      {expandable ? (
        <button
          aria-label={label(row.expanded ? "collapse" : "expand")}
          className="yayaw-ft-toggle"
          data-expanded={row.expanded}
          onClick={(event) => {
            event.stopPropagation();
            controller.toggle(row.id);
          }}
          tabIndex={-1}
          type="button"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      ) : (
        <span className="yayaw-ft-spacer" />
      )}
      <FileTreeIconView icon={rowIcon(props)} />
      {state.renamingId === row.id ? (
        <FileTreeNameInput
          error={state.renameError}
          initial={row.name}
          label={label("rename")}
          onCancel={() => controller.cancelRename()}
          onCommit={(value) => {
            controller.commitRename(value).catch(() => undefined);
          }}
        />
      ) : (
        <FileTreeName
          name={row.name}
          query={state.matches.has(row.id) ? query : ""}
        />
      )}
      {count ? <span className="yayaw-ft-count">{count}</span> : null}
    </div>
  );
}

function FileTreeRowMenu({
  context,
  controller,
  label,
  menuId,
  onMenu,
  row,
  setMenuId,
}: RowProps) {
  const record = controller.row(row.id);
  const menu = controller.menuItems(row.id, {
    preview: Boolean(record && mediaOf(context, record)),
  });
  return (
    <div className="yayaw-ft-cell yayaw-ft-menu" role="gridcell">
      {menu.length ? (
        <DropdownMenu
          onOpenChange={(open) => setMenuId(open ? row.id : undefined)}
          open={menuId === row.id}
        >
          <DropdownMenuTrigger
            render={
              <button
                aria-label={label("actions")}
                className="yayaw-ft-icon-button"
                onClick={(event) => event.stopPropagation()}
                tabIndex={-1}
                type="button"
              >
                <MoreHorizontal aria-hidden="true" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-44">
            {menu.map((item) => {
              const Icon = MENU_ICONS[item.key];
              return (
                <FileTreeMenuEntry danger={item.danger} key={item.key}>
                  <DropdownMenuItem
                    className={item.danger ? "yayaw-ft-menu-item-danger" : undefined}
                    onClick={() => onMenu(item.key, row.id)}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                </FileTreeMenuEntry>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function FileTreeRow(props: RowProps) {
  const { columns, context, controller, row, selectable, settings, state } = props;
  const firstNode = state.rows.find((item) => item.type === "node")?.id;
  const focused = (state.focusedId ?? firstNode) === row.id;
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    controller.click(row.id, event);
    if (state.phone) {
      controller.activate(row.id);
    }
  };
  return (
    <div
      aria-expanded={row.folder && row.hasChildren ? row.expanded : undefined}
      aria-label={row.name}
      aria-level={row.level}
      aria-posinset={row.posinset}
      aria-selected={state.selection.has(row.id)}
      aria-setsize={row.setsize}
      className="yayaw-ft-row"
      data-cut={state.cut.has(row.id) || undefined}
      data-dragging={state.drag?.ids.includes(row.id) || undefined}
      data-filetree-id={row.id}
      data-folder={row.folder}
      data-ft-drop={fileTreeDropMark(row.id, state.drag)}
      data-match={state.matches.has(row.id) || undefined}
      onClick={onClick}
      onDoubleClick={() => {
        if (!state.phone) {
          controller.activate(row.id);
        }
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) {
          controller.setFocused(row.id);
        }
      }}
      role="row"
      style={{ "--ft-level": indentLevel(row.level) } as CSSProperties}
      tabIndex={focused ? 0 : -1}
    >
      {selectable ? <FileTreeRowCheck {...props} /> : null}
      <FileTreeRowName {...props} />
      {columns.map((column) => (
        <div
          className="yayaw-ft-cell"
          data-align={
            column.id === settings.sizeColumn || column.type === "number"
              ? "end"
              : undefined
          }
          data-muted={column.id === settings.updatedColumn || undefined}
          data-optional
          key={column.id}
          role="gridcell"
        >
          {cellText(controller, context, settings, column, row)}
        </div>
      ))}
      <FileTreeRowMenu {...props} />
    </div>
  );
}

function FileTreeMenuEntry({ children, danger }: { children: ReactNode; danger: boolean }) {
  return (
    <>
      {danger ? <DropdownMenuSeparator /> : null}
      {children}
    </>
  );
}

function FileTreeDetails({
  columns,
  context,
  controller,
  hooks,
  label,
  onClose,
  onMenu,
  onWidth,
  openFile,
  settings,
  state,
  width,
}: {
  columns: Context["columns"];
  context: Context;
  controller: FileTreeController;
  hooks: FileTreeHooks<ReactNode>;
  label: Label;
  onClose: () => void;
  onMenu: (key: FileTreeMenuKey, id: string) => void;
  onWidth: (width: number) => void;
  openFile: (row: Row) => void;
  settings: ResolvedFileTreeSettings;
  state: FileTreeState;
  width: number;
}) {
  const id = state.focusedId;
  const row = id ? state.rows.find((item): item is FileTreeNodeRow => item.type === "node" && item.id === id) : undefined;
  const record = row && row.id !== FILETREE_UNFILED ? controller.row(row.id) : undefined;
  return (
    <aside aria-label={label("details")} className="yayaw-ft-details">
      <FileTreeResizeHandle label={label("resizeDetails")} onWidth={onWidth} width={width} />
      <header>
        <h3>{row && record ? row.name : label("details")}</h3>
        <FileTreeCloseButton label={label("hideDetails")} onClick={onClose} />
      </header>
      {row && record ? (
        <FileTreeDetailsBody
          columns={columns}
          context={context}
          controller={controller}
          hooks={hooks}
          label={label}
          onMenu={onMenu}
          openFile={openFile}
          record={record}
          row={row}
          settings={settings}
        />
      ) : (
        <p className="yayaw-ft-summary">{label("noSelection")}</p>
      )}
    </aside>
  );
}

function FileTreePreview({
  context,
  icon,
  label,
  openFile,
  record,
  title,
}: {
  context: Context;
  icon: ReturnType<typeof fileTreeIcon>;
  label: Label;
  openFile: (row: Row) => void;
  record: Row;
  title: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const source = mediaOf(context, record);
  useEffect(() => {
    const element = host.current;
    if (!(element && source)) {
      return;
    }
    return attachMediaThumbnail(element, source, title, {
      fit: "cover",
      hoverPreview: true,
      previewLabel: label("preview"),
      onOpen: () => openFile(record),
    });
  }, [label, openFile, record, source, title]);
  return (
    <div className="yayaw-ft-preview">
      {/* The thumbnail owns this element's content. */}
      <div className="yayaw-ft-thumb" ref={host} />
      {source ? null : <FileTreeIconView icon={icon} />}
    </div>
  );
}

function FileTreeDetailsBody({
  columns,
  context,
  controller,
  hooks,
  label,
  onMenu,
  openFile,
  record,
  row,
  settings,
}: {
  columns: Context["columns"];
  context: Context;
  controller: FileTreeController;
  hooks: FileTreeHooks<ReactNode>;
  label: Label;
  onMenu: (key: FileTreeMenuKey, id: string) => void;
  openFile: (row: Row) => void;
  record: Row;
  row: FileTreeNodeRow;
  settings: ResolvedFileTreeSettings;
}) {
  const custom = hooks.renderDetails?.(record);
  const icon = fileTreeIcon(record, {
    folder: row.folder,
    nameColumn: settings.nameColumn,
    media: context.media,
    imageColumn: context.imageColumn,
    getIcon: hooks.getIcon,
  });
  const menu = controller.menuItems(row.id, { preview: Boolean(mediaOf(context, record)) });
  const detailColumns = [
    ...columns,
    ...settings.detailFields
      .filter((field) => !settings.columns.includes(field))
      .flatMap((field) => context.columns.filter((column) => column.id === field)),
  ];
  const format = (column: Context["columns"][number]) =>
    formatFileTreeValue(record[column.id], column as FileTreeColumn, {
      locale: context.locale,
      settings,
      folder: row.folder,
      folderSize: controller.folderSize(row.id),
    });
  return (
    <>
      {custom ?? (
        <>
          <FileTreePreview
            context={context}
            icon={icon}
            label={label}
            openFile={openFile}
            record={record}
            title={row.name}
          />
          <dl>
            <dt>{label("type")}</dt>
            <dd>{row.folder ? label("folder") : label("file")}</dd>
            <dt>{label("path")}</dt>
            <dd>{controller.pathText(controller.parentOf(row.id) ?? null)}</dd>
            {row.folder && row.childCount !== undefined ? (
              <>
                <dt>{label("contents")}</dt>
                <dd>{row.childCount}</dd>
              </>
            ) : null}
            {detailColumns.map((column) => (
              <FileTreeDetailField key={column.id} term={column.header ?? column.id} value={format(column)} />
            ))}
          </dl>
        </>
      )}
      <div className="yayaw-ft-details-actions">
        {menu
          .filter((item) => item.key !== "info")
          .map((item) => {
            const Icon = MENU_ICONS[item.key];
            return (
              <button
                className="yayaw-ft-button"
                data-variant={item.danger ? "danger" : undefined}
                key={item.key}
                onClick={() => onMenu(item.key, row.id)}
                type="button"
              >
                <Icon aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
      </div>
    </>
  );
}

function FileTreeDetailField({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </>
  );
}
