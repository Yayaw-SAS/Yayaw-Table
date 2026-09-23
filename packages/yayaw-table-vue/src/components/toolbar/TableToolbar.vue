<script setup lang="ts">
import { type Component, defineComponent, type PropType, type VNodeChild } from "vue";
import TableTooltip from "./TableTooltip.vue";
import {
  FunnelX,
  Download,
  LayoutGrid,
  Rows3,
  Send,
  Share2,
  SlidersHorizontal,
  ArrowDownAZ,
  Calculator,
  ChevronRight,
  Layers,
  GripVertical,
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
import { exportColumns } from "../../core";
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
import ToolbarSearch from "./ToolbarSearch.vue";
import MenuChoiceList from "./MenuChoiceList.vue";
import ExportPanel from "./ExportPanel.vue";
import {
  availableExportFormats,
  defaultExportFileName,
  downloadExportFile,
  type ExportColumn,
  type ExportSettings,
  printExportPage,
  runExport,
} from "../../export-model";
import {
  type DataDestination,
  dataDestinationQuery,
  groupDataDestinations,
  runDataDestination,
} from "../../data-destinations";
import { TABLE_DENSITY_OPTIONS, type TableDensity } from "../../table-contracts";
import GanttSettings from "./GanttSettings.vue";
import { planningLabelOverrides } from "../../planning/labels";
import { ganttSettingsLabels } from "../../planning/settings";
import { availableDisplayModes } from "../../view-menu";
import { isManualOrder, MANUAL_ORDER_SORT_ID, manualOrderSorting } from "../../manual-order";
import GallerySettings from "./GallerySettings.vue";
import ListSettings from "./ListSettings.vue";
import { displayModeIcons } from "./display-mode-icons";
import TableSelect from "../controls/TableSelect.vue";
import DisplayModeRendererSettings from "./DisplayModeRendererSettings.vue";
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
type OptionsView = "columns" | "filters" | "group" | "main" | "sort" | "cards" | "layout" | "density" | "export";
const { compact, mobile } = useToolbarLayout();
const capabilities = computed(() => getViewModeCapabilities(context.state.displayMode.value));

const optionsRoot = ref<HTMLElement>();
const advancedFiltersPanel = ref<InstanceType<typeof AdvancedFilters>>();
const optionsOpen = ref(false);
const optionsView = ref<OptionsView>("main");
const densityLabel = computed(() => String(context.translations.value.density ?? "Table density"));
const densityValue = computed(() => TABLE_DENSITY_OPTIONS.find((option) => option.value === context.state.density.value)?.label ?? "");
const optionsTitle = computed(() => {
  switch (optionsView.value) {
    case "main":
      return translate("views.settings", "View settings");
    case "cards":
      return cardSettingsTitle.value;
    case "layout":
      return translate("displayMode", "Display mode");
    case "density":
      return densityLabel.value;
    case "export":
      return translate("export", "Export");
    case "columns":
      return translate("properties", "properties");
    default:
      return translate(optionsView.value, optionsView.value);
  }
});
const cardSettingsTitle = computed(() => context.state.displayMode.value === "gantt" ? ganttSettingsLabels(context.locale, planningLabelOverrides((key) => translate(key, key))).title : translate("views.cardSettings", "Card settings"));
const pendingAction = ref<string>();
const isExporting = ref(false);
const search = computed({
  get: () => context.state.search.value,
  set: (value: string) => {
    context.state.search.value = value;
  },
});
const activeRenderer = computed(() => context.displayModeRenderers?.[context.state.displayMode.value]);
const modes = computed<TableDisplayMode[]>(() =>
  availableDisplayModes(context.config.table.displayModes, {
    planning: Boolean(context.planning),
    renderers: Object.keys(context.displayModeRenderers ?? {}),
  })
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
    Boolean(column.filterRenderer) || (compact.value && quickFilterIds.value.has(column.id)) ||
    context.state.filters.value.some((filter) => filter.id === column.id))
  : filterableColumns.value);
