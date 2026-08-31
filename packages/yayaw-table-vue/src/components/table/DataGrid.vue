<script setup lang="ts">
import {
  FlexRender,
  type Column,
  type ColumnDef,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type RowSelectionState,
  type Updater,
  useVueTable,
} from "@tanstack/vue-table";
import { type CSSProperties, computed, h, ref, watch } from "vue";
import { useTableContext } from "../../context";
import { applyTableQuery, calculateColumn, formatNumber } from "../../core";
import type {
  CalculationType,
  ColumnDefinition,
  TableRecord,
} from "../../types";
import CellRenderer from "./CellRenderer.vue";
import RowActions from "./RowActions.vue";

const context = useTableContext();
const draggedColumn = ref<string>();
const updaterValue = <T>(updater: Updater<T>, previous: T): T =>
  typeof updater === "function"
    ? (updater as (value: T) => T)(previous)
    : updater;
const sourceColumns = computed(() =>
  context.config.columns.definitions.filter(
    (column) => column.id !== "select" && column.type !== "actions"
  )
);
const clientRows = computed(() =>
  context.data.isServer.value
    ? context.data.rows.value
    : applyTableQuery(context.data.rows.value, {
        columns: context.config.columns.definitions,
        advancedFilters: context.state.advancedFilters.value,
      })
);
const columnValue = (column: ColumnDefinition, row: TableRecord): unknown =>
  column.accessorFn
    ? column.accessorFn(row)
    : row[column.accessorKey ?? column.id];

const columns = computed<ColumnDef<TableRecord>[]>(() => {
  const definitions: ColumnDef<TableRecord>[] = sourceColumns.value.map(
    (column) => ({
      id: column.id,
      accessorFn: (row) => columnValue(column, row),
      header: column.header,
      enableHiding:
        !context.config.columns.mandatory.includes(column.id) &&
        column.enableHiding !== false,
      enableSorting:
        context.config.table.enableSorting && column.enableSorting !== false,
      enableColumnFilter:
        context.config.table.enableColumnFilters &&
        column.enableFiltering !== false,
      filterFn: (row, id, value) => {
        const actual = row.getValue(id);
        if (Array.isArray(actual)) {
          return actual.some((item) =>
            String(item)
              .toLocaleLowerCase()
              .includes(String(value).toLocaleLowerCase())
          );
        }
        return String(actual ?? "")
          .toLocaleLowerCase()
          .includes(String(value ?? "").toLocaleLowerCase());
      },
      cell: (info) =>
        h(CellRenderer, {
          value: info.getValue(),
          row: info.row.original,
          column,
        }),
      size: column.size,
      minSize: column.minSize,
      maxSize: column.maxSize,
    })
  );
  if (context.config.table.enableRowSelection) {
    definitions.unshift({
      id: "select",
      size: 42,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) =>
        context.config.table.enableMultiRowSelection
          ? h("input", {
              type: "checkbox",
              class: "yayaw-checkbox",
              checked: table.getIsAllPageRowsSelected(),
              indeterminate: table.getIsSomePageRowsSelected(),
              "aria-label": "Select page",
              onChange: table.getToggleAllPageRowsSelectedHandler(),
            })
          : "",
      cell: ({ row }) =>
        h("input", {
          type: "checkbox",
          class: "yayaw-checkbox",
          checked: row.getIsSelected(),
          disabled: !row.getCanSelect(),
          "aria-label": `Select ${row.id}`,
          onClick: (event: Event) => event.stopPropagation(),
          onChange: row.getToggleSelectedHandler(),
        }),
    });
  }
  const hasActions =
    context.config.table.allowEdit ||
    context.config.table.allowDelete ||
    context.config.table.allowDuplicate;
  if (hasActions) {
    definitions.push({
      id: "actions",
      size: 96,
      enableSorting: false,
      enableHiding: false,
      header: "",
      cell: ({ row }) => h(RowActions, { row: row.original }),
    });
  }
  return definitions;
});

