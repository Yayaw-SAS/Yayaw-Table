<script setup lang="ts">
import { computed, ref } from "vue";
import YayawDataTable from "../components/YayawDataTable.vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { TableActions, TableConfig, TableDisplayMode, TableRecord, TableViewConfig } from "../types";
import {
  type DashboardView,
  type DashboardWidget,
  widgetDisplayMode,
  widgetViewConfig,
  withDashboardFilters,
} from "./dashboard-model";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";

/**
 * A table instance of its own (no URL, private state) showing the widget's
 * view; the dashboard filters join its `list`/`aggregate` requests.
 */
const props = defineProps<{
  dashboardId: string;
  widget: DashboardWidget;
  source: DashboardTableSource;
  view?: DashboardView;
  rules: Record<string, unknown>[];
  revision: number;
  renderers?: DisplayModeRenderers;
  locale: string;
  label: DashboardLabel;
  getRowId?: (row: TableRecord) => string;
}>();

const failure = ref<string>();
const attempt = ref(0);
const viewConfig = computed(() => widgetViewConfig(props.widget, props.view));
const mode = computed(() => widgetDisplayMode(viewConfig.value));
const config = computed<TableConfig>(() => {
  const modes = props.source.config.table?.displayModes ?? ["table"];
  const wanted = mode.value as TableDisplayMode;
  return {
    ...props.source.config,
    table: {
      ...props.source.config.table,
      // Embedded: no URL, no toolbar, the widget's own view.
      syncUrl: false,
      showToolbar: false,
      showToolbarHeader: false,
      enableViews: false,
      displayModes: modes.includes(wanted) ? modes : [...modes, wanted],
    },
  } as TableConfig;
});
const rulesKey = computed(() => JSON.stringify(props.rules));
const actions = computed<TableActions>(() => {
  const filtered = withDashboardFilters(props.source.actions, JSON.parse(rulesKey.value) as Record<string, unknown>[]);
  const list = filtered.list as ((params: Record<string, unknown>) => Promise<unknown>) | undefined;
  if (!list) return filtered;
  return {
    ...filtered,
    list: async (params: Record<string, unknown>) => {
      try {
        const result = await list(params);
        failure.value = undefined;
        return result;
      } catch (error) {
        failure.value = error instanceof Error ? error.message : String(error);
        throw error;
      }
    },
  } as unknown as TableActions;
});
/** Short, stable instance keys (widget, filters and refresh count). */
const hash = (value: string): string => {
  let result = 5381;
  for (const character of value) {
    result = (result * 33 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return result.toString(36);
};
const instanceId = computed(
  () => `dashboard-${hash(`${props.dashboardId}:${props.widget.id}:${rulesKey.value}:${props.revision}:${attempt.value}`)}`
);
const initialView = computed(() => ({
  id: props.view?.id ?? null,
  config: viewConfig.value as TableViewConfig,
}));
const missingRenderer = computed(() => mode.value === "chart" && !props.renderers?.chart);
const retry = () => {
  failure.value = undefined;
  attempt.value += 1;
};
</script>

<template>
  <div v-if="missingRenderer" class="yayaw-dashboard-message" data-widget-state="error">
    <p role="alert">{{ props.label("widgetError", { error: "chart renderer" }) }}</p>
  </div>
  <div v-else class="yayaw-dashboard-embedded" :data-widget-mode="mode">
    <div v-if="failure" class="yayaw-dashboard-message" data-widget-state="error">
      <p role="alert">{{ props.label("widgetError", { error: failure }) }}</p>
      <button type="button" class="yayaw-button yayaw-button-outline" @click="retry">{{ props.label("retry") }}</button>
    </div>
    <YayawDataTable
      :key="instanceId"
      :table-type="props.widget.tableId ?? props.source.config.id"
      :table-id="instanceId"
      :instance-id="instanceId"
      :config="config"
      :get-table-actions="() => actions"
      :initial-view="initialView"
      :enable-toolbar="false"
      :show-filter-bar="false"
      :sync-url="false"
      :display-mode-renderers="props.renderers"
      :locale="props.locale"
      :get-row-id="props.getRowId"
    />
  </div>
</template>
