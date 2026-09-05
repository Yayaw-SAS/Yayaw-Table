<script setup lang="ts">
import {
  ArrowLeft,
  ArrowDownAZ,
  Calculator,
  ChevronRight,
  Download,
  Layers,
  List,
  ListFilter,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-vue-next";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useTableContext } from "../../context";
import { newFilter } from "../../filter-config";
import { downloadCsv, exportColumns } from "../../core";
import type {
  ColumnDefinition,
  TableDisplayMode,
  TableView,
  ToolbarAction,
  ToolbarActionContext,
  ToolbarActionsPlacement,
} from "../../types";
import SavedViews from "./SavedViews.vue";

const props = defineProps<{
  enableAdvancedFilters: boolean;
  initialViews: TableView[];
  toolbarActionsPlacement?: ToolbarActionsPlacement;
}>();
const context = useTableContext();
type OptionsView = "columns" | "filters" | "group" | "main" | "sort";

const optionsRoot = ref<HTMLElement>();
const optionsOpen = ref(false);
const optionsView = ref<OptionsView>("main");
const pendingAction = ref<string>();
const isExporting = ref(false);
const search = computed({
  get: () => context.state.search.value,
  set: (value: string) => {
    context.state.search.value = value;
  },
});
const modes = computed<TableDisplayMode[]>(
  () => context.config.table.displayModes ?? ["table"]
);
const displayMode = computed({
  get: () => context.state.displayMode.value,
  set: (value: TableDisplayMode) => {
    context.state.displayMode.value = value;
  },
});
const dataColumns = computed(() =>
  context.config.columns.definitions.filter(
    (column) => column.id !== "select" && column.type !== "actions"
  )
);
const hideableColumns = computed(() =>
  dataColumns.value.filter(
    (column) =>
      column.enableHiding !== false &&
      !context.config.columns.mandatory.includes(column.id)
  )
);
const filterableColumns = computed(() =>
  dataColumns.value.filter((column) => column.enableFiltering !== false)
);
const sortableColumns = computed(() =>
  dataColumns.value.filter((column) => column.enableSorting !== false)
);
const groupableColumns = computed(() =>
  dataColumns.value.filter((column) => column.enableGrouping !== false)
);
const visibleColumnCount = computed(
  () =>
    dataColumns.value.filter(
      (column) => context.state.visibility.value[column.id] !== false
    ).length
);
const columnDndFeatureEnabled = computed(
  () => context.config.table.enableColumnDnd !== false
);
const defaultColumnDragEnabled = computed(
  () =>
    columnDndFeatureEnabled.value &&
    context.config.table.enableColumnDragDropByDefault
);
const activeFilterCount = computed(
  () =>
    context.state.filters.value.length +
    context.state.advancedFilters.value.filters.filter(
      (filter) => filter.isActive !== false
    ).length
);
const activeOptionCount = computed(
  () =>
    (context.config.table.enableColumnFilters ? activeFilterCount.value : 0) +
    (context.config.table.enableSorting
      ? context.state.sorting.value.length
      : 0)
);
const hasHiddenColumns = computed(() =>
  dataColumns.value.some(
    (column) => context.state.visibility.value[column.id] === false
  )
);
const hasAnythingToReset = computed(
  () =>
    (context.config.table.enableColumnFilters && activeFilterCount.value > 0) ||
    (context.config.table.enableSorting &&
      context.state.sorting.value.length > 0) ||
    (context.config.table.enableGrouping &&
      context.state.grouping.value.length > 0) ||
    hasHiddenColumns.value ||
    (columnDndFeatureEnabled.value &&
      context.state.columnDragEnabled.value !== defaultColumnDragEnabled.value)
);
const hasAnyMenuSection = computed(
  () =>
    hideableColumns.value.length > 0 ||
    columnDndFeatureEnabled.value ||
    (context.config.table.enableColumnFilters &&
      (filterableColumns.value.length > 0 || props.enableAdvancedFilters)) ||
    (context.config.table.enableSorting && sortableColumns.value.length > 0) ||
    (context.config.table.enableGrouping &&
      groupableColumns.value.length > 0) ||
    context.config.table.enableCalculations
);
const maxGroupingCount = computed(() =>
  context.state.displayMode.value === "table" ? 2 : 1
);
const actionsAsIcons = computed(
  () => context.config.table.actionsAsIcons === true
);
const selectedIds = computed(() =>
  Object.keys(context.selection.value).filter(
    (id) => context.selection.value[id]
  )
);
const isCreateEnabled = computed(
  () =>
    context.config.table.allowCreate && Boolean(context.actions.value?.create)
);
const actionContext = computed<ToolbarActionContext>(() => ({
  actionsAsIcons: actionsAsIcons.value,
  clearSelection: context.clearSelection,
  count: context.selectedRows.value.length,
  data: context.data.rows.value,
  hasListAction: Boolean(context.actions.value?.list),
  isCreateEnabled: isCreateEnabled.value,
  isExportEnabled: context.config.table.export,
  isExporting: isExporting.value,
  isFooterCalculationsEnabled:
    context.config.table.enableCalculations === true,
  isMobile:
    typeof window !== "undefined" &&
    window.matchMedia?.("(max-width: 767px)").matches === true,
  refresh: context.refresh,
  selectedCount: context.selectedRows.value.length,
  selectedIds: selectedIds.value,
  selectedOriginalRows: context.selectedRows.value,
  selectedRowIds: selectedIds.value,
  selectedRows: context.selectedRows.value,
  tableActions: context.actions.value,
  tableId: context.config.id,
  tableType: context.tableType,
}));
const resolvedToolbarActions = computed(() => {
  const input = context.toolbarActions.value;
  const actions =
    typeof input === "function" ? input(actionContext.value) : input;
  return actions.filter(
    (action) =>
      Boolean(action.id && action.label && (action.onClick || action.handler)) &&
      !(
        action.requiresFooterCalculations &&
        !actionContext.value.isFooterCalculationsEnabled
      )
  );
});
const visibleToolbarActions = computed(() =>
  resolvedToolbarActions.value.filter(
    (action) => !actionsAsIcons.value || action.showInIconMode !== false
  )
);
const toolbarActionsPlacement = computed<ToolbarActionsPlacement>(() =>
  ["after-export", "before-create", "between-create-export"].includes(
    props.toolbarActionsPlacement ?? ""
  )
    ? (props.toolbarActionsPlacement as ToolbarActionsPlacement)
    : "between-create-export"
);
type ToolbarItem =
  | { action: ToolbarAction; key: string; kind: "action" }
  | { key: "create"; kind: "create" }
  | { key: "export"; kind: "export" };
const toolbarItems = computed<ToolbarItem[]>(() => {
  const actionItems = visibleToolbarActions.value.map((action) => ({
    action,
    key: `action-${action.id}`,
    kind: "action" as const,
  }));
  const items: ToolbarItem[] = [];
  if (toolbarActionsPlacement.value === "before-create") {
    items.push(...actionItems);
  }
  if (isCreateEnabled.value) {
    items.push({ key: "create", kind: "create" });
  }
  if (toolbarActionsPlacement.value === "between-create-export") {
    items.push(...actionItems);
  }
  if (context.config.table.export) {
    items.push({ key: "export", kind: "export" });
  }
  if (toolbarActionsPlacement.value === "after-export") {
    items.push(...actionItems);
  }
  return items;
});

const translate = (key: string, fallback: string): string =>
  String(context.translations.value[key] ?? fallback);
const columnLabel = (columnId: string): string =>
  String(
    dataColumns.value.find((column) => column.id === columnId)?.header ??
      columnId
  );
const toolbarActionDisabled = (action: ToolbarAction): boolean => {
  const disabled =
    typeof action.disabled === "function"
      ? action.disabled(actionContext.value)
      : action.disabled;
  return Boolean(
    disabled || action.loading || pendingAction.value === action.id
  );
};
const toolbarActionVariant = (action: ToolbarAction): string => {
  if (action.variant === "default") {
    return "";
  }
  if (action.variant === "ghost") {
    return "yayaw-button-ghost";
  }
  if (action.variant === "destructive") {
    return "yayaw-button-danger";
  }
  if (action.variant === "secondary") {
    return "yayaw-button-secondary";
  }
  return "yayaw-button-outline";
};
const focusOptions = async (): Promise<void> => {
  await nextTick();
  optionsRoot.value
    ?.querySelector<HTMLElement>(".yayaw-options-menu button:not(:disabled)")
    ?.focus();
};
const openOptions = async (): Promise<void> => {
  optionsView.value = "main";
  optionsOpen.value = !optionsOpen.value;
  if (optionsOpen.value) await focusOptions();
};
const closeOptions = (restoreFocus = true): void => {
  const wasOpen = optionsOpen.value;
  optionsOpen.value = false;
  optionsView.value = "main";
  if (restoreFocus && wasOpen)
    document.getElementById(`table-options-${context.config.id}`)?.focus();
};
watch(optionsView, async () => {
  if (optionsOpen.value) await focusOptions();
});
watch(
  () => context.optionsRequest.value,
  async (request) => {
    if (!request) {
      return;
    }
    optionsView.value = request.view;
    optionsOpen.value = true;
    await focusOptions();
    if (request.columnId) {
      const columnId = request.columnId;
      setTimeout(() => {
        const field = Array.from(
          optionsRoot.value?.querySelectorAll<HTMLElement>(
            "[data-filter-column]"
          ) ?? []
        ).find((element) => element.dataset.filterColumn === columnId);
        field?.querySelector<HTMLElement>("input, select")?.focus();
      }, 10);
    }
    context.optionsRequest.value = undefined;
  }
);
const handleDocumentPointer = (event: PointerEvent): void => {
  if (!optionsRoot.value?.contains(event.target as Node)) {
    closeOptions(false);
  }
};
const handleDocumentKey = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    closeOptions();
  }
};
onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointer);
  document.addEventListener("keydown", handleDocumentKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointer);
  document.removeEventListener("keydown", handleDocumentKey);
});

