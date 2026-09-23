<script setup lang="ts">
import { createPlanningSession, withPlanningActions } from "../planning/session";
import { canDeriveRowsPlanning, createRowsPlanningAdapter } from "../planning/rows-adapter";
import { planningLabels, planningLabelOverrides } from "../planning/labels";
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
import { defineTableConfig } from "../config";
import {
  type OpenFormState,
  type TableContextValue,
  tableContextKey,
} from "../context";
import { applyTableQuery } from "../core";
import { cloneFormValue } from "../form-runtime";
import { createTranslations } from "../translations";
import type {
  BulkAction,
  RowActionItem,
  BulkActionHandlerResult,
  DataTableTranslations,
  FormConfig,
  FormFieldContext,
  MaybePromise,
  TableActions,
  TableConfig,
  TableRecord,
  TableView,
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
    details?: RecordDetailsConfig;
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
    initialData?: TableRecord[];
    initialRowCount?: number;
    initialPageCount?: number;
    initialViews?: TableView[];
    initialActiveViewId?: string;
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
const advancedFiltersEnabled = computed(
  () => props.enableAdvancedFilters ?? config.table.enableAdvancedFilters ?? false
);
const searchDebounceMs = computed(
  () => props.searchDebounceMs ?? config.table.searchDebounceMs ?? 300
);
const state = useTableState({
  config,
  syncUrl: props.syncUrl ?? config.table.syncUrl ?? true,
  initialActiveViewId: props.initialActiveViewId,
  planning: Boolean(planning),
});
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
  queryClient,
  searchDebounceMs,
  tableId: config.id,
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
const openDetails = (row: TableRecord): void => {
  if (props.onOpenDetails) props.onOpenDetails(row);
  else if (props.details && !form.value.open) detailRow.value = row;
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
const refresh = async (): Promise<void> => {
  await tableData.refresh();
  await queryClient.invalidateQueries({ queryKey: ["yayaw-table", config.id, "aggregate"] });
};
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
  config: () => props.details,
  handler: () => props.onRevertActivity,
  onReverted: async () => { await refresh(); },
  onSuccess: entry => { status.value = { type: "success", message: detailUndoMessage(entry, detailLabels(props.locale, props.details?.labels)) }; },
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

const openCreate = (): void => {
  detailRow.value = undefined;
  form.value = {
    open: true,
    mode: "create",
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
  optionsRequest,
  getRowId,
  getFormConfig: props.getFormConfig,
  refresh,
  openCreate,
  openEdit,
  get openDetails() { return props.onOpenDetails || props.details ? openDetails : undefined; },
  activateRow,
  emitSelection,
  clearSelection,
  selectAllMatching,
  loadAllMatchingRows,
  status,
  queryClient,
  locale: props.locale,
  onBulkDelete: props.onBulkDelete,
  get onBulkEdit() { return props.onBulkEdit; },
  onBulkCopy: props.onBulkCopy,
  onBulkExport: props.onBulkExport,
  onExport: props.onExport,
} as TableContextValue);
</script>

<template>
  <section ref="selectionRoot" data-yayaw-table-selection-scope="" class="yayaw-table" :class="className" :data-density="state.density.value" :style="densityStyle" tabindex="-1">
    <header v-if="config.table.showToolbarHeader" class="yayaw-header">
      <div>
        <h2 class="yayaw-title">{{ title ?? config.translations.keys.title ?? `${tableType} Table` }}</h2>
        <p v-if="description ?? config.translations.keys.description" class="yayaw-description">
          {{ description ?? config.translations.keys.description }}
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


    <div v-if="tableData.error.value" class="yayaw-error" role="alert">
      {{ tableData.error.value.message }}
      <button type="button" class="yayaw-button" @click="refresh">{{ translations.retry }}</button>
    </div>

    <div class="yayaw-content" :aria-busy="tableData.isLoading.value">
      <DataGrid v-if="state.displayMode.value === 'table'" />
      <KanbanView v-else-if="state.displayMode.value === 'kanban'" />
      <ListView v-else-if="state.displayMode.value === 'list'" />
      <GanttView v-else-if="state.displayMode.value === 'gantt' && planning" />
      <div v-else-if="state.displayMode.value === 'gantt'" role="alert">{{ ganttLabels.noAdapter }}</div>
      <GalleryView v-else />
      <CardPagination v-if="state.displayMode.value !== 'table' && state.displayMode.value !== 'gantt' && !(state.displayMode.value === 'kanban' && config.table.kanban?.server)" />
      <component :is="loadingOverlay" v-if="tableData.isLoading.value && loadingOverlay" />
      <div v-else-if="tableData.isLoading.value" class="yayaw-loading-overlay">{{ translations.loading }}</div>
    </div>

    <div class="yayaw-bulk-anchor" aria-hidden="true" />
    <BulkActions v-if="selectedRows.length" />
    <CatalogueForm v-if="form.open && !currentDetailRow">
      <template v-for="(_, name) in $slots" #[name]="scope"><slot :name="name" v-bind="scope" /></template>
    </CatalogueForm>
    <PlanningSurface v-if="planning" :session="planning" :labels="ganttLabels" :locale="locale" :on-open-record="details || onOpenDetails ? (task) => {if (task.record) openDetails(task.record)} : undefined" />
    <RecordDetails v-if="details && currentDetailRow" :key="getRowId(currentDetailRow)" :row="currentDetailRow" :config="{ ...details, presentation: config.presentation ?? details.presentation }" :editing="form.open" :editor-busy="detailEditorBusy" :columns="config.columns.definitions" :locale="locale"
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
