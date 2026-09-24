<script setup lang="ts">
import { computed, onErrorCaptured, ref, type VNodeChild } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord } from "../types";
import {
  type Dashboard,
  type DashboardTranslate,
  type DashboardView,
  type DashboardWidget,
  dashboardFilterRules,
} from "./dashboard-model";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";
import DashboardKpiWidget from "./DashboardKpiWidget.vue";
import DashboardTableWidget from "./DashboardTableWidget.vue";

/** What a widget shows: a note, an embedded table, or why it cannot. */
const props = defineProps<{
  dashboard: Dashboard;
  widget: DashboardWidget;
  tables: Record<string, DashboardTableSource>;
  views: Record<string, DashboardView[] | undefined>;
  revision: number;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  /** The page's table labels, e.g. French pagination. */
  tableTranslations?: DataTableTranslations;
  /** The widget's size in the layout. */
  size: { w: number; h: number };
  /** Whether the full view can open ("View all" under fit records). */
  openable?: boolean;
  renderers?: DisplayModeRenderers;
  renderMarkdown?: (text: string) => VNodeChild;
  getRowId?: (row: TableRecord) => string;
}>();
const emit = defineEmits<{ viewAll: [] }>();

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
const source = computed(() => (props.widget.tableId ? props.tables[props.widget.tableId] : undefined));
const tableViews = computed(() => (props.widget.tableId ? props.views[props.widget.tableId] : undefined));
const view = computed(() => tableViews.value?.find((item) => item.id === props.widget.viewId));
const state = computed(() => {
  if (props.widget.type === "note") return "note";
  if (!source.value) return "missingTable";
  if (props.widget.viewId && !tableViews.value) return "loading";
  if (props.widget.viewId && !view.value) return "missingView";
  return props.widget.type === "kpi" ? "kpi" : "table";
});
const rules = computed(() => dashboardFilterRules(props.dashboard, props.widget));
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
  <div v-else-if="state === 'missingTable' || state === 'missingView'" class="yayaw-dashboard-message" data-widget-state="error">
    <p role="alert">{{ props.label(state) }}</p>
  </div>
  <div v-else-if="state === 'loading'" class="yayaw-dashboard-message" data-widget-state="muted">
    <output>{{ props.label("widgetLoading") }}</output>
  </div>
  <DashboardKpiWidget
    v-else-if="state === 'kpi' && source"
    :key="attempt"
    :dashboard="props.dashboard"
    :widget="props.widget"
    :source="source"
    :view="view"
    :revision="props.revision"
    :locale="props.locale"
    :label="props.label"
    :translate="props.translate"
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
    @view-all="emit('viewAll')"
  />
</template>
