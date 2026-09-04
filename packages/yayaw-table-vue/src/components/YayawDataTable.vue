<script setup lang="ts">
import { QueryClient } from "@tanstack/vue-query";
import { type Component, computed, onBeforeUnmount, provide, ref, watch } from "vue";
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
  BulkActionHandlerResult,
  DataTableTranslations,
  FormConfig,
  FormFieldContext,
  MaybePromise,
  TableActions,
  TableConfig,
  TableRecord,
  TableView,
  ToolbarAction,
} from "../types";
import { fetchAllContractRows } from "../table-contracts";
import type { TableListParams } from "../types";
import CardPagination from "./table/CardPagination.vue";
import AdvancedFilters from "./filters/AdvancedFilters.vue";
import CatalogueForm from "./forms/CatalogueForm.vue";
import GalleryView from "./gallery/GalleryView.vue";
import KanbanView from "./kanban/KanbanView.vue";
import BulkActions from "./table/BulkActions.vue";
import DataGrid from "./table/DataGrid.vue";
import TableToolbar from "./toolbar/TableToolbar.vue";

const HTTP_URL_PATTERN = /^https?:\/\//;

const props = withDefaults(
  defineProps<{
    tableType: string;
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
    enableViews?: boolean;
    syncUrl?: boolean;
    searchDebounceMs?: number;
    customBulkActions?: BulkAction[];
    toolbarActions?: ToolbarAction[];
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
const config = defineTableConfig({
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
const actions = computed(() => props.getTableActions?.(props.tableType));
const queryClient = props.queryClient ?? new QueryClient();
const inputData = computed(() =>
  props.data.length ? props.data : props.initialData
);
const advancedFiltersEnabled = computed(
  () => props.enableAdvancedFilters ?? config.table.enableAdvancedFilters ?? true
);
const searchDebounceMs = computed(
  () => props.searchDebounceMs ?? config.table.searchDebounceMs ?? 0
);
const state = useTableState({
  config,
  syncUrl: props.syncUrl ?? config.table.syncUrl ?? true,
  initialActiveViewId: props.initialActiveViewId,
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
const selection = ref<Record<string, boolean>>({});
const selectedRowCache = ref<Record<string, TableRecord>>({});
const isSelectingAll = ref(false);
const form = ref<OpenFormState>({ open: false, mode: "create" });
const footerCalculationsVisible = ref(config.table.enableCalculations === true);
const status = ref<{ type: "error" | "success"; message: string }>();
const translations = computed(() =>
  createTranslations(props.locale, { ...config.translations.keys, ...props.translations })
);
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
    clearSelection();
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

const openCreate = (): void => {
  form.value = {
    open: true,
    mode: "create",
    formType: config.form?.createFormType ?? props.formType ?? props.tableType,
  };
};
const openEdit = (row: TableRecord): void => {
  form.value = {
    open: true,
    mode: "edit",
    row,
    formType: config.form?.resolveEditFormType?.(row) ?? config.form?.editFormType ?? props.formType ?? props.tableType,
  };
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
  toolbarActions,
  form,
  footerCalculationsVisible,
  getRowId,
  getFormConfig: props.getFormConfig,
  refresh,
  openCreate,
  openEdit,
  activateRow,
  emitSelection,
  clearSelection,
  selectAllMatching,
  loadAllMatchingRows,
  status,
  queryClient,
  locale: props.locale,
  onBulkDelete: props.onBulkDelete,
  onBulkEdit: props.onBulkEdit,
  onBulkCopy: props.onBulkCopy,
  onBulkExport: props.onBulkExport,
  onExport: props.onExport,
} as TableContextValue);
</script>

<template>
  <section class="yayaw-table" :class="className" :data-density="config.table.density" tabindex="-1">
    <div v-if="status" class="yayaw-status" :data-type="status.type" role="status">
      <span>{{ status.message }}</span>
      <button type="button" :aria-label="String(translations.dismiss)" @click="status = undefined">×</button>
    </div>

    <header v-if="config.table.showToolbarHeader" class="yayaw-header">
      <div>
        <h2 class="yayaw-title">{{ title ?? config.translations.keys.title ?? `${tableType} Table` }}</h2>
        <p v-if="description ?? config.translations.keys.description" class="yayaw-description">
          {{ description ?? config.translations.keys.description }}
        </p>
      </div>
    </header>

    <TableToolbar
      v-if="config.table.showToolbar"
      :enable-advanced-filters="advancedFiltersEnabled && config.table.enableColumnFilters"
      :initial-views="initialViews"
    />
    <AdvancedFilters v-if="advancedFiltersEnabled && config.table.enableColumnFilters && state.advancedFilters.value.filters.length" />

    <div v-if="tableData.error.value" class="yayaw-error" role="alert">
      {{ tableData.error.value.message }}
      <button type="button" class="yayaw-button" @click="refresh">{{ translations.retry }}</button>
    </div>

    <div class="yayaw-content" :aria-busy="tableData.isLoading.value">
      <DataGrid v-if="state.displayMode.value === 'table'" />
      <KanbanView v-else-if="state.displayMode.value === 'kanban'" />
      <GalleryView v-else />
      <CardPagination v-if="state.displayMode.value !== 'table'" />
      <component :is="loadingOverlay" v-if="tableData.isLoading.value && loadingOverlay" />
      <div v-else-if="tableData.isLoading.value" class="yayaw-loading-overlay">{{ translations.loading }}</div>
    </div>

    <div class="yayaw-bulk-anchor" aria-hidden="true" />
    <BulkActions v-if="selectedRows.length" />
    <CatalogueForm v-if="form.open" />
  </section>
</template>