const FilterContent = defineComponent({ props: { node: { type: null as unknown as PropType<VNodeChild> } }, setup: props => () => props.node });
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
const canSortManually = computed(
  () =>
    context.config.table.manualOrder === true &&
    typeof context.actions.value?.reorder === "function"
);
const manualSortActive = computed(() => isManualOrder(context.state.sorting.value));
const toggleManualSort = (): void => {
  context.state.sorting.value = manualSortActive.value ? [] : manualOrderSorting();
};
const addSort = (): void => {
  // A view's manual order cannot be combined with column sorts.
  const current = context.state.sorting.value.filter(
    (sort) => sort.id !== MANUAL_ORDER_SORT_ID
  );
  const used = new Set(current.map((sort) => sort.id));
  const column = sortableColumns.value.find((item) => !used.has(item.id));
  if (column) {
    context.state.sorting.value = [...current, { id: column.id, desc: false }];
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
const exportColumn = (column: ColumnDefinition): ExportColumn => ({
  id: column.id,
  header: column.header,
  type: column.type,
  options: column.options,
  numberFormat: column.numberFormat as ExportColumn["numberFormat"],
  dateDisplayPreset: column.dateDisplayPreset,
  dateFormat: column.dateFormat,
  timeZone: column.timeZone,
});
const exportLabel = (key: string, fallback: string): string => translate(`exportScreen.${key}`, fallback);
const exportFormats = computed(() =>
  availableExportFormats(context.config.table.exportFormats, Boolean(context.actions.value?.exportFile))
);
// Server first through `actions.exportFile`; otherwise CSV or print here.
const exportRows = async (settings: ExportSettings): Promise<void> => {
  if (isExporting.value) return;
  isExporting.value = true;
  try {
    await runExport({
      settings,
      viewId: context.state.activeViewId.value ?? null,
      query: dataDestinationQuery({
        search: context.state.search.value,
        filters: Object.fromEntries(context.state.filters.value.map((filter) => [filter.id, filter.value])),
        advancedFilters: context.state.advancedFilters.value,
        sorting: context.state.sorting.value,
      }),
      allColumns: context.config.columns.definitions.filter((column) => column.id !== "select" && column.type !== "actions").map(exportColumn),
      visibleColumns: exportColumns(context.config.columns.definitions, context.state.visibility.value, context.state.order.value).map(exportColumn),
      selectedRowIds: context.selectedRows.value.map((row) => context.getRowId(row)),
      selectedRows: context.selectedRows.value,
      loadRows: () => context.loadAllMatchingRows(),
      locale: context.locale,
      title: String(context.translations.value.title ?? context.config.id),
      exportFile: context.actions.value?.exportFile,
      onRows: context.onExport,
      download: downloadExportFile,
      print: printExportPage,
    });
  } catch (cause) {
    context.status.value = {
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  } finally {
    isExporting.value = false;
  }
};
// Application actions stay in the toolbar on wide screens and join the settings "Data" section on touch layouts.
const actionItems = computed(() => visibleToolbarActions.value.map((action) => ({ action, key: `action-${action.id}`, kind: "action" as const })));
const hasExport = computed(() => Boolean(context.config.table.export));
const hasShare = computed(() => context.config.table.share !== false);
const destinations = computed(() =>
  groupDataDestinations(context.actions.value?.destinations, context.selectedRows.value.length)
);
const pendingDestination = ref<string>();
// One destination runs at a time; the host receives the view's query first.
const runDestination = async (destination: DataDestination<Component>): Promise<void> => {
  if (pendingDestination.value) return;
  pendingDestination.value = destination.id;
  const result = await runDataDestination(destination, {
    tableId: context.config.id,
    tableType: context.tableType,
    viewId: context.state.activeViewId.value ?? null,
    query: dataDestinationQuery({
      search: context.state.search.value,
      filters: Object.fromEntries(context.state.filters.value.map((filter) => [filter.id, filter.value])),
      advancedFilters: context.state.advancedFilters.value,
      sorting: context.state.sorting.value,
    }),
    columns: exportColumns(context.config.columns.definitions, context.state.visibility.value, context.state.order.value)
      .map((column) => ({ id: column.id, header: column.header })),
    selectedRowIds: context.selectedRows.value.map((row) => context.getRowId(row)),
    url: window.location.href,
    loadRows: () => context.loadAllMatchingRows(),
  });
  pendingDestination.value = undefined;
  context.status.value = result.ok
    ? { type: "success", message: result.message ?? translate("destinations.done", "Sent") }
    : { type: "error", message: result.error };
};
const settingsBadge = computed(() => activeFilterCount.value + context.state.sorting.value.length);
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
    <SavedViews :initial-views="initialViews" :enabled="context.config.table.enableViews" :compact="compact" />
    <div class="yayaw-toolbar-end">
    <ToolbarSearch v-if="context.config.table.enableColumnFilters !== false" v-model="search" :label="translate('search', 'Search…')" :clear-label="translate('reset', 'Reset')" :compact="compact" />
    <ToolbarDataActions v-if="!compact && actionItems.length" :show-search="false" :show-share="false" :items="actionItems" :actions-as-icons="actionsAsIcons" :compact="compact" v-model:search="search"
      :search-label="translate('search', 'Search…')" :export-label="translate('export', 'Export')" :share-label="translate('url_state.share', 'Share')"
      :pending-action="pendingAction" :is-exporting="isExporting" :disabled="toolbarActionDisabled" :variant="toolbarActionVariant"
      @action="runAction" @share="shareLink" />
    <ToolbarMenu v-model:open="optionsOpen" :compact="compact" align="end"
      :title="optionsTitle"
      :back="optionsView !== 'main'" :back-label="translate('back', 'Back')" :close-label="translate('close', 'Close')" @back="optionsView = 'main'">
      <template #trigger>
        <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only yayaw-settings-trigger" :id="`table-options-${context.config.id}`" :aria-label="translate('views.settings', 'View settings')">
          <SlidersHorizontal :size="16" aria-hidden="true" />
          <span v-if="settingsBadge" class="yayaw-settings-badge" aria-hidden="true">{{ settingsBadge }}</span>
        </button>
      </template>
      <div v-if="optionsView === 'main'" ref="optionsRoot">
        <div v-if="modes.length > 1 && !compact" class="yayaw-display-mode-select">
          <TableSelect
            v-model="displayMode"
            :label="translate('displayMode', 'Display mode')"
            :options="modes.map((mode) => ({ value: mode, label: translate(`display.${mode}`, mode) }))"
          />
        </div>
        <TableDensityMenu v-if="capabilities.density && !compact" inline />
            <div v-if="optionsView === 'main'" class="yayaw-options-list">
              <!-- Touch drawers read as one list: layout and density open their own choices. -->
              <template v-if="compact">
                <button v-if="modes.length > 1" type="button" class="yayaw-options-item" @click="optionsView = 'layout'">
                  <span class="yayaw-options-item-icon"><LayoutGrid :size="16" aria-hidden="true" /></span>
                  <span class="yayaw-options-item-copy"><span>{{ translate('displayMode', 'Display mode') }}</span></span>
                  <span class="yayaw-options-item-end">{{ translate(`display.${displayMode}`, displayMode) }}</span>
                </button>
                <button v-if="capabilities.density" type="button" class="yayaw-options-item" @click="optionsView = 'density'">
                  <span class="yayaw-options-item-icon"><Rows3 :size="16" aria-hidden="true" /></span>
                  <span class="yayaw-options-item-copy"><span>{{ densityLabel }}</span></span>
                  <span class="yayaw-options-item-end">{{ densityValue }}</span>
                </button>
              </template>
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
                  <span>{{ translate("filter", "Filter") }}</span>
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
              <button v-if="['kanban', 'gallery', 'gantt', 'list'].includes(context.state.displayMode.value) || activeRenderer?.settings" type="button" class="yayaw-options-item" @click="optionsView = 'cards'"><List :size="16" /><span>{{ cardSettingsTitle }}</span><ChevronRight :size="16" /></button>
            </div>


        <div class="yayaw-options-list yayaw-options-data" data-menu-section="data">
          <p class="yayaw-options-heading">{{ translate('menu.data', 'Data') }}</p>
          <template v-if="compact">
            <button v-for="item in actionItems" :key="item.key" type="button" class="yayaw-options-item" :disabled="toolbarActionDisabled(item.action)" @click="runAction(item.action)">
              <span class="yayaw-options-item-icon"><component :is="item.action.icon" v-if="item.action.icon" :size="16" aria-hidden="true" /></span>
              <span class="yayaw-options-item-copy"><span>{{ item.action.label }}</span></span>
            </button>
          </template>
          <button v-if="hasExport" type="button" class="yayaw-options-item" :aria-busy="isExporting" @click="optionsView = 'export'">
            <span class="yayaw-options-item-icon"><span v-if="isExporting" class="yayaw-spinner" aria-hidden="true" /><Download v-else :size="16" aria-hidden="true" /></span>
            <span class="yayaw-options-item-copy"><span>{{ translate('export', 'Export') }}</span></span>
            <ChevronRight :size="16" aria-hidden="true" />
          </button>
          <button v-for="destination in destinations.export" :key="destination.id" type="button" class="yayaw-options-item"
            :disabled="Boolean(pendingDestination)" :aria-busy="pendingDestination === destination.id" @click="runDestination(destination)">
            <span class="yayaw-options-item-icon">
              <span v-if="pendingDestination === destination.id" class="yayaw-spinner" aria-hidden="true" />
              <component :is="destination.icon ?? Send" v-else :size="16" aria-hidden="true" />
            </span>
            <span class="yayaw-options-item-copy"><span>{{ destination.label }}</span></span>
          </button>
          <button v-if="hasShare" type="button" class="yayaw-options-item" @click="shareLink">
            <span class="yayaw-options-item-icon"><Share2 :size="16" aria-hidden="true" /></span>
            <span class="yayaw-options-item-copy"><span>{{ translate('url_state.share', 'Share') }}</span></span>
          </button>
          <button v-for="destination in destinations.share" :key="destination.id" type="button" class="yayaw-options-item"
            :disabled="Boolean(pendingDestination)" :aria-busy="pendingDestination === destination.id" @click="runDestination(destination)">
            <span class="yayaw-options-item-icon">
              <span v-if="pendingDestination === destination.id" class="yayaw-spinner" aria-hidden="true" />
              <component :is="destination.icon ?? Send" v-else :size="16" aria-hidden="true" />
            </span>
            <span class="yayaw-options-item-copy"><span>{{ destination.label }}</span></span>
          </button>
        </div>
      </div>
      <div v-else ref="optionsRoot">
            <ExportPanel v-if="optionsView === 'export'" :busy="isExporting" :formats="exportFormats" :label="exportLabel"
              :default-file-name="defaultExportFileName(String(context.translations.value.title ?? context.config.id))"
              :selected-count="context.selectedRows.value.length" @export="exportRows" />
            <MenuChoiceList v-else-if="optionsView === 'layout'" :label="translate('displayMode', 'Display mode')" :model-value="displayMode"
              :options="modes.map((mode) => ({ value: mode, label: translate(`display.${mode}`, mode), icon: displayModeIcons[mode] }))"
              @update:model-value="(mode) => (displayMode = mode as TableDisplayMode)" />
            <MenuChoiceList v-else-if="optionsView === 'density'" :label="densityLabel" :model-value="context.state.density.value"
              :options="TABLE_DENSITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))"
              @update:model-value="(density) => (context.state.density.value = density as TableDensity)" />
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
              <button v-if="[context.config.table.showClearFilters, context.config.table.showResetFilters].includes(true)" type="button" class="yayaw-button yayaw-button-outline" :aria-label="translate('clearFilters', 'Clear filters')" @click="context.state.resetFilters(); advancedFiltersPanel?.clearDrafts()"><FunnelX :size="16" />{{ translate('clearFilters', 'Clear filters') }}</button>
              <AdvancedFilters v-if="props.enableAdvancedFilters" ref="advancedFiltersPanel" />
              <div
                v-for="column in panelFilterColumns"
                :key="column.id"
                class="yayaw-field-inline"
                :data-filter-column="column.id"
              >
                <span>{{ column.header }}</span>
                <FilterContent v-if="column.filterRenderer" :node="column.filterRenderer({ value: columnFilterValue(column.id), onChange: value => setColumnFilter(column.id, value) })" />
                <OptionFilter v-else-if="quickFilterIds.has(column.id)" :column="column" />
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
              <button
                v-if="canSortManually"
                type="button"
                class="yayaw-button yayaw-button-outline"
                :aria-pressed="manualSortActive"
                @click="toggleManualSort"
              >
                <GripVertical :size="15" aria-hidden="true" />
                {{ translate("manualOrder", "Manual order") }}
              </button>
              <div
                v-for="(sort, index) in manualSortActive ? [] : context.state.sorting.value"
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

            <div v-else-if="optionsView === 'cards'" class="yayaw-options-content"><KanbanSettings v-if="capabilities.kanban" /><GallerySettings v-else-if="capabilities.gallery" /><GanttSettings v-else-if="context.state.displayMode.value === 'gantt'" /><ListSettings v-else-if="context.state.displayMode.value === 'list'" /><DisplayModeRendererSettings v-else-if="activeRenderer" :renderer="activeRenderer" /></div>
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

      </div>
    </ToolbarMenu>
    <template v-if="compact">
      <button v-if="isCreateEnabled" type="button" class="yayaw-button yayaw-icon-only" :aria-label="translate('add_an_item', 'Add item')" @click="context.openCreate()"><Plus :size="16" /></button>
    </template>
    <template v-else>
      <TableTooltip v-if="isCreateEnabled" :label="translate('add_an_item', 'Add item')"><button type="button" class="yayaw-button" :class="{ 'yayaw-icon-only': actionsAsIcons }" :aria-label="translate('add_an_item', 'Add item')" @click="context.openCreate()"><Plus :size="16" /><span v-if="!actionsAsIcons">{{ translate('add_an_item', 'Add item') }}</span></button></TableTooltip>
    </template>
    </div>
  </div>
</template>
