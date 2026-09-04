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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useTableContext } from "../../context";
import { downloadCsv } from "../../core";
import type {
  AdvancedFilter,
  ColumnDefinition,
  TableDisplayMode,
  TableView,
  ToolbarAction,
  ToolbarActionContext,
} from "../../types";
import SavedViews from "./SavedViews.vue";

const props = defineProps<{
  enableAdvancedFilters: boolean;
  initialViews: TableView[];
}>();
const context = useTableContext();
type OptionsView = "columns" | "filters" | "group" | "main" | "sort";

const optionsRoot = ref<HTMLElement>();
const optionsOpen = ref(false);
const optionsView = ref<OptionsView>("main");
const pendingAction = ref<string>();
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
const activeFilterCount = computed(
  () =>
    context.state.filters.value.length +
    context.state.advancedFilters.value.filters.length
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
    hasHiddenColumns.value
);
const hasAnyMenuSection = computed(
  () =>
    hideableColumns.value.length > 0 ||
    (context.config.table.enableColumnFilters &&
      (filterableColumns.value.length > 0 || props.enableAdvancedFilters)) ||
    (context.config.table.enableSorting && sortableColumns.value.length > 0) ||
    (context.config.table.enableGrouping && groupableColumns.value.length > 0) ||
    context.config.table.enableCalculations
);
const maxGroupingCount = computed(() =>
  context.state.displayMode.value === "table" ? 2 : 1
);
const actionsAsIcons = computed(
  () => context.config.table.actionsAsIcons === true
);
const actionContext = computed<ToolbarActionContext>(() => ({
  data: context.data.rows.value,
  selectedRows: context.selectedRows.value,
  selectedIds: Object.keys(context.selection.value).filter(
    (id) => context.selection.value[id]
  ),
  count: context.selectedRows.value.length,
  clearSelection: context.clearSelection,
  refresh: context.refresh,
}));
const visibleToolbarActions = computed(() =>
  context.toolbarActions.value.filter(
    (action) => !actionsAsIcons.value || action.showInIconMode !== false
  )
);

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
  return Boolean(disabled || action.loading || pendingAction.value);
};
const toolbarActionVariant = (action: ToolbarAction): string => {
  if (action.variant === "default") {
    return "";
  }
  return action.variant === "ghost"
    ? "yayaw-button-ghost"
    : "yayaw-button-outline";
};
const openOptions = (): void => {
  optionsView.value = "main";
  optionsOpen.value = !optionsOpen.value;
};
const closeOptions = (): void => {
  optionsOpen.value = false;
  optionsView.value = "main";
};
const handleDocumentPointer = (event: PointerEvent): void => {
  if (!optionsRoot.value?.contains(event.target as Node)) {
    closeOptions();
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

const addAdvancedFilter = (): void => {
  const column = filterableColumns.value[0];
  if (!column) {
    return;
  }
  const filter: AdvancedFilter = {
    id: crypto.randomUUID(),
    columnId: column.id,
    operator: column.type === "boolean" ? "isTrue" : "contains",
    type: column.type,
    values: "",
  };
  context.state.advancedFilters.value = {
    ...context.state.advancedFilters.value,
    filters: [...context.state.advancedFilters.value.filters, filter],
  };
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
  if (
    column &&
    context.state.grouping.value.length < maxGroupingCount.value
  ) {
    context.state.grouping.value = [
      ...context.state.grouping.value,
      column.id,
    ];
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
};
const runAction = async (id: string): Promise<void> => {
  const action = context.toolbarActions.value.find((item) => item.id === id);
  if (!action || toolbarActionDisabled(action)) {
    return;
  }
  pendingAction.value = id;
  try {
    await action.handler(actionContext.value);
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
  if (context.onExport) {
    await context.onExport(context.data.rows.value);
    return;
  }
  downloadCsv(
    context.data.rows.value,
    context.config.columns.definitions,
    context.config.id
  );
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
          aria-label="Display mode"
        >
          <button
            v-for="mode in modes"
            :key="mode"
            type="button"
            :class="{ active: displayMode === mode }"
            @click="displayMode = mode"
          >
            {{ mode }}
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
            aria-haspopup="menu"
            :title="actionsAsIcons ? translate('options', 'Options') : undefined"
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
            role="menu"
            :aria-label="translate('options', 'Options')"
          >
            <header class="yayaw-options-header">
              <button
                v-if="optionsView !== 'main'"
                type="button"
                class="yayaw-icon-button"
                aria-label="Back"
                @click="optionsView = 'main'"
              >
                <ArrowLeft :size="16" aria-hidden="true" />
              </button>
              <strong>{{ optionsView === "main" ? "Menu" : translate(optionsView === "columns" ? "properties" : optionsView, optionsView) }}</strong>
              <button
                v-if="hideableColumns.length"
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
                aria-label="Close"
                @click="closeOptions"
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
                  <small>{{ visibleColumnCount }} visible</small>
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
                  <small v-if="activeFilterCount">{{ activeFilterCount }} active</small>
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
                  <small v-if="context.state.sorting.value.length">{{ context.state.sorting.value.length }} active</small>
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
                  <small v-if="context.state.grouping.value.length">{{ context.state.grouping.value.length }} active</small>
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
                role="menuitemcheckbox"
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
            </div>

            <div v-else-if="optionsView === 'filters'" class="yayaw-options-content">
              <label
                v-for="column in filterableColumns"
                :key="column.id"
                class="yayaw-field-inline"
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
                @click="addAdvancedFilter"
              >
                <Plus :size="15" aria-hidden="true" />
                {{ translate("filters", "Filters") }}
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
          v-if="context.config.table.showResetFilters === true"
          type="button"
          class="yayaw-button yayaw-button-outline yayaw-icon-only"
          :aria-label="translate('clearFilters', 'Clear filters')"
          :title="translate('clearFilters', 'Clear filters')"
          @click="context.state.resetFilters()"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </button>

        <button
          v-for="action in visibleToolbarActions"
          :key="action.id"
          type="button"
          class="yayaw-button"
          :class="[
            toolbarActionVariant(action),
            { 'yayaw-icon-only': actionsAsIcons },
          ]"
          :disabled="toolbarActionDisabled(action)"
          :aria-label="actionsAsIcons ? action.label : undefined"
          :title="actionsAsIcons ? (action.tooltip ?? action.label) : action.tooltip"
          @click="runAction(action.id)"
        >
          <span v-if="pendingAction === action.id || action.loading" class="yayaw-spinner" aria-hidden="true" />
          <component v-else-if="action.icon" :is="action.icon" :size="16" aria-hidden="true" />
          <span v-else-if="actionsAsIcons" aria-hidden="true">{{ action.label.slice(0, 1) }}</span>
          <span v-if="!actionsAsIcons">{{ action.label }}</span>
        </button>

        <button
          v-if="context.config.table.export"
          type="button"
          class="yayaw-button yayaw-button-outline"
          :class="{ 'yayaw-icon-only': actionsAsIcons }"
          :aria-label="translate('export', 'Export')"
          :title="actionsAsIcons ? translate('export', 'Export') : undefined"
          @click="exportRows"
        >
          <Download :size="16" aria-hidden="true" />
          <span v-if="!actionsAsIcons">{{ translate("export", "Export") }}</span>
        </button>
        <button
          v-if="context.config.table.allowCreate && context.actions.value?.create"
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
      </div>
    </div>
  </div>
</template>
