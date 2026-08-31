<script setup lang="ts">
import { QueryClient } from "@tanstack/vue-query";
import { type Component, computed, provide, ref, watch } from "vue";
import { useTableData } from "../composables/use-table-data";
import { useTableState } from "../composables/use-table-state";
import { defineTableConfig } from "../config";
import {
  type OpenFormState,
  type TableContextValue,
  tableContextKey,
} from "../context";
import { applyTableQuery } from "../core";
import { createTranslations } from "../translations";
import type {
  BulkAction,
  DataTableTranslations,
  FormConfig,
  FormFieldContext,
  MaybePromise,
  TableActionResult,
  TableActions,
  TableConfig,
  TableRecord,
  TableView,
  ToolbarAction,
} from "../types";
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
    customBulkActions?: BulkAction[];
    toolbarActions?: ToolbarAction[];
    getRowId?: (row: TableRecord) => string;
    queryClient?: QueryClient;
    loadingOverlay?: Component;
    onRowClick?: (url: string, row: TableRecord, event: MouseEvent) => void;
    onBulkDelete?: (
      rows: TableRecord[]
    ) => MaybePromise<TableActionResult | undefined>;
    onBulkEdit?: (
      rows: TableRecord[],
      patch?: TableRecord
    ) => MaybePromise<TableActionResult | undefined>;
    onBulkCopy?: (
      rows: TableRecord[]
    ) => MaybePromise<TableActionResult | undefined>;
    onBulkExport?: (
      rows: TableRecord[]
    ) => MaybePromise<TableActionResult | undefined>;
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
    enableAdvancedFilters: true,
    enableToolbar: undefined,
    enableViews: undefined,
    syncUrl: true,
    customBulkActions: () => [],
    toolbarActions: () => [],
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
const state = useTableState({ config, syncUrl: props.syncUrl });
if (props.initialActiveViewId) {
  state.activeViewId.value = props.initialActiveViewId;
}
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
  tableId: config.id,
});
const selection = ref<Record<string, boolean>>({});
const selectedRowCache = ref<Record<string, TableRecord>>({});
const isSelectingAll = ref(false);
const form = ref<OpenFormState>({ open: false, mode: "create" });
const status = ref<{ type: "error" | "success"; message: string }>();
const translations = computed(() =>
  createTranslations(props.locale, props.translations)
);
const customBulkActions = computed(() => props.customBulkActions);
const toolbarActions = computed(() => props.toolbarActions);
const getRowId = (row: TableRecord, index = 0): string =>
  props.getRowId?.(row) ?? String(row.id ?? row.key ?? index);
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
const refresh = async (): Promise<void> => tableData.refresh();
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
  const matching: TableRecord[] = [];
  const pageSize = Math.min(
    Math.max(tableData.rowCount.value, config.table.defaultPageSize, 1),
    1000
  );
  const list = actions.value.list;
  let page = 1;
  let totalCount = tableData.rowCount.value;
  while (matching.length < totalCount && page < 10_000) {
    const params = {
      page,
      pageSize,
      search: state.search.value,
      filters: Object.fromEntries(
        state.filters.value.map((filter) => [filter.id, filter.value])
      ),
      advancedFilters: state.advancedFilters.value.filters,
      advancedFilterJoin: state.advancedFilters.value.joinOperator,
      sorting: state.sorting.value,
      grouping: state.grouping.value,
    };
    const result = await queryClient.fetchQuery({
      queryKey: ["yayaw-table", config.id, "all-matching", params],
      queryFn: () => list(params),
      staleTime: 0,
    });
    matching.push(...result.data);
    totalCount = result.meta?.totalCount ?? matching.length;
    if (!result.data.length || result.data.length < pageSize) {
      break;
    }
    page += 1;
  }
  return matching;
};
const selectAllMatching = async (): Promise<number> => {
  isSelectingAll.value = true;
  try {
    const matching = await loadAllMatchingRows();
    const selectable = matching.filter(
      (row) => config.table.canSelectRow?.(row) !== false
    );
    const cache: Record<string, TableRecord> = {};
    const nextSelection: Record<string, boolean> = {};
    selectable.forEach((row, index) => {
      const id = getRowId(row, index);
      cache[id] = row;
      nextSelection[id] = true;
    });
    selectedRowCache.value = cache;
    selection.value = nextSelection;
    return selectable.length;
  } catch (cause) {
    status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
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
    formType: config.form?.editFormType ?? props.formType ?? props.tableType,
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
  if (mode === "edit" && config.table.allowEdit) {
    openEdit(row);
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
        window.location.assign(url);
      }
    }
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
  <section class="yayaw-table" :class="className" :data-density="config.table.density">
    <div v-if="status" class="yayaw-status" :data-type="status.type" role="status">
      <span>{{ status.message }}</span>
      <button type="button" aria-label="Dismiss" @click="status = undefined">×</button>
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
      :enable-advanced-filters="enableAdvancedFilters"
      :initial-views="initialViews"
    />
    <AdvancedFilters v-if="enableAdvancedFilters && state.advancedFilters.value.filters.length" />

    <div v-if="tableData.error.value" class="yayaw-error" role="alert">
      {{ tableData.error.value.message }}
      <button type="button" class="yayaw-button" @click="refresh">Retry</button>
    </div>

    <div class="yayaw-content" :aria-busy="tableData.isLoading.value">
      <DataGrid v-if="state.displayMode.value === 'table'" />
      <KanbanView v-else-if="state.displayMode.value === 'kanban'" />
      <GalleryView v-else />
      <component :is="loadingOverlay" v-if="tableData.isLoading.value && loadingOverlay" />
      <div v-else-if="tableData.isLoading.value" class="yayaw-loading-overlay">{{ translations.loading }}</div>
    </div>

    <BulkActions v-if="selectedRows.length" />
    <CatalogueForm v-if="form.open" />
  </section>
</template>