const table = useVueTable({
  get data() {
    return clientRows.value;
  },
  get columns() {
    return columns.value;
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getRowId: (row, index) => context.getRowId(row, index),
  getSubRows: (row) => row.subRows as TableRecord[] | undefined,
  get enableRowSelection() {
    if (!context.config.table.enableRowSelection) {
      return false;
    }
    if (!context.config.table.canSelectRow) {
      return true;
    }
    return (row: Row<TableRecord>) =>
      context.config.table.canSelectRow?.(row.original) !== false;
  },
  get enableMultiRowSelection() {
    return context.config.table.enableMultiRowSelection;
  },
  get manualFiltering() {
    return context.data.isServer.value;
  },
  get manualSorting() {
    return context.data.isServer.value;
  },
  get manualPagination() {
    return context.data.isServer.value;
  },
  get pageCount() {
    return context.data.isServer.value
      ? context.data.pageCount.value
      : undefined;
  },
  autoResetPageIndex: false,
  state: {
    get globalFilter() {
      return context.state.search.value;
    },
    get columnFilters() {
      return context.state.filters.value;
    },
    get sorting() {
      return context.state.sorting.value;
    },
    get columnVisibility() {
      return context.state.visibility.value;
    },
    get columnOrder() {
      return context.state.order.value;
    },
    get grouping() {
      return context.state.grouping.value;
    },
    get columnPinning() {
      return context.state.pinning.value;
    },
    get pagination() {
      return context.state.pagination.value;
    },
    get rowSelection() {
      return context.selection.value;
    },
  },
  onGlobalFilterChange: (updater) => {
    context.state.search.value = updaterValue(
      updater,
      context.state.search.value
    );
  },
  onColumnFiltersChange: (updater) => {
    context.state.filters.value = updaterValue(
      updater,
      context.state.filters.value
    );
  },
  onSortingChange: (updater) => {
    context.state.sorting.value = updaterValue(
      updater,
      context.state.sorting.value
    );
  },
  onColumnVisibilityChange: (updater) => {
    context.state.visibility.value = updaterValue(
      updater,
      context.state.visibility.value
    );
  },
  onColumnOrderChange: (updater) => {
    context.state.order.value = updaterValue(
      updater,
      context.state.order.value
    );
  },
  onGroupingChange: (updater) => {
    context.state.grouping.value = updaterValue(
      updater,
      context.state.grouping.value
    );
  },
  onColumnPinningChange: (updater) => {
    const next = updaterValue(
      updater,
      context.state.pinning.value
    );
    context.state.pinning.value = {
      left: next.left ?? [],
      right: next.right ?? [],
    };
  },
  onPaginationChange: (updater) => {
    context.state.pagination.value = updaterValue(
      updater,
      context.state.pagination.value
    );
  },
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
    context.selection.value = updaterValue(updater, context.selection.value);
  },
});

