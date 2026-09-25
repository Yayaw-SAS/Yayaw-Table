<script setup lang="ts">
import { QueryClient } from "@tanstack/vue-query";
import { computed, ref, shallowRef, watch } from "vue";
import YayawDataTable from "../components/YayawDataTable.vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type {
  DataTableTranslations,
  TableActions,
  TableConfig,
  TableRecord,
  TableView,
} from "../types";
import {
  type DashboardNotice,
  type DashboardWidget,
  dashboardScreenView,
  dashboardTableViews,
  withDashboardFilters,
  withDashboardTableViews,
  withMutationSignal,
  withNoticeCapture,
} from "./dashboard-model";
import type { DashboardDataTableProps, DashboardTableSource } from "./dashboard-types";

/**
 * A `table` widget: the source's full list page (toolbar, saved views,
 * selection, URL state) without a card. Its inline view is the screen's
 * default view; the screen's filters reach every request as
 * `requiredFilters`; its changes reload the screen's other widgets.
 */
const props = defineProps<{
  dashboardId: string;
  widget: DashboardWidget;
  /** The source id: the table's id, so URL keys, saved views and favorites stay the list page's. */
  sourceId: string;
  source: DashboardTableSource;
  /** None for the screen's first table (canonical URL keys), else the widget's id. */
  instanceId?: string;
  /** Name of the screen's default view (the widget's inline view). */
  screenViewName: string;
  /** The screen filters' rules for this widget (`requiredFilters`). */
  rules: Record<string, unknown>[];
  /** Changes with "Refresh all" and a refresh of this source: rows load again. */
  revision: number;
  /** The screen's URL sync: off keeps the table's state out of the URL too. */
  syncUrl: boolean;
  renderers?: DisplayModeRenderers;
  locale: string;
  translations?: DataTableTranslations;
  getRowId?: (row: TableRecord) => string;
  noticeText: (notice: DashboardNotice) => string;
}>();
/** `mutated`: after each change of the table's records (the screen reloads its other widgets). */
const emit = defineEmits<{ mutated: [] }>();

const notice = ref<DashboardNotice>();
const rulesKey = computed(() => JSON.stringify(props.rules));
const screenView = computed(() =>
  dashboardScreenView(props.dashboardId, props.widget, props.screenViewName)
);
const actions = computed(
  () =>
    withDashboardTableViews(
      withNoticeCapture(
        withMutationSignal(
          withDashboardFilters(
            props.source.actions,
            JSON.parse(rulesKey.value) as Record<string, unknown>[]
          ),
          () => emit("mutated")
        ),
        (found) => {
          notice.value = found;
        }
      ),
      screenView.value?.id ?? props.widget.viewId
    ) as TableActions
);
// The screen names the table, not the table's own header.
const config = computed<TableConfig>(() => ({
  ...props.source.config,
  table: {
    ...props.source.config.table,
    showToolbarHeader: false,
    ...(props.syncUrl ? {} : { syncUrl: false }),
  },
}));
const hostProps = computed(() => props.source.tableProps ?? {});
const initialViews = computed(() =>
  dashboardTableViews(
    [
      ...(props.source.views ?? []),
      ...((hostProps.value.initialViews as TableView[] | undefined) ?? []),
    ],
    {
      screenView: screenView.value as unknown as TableView | undefined,
      defaultViewId: props.widget.viewId,
    }
  )
);
// "Refresh all" reaches a host's table through its query client.
const queryClient = new QueryClient();
const tableProps = computed<DashboardDataTableProps>(() => ({
  queryClient,
  ...hostProps.value,
  displayModeRenderers: {
    ...props.renderers,
    ...(hostProps.value.displayModeRenderers as DisplayModeRenderers | undefined),
  },
  getRowId: hostProps.value.getRowId ?? props.getRowId,
  locale: hostProps.value.locale ?? props.locale,
  translations: hostProps.value.translations ?? props.translations,
  tableType: props.sourceId,
  tableId: props.sourceId,
  instanceId: props.instanceId,
  config: config.value,
  getTableActions: () => actions.value,
  initialViews: initialViews.value,
}));
const HostTable = () => props.source.renderTable?.(tableProps.value);

const table = shallowRef<{ refresh?: () => Promise<void> }>();
watch(
  () => props.revision,
  async () => {
    const client = (hostProps.value.queryClient as QueryClient | undefined) ?? queryClient;
    try {
      await (table.value?.refresh
        ? table.value.refresh()
        : client.invalidateQueries({ queryKey: ["yayaw-table"] }));
    } catch {
      // The table shows its own error.
    }
  }
);
</script>

<template>
  <div class="yayaw-dashboard-page-table" :data-page-table="props.sourceId">
    <div
      v-if="notice"
      class="yayaw-dashboard-message yayaw-dashboard-notice"
      data-widget-state="notice"
      :data-widget-reason="notice.code"
    >
      <p>{{ props.noticeText(notice) }}</p>
    </div>
    <!-- Kept mounted behind a notice, so "Refresh all" asks again; new filters remount it. -->
    <div :key="rulesKey" :class="notice ? 'yayaw-dashboard-hidden' : 'yayaw-dashboard-contents'">
      <HostTable v-if="props.source.renderTable" />
      <YayawDataTable v-else ref="table" v-bind="tableProps" />
    </div>
  </div>
</template>
