<script setup lang="ts">
import { computed, onErrorCaptured, ref, toRaw, type VNodeChild } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord } from "../types";
import type { ViewConfig } from "../view-config";
import {
  type Dashboard,
  type DashboardFilterValue,
  type DashboardNotice,
  type DashboardOpenViewContext,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidget,
  dashboardFilterRules,
  dashboardTableInstanceId,
  dashboardUnavailableText,
  resolveWidgetView,
} from "./dashboard-model";
import { dashboardText } from "./dashboard-schema";
import type {
  DashboardSourceLoader,
  DashboardWidgetAvailability,
} from "./dashboard-sources";
import type {
  DashboardBlock,
  DashboardLabel,
  DashboardTableSource,
} from "./dashboard-types";
import DashboardKpiWidget from "./DashboardKpiWidget.vue";
import DashboardPageTable from "./DashboardPageTable.vue";
import DashboardTableWidget from "./DashboardTableWidget.vue";

/**
 * What a widget shows: a note, a host block, a number, an embedded table
 * (saved or inline view), a full-page table, or why it cannot (its source
 * loading, failing, unavailable; a block the host lacks).
 */
const props = defineProps<{
  /** The document (edit mode changes it). */
  dashboard: Dashboard;
  /** The document with the reader's filter values: what widgets query. */
  shown: Dashboard;
  widget: DashboardWidget;
  availability: DashboardWidgetAvailability;
  /** The widget's source, once ready. */
  source?: DashboardTableSource;
  loader: DashboardSourceLoader<DashboardTableSource>;
  views: Record<string, DashboardView[] | undefined>;
  /** The host's block for a block widget. */
  block?: DashboardBlock;
  today: string;
  editing: boolean;
  syncUrl: boolean;
  /** Numbers' and views' revision; page tables' and blocks' below. */
  revision: number;
  pageRevision: number;
  blockRevision: number;
  filterValues: Record<string, DashboardFilterValue | undefined>;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  noticeText: (notice: DashboardNotice) => string;
  /** The page's table labels, e.g. French pagination. */
  tableTranslations?: DataTableTranslations;
  /** The widget's size in the layout. */
  size: { w: number; h: number };
  /** Whether the full view can open ("View all" under fit records). */
  openable?: boolean;
  renderers?: DisplayModeRenderers;
  renderMarkdown?: (text: string) => VNodeChild;
  getRowId?: (row: TableRecord) => string;
  /** A flow section's widget: its natural height. */
  natural?: boolean;
  refresh: (tableId?: string) => void;
  openView?: (
    tableId: string,
    viewId: string | null,
    context?: DashboardOpenViewContext
  ) => void;
}>();
/** `page-view`: the view a full-page table shows (`view-config-change`), for "Make the current view the screen default". */
const emit = defineEmits<{ viewAll: []; mutated: [tableId: string]; pageView: [config: ViewConfig] }>();

// A widget that fails to render shows its error; the others keep working.
const error = ref<Error>();
const attempt = ref(0);
onErrorCaptured((cause) => {
  error.value = cause instanceof Error ? cause : new Error(String(cause));
  return false;
});
const retry = () => {
  error.value = undefined;
  attempt.value += 1;
};

const noteText = computed(() => String(props.widget.settings.text ?? ""));
const NoteMarkdown = () => props.renderMarkdown?.(noteText.value);
const source = computed(() => props.source);
const resolved = computed(() =>
  resolveWidgetView(
    props.widget,
    props.widget.tableId ? props.views[props.widget.tableId] : undefined
  )
);
const view = computed(() =>
  resolved.value.status === "ready" ? resolved.value.view : undefined
);
const state = computed(() => {
  const type = props.widget.type;
  if (type === "note" || type === "block") {
    return type;
  }
  const availability = props.availability.status;
  if (availability !== "ready" || !source.value) {
    return availability === "ready" ? "loading" : availability;
  }
  if (type === "table") {
    return "page";
  }
  if (resolved.value.status !== "ready") {
    return resolved.value.status === "missing" ? "missingView" : "loading";
  }
  return type === "kpi" ? "kpi" : "table";
});
const unavailableText = computed(() => {
  const availability = props.availability;
  return availability.status === "unavailable"
    ? dashboardUnavailableText(
        availability.reason,
        availability.message,
        props.locale,
        props.translate
      )
    : "";
});
const unavailableReason = computed(() =>
  props.availability.status === "unavailable" ? props.availability.reason : undefined
);
const errorMessage = computed(() =>
  props.availability.status === "error" ? props.availability.message : ""
);
const retrySource = () => {
  if (props.widget.tableId) {
    props.loader.retry(props.widget.tableId).catch(() => undefined);
  }
};
const rules = computed(() =>
  dashboardFilterRules(props.shown, props.widget, props.today)
);
// A registry held in reactive state must not make its components reactive.
const blockComponent = computed(() =>
  props.block ? toRaw(props.block.component) : undefined
);
const blockProps = computed(() => ({
  widgetId: props.widget.id,
  props: { ...props.block?.defaultProps, ...props.widget.props },
  size: props.natural ? undefined : props.size,
  editing: props.editing,
  locale: props.locale,
  revision: props.blockRevision,
  filters: props.filterValues,
  refresh: props.refresh,
  openView: props.openView,
}));
const screenViewName = computed(
  () =>
    dashboardText(props.widget.title, props.locale) ||
    props.label("screenDefaultView")
);
const instanceId = computed(() =>
  dashboardTableInstanceId(props.dashboard, props.widget.id)
);
</script>

