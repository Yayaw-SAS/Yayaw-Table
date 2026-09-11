<script setup lang="ts">
import TableTooltip from "./TableTooltip.vue";
import {
  FunnelX,
  MoreHorizontal,
  ArrowDownAZ,
  Calculator,
  Columns3,
  Images,
  Table2,
  ChevronRight,
  Layers,
  List,
  ListFilter,
  Plus,
  X,
} from "lucide-vue-next";
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue";
import { useTableContext } from "../../context";
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
import OptionFilter from "../filters/OptionFilter.vue";
import { filterBarColumns } from "../../filter-bar";
import TableDensityMenu from "./TableDensityMenu.vue";
import ToolbarMenu from "./ToolbarMenu.vue";
import ToolbarDataActions from "./ToolbarDataActions.vue";
import GallerySettings from "./GallerySettings.vue";
import KanbanSettings from "./KanbanSettings.vue";
import AdvancedFilters from "../filters/AdvancedFilters.vue";
import { useToolbarLayout } from "../../composables/use-toolbar-layout";
import { getViewModeCapabilities, sharePageUrl } from "../../view-menu";

const props = defineProps<{
  enableAdvancedFilters: boolean;
  initialViews: TableView[];
  toolbarActionsPlacement?: ToolbarActionsPlacement;
}>();
const context = useTableContext();
type OptionsView = "columns" | "filters" | "group" | "main" | "sort" | "cards";
const { compact, mobile } = useToolbarLayout();
const actionsOpen = ref(false);
const capabilities = computed(() => getViewModeCapabilities(context.state.displayMode.value));

const optionsRoot = ref<HTMLElement>();
const advancedFiltersPanel = ref<InstanceType<typeof AdvancedFilters>>();
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
const displayModeIcons = { table: Table2, kanban: Columns3, gallery: Images };
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
const filterableColumns = computed(() =>
  dataColumns.value.filter((column) => column.enableFiltering !== false)
);
const quickFilterIds = computed(() => new Set(filterBarColumns(dataColumns.value, context.config.table.filterBarColumns).map(column => column.id)));
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
const activeFilterCount = computed(
  () =>
    context.state.filters.value.length +
    context.state.advancedFilters.value.filters.filter(
      (filter) => filter.isActive !== false
    ).length
);
const maxGroupingCount = computed(() =>
  capabilities.value.maxGroups
);
const actionsAsIcons = computed(
  () => context.config.table.actionsAsIcons === true && !compact.value
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
    compact.value,
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
  if (toolbarActionsPlacement.value === "between-create-export") {
    items.push(...actionItems);
  }
  if (context.config.table.export) {
    items.push({ key: "export", kind: "export" });
  }
  if (toolbarActionsPlacement.value === "after-export") {
    items.push(...actionItems);
  }
  if (isCreateEnabled.value) {
    items.push({ key: "create", kind: "create" });
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
    ?.querySelector<HTMLElement>("button:not(:disabled), input, select")
    ?.focus();
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
    if (request.columnId && props.enableAdvancedFilters && request.view === "filters") {
      await advancedFiltersPanel.value?.add(request.columnId);
    } else if (request.columnId) {
      const columnId = request.columnId;
      setTimeout(() => {
        const field = Array.from(
          optionsRoot.value?.querySelectorAll<HTMLElement>(
            "[data-filter-column]"
          ) ?? []
        ).find((element) => element.dataset.filterColumn === columnId);
        field?.querySelector<HTMLElement>("input, select, button")?.focus();
      }, 10);
    }
    context.optionsRequest.value = undefined;
  }
);
const addAdvancedFilter = async (): Promise<void> => {
  await advancedFiltersPanel.value?.add();
};
const panelFilterColumns = computed(() => props.enableAdvancedFilters
  ? filterableColumns.value.filter((column) =>
    (compact.value && quickFilterIds.value.has(column.id)) ||
    context.state.filters.value.some((filter) => filter.id === column.id))
  : filterableColumns.value);
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
const dataItems = computed(() => toolbarItems.value.filter(item => item.kind !== "create"));
const shareLink = async () => {
  try {
    const result = await sharePageUrl(window.location.href, mobile.value);
    if (result === "copied") context.status.value = { type: "success", message: translate("url_state.link_copied", "Link copied to clipboard") };
  } catch {
    context.status.value = { type: "error", message: translate("actions.shareError", "Unable to share the link") };
  }
};
watch(optionsOpen, open => { if (!open) optionsView.value = "main"; });
watch(compact, value => { context.toolbarCompact.value = value; }, { immediate: true });
</script>