const addAdvancedFilter = async (): Promise<void> => {
  const column = filterableColumns.value[0];
  if (!column) return;
  const filter = newFilter(column);
  context.state.advancedFilters.value = {
    ...context.state.advancedFilters.value,
    filters: [...context.state.advancedFilters.value.filters, filter],
  };
  closeOptions();
  await nextTick();
  document.getElementById(`filter-column-${filter.id}`)?.focus();
};
const setColumnFilter = (columnId: string, value: unknown): void => {
  const otherFilters = context.state.filters.value.filter(
    (filter) => filter.id !== columnId
  );
  context.state.filters.value =
    value === "" || value === undefined
      ? otherFilters
      : [...otherFilters, { id: columnId, value }];
};
const columnFilterValue = (columnId: string): unknown =>
  context.state.filters.value.find((filter) => filter.id === columnId)?.value ??
  "";
const setOptionFilter = (columnId: string, event: Event): void => {
  const rawValue = (event.target as HTMLSelectElement).value;
  const option = dataColumns.value
    .find((column) => column.id === columnId)
    ?.options?.find((item) => String(item.value) === rawValue);
  setColumnFilter(columnId, rawValue === "" ? "" : (option?.value ?? rawValue));
};
const setVisible = (column: ColumnDefinition, visible: boolean): void => {
  if (
    context.config.columns.mandatory.includes(column.id) ||
    column.enableHiding === false
  ) {
    return;
  }
  context.state.visibility.value = {
    ...context.state.visibility.value,
    [column.id]: visible,
  };
};
const addSort = (): void => {
  const used = new Set(context.state.sorting.value.map((sort) => sort.id));
  const column = sortableColumns.value.find((item) => !used.has(item.id));
  if (column) {
    context.state.sorting.value = [
      ...context.state.sorting.value,
      { id: column.id, desc: false },
    ];
  }
};
const updateSortColumn = (index: number, columnId: string): void => {
  const sorting = [...context.state.sorting.value];
  const currentSort = sorting[index];
  if (!currentSort) {
    return;
  }
  sorting[index] = { ...currentSort, id: columnId };
  context.state.sorting.value = sorting;
};
const toggleSortDirection = (index: number): void => {
  const sorting = [...context.state.sorting.value];
  const currentSort = sorting[index];
  if (!currentSort) {
    return;
  }
  sorting[index] = { ...currentSort, desc: !currentSort.desc };
  context.state.sorting.value = sorting;
};
const removeSort = (index: number): void => {
  context.state.sorting.value = context.state.sorting.value.filter(
    (_, itemIndex) => itemIndex !== index
  );
};
const addGrouping = (): void => {
  const used = new Set(context.state.grouping.value);
  const column = groupableColumns.value.find((item) => !used.has(item.id));
  if (column && context.state.grouping.value.length < maxGroupingCount.value) {
    context.state.grouping.value = [...context.state.grouping.value, column.id];
  }
};
const updateGrouping = (index: number, columnId: string): void => {
  const grouping = [...context.state.grouping.value];
  grouping[index] = columnId;
  context.state.grouping.value = grouping;
};
const removeGrouping = (index: number): void => {
  context.state.grouping.value = context.state.grouping.value.filter(
    (_, itemIndex) => itemIndex !== index
  );
};
const resetOptions = (): void => {
  context.state.filters.value = [];
  context.state.advancedFilters.value = { filters: [], joinOperator: "and" };
  context.state.sorting.value = context.config.columns.sort ?? [];
  context.state.grouping.value = [];
  context.state.visibility.value = Object.fromEntries(
    dataColumns.value.map((column) => [
      column.id,
      context.config.columns.visible.includes(column.id),
    ])
  );
  context.state.columnDragEnabled.value = defaultColumnDragEnabled.value;
};
const runAction = async (action: ToolbarAction): Promise<void> => {
  const callback = action.onClick ?? action.handler;
  if (!callback || toolbarActionDisabled(action)) {
    return;
  }
  pendingAction.value = action.id;
  try {
    await callback(actionContext.value);
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    pendingAction.value = undefined;
  }
};
const exportRows = async (): Promise<void> => {
  if (isExporting.value) return;
  const columns = exportColumns(
    context.config.columns.definitions,
    context.state.visibility.value,
    context.state.order.value
  );
  isExporting.value = true;
  try {
    const rows = await context.loadAllMatchingRows();
    if (context.onExport) {
      await context.onExport(rows);
    } else {
      downloadCsv(rows, columns, context.config.id);
    }
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    isExporting.value = false;
  }
};
</script>

