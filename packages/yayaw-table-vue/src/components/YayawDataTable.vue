<script setup lang="ts">
import { createPlanningSession, withPlanningActions } from "../planning/session";
import { canDeriveRowsPlanning, createRowsPlanningAdapter } from "../planning/rows-adapter";
import { planningLabels, planningLabelOverrides } from "../planning/labels";
import { planningFormatters } from "../planning/format";
import PlanningSurface from "./planning/PlanningSurface.vue";
import GanttView from "./planning/GanttView.vue";
import { createSelectionDuplicate, duplicateLabels } from "../duplicate-shortcut";
import { createActivityUndo } from "../activity-shortcuts";
import { detailUndoMessage, detailLabels } from "../record-details";
import { registerSelectionShortcuts } from "../selection-shortcuts";
import { QueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { type Component, computed, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from "vue";
import { useTableData } from "../composables/use-table-data";
import { useTableState } from "../composables/use-table-state";
import { useTagCatalogs } from "../composables/use-tag-catalogs";
import { defineTableConfig } from "../config";
import {
  type OpenFormState,
  type TableContextValue,
  tableContextKey,
} from "../context";
import { applyTableQuery } from "../core";
import { cloneFormValue } from "../form-runtime";
import { resolveInitialRowsUse } from "../initial-rows";
import { canonicalViewConfig, type ViewConfig } from "../view-config";
import { createTranslations } from "../translations";
import type {
  BulkAction,
  RowActionItem,
  BulkActionHandlerResult,
  DataTableTranslations,
  FormConfig,
  FormFieldContext,
  MaybePromise,
  SortingState,
  TableActions,
  TableConfig,
  TableRecord,
  TableView,
  TableViewConfig,
  ToolbarActionsInput,
  ToolbarActionsPlacement,
} from "../types";
import { fetchAllContractRows, TABLE_DENSITY_METRICS } from "../table-contracts";
import type { TableListParams } from "../types";
import CardPagination from "./table/CardPagination.vue";
import TableFilterBar from "./filters/TableFilterBar.vue";
import CatalogueForm from "./forms/CatalogueForm.vue";
import RecordDetails from "./details/RecordDetails.vue";
import type { DetailRevertHandler, RecordDetailsConfig } from "../record-details";
import GalleryView from "./gallery/GalleryView.vue";
import DisplayModeRendererHost from "./DisplayModeRendererHost.vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import { withFeedRenderer } from "../feed/feed-renderer";
import { withFormRenderer } from "../form/form-renderer";
import { withFileTreeRenderer } from "../filetree/filetree-renderer";
import { isFileTreeAvailable } from "../filetree-model";
import { facetsShownIn, resolveFacets } from "../facets-model";
import { folderTreeOf } from "../folder-directory";
import { createFolderDirectoryStore } from "../composables/use-folder-directory";
import FacetPanel from "./facets/FacetPanel.vue";
import { withoutDisabledModeRenderers } from "../display-modes";
import { isFormModeEnabled } from "../form-view";
import ListView from "./list/ListView.vue";
import KanbanView from "./kanban/KanbanView.vue";
import BulkActions from "./table/BulkActions.vue";
import DataGrid from "./table/DataGrid.vue";
import TableToolbar from "./toolbar/TableToolbar.vue";

const HTTP_URL_PATTERN = /^https?:\/\//;
const optionsRequest = ref<TableContextValue["optionsRequest"]["value"]>();

const props = withDefaults(
  defineProps<{
    tableType: string;
    /**
     * Views rendered by optional registry items, e.g.
     * `{ calendar: calendarRenderer }` from `yayaw-table-vue-calendar`.
     */
    displayModeRenderers?: DisplayModeRenderers;
    /** Built-in record view on row click; fields come from the columns by default, `false` turns it off. */
    details?: RecordDetailsConfig | false;
    onOpenDetails?: (row: TableRecord) => void;
    onRevertActivity?: DetailRevertHandler;
    tableId?: string;
    formType?: string;
    className?: string;
    config?: TableConfig;
    getTableConfig?: (tableType: string) => TableConfig | undefined;
    getTableActions?: (tableType: string) => TableActions | undefined;
    getFormConfig?: (
      formType: string,
      context?: FormFieldContext
    ) => FormConfig | undefined;
    data?: TableRecord[];
    /**
     * Rows shown before the first request, e.g. a server-rendered first page.
     * They stand for the table's default state (page 1 at
     * `table.defaultPageSize`, no filters or search, sorted by `columns.sort`
     * when it is set) and load again on mount unless `initialDataSort` says
     * they were produced in the sort the table starts from.
     */
    initialData?: TableRecord[];
    /**
     * The sort `initialData` was produced with. When it is `columns.sort`
     * (`[]` without one) and the table starts there, the rows are current and
     * do not load again on mount.
     */
    initialDataSort?: SortingState;
    initialRowCount?: number;
    initialPageCount?: number;
    initialViews?: TableView[];
    initialActiveViewId?: string;
    /**
     * Isolates this instance on a page with other tables: its URL keys are
     * `<instanceId>-view` and `<instanceId>-…` instead of `view` and
     * `<tableId>-…`. Config, actions and views still use the table.
     */
    instanceId?: string;
    /**
     * Settings an instance with URL sync off starts from, applied before its
     * first request: a saved view (its id becomes the active view) or a view
     * config. For tables embedded without a toolbar, e.g. dashboard widgets.
     */
    initialView?: { id?: string | null; config: TableViewConfig };
    title?: string;
    description?: string;
    locale?: string;
    translations?: DataTableTranslations;
    enableAdvancedFilters?: boolean;
    enableToolbar?: boolean;
    showFilterBar?: boolean;
    enableViews?: boolean;
    syncUrl?: boolean;
    searchDebounceMs?: number;
    rowActions?: RowActionItem[];
    customBulkActions?: BulkAction[];
    toolbarActions?: ToolbarActionsInput;
    toolbarActionsPlacement?: ToolbarActionsPlacement;
    rowSelection?: Record<string, boolean>;
    getRowId?: (row: TableRecord) => string;
    queryClient?: QueryClient;
    loadingOverlay?: Component;
    onRowClick?: (url: string, row: TableRecord, event: MouseEvent) => void;
    onBulkDelete?: (
      rows: TableRecord[]
    ) => MaybePromise<BulkActionHandlerResult>;
    onBulkEdit?: (
      rows: TableRecord[],
      /** Retained for source compatibility; application-owned callbacks are triggered without a built-in patch. */
      patch?: TableRecord
    ) => MaybePromise<BulkActionHandlerResult>;
    onBulkCopy?: (
      rows: TableRecord[]
    ) => MaybePromise<BulkActionHandlerResult>;
    onBulkExport?: (
      rows: TableRecord[]
    ) => MaybePromise<BulkActionHandlerResult>;
    onExport?: (rows: TableRecord[]) => MaybePromise<void>;
    columnTypeMapping?: Record<
      string,
      "date" | "multiSelect" | "number" | "select" | "text"
    >;
  }>(),
  {
    data: () => [],
    initialData: () => [],
    locale: "en",
    // `false` is a valid value; keep an absent prop undefined, not Vue's boolean false.
    details: undefined,
    enableAdvancedFilters: undefined,
    enableToolbar: undefined,
    showFilterBar: undefined,
    enableViews: undefined,
    syncUrl: undefined,
    customBulkActions: () => [],
    toolbarActions: undefined,
    initialViews: () => [],
  }
);

const emit = defineEmits<{
  rowActivate: [row: TableRecord, event: MouseEvent];
  rowSelectionChange: [selection: Record<string, boolean>];
  /**
   * `view-config-change`: the view the table shows, as a saved view's `config`
   * (the shape `sanitizeViewConfig` accepts), once the table starts, then
   * after each change of its sort, filters, search, columns, display mode or
   * mode settings. React: `onViewConfigChange`.
   */
  viewConfigChange: [config: ViewConfig];
}>();

const sourceConfig = props.config ?? props.getTableConfig?.(props.tableType);
if (!sourceConfig) {
  throw new Error(
    `YaYaw Table: no configuration found for table type "${props.tableType}".`
  );
}
const normalizedConfig = defineTableConfig({
  ...sourceConfig,
  id: props.tableId ?? sourceConfig.id,
  columns: {
    ...sourceConfig.columns,
    definitions: sourceConfig.columns.definitions.map((column) => ({
      ...column,
      type: props.columnTypeMapping?.[column.id] ?? column.type,
    })),
  },
  table: {
    ...sourceConfig.table,
    showToolbar: props.enableToolbar ?? sourceConfig.table.showToolbar,
    enableViews: props.enableViews ?? sourceConfig.table.enableViews,
  },
});
// Presentation can change without resetting the table state or an open draft.
const config = {
  ...normalizedConfig,
  get presentation() { return (props.config ?? props.getTableConfig?.(props.tableType))?.presentation; },
};
const rawActions = computed(() => props.getTableActions?.(props.tableType));
// A table mapping its own start/end columns gets a Gantt from its existing list/update actions.
const derivedPlanning = config.table.planning?.enabled && !rawActions.value?.planning && rawActions.value?.list && canDeriveRowsPlanning(config.table.gantt)
  ? createRowsPlanningAdapter({config: config.table.planning, gantt: config.table.gantt, list: rawActions.value.list, update: rawActions.value.update})
  : undefined;
const planningActions = rawActions.value?.planning ?? derivedPlanning?.actions;
const planning = config.table.planning?.enabled && planningActions ? createPlanningSession({
  // Rows carry dates and hierarchy, never relationships.
  config: derivedPlanning ? {...config.table.planning, allowDependencyEdit: false} : config.table.planning,
  actions: planningActions,
  allowEdit: config.table.allowEdit, canEditRow: config.table.canEditRow,
  onChanged: async () => {await queryClient.invalidateQueries({queryKey: ["yayaw-table"]});},
}) : undefined;
const planningState = shallowRef(planning?.getState());
const unsubscribePlanning = planning?.subscribe(() => {planningState.value = planning.getState();});
onMounted(() => planning?.connect());
onBeforeUnmount(() => {unsubscribePlanning?.(); planning?.dispose();});
const actions = computed(() => rawActions.value && planning ? withPlanningActions(rawActions.value, planning) : rawActions.value);
const queryClient = props.queryClient ?? new QueryClient();
const inputData = computed(() =>
  props.data.length ? props.data : props.initialData
);
// Tags columns take their options from the host's catalogs (`actions.tags`).
// It runs first: facets and filters read the columns it fills.
const tagCatalogs = useTagCatalogs({
  config,
  actions,
  queryClient,
  tableId: config.id,
  tableType: props.tableType,
  locale: props.locale,
  translate: (key) => {
    const value = translations.value[key];
    return typeof value === "string" ? value : undefined;
  },
  rows: () => tableData.rows.value,
  refresh: () => refresh(),
});
// Facet clicks are advanced rules: tables with facets show their menu.
const advancedFiltersEnabled = computed(
  () =>
    (props.enableAdvancedFilters ?? config.table.enableAdvancedFilters ?? false) ||
    Boolean(
      resolveFacets(config.table.facets, config.columns.definitions, {
        folderColumn: folderTreeOf(config.table.filetree, config.columns.definitions)?.parentColumn,
      })
    )
);
const searchDebounceMs = computed(
  () => props.searchDebounceMs ?? config.table.searchDebounceMs ?? 300
);
// The Form mode ships in the table; it is offered when records can be created.
// The Feed mode ships in the table too; `table.feed: false` withholds it.
// The File tree is offered when rows have a parent column.
const modeRenderers = withFileTreeRenderer(
  withFormRenderer(
    withoutDisabledModeRenderers(
      withFeedRenderer(props.displayModeRenderers),
      config.table
    ),
    isFormModeEnabled(
      config.table.form,
      config.table.allowCreate !== false && Boolean(actions.value?.create)
    )
  ),
  isFileTreeAvailable(config.table.filetree, config.columns.definitions)
);
const syncUrl = props.syncUrl ?? config.table.syncUrl ?? true;
const state = useTableState({
  config,
  syncUrl,
  initialActiveViewId: props.initialActiveViewId,
  instanceId: props.instanceId,
  planning: Boolean(planning),
  renderers: Object.keys(modeRenderers ?? {}),
});
// An embedded instance starts from its view before its first request.
if (props.initialView && !syncUrl) {
  state.applyView(props.initialView.config, props.initialView.id ?? undefined);
}
// The host's rows are current when produced in the sort the table starts
// from, on its first page (see initial-rows.ts); otherwise they load again.
const initialRowsCurrent =
  !props.data.length &&
  props.initialData.length > 0 &&
  resolveInitialRowsUse({
    configuredSorting: config.columns.sort,
    firstPage:
      state.pagination.value.pageIndex === 0 &&
      state.pagination.value.pageSize === config.table.defaultPageSize &&
      !state.search.value.trim() &&
      !state.filters.value.length &&
      !state.advancedFilters.value.filters.length,
    initialDataSort: props.initialDataSort,
    sorting: state.sorting.value,
  }) === "current";
const tableData = useTableData({
  actions,
  inputData,
  search: state.search,
  filters: state.filters,
  advancedFilters: state.advancedFilters,
  sorting: state.sorting,
  grouping: state.grouping,
  pagination: state.pagination,
  initialRowCount: props.initialRowCount,
  initialPageCount: props.initialPageCount,
  initialRowsCurrent,
  queryClient,
  searchDebounceMs,
  tableId: config.id,
  viewId: state.activeViewId,
});
const selection = ref<Record<string, boolean>>({ ...props.rowSelection });
const selectedRowCache = ref<Record<string, TableRecord>>({});
const isSelectingAll = ref(false);
const form = ref<OpenFormState>({ open: false, mode: "create" });
const detailRow = ref<TableRecord>();
const detailEditorBusy = ref(false);
const closeDetails = () => {
  if (detailEditorBusy.value) return;
  if (detailRow.value && form.value.open) form.value = { ...form.value, open: false };
  detailRow.value = undefined;
};
const currentDetailRow = computed(() => {
  const selected = detailRow.value;
  return selected && (tableData.rows.value.find(row => getRowId(row) === getRowId(selected)) ?? selected);
});
// Record view derived from the columns unless `details` is false.
const recordDetails = computed<RecordDetailsConfig | undefined>(() =>
  props.details === false ? undefined : (props.details ?? {})
);
const openDetails = (row: TableRecord): void => {
  if (props.onOpenDetails) props.onOpenDetails(row);
  else if (recordDetails.value && !form.value.open) detailRow.value = row;
};
const deleteDetail = async (row: TableRecord) => {
  if (!config.table.allowDelete || config.table.canDeleteRow?.(row) === false || !actions.value?.delete) return { success: false };
  return await actions.value.delete(getRowId(row), { row: { ...row } });
};
const detailDeleted = async (): Promise<void> => {
  detailRow.value = undefined;
  status.value = { type: "success", message: String(translations.value.rowDeleted ?? "Row deleted") };
  clearSelection();
  try { await refresh(); }
  catch (cause) { status.value = { type: "error", message: cause instanceof Error ? cause.message : String(cause) }; }
};
const detailReverted = async (): Promise<void> => {
  try { await refresh(); }
  catch (cause) { status.value = { type: "error", message: cause instanceof Error ? cause.message : String(cause) }; }
};
const footerCalculationsVisible = state.footerCalculationsVisible;
const toolbarCompact = ref(false);
const status = ref<{ type: "error" | "success"; message: string }>();
// Use the host's single Sonner outlet, as React does; feedback must not move table content.
watch(status, notification => {
  if (notification) toast[notification.type](notification.message);
}, { flush: "sync" });
const translations = computed(() =>
  createTranslations(props.locale, { ...config.translations.keys, ...props.translations })
);
const ganttLabels = computed(() => planningLabels(props.locale, planningLabelOverrides((key) => {const value = translations.value[key]; return typeof value === "string" ? value : key;})));
// The planning dialog reads names, days and fields as the table shows them.
const planningFormat = computed(() => planningFormatters(config.columns.definitions, config.table.gantt, props.locale));
const customBulkActions = computed(() => props.customBulkActions);
const toolbarActions = computed(() => props.toolbarActions ?? config.toolbarActions ?? []);
const getRowId = (row: TableRecord, index = 0): string =>
  props.getRowId?.(row) ?? String(row.id ?? row._id ?? row.key ?? index);
const selectedRows = computed(() =>
  Object.keys(selection.value)
    .filter((id) => selection.value[id])
    .map((id) => selectedRowCache.value[id])
    .filter((row): row is TableRecord => Boolean(row))
);
const matchingRowCount = computed(() => {
  if (tableData.isServer.value) {
    return tableData.rowCount.value;
  }
  return applyTableQuery(inputData.value, {
    columns: config.columns.definitions,
    search: state.search.value,
    filters: state.filters.value,
    advancedFilters: state.advancedFilters.value,
    sorting: state.sorting.value,
  }).length;
});
watch(
  [matchingRowCount, state.pagination],
  () => {
    if (tableData.isServer.value) return;
    const lastPage = Math.max(
      0,
      Math.ceil(matchingRowCount.value / state.pagination.value.pageSize) - 1
    );
    if (state.pagination.value.pageIndex > lastPage) {
      state.pagination.value = { ...state.pagination.value, pageIndex: lastPage };
    }
  },
  { immediate: true }
);
const dataRevision = ref(0);
const refresh = async (): Promise<void> => {
  dataRevision.value += 1;
  await tableData.refresh();
  await queryClient.invalidateQueries({ queryKey: ["yayaw-table", config.id, "aggregate"] });
};
const facetsOpen = ref<boolean>();
// The folders of a file tree: "New folder", the folder filter and folder facets.
const folders = createFolderDirectoryStore({
  actions,
  config,
  locale: props.locale,
  revision: dataRevision,
  rows: () => inputData.value,
});
const facetState = computed(() => {
  const facets = resolveFacets(config.table.facets, config.columns.definitions, {
    folderColumn: folders.tree?.parentColumn,
    locale: props.locale,
  });
  const shown =
    Boolean(facets) &&
    config.table.showToolbar !== false &&
    config.table.enableColumnFilters !== false &&
    facetsShownIn(state.displayMode.value);
  return {
    facets,
    // The panel beside the records on wide screens; phones open a sheet.
    inline: Boolean(facets) && shown && !toolbarCompact.value && (facetsOpen.value ?? facets?.defaultOpen ?? true),
  };
});
const clearSelection = (): void => {
  selection.value = {};
  selectedRowCache.value = {};
};
const sameSelection = (
  left: Record<string, boolean>,
  right: Record<string, boolean>
): boolean => {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => Boolean(left[key]) === Boolean(right[key]));
};
watch(
  () => props.rowSelection,
  (next) => {
    if (next && !sameSelection(selection.value, next)) {
      selection.value = { ...next };
    }
  },
  { deep: true }
);
const loadAllMatchingRows = async (): Promise<TableRecord[]> => {
  if (!actions.value?.list) {
    return applyTableQuery(inputData.value, {
      columns: config.columns.definitions,
      search: state.search.value,
      filters: state.filters.value,
      advancedFilters: state.advancedFilters.value,
      sorting: state.sorting.value,
    });
  }
  // Capture the query once so changing filters during export cannot mix result sets.
  const params = cloneFormValue({
    pageSize: state.pagination.value.pageSize,
    search: state.search.value,
    filters: Object.fromEntries(
      state.filters.value.map((filter) => [filter.id, filter.value])
    ),
    advancedFilters: state.advancedFilters.value,
    sorting: state.sorting.value,
    grouping: state.grouping.value,
  });
  const list = actions.value.list;
  return await fetchAllContractRows({
    list: async (request) => await list(request as unknown as TableListParams),
    params,
  });
};
let selectionVersion = 0;
watch(selection, () => { selectionVersion += 1; }, { deep: true, flush: "sync" });
watch(
  [state.search, state.filters, state.advancedFilters, state.sorting, state.grouping],
  () => {
    selectionVersion += 1;
    if (!config.table.preserveSelectionOnQuery) clearSelection();
  },
  { deep: true, flush: "sync" }
);
onBeforeUnmount(() => { selectionVersion += 1; });
const selectAllMatching = async (): Promise<number> => {
  if (
    isSelectingAll.value ||
    !config.table.enableRowSelection ||
    !config.table.enableMultiRowSelection
  ) return 0;
  const version = selectionVersion;
  isSelectingAll.value = true;
  try {
    const matching = await loadAllMatchingRows();
    // Do not overwrite a newer query or a selection edited while the request was pending.
    if (version !== selectionVersion) return 0;
    const selectable = matching.filter(
      (row) => config.table.canSelectRow?.(row) !== false
    );
    const cache: Record<string, TableRecord> = {};
    const nextSelection: Record<string, boolean> = {};
    for (const [index, row] of selectable.entries()) {
      const id = getRowId(row, index);
      cache[id] = row;
      nextSelection[id] = true;
    }
    selectedRowCache.value = cache;
    selection.value = nextSelection;
    return selectable.length;
  } catch (cause) {
    if (version === selectionVersion) {
      status.value = {
        type: "error",
        message: cause instanceof Error ? cause.message : String(cause),
      };
    }
    return 0;
  } finally {
    isSelectingAll.value = false;
  }
};

const selectionRoot = ref<HTMLElement>();
const activityUndo = createActivityUndo({
  rows: () => tableData.rows.value,
  config: () => recordDetails.value,
  handler: () => props.onRevertActivity,
  onReverted: async () => { await refresh(); },
  onSuccess: entry => { status.value = { type: "success", message: detailUndoMessage(entry, detailLabels(props.locale, recordDetails.value?.labels)) }; },
  onError: error => { status.value = { type: "error", message: error ?? detailLabels(props.locale).undoError }; },
  onUnavailable: () => { status.value = { type: "error", message: detailLabels(props.locale).undoUnavailable }; },
});
const duplicateSelection = createSelectionDuplicate({
  rows: () => selectedRows.value,
  getId: getRowId,
  canDuplicate: row => config.table.canDuplicateRow?.(row) !== false,
  action: () => actions.value?.duplicate,
  refresh,
  select: rows => {
    const cache: Record<string, TableRecord> = {};
    const next: Record<string, boolean> = {};
    for (const row of rows) { const id = getRowId(row); cache[id] = row; next[id] = true; }
    selectedRowCache.value = cache;
    selection.value = next;
  },
  success: count => { status.value = { type: "success", message: duplicateLabels(props.locale, count).success }; },
  error: error => { status.value = { type: "error", message: error ?? duplicateLabels(props.locale, 0).error }; },
});
let removeSelectionShortcuts: (() => void) | undefined;
onMounted(() => {
  if (!selectionRoot.value) return;
  removeSelectionShortcuts = registerSelectionShortcuts({
    root: selectionRoot.value,
    enabled: () => true,
    get selectAll() { return config.table.enableRowSelection !== false && config.table.enableMultiRowSelection !== false ? () => { void selectAllMatching(); } : undefined; },
    get duplicate() { return config.table.allowDuplicate !== false && actions.value?.duplicate ? () => { void duplicateSelection(); } : undefined; },
    get undo() { return props.onRevertActivity ? () => { void activityUndo.undo(); } : undefined; },
  });
});
onBeforeUnmount(() => removeSelectionShortcuts?.());

const densityStyle = computed(() => {
  const metrics = TABLE_DENSITY_METRICS[state.density.value];
  const spacing = (units: number) => `calc(var(--spacing, 0.25rem) * ${units})`;
  return {
    "--yayaw-density-height": spacing(metrics.rowHeight),
    "--yayaw-density-control": spacing(metrics.controlHeight),
    "--yayaw-density-px": spacing(metrics.paddingX),
    "--yayaw-density-py": spacing(metrics.paddingY),
  };
});

const openCreate = (initial?: TableRecord): void => {
  detailRow.value = undefined;
  form.value = {
    open: true,
    mode: "create",
    initial,
    formType: config.form?.createFormType ?? props.formType ?? props.tableType,
  };
};
const openEdit = (row: TableRecord): void => {
  detailRow.value = undefined;
  form.value = {
    open: true,
    mode: "edit",
    row,
    formType: config.form?.resolveEditFormType?.(row) ?? config.form?.editFormType ?? props.formType ?? props.tableType,
  };
};
const editDetails = (row: TableRecord): void => {
  openEdit(row);
  detailRow.value = row;
};
const resolveRowClickMode = (): NonNullable<typeof config.table.rowClickMode> => {
  const configured = config.table.rowClickMode;
  if (configured && configured !== "default") {
    return configured;
  }
  return config.table.enableRowClickEdit ? "edit" : "activate";
};
const activateRow = (row: TableRecord, event: MouseEvent): void => {
  const mode = resolveRowClickMode();
  if (mode === "none") {
    return;
  }
  if (mode === "edit") {
    if (
      config.table.allowEdit &&
      config.table.canEditRow?.(row) !== false
    ) {
      openEdit(row);
    }
    return;
  }
  if (mode === "link") {
    const linkColumn = config.columns.definitions.find(
      (column) => column.urlDisplayMode === "row-link"
    );
    const url = linkColumn
      ? row[linkColumn.accessorKey ?? linkColumn.id]
      : undefined;
    if (typeof url === "string" && HTTP_URL_PATTERN.test(url)) {
      if (props.onRowClick) {
        props.onRowClick(url, row, event);
      } else {
        if (event.metaKey || event.ctrlKey) window.open(url, "_blank", "noopener");
        else window.location.assign(url);
      }
    }
    return;
  }
  openDetails(row);
  emit("rowActivate", row, event);
};
const emitSelection = (): void =>
  emit("rowSelectionChange", { ...selection.value });
watch(selection, emitSelection, { deep: true });
watch(
  [selection, () => tableData.rows.value],
  () => {
    const next = Object.fromEntries(
      Object.entries(selectedRowCache.value).filter(
        ([id]) => selection.value[id]
      )
    );
    tableData.rows.value.forEach((row, index) => {
      const id = getRowId(row, index);
      if (selection.value[id]) {
        next[id] = row;
      }
    });
    selectedRowCache.value = next;
  },
  { deep: true, immediate: true }
);

provide(tableContextKey, {
  config,
  planning,
  planningState,
  tableType: props.tableType,
  formType: props.formType,
  actions,
  state,
  data: tableData,
  selection,
  selectedRows,
  matchingRowCount,
  isSelectingAll,
  translations,
  customBulkActions,
  rowActions: computed(() => props.rowActions ?? []),
  toolbarActions,
  form,
  footerCalculationsVisible,
  toolbarCompact,
  facetsOpen,
  dataRevision,
  folders,
  optionsRequest,
  getRowId,
  getFormConfig: props.getFormConfig,
  refresh,
  openCreate,
  displayModeRenderers: modeRenderers,
  openEdit,
  get openDetails() { return props.onOpenDetails || recordDetails.value ? openDetails : undefined; },
  activateRow,
  emitSelection,
  clearSelection,
  selectAllMatching,
  loadAllMatchingRows,
  status,
  queryClient,
  tags: tagCatalogs,
  locale: props.locale,
  onBulkDelete: props.onBulkDelete,
  get onBulkEdit() { return props.onBulkEdit; },
  onBulkCopy: props.onBulkCopy,
  onBulkExport: props.onBulkExport,
  onExport: props.onExport,
} as TableContextValue);

// The view the table shows, as both editions report it.
const viewConfig = computed(() => canonicalViewConfig(state.snapshot.value));
let reportedView = "";
const reportView = (): void => {
  const json = JSON.stringify(viewConfig.value);
  if (json !== reportedView) {
    reportedView = json;
    emit("viewConfigChange", viewConfig.value);
  }
};
onMounted(reportView);
watch(viewConfig, reportView);

/**
 * `refresh()`: loads the rows (and aggregates) again, e.g. a dashboard's
 * "Refresh all". `getViewConfig()`: the view the table shows now.
 */
defineExpose({ refresh, getViewConfig: () => viewConfig.value });
</script>

<template>
  <section ref="selectionRoot" data-yayaw-table-selection-scope="" class="yayaw-table" :class="className" :data-density="state.density.value" :style="densityStyle" tabindex="-1">
    <header v-if="config.table.showToolbarHeader" class="yayaw-header">
      <div>
        <h2 class="yayaw-title">{{ title ?? config.translations.keys.title ?? `${tableType} Table` }}</h2>
        <p class="yayaw-description">
          {{ description ?? config.translations.keys.description ?? `Manage your ${tableType}` }}
        </p>
      </div>
    </header>

    <TableFilterBar v-if="!toolbarCompact && (props.showFilterBar ?? config.table.showFilterBar)" />
    <TableToolbar
      v-if="config.table.showToolbar"
      :enable-advanced-filters="advancedFiltersEnabled && config.table.enableColumnFilters"
      :initial-views="initialViews"
      :toolbar-actions-placement="props.toolbarActionsPlacement ?? config.toolbarActionsPlacement"
    />


    <div class="yayaw-records-layout" :data-facets="facetState.inline ? facetState.facets?.position : undefined">
    <aside v-if="facetState.inline && facetState.facets?.position !== 'right'" :id="`${config.id}-facets`" class="yayaw-facets-panel" data-facet-panel="" :data-position="facetState.facets?.position" :style="{ width: `${facetState.facets?.width}px` }" :aria-labelledby="`${config.id}-facets-title`">
      <FacetPanel :heading-id="`${config.id}-facets-title`" />
    </aside>
    <div class="yayaw-records">
    <div v-if="tableData.error.value" class="yayaw-error" role="alert">
      {{ tableData.error.value.message }}
      <button type="button" class="yayaw-button" @click="refresh">{{ translations.retry }}</button>
    </div>

    <div class="yayaw-content" :aria-busy="tableData.isLoading.value">
      <DisplayModeRendererHost v-if="modeRenderers?.[state.displayMode.value]" :renderer="modeRenderers[state.displayMode.value]!" />
      <DataGrid v-else-if="state.displayMode.value === 'table'" />
      <KanbanView v-else-if="state.displayMode.value === 'kanban'" />
      <ListView v-else-if="state.displayMode.value === 'list'" />
      <GanttView v-else-if="state.displayMode.value === 'gantt' && planning" />
      <div v-else-if="state.displayMode.value === 'gantt'" role="alert">{{ ganttLabels.noAdapter }}</div>
      <GalleryView v-else />
      <CardPagination v-if="!modeRenderers?.[state.displayMode.value] && state.displayMode.value !== 'table' && state.displayMode.value !== 'gantt' && !(state.displayMode.value === 'kanban' && config.table.kanban?.server)" />
      <component :is="loadingOverlay" v-if="tableData.isLoading.value && loadingOverlay" />
      <div v-else-if="tableData.isLoading.value" class="yayaw-loading-overlay">{{ translations.loading }}</div>
    </div>
    </div>
    <aside v-if="facetState.inline && facetState.facets?.position === 'right'" :id="`${config.id}-facets`" class="yayaw-facets-panel" data-facet-panel="" data-position="right" :style="{ width: `${facetState.facets?.width}px` }" :aria-labelledby="`${config.id}-facets-title`">
      <FacetPanel :heading-id="`${config.id}-facets-title`" />
    </aside>
    </div>

    <div class="yayaw-bulk-anchor" aria-hidden="true" />
    <BulkActions v-if="selectedRows.length" />
    <CatalogueForm v-if="form.open && !currentDetailRow">
      <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
    </CatalogueForm>
    <PlanningSurface v-if="planning" :session="planning" :labels="ganttLabels" :locale="locale" :formatters="planningFormat" :on-open-record="recordDetails || onOpenDetails ? (task) => {if (task.record) openDetails(task.record)} : undefined" />
    <RecordDetails v-if="recordDetails && currentDetailRow" :key="getRowId(currentDetailRow)" :row="currentDetailRow" :config="{ ...recordDetails, presentation: config.presentation ?? recordDetails.presentation }" :editing="form.open" :editor-busy="detailEditorBusy" :columns="config.columns.definitions" :locale="locale"
      :can-edit="config.table.allowEdit && Boolean(actions?.update) && config.table.canEditRow?.(currentDetailRow) !== false"
      :can-delete="config.table.allowDelete && Boolean(actions?.delete) && config.table.canDeleteRow?.(currentDetailRow) !== false"
      :on-planning="planning ? (row) => planning?.open({source: planning.config.sourceId, id: getRowId(row)}) : undefined"
      :on-delete="deleteDetail" :on-revert-activity="onRevertActivity" @reverted="detailReverted" @edit="editDetails" @close="closeDetails" @deleted="detailDeleted">
      <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
      <template #editor><CatalogueForm embedded @busy="detailEditorBusy = $event">
        <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
      </CatalogueForm></template>
    </RecordDetails>
  </section>
</template>