<template>
  <div ref="toolbarRoot" class="yayaw-toolbar" :data-compact="compact" data-table-toolbar>
    <SavedViews :initial-views="initialViews" :enabled="context.config.table.enableViews" :compact="compact" v-model:open="optionsOpen"
      :panel="optionsView !== 'main'" :panel-title="translate(optionsView === 'columns' ? 'properties' : optionsView === 'cards' ? 'views.cardSettings' : optionsView, optionsView)"
      @back="optionsView = 'main'">
      <template #settings><div ref="optionsRoot">
        <div
          v-if="modes.length > 1"
          class="yayaw-segmented"
          role="group"
          :aria-label="translate('displayMode', 'Display mode')"
        >
          <TableTooltip v-for="mode in modes" :key="mode" :label="translate(`display.${mode}`, mode)">
            <button
              type="button"
              :class="{ active: displayMode === mode }"
              :aria-pressed="displayMode === mode"
              @click="displayMode = mode"
            >
              <component :is="displayModeIcons[mode]" :size="16" aria-hidden="true" />
              <span>{{ translate(`display.${mode}`, mode) }}</span>
            </button>
          </TableTooltip>
        </div>
        <TableDensityMenu v-if="capabilities.density" inline />
            <div v-if="optionsView === 'main'" class="yayaw-options-list">
              <button
                v-if="capabilities.columns"
                type="button"
                class="yayaw-options-item"
                @click="optionsView = 'columns'"
              >
                <span class="yayaw-options-item-icon"><List :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("properties", "Properties") }}</span>
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
                </span>
                <span class="yayaw-options-item-end">
                  <span v-if="context.state.grouping.value.length" class="yayaw-options-item-count">{{ context.state.grouping.value.length }}</span>
                  <ChevronRight v-else :size="16" aria-hidden="true" />
                </span>
              </button>
              <button
                v-if="capabilities.calculations && context.config.table.enableCalculations"
                type="button"
                class="yayaw-options-item"
                role="switch"
                :aria-checked="context.footerCalculationsVisible.value"
                @click="context.footerCalculationsVisible.value = !context.footerCalculationsVisible.value"
              >
                <span class="yayaw-options-item-icon"><Calculator :size="16" aria-hidden="true" /></span>
                <span class="yayaw-options-item-copy">
                  <span>{{ translate("calculations", "Footer calculations") }}</span>
                </span>
                <span class="yayaw-options-item-end">{{ context.footerCalculationsVisible.value ? translate("calculationsOn", "Shown") : translate("calculationsOff", "Hidden") }}</span>
              </button>
              <button v-if="!capabilities.columns" type="button" class="yayaw-options-item" @click="optionsView = 'cards'"><List :size="16" /><span>{{ translate('views.cardSettings', 'Card settings') }}</span><ChevronRight :size="16" /></button>
            </div>


      </div></template>
      <template #panel><div ref="optionsRoot">
            <div v-if="optionsView === 'columns'" class="yayaw-options-content">
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
              <button v-if="[context.config.table.showClearFilters, context.config.table.showResetFilters].includes(true)" type="button" class="yayaw-button yayaw-button-outline" :aria-label="translate('clearFilters', 'Clear filters')" @click="context.state.resetFilters(); advancedFiltersPanel?.clearDrafts()"><FunnelX :size="16" />{{ translate('clearFilters', 'Clear filters') }}</button>
              <AdvancedFilters v-if="props.enableAdvancedFilters" ref="advancedFiltersPanel" />
              <div
                v-for="column in panelFilterColumns"
                :key="column.id"
                class="yayaw-field-inline"
                :data-filter-column="column.id"
              >
                <span>{{ column.header }}</span>
                <OptionFilter v-if="quickFilterIds.has(column.id)" :column="column" />
                <select
                  v-else-if="column.options?.length"
                  class="yayaw-select"
                  :aria-label="column.header"
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
                  :aria-label="column.header"
                  :type="column.type === 'number' ? 'number' : 'search'"
                  :value="columnFilterValue(column.id)"
                  @input="setColumnFilter(column.id, ($event.target as HTMLInputElement).value)"
                />
              </div>
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

            <div v-else-if="optionsView === 'cards'" class="yayaw-options-content"><KanbanSettings v-if="capabilities.kanban" /><GallerySettings v-else-if="capabilities.gallery" /></div>
            <div v-else class="yayaw-options-content">
              <div
                v-for="(columnId, index) in context.state.grouping.value.slice(0, maxGroupingCount)"
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

      </div></template>
    </SavedViews>
    <template v-if="compact">
      <button v-if="isCreateEnabled" type="button" class="yayaw-button yayaw-icon-only" :aria-label="translate('create', 'Create')" @click="context.openCreate"><Plus :size="16" /></button>
      <ToolbarMenu v-model:open="actionsOpen" compact :title="translate('actions.dataActions', 'Data actions')" :close-label="translate('close', 'Close')">
        <template #trigger><button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only" :aria-label="translate('actions.dataActions', 'Data actions')"><MoreHorizontal :size="16" /></button></template>
<ToolbarDataActions :show-search="context.config.table.enableColumnFilters !== false" :items="dataItems" :actions-as-icons="actionsAsIcons" :compact="compact" v-model:search="search"
  :search-label="translate('search', 'Search…')" :export-label="translate('export', 'Export')" :share-label="translate('url_state.share', 'Share')"
  :pending-action="pendingAction" :is-exporting="isExporting" :disabled="toolbarActionDisabled" :variant="toolbarActionVariant"
  @action="runAction" @export="exportRows" @share="shareLink" />
      </ToolbarMenu>
    </template>
    <template v-else>
<ToolbarDataActions :show-search="context.config.table.enableColumnFilters !== false" :items="dataItems" :actions-as-icons="actionsAsIcons" :compact="compact" v-model:search="search"
  :search-label="translate('search', 'Search…')" :export-label="translate('export', 'Export')" :share-label="translate('url_state.share', 'Share')"
  :pending-action="pendingAction" :is-exporting="isExporting" :disabled="toolbarActionDisabled" :variant="toolbarActionVariant"
  @action="runAction" @export="exportRows" @share="shareLink" />
      <TableTooltip v-if="isCreateEnabled" :label="translate('create', 'Create')"><button type="button" class="yayaw-button" :class="{ 'yayaw-icon-only': actionsAsIcons }" :aria-label="translate('create', 'Create')" @click="context.openCreate"><Plus :size="16" /><span v-if="!actionsAsIcons">{{ translate('create', 'Create') }}</span></button></TableTooltip>
    </template>
  </div>
</template>