<template>
  <div class="yayaw-toolbar">
    <div class="yayaw-toolbar-row">
      <div class="yayaw-toolbar-left">
        <SavedViews
          v-if="context.config.table.enableViews"
          :initial-views="initialViews"
        />
        <div
          v-if="modes.length > 1"
          class="yayaw-segmented"
          role="group"
          :aria-label="translate('displayMode', 'Display mode')"
        >
          <button
            v-for="mode in modes"
            :key="mode"
            type="button"
            :class="{ active: displayMode === mode }"
            @click="displayMode = mode"
          >
            {{ translate(`display.${mode}`, mode) }}
          </button>
        </div>
      </div>

      <div class="yayaw-toolbar-right">
        <input
          v-model="search"
          type="search"
          class="yayaw-input yayaw-search"
          :placeholder="String(context.translations.value.search)"
          :aria-label="String(context.translations.value.search)"
        />

        <div v-if="hasAnyMenuSection" ref="optionsRoot" class="yayaw-options-root">
          <button
            type="button"
            class="yayaw-button yayaw-button-outline"
            :class="{ 'yayaw-icon-only': actionsAsIcons }"
            :aria-label="translate('options', 'Options')"
            :aria-expanded="optionsOpen"
            aria-haspopup="dialog"
            :title="actionsAsIcons ? translate('options', 'Options') : undefined"
            :id="`table-options-${context.config.id}`"
          @click="openOptions"
          >
            <SlidersHorizontal :size="16" aria-hidden="true" />
            <span v-if="!actionsAsIcons">{{ translate("options", "Options") }}</span>
            <span
              v-if="activeOptionCount"
              class="yayaw-options-trigger-count"
              :class="{ 'yayaw-options-trigger-count-icon': actionsAsIcons }"
            >{{ activeOptionCount }}</span>
          </button>

          <section
            v-if="optionsOpen"
            class="yayaw-options-menu"
            role="dialog"
            :aria-label="translate('options', 'Options')"
          >
            <header class="yayaw-options-header">
              <button
                v-if="optionsView !== 'main'"
                type="button"
                class="yayaw-icon-button"
                :aria-label="translate('back', 'Back')"
                @click="optionsView = 'main'"
              >
                <ArrowLeft :size="16" aria-hidden="true" />
              </button>
              <strong>{{ optionsView === "main" ? "Menu" : translate(optionsView === "columns" ? "properties" : optionsView, optionsView) }}</strong>
              <button
                v-if="hideableColumns.length || columnDndFeatureEnabled"
                type="button"
                class="yayaw-icon-button"
                :disabled="!hasAnythingToReset"
                :aria-label="translate('reset', 'Reset')"
                :title="translate('reset', 'Reset')"
                @click="resetOptions"
              >
                <RotateCcw :size="16" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="yayaw-icon-button"
                :aria-label="translate('close', 'Close')"
                @click="closeOptions()"
              >
                <X :size="16" aria-hidden="true" />
              </button>
            </header>

            <div v-if="optionsView === 'main'" class="yayaw-options-list">
              <button
                type="button"
                class="yayaw-options-item"
                @click="optionsView = 'columns'"
              >
                <span class="yayaw-options-item-icon"><List :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("properties", "Properties") }}</span>
                  <small>{{ visibleColumnCount }} {{ translate("visible", "visible") }}</small>
                </span>
                <span class="yayaw-options-item-end">
                  <span class="yayaw-options-item-count">{{ visibleColumnCount }}</span>
                </span>
              </button>
              <button
                v-if="context.config.table.enableColumnFilters && (filterableColumns.length || props.enableAdvancedFilters)"
                type="button"
                class="yayaw-options-item"
                @click="optionsView = 'filters'"
              >
                <span class="yayaw-options-item-icon"><ListFilter :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("filters", "Filters") }}</span>
                  <small v-if="activeFilterCount">{{ activeFilterCount }} {{ translate("active", "active") }}</small>
                </span>
                <span class="yayaw-options-item-end">
                  <span v-if="activeFilterCount" class="yayaw-options-item-count">{{ activeFilterCount }}</span>
                  <ChevronRight v-else :size="16" aria-hidden="true" />
                </span>
              </button>
              <button
                v-if="context.config.table.enableSorting && sortableColumns.length"
                type="button"
                class="yayaw-options-item"
                @click="optionsView = 'sort'"
              >
                <span class="yayaw-options-item-icon"><ArrowDownAZ :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("sort", "Sort") }}</span>
                  <small v-if="context.state.sorting.value.length">{{ context.state.sorting.value.length }} {{ translate("active", "active") }}</small>
                </span>
                <span class="yayaw-options-item-end">
                  <span v-if="context.state.sorting.value.length" class="yayaw-options-item-count">{{ context.state.sorting.value.length }}</span>
                  <ChevronRight v-else :size="16" aria-hidden="true" />
                </span>
              </button>
              <button
                v-if="context.config.table.enableGrouping && groupableColumns.length"
                type="button"
                class="yayaw-options-item"
                @click="optionsView = 'group'"
              >
                <span class="yayaw-options-item-icon"><Layers :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("group", "Group") }}</span>
                  <small v-if="context.state.grouping.value.length">{{ context.state.grouping.value.length }} {{ translate("active", "active") }}</small>
                </span>
                <span class="yayaw-options-item-end">
                  <span v-if="context.state.grouping.value.length" class="yayaw-options-item-count">{{ context.state.grouping.value.length }}</span>
                  <ChevronRight v-else :size="16" aria-hidden="true" />
                </span>
              </button>
              <button
                v-if="context.config.table.enableCalculations"
                type="button"
                class="yayaw-options-item"
                role="switch"
                :aria-checked="context.footerCalculationsVisible.value"
                @click="context.footerCalculationsVisible.value = !context.footerCalculationsVisible.value"
              >
                <span class="yayaw-options-item-icon"><Calculator :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("calculations", "Footer calculations") }}</span>
                  <small>{{ context.footerCalculationsVisible.value ? translate("calculationsOn", "Shown") : translate("calculationsOff", "Hidden") }}</small>
                </span>
                <span class="yayaw-options-item-end" />
              </button>
            </div>

            <div v-else-if="optionsView === 'columns'" class="yayaw-options-content">
              <label
                v-for="column in dataColumns"
                :key="column.id"
                class="yayaw-checkbox-label yayaw-options-check"
              >
                <input
                  type="checkbox"
                  :checked="context.state.visibility.value[column.id] !== false"
                  :disabled="context.config.columns.mandatory.includes(column.id) || column.enableHiding === false"
                  @change="setVisible(column, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ column.header }}</span>
              </label>
              <label
                v-if="columnDndFeatureEnabled"
                class="yayaw-checkbox-label yayaw-options-check"
              >
                <input
                  type="checkbox"
                  :checked="context.state.columnDragEnabled.value"
                  @change="context.state.columnDragEnabled.value = ($event.target as HTMLInputElement).checked"
                />
                <span>{{ translate("columns.reorder", "Drag to reorder") }}</span>
              </label>
            </div>

            <div v-else-if="optionsView === 'filters'" class="yayaw-options-content">
              <label
                v-for="column in filterableColumns"
                :key="column.id"
                class="yayaw-field-inline"
                :data-filter-column="column.id"
              >
                <span>{{ column.header }}</span>
                <select
                  v-if="column.options?.length"
                  class="yayaw-select"
                  :value="columnFilterValue(column.id)"
                  @change="setOptionFilter(column.id, $event)"
                >
                  <option value="">{{ translate("all", "All") }}</option>
                  <option
                    v-for="option in column.options"
                    :key="String(option.value)"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <input
                  v-else
                  class="yayaw-input"
                  :type="column.type === 'number' ? 'number' : 'search'"
                  :value="columnFilterValue(column.id)"
                  @input="setColumnFilter(column.id, ($event.target as HTMLInputElement).value)"
                />
              </label>
              <button
                v-if="props.enableAdvancedFilters"
                type="button"
                class="yayaw-button yayaw-button-outline"
                :aria-label="translate('filters.add', 'Add filter')"
                @click="addAdvancedFilter"
              >
                <Plus :size="15" aria-hidden="true" />
                {{ translate("filters.add", "Add filter") }}
              </button>
            </div>

            <div v-else-if="optionsView === 'sort'" class="yayaw-options-content">
              <div
                v-for="(sort, index) in context.state.sorting.value"
                :key="`${sort.id}-${index}`"
                class="yayaw-options-rule"
              >
                <select
                  class="yayaw-select"
                  :value="sort.id"
                  :aria-label="`${translate('sort', 'Sort')} ${index + 1}`"
                  @change="updateSortColumn(index, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="column in sortableColumns"
                    :key="column.id"
                    :value="column.id"
                  >
                    {{ column.header }}
                  </option>
                </select>
                <button
                  type="button"
                  class="yayaw-button yayaw-button-outline"
                  @click="toggleSortDirection(index)"
                >
                  {{ sort.desc ? translate("descending", "Descending") : translate("ascending", "Ascending") }}
                </button>
                <button
                  type="button"
                  class="yayaw-icon-button"
                  :aria-label="`Remove ${columnLabel(sort.id)}`"
                  @click="removeSort(index)"
                >
                  <X :size="15" aria-hidden="true" />
                </button>
              </div>
              <button
                v-if="context.state.sorting.value.length < sortableColumns.length"
                type="button"
                class="yayaw-button yayaw-button-outline"
                @click="addSort"
              >
                <Plus :size="15" aria-hidden="true" />
                {{ translate("addSort", "Add sort") }}
              </button>
            </div>

            <div v-else class="yayaw-options-content">
              <div
                v-for="(columnId, index) in context.state.grouping.value"
                :key="`${columnId}-${index}`"
                class="yayaw-options-rule"
              >
                <select
                  class="yayaw-select"
                  :value="columnId"
                  :aria-label="`${translate('group', 'Group')} ${index + 1}`"
                  @change="updateGrouping(index, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="column in groupableColumns"
                    :key="column.id"
                    :value="column.id"
                  >
                    {{ column.header }}
                  </option>
                </select>
                <button
                  type="button"
                  class="yayaw-icon-button"
                  :aria-label="`Remove ${columnLabel(columnId)}`"
                  @click="removeGrouping(index)"
                >
                  <X :size="15" aria-hidden="true" />
                </button>
              </div>
              <button
                v-if="context.state.grouping.value.length < Math.min(maxGroupingCount, groupableColumns.length)"
                type="button"
                class="yayaw-button yayaw-button-outline"
                @click="addGrouping"
              >
                <Plus :size="15" aria-hidden="true" />
                {{ translate("group", "Group") }}
              </button>
            </div>

          </section>
        </div>

        <button
          v-if="[context.config.table.showResetFilters, context.config.table.showClearFilters].includes(true)"
          type="button"
          class="yayaw-button yayaw-button-outline yayaw-icon-only"
          :aria-label="translate('clearFilters', 'Clear filters')"
          :title="translate('clearFilters', 'Clear filters')"
          @click="context.state.resetFilters()"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </button>

        <template v-for="item in toolbarItems" :key="item.key">
          <button
            v-if="item.kind === 'action'"
            type="button"
            class="yayaw-button"
            :class="[
              toolbarActionVariant(item.action),
              { 'yayaw-icon-only': actionsAsIcons },
            ]"
            :disabled="toolbarActionDisabled(item.action)"
            :aria-label="actionsAsIcons ? item.action.label : undefined"
            :title="actionsAsIcons ? (item.action.tooltip ?? item.action.label) : item.action.tooltip"
            @click="runAction(item.action)"
          >
            <span v-if="pendingAction === item.action.id || item.action.loading" class="yayaw-spinner" aria-hidden="true" />
            <component v-else-if="item.action.icon" :is="item.action.icon" :size="16" aria-hidden="true" />
            <span v-else-if="actionsAsIcons" aria-hidden="true">{{ item.action.label.slice(0, 1) }}</span>
            <span v-if="!actionsAsIcons">{{ item.action.label }}</span>
          </button>

          <button
            v-else-if="item.kind === 'create'"
            type="button"
            class="yayaw-button"
            :class="{ 'yayaw-icon-only': actionsAsIcons }"
            :aria-label="translate('create', 'Create')"
            :title="actionsAsIcons ? translate('create', 'Create') : undefined"
            @click="context.openCreate"
          >
            <Plus :size="16" aria-hidden="true" />
            <span v-if="!actionsAsIcons">{{ translate("create", "Create") }}</span>
          </button>

          <button
            v-else
            type="button"
            class="yayaw-button yayaw-button-outline"
            :class="{ 'yayaw-icon-only': actionsAsIcons }"
            :aria-label="translate('export', 'Export')"
            :title="actionsAsIcons ? translate('export', 'Export') : undefined"
            :disabled="isExporting"
            :aria-busy="isExporting"
            @click="exportRows"
          >
            <Download :size="16" aria-hidden="true" />
            <span v-if="!actionsAsIcons">{{ translate("export", "Export") }}</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
