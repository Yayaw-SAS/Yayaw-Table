<script setup lang="ts">
import { computed, ref } from "vue";
import { useTableContext } from "../../context";
import { downloadCsv } from "../../core";
import type {
  AdvancedFilter,
  TableDisplayMode,
  TableView,
  ToolbarActionContext,
} from "../../types";
import SavedViews from "./SavedViews.vue";

defineProps<{ enableAdvancedFilters: boolean; initialViews: TableView[] }>();
const context = useTableContext();
const showColumns = ref(false);
const showFilters = ref(false);
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
const copyShareLink = async (): Promise<void> => {
  if (typeof navigator !== "undefined") {
    await navigator.clipboard?.writeText(context.state.shareableUrl());
  }
};

const addAdvancedFilter = (): void => {
  const column = context.config.columns.definitions.find(
    (item) =>
      item.enableFiltering !== false &&
      item.id !== "select" &&
      item.type !== "actions"
  );
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
  const others = context.state.filters.value.filter(
    (filter) => filter.id !== columnId
  );
  context.state.filters.value =
    value === "" || value === undefined
      ? others
      : [...others, { id: columnId, value }];
};
const columnFilterValue = (columnId: string): unknown =>
  context.state.filters.value.find((filter) => filter.id === columnId)?.value ??
  "";
const setOptionFilter = (columnId: string, event: Event): void => {
  const raw = (event.target as HTMLSelectElement).value;
  const option = context.config.columns.definitions
    .find((column) => column.id === columnId)
    ?.options?.find((item) => String(item.value) === raw);
  setColumnFilter(columnId, raw === "" ? "" : (option?.value ?? raw));
};
const setVisible = (columnId: string, visible: boolean): void => {
  if (context.config.columns.mandatory.includes(columnId)) {
    return;
  }
  context.state.visibility.value = {
    ...context.state.visibility.value,
    [columnId]: visible,
  };
};
const setGrouping = (columnId: string): void => {
  context.state.grouping.value = columnId ? [columnId] : [];
};
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
const runAction = async (id: string): Promise<void> => {
  const action = context.toolbarActions.value.find((item) => item.id === id);
  if (!action) {
    return;
  }
  const disabled =
    typeof action.disabled === "function"
      ? action.disabled(actionContext.value)
      : action.disabled;
  if (disabled) {
    return;
  }
  pendingAction.value = id;
  try {
    await action.handler(actionContext.value);
  } finally {
    pendingAction.value = undefined;
  }
};
const exportRows = async (): Promise<void> => {
  if (context.onExport) {
    await context.onExport(context.data.rows.value);
  } else {
    downloadCsv(
      context.data.rows.value,
      context.config.columns.definitions,
      context.config.id
    );
  }
};
</script>

<template>
  <div class="yayaw-toolbar">
    <div class="yayaw-toolbar-row">
      <div class="yayaw-toolbar-left">
        <SavedViews v-if="context.config.table.enableViews" :initial-views="initialViews" />
        <div v-if="modes.length > 1" class="yayaw-segmented" role="group" aria-label="Display mode">
          <button v-for="mode in modes" :key="mode" type="button" :class="{ active: displayMode === mode }" @click="displayMode = mode">{{ mode }}</button>
        </div>
      </div>
      <div class="yayaw-toolbar-right">
        <input v-model="search" type="search" class="yayaw-input yayaw-search" :placeholder="String(context.translations.value.search)" />
        <button v-if="context.config.table.enableColumnFilters" type="button" class="yayaw-button yayaw-button-outline" @click="showFilters = !showFilters">
          {{ context.translations.value.filters }}
          <span v-if="context.state.filters.value.length" class="yayaw-count">{{ context.state.filters.value.length }}</span>
        </button>
        <button v-if="enableAdvancedFilters" type="button" class="yayaw-button yayaw-button-outline" @click="addAdvancedFilter">+ Filter</button>
        <button type="button" class="yayaw-button yayaw-button-outline" @click="showColumns = !showColumns">{{ context.translations.value.columns }}</button>
        <button
          v-for="action in context.toolbarActions.value"
          :key="action.id"
          type="button"
          class="yayaw-button yayaw-button-outline"
          :disabled="pendingAction === action.id || (typeof action.disabled === 'boolean' && action.disabled)"
          @click="runAction(action.id)"
        >{{ pendingAction === action.id ? '…' : action.label }}</button>
        <button v-if="context.config.table.export" type="button" class="yayaw-button yayaw-button-outline" @click="exportRows">
          {{ context.translations.value.export }}
        </button>
        <button v-if="context.config.table.allowCreate && context.actions.value?.create" type="button" class="yayaw-button" @click="context.openCreate">
          {{ context.translations.value.create }}
        </button>
      </div>
    </div>
    <div v-if="showFilters" class="yayaw-column-filters">
      <label v-for="column in context.config.columns.definitions.filter((item) => item.enableFiltering !== false && item.id !== 'select' && item.type !== 'actions')" :key="column.id" class="yayaw-field-inline">
        <span>{{ column.header }}</span>
        <select v-if="column.options?.length" class="yayaw-select" :value="columnFilterValue(column.id)" @change="setOptionFilter(column.id, $event)">
          <option value="">All</option>
          <option v-for="option in column.options" :key="String(option.value)" :value="option.value">{{ option.label }}</option>
        </select>
        <input v-else class="yayaw-input" :type="column.type === 'number' ? 'number' : 'search'" :value="columnFilterValue(column.id)" @input="setColumnFilter(column.id, ($event.target as HTMLInputElement).value)" />
      </label>
    </div>
    <div v-if="showColumns" class="yayaw-columns-panel">
      <div class="yayaw-column-toggles">
        <label v-for="column in context.config.columns.definitions.filter((item) => item.id !== 'select' && item.type !== 'actions')" :key="column.id" class="yayaw-checkbox-label">
          <input type="checkbox" :checked="context.state.visibility.value[column.id] !== false" :disabled="context.config.columns.mandatory.includes(column.id)" @change="setVisible(column.id, ($event.target as HTMLInputElement).checked)" />
          {{ column.header }}
        </label>
      </div>
      <label class="yayaw-field-inline">
        <span>Group by</span>
        <select class="yayaw-select" :value="context.state.grouping.value[0] ?? ''" @change="setGrouping(($event.target as HTMLSelectElement).value)">
          <option value="">None</option>
          <option v-for="column in context.config.columns.definitions.filter((item) => item.enableGrouping !== false && item.id !== 'select' && item.type !== 'actions')" :key="column.id" :value="column.id">{{ column.header }}</option>
        </select>
      </label>
      <button type="button" class="yayaw-button yayaw-button-ghost" @click="context.state.reset">Reset</button>
      <button type="button" class="yayaw-button yayaw-button-ghost" @click="copyShareLink">Copy link</button>
    </div>
  </div>
</template>
