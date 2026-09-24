<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import YayawDataTable from "../components/YayawDataTable.vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type {
  DataTableTranslations,
  TableActions,
  TableConfig,
  TableDisplayMode,
  TableRecord,
  TableViewConfig,
} from "../types";
import { observeDashboardFit } from "./dashboard-fit";
import {
  type DashboardView,
  type DashboardWidget,
  dashboardFitPageSize,
  dashboardFitsRecords,
  dashboardListTotal,
  dashboardMoreCount,
  widgetDisplayMode,
  widgetOverflow,
  widgetViewConfig,
  withDashboardFilters,
} from "./dashboard-model";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";

/**
 * A table instance of its own (no URL, private state) showing the widget's
 * view; the dashboard filters join its `list`/`aggregate` requests. A fit
 * widget (the default) shows the records that fit and "+N more".
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
  /** The page's table labels, e.g. French pagination. */
  translations?: DataTableTranslations;
  label: DashboardLabel;
  getRowId?: (row: TableRecord) => string;
  /** The widget's size in the layout, which sets how many records a fit widget loads. */
  size: { w: number; h: number };
  /** Whether "View all" (the full view) is offered under a fit widget's records. */
  openable?: boolean;
}>();
const emit = defineEmits<{ viewAll: [] }>();

const failure = ref<string>();
const attempt = ref(0);
const total = ref<number>();
const shown = ref<number>();
const viewConfig = computed(() => widgetViewConfig(props.widget, props.view));
const mode = computed(() => widgetDisplayMode(viewConfig.value));
const records = computed(() => dashboardFitsRecords(mode.value));
const fits = computed(() => records.value && widgetOverflow(props.widget) === "fit");
const pageSize = computed(() =>
  fits.value ? dashboardFitPageSize(mode.value, props.size, viewConfig.value.pageSize) : undefined
);
// Embedded: no URL, toolbar, views or row selection; charts fill the widget.
// Only records that scroll (`overflow: "scroll"`) keep their pagination; fit
// records show "+N more" instead.
const config = computed<TableConfig>(() => {
  const modes = props.source.config.table?.displayModes ?? ["table"];
  const wanted = mode.value as TableDisplayMode;
  const chart = props.source.config.table?.chart;
  return {
    ...props.source.config,
    table: {
      ...props.source.config.table,
      syncUrl: false,
      showToolbar: false,
      showToolbarHeader: false,
      enableViews: false,
      enableRowSelection: false,
      ...(records.value && !fits.value ? {} : { enablePagination: false }),
      ...(chart === false ? {} : { chart: { ...(typeof chart === "object" ? chart : {}), fill: true } }),
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
        total.value = dashboardListTotal(result);
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
  () =>
    `dashboard-${hash(`${props.dashboardId}:${props.widget.id}:${rulesKey.value}:${props.revision}:${attempt.value}:${pageSize.value ?? ""}`)}`
);
const initialView = computed(() => ({
  id: props.view?.id ?? null,
  config: (pageSize.value ? { ...viewConfig.value, pageSize: pageSize.value } : viewConfig.value) as TableViewConfig,
}));
const missingRenderer = computed(() => mode.value === "chart" && !props.renderers?.chart);
const retry = () => {
  failure.value = undefined;
  attempt.value += 1;
};

// A fit widget hides the records that do not fit and counts the ones shown.
const fitElement = ref<HTMLElement>();
let stopFit: (() => void) | undefined;
watch(
  [fitElement, instanceId],
  ([element]) => {
    stopFit?.();
    stopFit = undefined;
    shown.value = undefined;
    if (element) {
      stopFit = observeDashboardFit(element, (result) => {
        shown.value = result.shown;
      });
    }
  },
  { flush: "post" }
);
watch(instanceId, () => {
  total.value = undefined;
});
onBeforeUnmount(() => stopFit?.());
const more = computed(() =>
  fits.value && total.value !== undefined && shown.value !== undefined ? dashboardMoreCount(total.value, shown.value) : 0
);
</script>

<template>
  <div v-if="missingRenderer" class="yayaw-dashboard-message" data-widget-state="error">
    <p role="alert">{{ props.label("widgetError", { error: "chart renderer" }) }}</p>
  </div>
  <div v-else class="yayaw-dashboard-embedded" :data-widget-mode="mode" :data-widget-overflow="fits ? 'fit' : undefined">
    <div v-if="failure" class="yayaw-dashboard-message" data-widget-state="error">
      <p role="alert">{{ props.label("widgetError", { error: failure }) }}</p>
      <button type="button" class="yayaw-button yayaw-button-outline" @click="retry">{{ props.label("retry") }}</button>
    </div>
    <div v-if="fits" ref="fitElement" data-dashboard-fit="">
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
        :translations="props.translations"
        :get-row-id="props.getRowId"
      />
    </div>
    <YayawDataTable
      v-else
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
      :translations="props.translations"
      :get-row-id="props.getRowId"
    />
    <footer v-if="more > 0" data-widget-more="">
      <span>{{ props.label("moreCount", { count: more }) }}</span>
      <template v-if="props.openable">
        <span aria-hidden="true">·</span>
        <button type="button" @click="emit('viewAll')">{{ props.label("viewAll") }}</button>
      </template>
    </footer>
  </div>
</template>