const visibleRows = computed(() => table.getRowModel().rows);
const totalPages = computed(() => Math.max(1, table.getPageCount()));
const moveColumn = (target: string): void => {
  const source = draggedColumn.value;
  if (
    !source ||
    source === target ||
    ["select", "actions"].includes(source) ||
    ["select", "actions"].includes(target)
  ) {
    return;
  }
  const current = [...context.state.order.value].filter((id) => id !== source);
  const targetIndex = current.indexOf(target);
  current.splice(Math.max(0, targetIndex), 0, source);
  context.state.order.value = current;
  draggedColumn.value = undefined;
};
const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(target.closest("button,a,input,select,textarea,[role='button']"));
const rowClick = (row: TableRecord, event: MouseEvent): void => {
  if (!isInteractive(event.target)) {
    context.activateRow(row, event);
  }
};
const calculationColumns = computed(() =>
  sourceColumns.value.filter((column) => column.enableCalculation !== false)
);
const selectedCalculations = ref<Record<string, CalculationType>>(
  Object.fromEntries(
    calculationColumns.value.map((column) => [
      column.id,
      column.defaultCalculation ?? "none",
    ])
  )
);
const calculations = computed(() =>
  calculationColumns.value.filter(
    (column) => selectedCalculations.value[column.id] !== "none"
  )
);
const activeCalculations = computed<Record<string, CalculationType>>(() =>
  Object.fromEntries(
    calculations.value.map((column) => [
      column.id,
      selectedCalculations.value[column.id] ?? "none",
    ])
  )
);
const availableCalculations = (column: ColumnDefinition): CalculationType[] => {
  const base: CalculationType[] = [
    "none",
    "count_all",
    "count_values",
    "count_unique",
    "count_empty",
    "count_not_empty",
    "percent_empty",
    "percent_not_empty",
  ];
  if (column.type === "boolean") {
    return [
      ...base,
      "count_true",
      "count_false",
      "percent_true",
      "percent_false",
    ];
  }
  if (column.type === "number") {
    return [...base, "sum", "average", "median", "min", "max", "range"];
  }
  if (column.type === "date") {
    return [...base, "min", "max", "range"];
  }
  return base;
};
const aggregateResults = ref<Record<string, unknown>>({});
let calculationRequest = 0;
const refreshCalculations = async (): Promise<void> => {
  if (!(context.data.isServer.value && calculations.value.length)) {
    aggregateResults.value = {};
    return;
  }
  const request = ++calculationRequest;
  try {
    if (context.actions.value?.aggregate) {
      try {
        const result = await context.queryClient.fetchQuery({
          queryKey: [
            "yayaw-table",
            context.config.id,
            "aggregate",
            activeCalculations.value,
            context.state.search.value,
            context.state.filters.value,
            context.state.advancedFilters.value,
            context.locale,
          ],
          queryFn: () =>
            context.actions.value?.aggregate?.({
              filters: Object.fromEntries(
                context.state.filters.value.map((filter) => [
                  filter.id,
                  filter.value,
                ])
              ),
              advancedFilters: context.state.advancedFilters.value.filters,
              search: context.state.search.value,
              calculations: activeCalculations.value,
              locale: context.locale,
            }),
          staleTime: 15_000,
        });
        if (result && request === calculationRequest) {
          aggregateResults.value = result.results ?? {};
        }
        if (result) {
          return;
        }
      } catch {
        /* use the list fallback below */
      }
    }
    const rows = await context.loadAllMatchingRows();
    if (request === calculationRequest) {
      aggregateResults.value = Object.fromEntries(
        calculations.value.map((column) => [
          column.id,
          calculateColumn(
            column.accessorFn
              ? rows.map((row) => ({
                  ...row,
                  [column.id]: column.accessorFn?.(row),
                }))
              : rows,
            column.accessorFn ? column.id : (column.accessorKey ?? column.id),
            selectedCalculations.value[column.id] ?? "none",
            column.type,
            context.locale
          ),
        ])
      );
    }
  } catch {
    if (request === calculationRequest) {
      aggregateResults.value = {};
    }
  }
};
watch(
  [
    activeCalculations,
    context.actions,
    context.state.search,
    context.state.filters,
    context.state.advancedFilters,
  ],
  async () => {
    await refreshCalculations();
  },
  { deep: true, immediate: true }
);
const calculationFor = (
  columnId: string,
  calculation: CalculationType
): string => {
  const definition = sourceColumns.value.find(
    (column) => column.id === columnId
  );
  const localRows = table.getFilteredRowModel().rows.map((row) => row.original);
  const value = context.data.isServer.value
    ? aggregateResults.value[columnId]
    : calculateColumn(
        definition?.accessorFn
          ? localRows.map((row) => ({
              ...row,
              [columnId]: definition.accessorFn?.(row),
            }))
          : localRows,
        definition?.accessorFn
          ? columnId
          : (definition?.accessorKey ?? columnId),
        calculation,
        definition?.type,
        context.locale
      );
  if (typeof value !== "number") {
    return String(value ?? "—");
  }
  const formatted = formatNumber(value);
  return calculation.startsWith("percent_") ? `${formatted}%` : formatted;
};
const pinnedStyle = (column: Column<TableRecord>): CSSProperties => {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return { width: `${column.getSize()}px` };
  }
  return {
    width: `${column.getSize()}px`,
    position: "sticky",
    left: pinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: pinned === "right" ? `${column.getAfter("right")}px` : undefined,
    zIndex: 2,
    background: "var(--yayaw-background)",
  };
};
</script>