<template>
  <div v-if="error" class="yayaw-dashboard-message" data-widget-state="error">
    <p role="alert">{{ props.label("widgetError", { error: error.message }) }}</p>
    <button type="button" class="yayaw-button yayaw-button-outline" @click="retry">{{ props.label("retry") }}</button>
  </div>
  <template v-else-if="state === 'note'">
    <div v-if="!noteText.trim()" class="yayaw-dashboard-message" data-widget-state="muted">
      <output>{{ props.label("emptyNote") }}</output>
    </div>
    <div v-else class="yayaw-dashboard-note" data-widget-note="">
      <NoteMarkdown v-if="props.renderMarkdown" />
      <p v-else>{{ noteText }}</p>
    </div>
  </template>
  <template v-else-if="state === 'block'">
    <div v-if="blockComponent" :key="attempt" class="yayaw-dashboard-block" data-block-content=""><component :is="blockComponent" v-bind="blockProps" /></div>
    <div v-else class="yayaw-dashboard-message yayaw-dashboard-notice" data-widget-state="unknownBlock">
      <p>{{ props.label("unknownBlock") }}</p>
    </div>
  </template>
  <div
    v-else-if="state === 'unavailable'"
    class="yayaw-dashboard-message yayaw-dashboard-notice"
    data-widget-state="unavailable"
    :data-widget-reason="unavailableReason"
  >
    <p>{{ unavailableText }}</p>
  </div>
  <div v-else-if="state === 'error'" class="yayaw-dashboard-message" data-widget-state="error">
    <p role="alert">{{ props.label("widgetError", { error: errorMessage }) }}</p>
    <button type="button" class="yayaw-button yayaw-button-outline" @click="retrySource">{{ props.label("retry") }}</button>
  </div>
  <div v-else-if="state === 'missingView'" class="yayaw-dashboard-message" data-widget-state="error">
    <p role="alert">{{ props.label("missingView") }}</p>
  </div>
  <div v-else-if="state === 'loading'" class="yayaw-dashboard-message" data-widget-state="muted">
    <output>{{ props.label("widgetLoading") }}</output>
  </div>
  <DashboardPageTable
    v-else-if="state === 'page' && source && props.widget.tableId"
    :key="attempt"
    :dashboard-id="props.dashboard.id"
    :widget="props.widget"
    :source-id="props.widget.tableId"
    :source="source"
    :instance-id="instanceId"
    :screen-view-name="screenViewName"
    :rules="rules"
    :revision="props.pageRevision"
    :sync-url="props.syncUrl"
    :renderers="props.renderers"
    :locale="props.locale"
    :translations="props.tableTranslations"
    :get-row-id="props.getRowId"
    :notice-text="props.noticeText"
    @mutated="emit('mutated', props.widget.tableId)"
    @view-config-change="(config: ViewConfig) => emit('pageView', config)"
  />
  <DashboardKpiWidget
    v-else-if="state === 'kpi' && source"
    :key="attempt"
    :dashboard="props.shown"
    :widget="props.widget"
    :source="source"
    :view="view"
    :revision="props.revision"
    :locale="props.locale"
    :label="props.label"
    :translate="props.translate"
    :notice-text="props.noticeText"
  />
  <DashboardTableWidget
    v-else-if="source"
    :key="attempt"
    :dashboard-id="props.dashboard.id"
    :widget="props.widget"
    :source="source"
    :view="view"
    :rules="rules"
    :revision="props.revision"
    :renderers="props.renderers"
    :locale="props.locale"
    :translations="props.tableTranslations"
    :label="props.label"
    :get-row-id="props.getRowId"
    :size="props.size"
    :openable="props.openable"
    :natural="props.natural"
    :notice-text="props.noticeText"
    @view-all="emit('viewAll')"
  />
</template>