<template>
  <div class="yayaw-grid-shell">
    <div class="yayaw-table-scroll">
      <table class="yayaw-data-grid">
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :style="pinnedStyle(header.column)"
              :aria-label="header.column.id === 'actions' ? String(context.translations.value.actions ?? 'Actions') : undefined"
              :draggable="context.config.table.enableColumnDragDropByDefault && !['select', 'actions'].includes(header.column.id)"
              :class="{ sortable: header.column.getCanSort(), pinned: header.column.getIsPinned() }"
              @dragstart="draggedColumn = header.column.id"
              @dragover.prevent
              @drop="moveColumn(header.column.id)"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="yayaw-header-cell">
                <span v-if="header.column.id === 'actions'" class="yayaw-sr-only">Actions</span>
                <FlexRender v-if="!header.isPlaceholder" :render="header.column.columnDef.header" :props="header.getContext()" />
                <span v-if="header.column.getIsSorted() === 'asc'" aria-hidden="true">↑</span>
                <span v-else-if="header.column.getIsSorted() === 'desc'" aria-hidden="true">↓</span>
                <button v-if="context.config.table.enableColumnPinning && !['select', 'actions'].includes(header.column.id)" type="button" class="yayaw-pin" :aria-label="`Pin ${header.column.id}`" @click.stop="header.column.pin(header.column.getIsPinned() ? false : 'left')"><span aria-hidden="true">{{ header.column.getIsPinned() ? '◆' : '◇' }}</span></button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!visibleRows.length && !context.data.isLoading.value">
            <td :colspan="table.getVisibleLeafColumns().length" class="yayaw-empty">
              <strong>{{ context.config.table.emptyState?.title ?? context.translations.value.noResults }}</strong>
              <span v-if="context.config.table.emptyState?.description">{{ context.config.table.emptyState.description }}</span>
            </td>
          </tr>
          <tr v-for="row in visibleRows" :key="row.id" :class="{ selected: row.getIsSelected(), grouped: row.getIsGrouped() }" @click="rowClick(row.original, $event)">
            <td v-for="cell in row.getVisibleCells()" :key="cell.id" :style="pinnedStyle(cell.column)">
              <template v-if="cell.getIsGrouped()">
                <button type="button" class="yayaw-group-toggle" @click.stop="row.toggleExpanded()">{{ row.getIsExpanded() ? '−' : '+' }}</button>
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                <span class="yayaw-count">{{ row.subRows.length }}</span>
              </template>
              <template v-else-if="cell.getIsAggregated()">{{ cell.getValue() }}</template>
              <FlexRender v-else-if="!cell.getIsPlaceholder()" :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
        </tbody>
        <tfoot v-if="context.config.table.enableCalculations && calculationColumns.length">
          <tr>
            <td v-for="column in table.getVisibleLeafColumns()" :key="column.id" class="yayaw-calculation">
              <template v-if="calculationColumns.find((item) => item.id === column.id)">
                <select v-model="selectedCalculations[column.id]" class="yayaw-calculation-select" :aria-label="`Calculate ${column.id}`">
                  <option v-for="calculation in availableCalculations(calculationColumns.find((item) => item.id === column.id)!)" :key="calculation" :value="calculation">{{ calculation }}</option>
                </select>
                <strong v-if="selectedCalculations[column.id] !== 'none'">{{ calculationFor(column.id, selectedCalculations[column.id]!) }}</strong>
              </template>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <footer v-if="context.config.table.enablePagination" class="yayaw-pagination">
      <span>{{ context.matchingRowCount.value }} rows</span>
      <label>
        {{ context.translations.value.rowsPerPage }}
        <select :value="context.state.pagination.value.pageSize" class="yayaw-select" @change="table.setPageSize(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="size in context.config.table.pageSizeOptions" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
      <span>{{ context.state.pagination.value.pageIndex + 1 }} / {{ totalPages }}</span>
      <button type="button" class="yayaw-button yayaw-button-outline" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">{{ context.translations.value.previous }}</button>
      <button type="button" class="yayaw-button yayaw-button-outline" :disabled="!table.getCanNextPage()" @click="table.nextPage()">{{ context.translations.value.next }}</button>
    </footer>
  </div>
</template>
