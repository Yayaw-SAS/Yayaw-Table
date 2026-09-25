<script setup lang="ts">
/**
 * The screen editor's dialogs, in a chunk of their own: `YayawDashboard`
 * loads it (`defineAsyncComponent`) when edit mode starts, so readers never
 * download the widget dialog, the source catalogue, the view editor or the
 * filter dialog.
 */
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from "reka-ui";
import { computed } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord } from "../types";
import DashboardAddFilter from "./DashboardAddFilter.vue";
import DashboardViewEditor from "./DashboardViewEditor.vue";
import DashboardWidgetDialog from "./DashboardWidgetDialog.vue";
import { tableInfo } from "./dashboard-composables";
import {
  type DashboardEditorRequest,
  dashboardSectionName,
  dashboardSectionWidgetIds,
  dashboardViewEditStart,
  removeDashboardSection,
  setDashboardWidgetView,
  updateDashboardWidget,
} from "./dashboard-editor-model";
import {
  addDashboardFilter,
  type DashboardTableInfo,
  type DashboardTranslate,
  type DashboardView,
  dashboardWidgetSize,
} from "./dashboard-model";
import {
  addDashboardWidget,
  type Dashboard,
  type DashboardInlineView,
  type DashboardWidget,
} from "./dashboard-schema";
import type { DashboardSourceLoader } from "./dashboard-sources";
import type {
  DashboardBlockRegistry,
  DashboardLabel,
  DashboardTableSource,
} from "./dashboard-types";

const props = defineProps<{
  request: DashboardEditorRequest | null;
  dashboard: Dashboard;
  update: (change: (current: Dashboard) => Dashboard) => void;
  announce: (message: string) => void;
  loader: DashboardSourceLoader<DashboardTableSource>;
  /** Saved views of the sources loaded, by source. */
  views: Record<string, DashboardView[] | undefined>;
  /** The sources the screen's widgets read: what a new filter can target. */
  filterTables: Record<string, DashboardTableInfo>;
  blocks?: DashboardBlockRegistry;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  renderers?: DisplayModeRenderers;
  getRowId?: (row: TableRecord) => string;
  tableTranslations?: DataTableTranslations;
  titleOf: (widget: DashboardWidget) => string;
}>();
const emit = defineEmits<{ close: [] }>();

const sourceOf = (id: string | undefined): DashboardTableSource | undefined => {
  const state = id ? props.loader.state(id) : undefined;
  return state?.status === "ready" ? state.source : undefined;
};
const widget = computed(() => {
  const request = props.request;
  return request?.kind === "editWidget" || request?.kind === "editView"
    ? props.dashboard.widgets.find((item) => item.id === request.widgetId)
    : undefined;
});
const addTo = computed(() => {
  const request = props.request;
  return request?.kind === "addWidget"
    ? props.dashboard.sections.find((section) => section.id === request.sectionId)
    : undefined;
});
const widgetDialog = computed(
  () => props.request?.kind === "addWidget" || (props.request?.kind === "editWidget" && Boolean(widget.value))
);
const viewSource = computed(() =>
  props.request?.kind === "editView" && widget.value ? sourceOf(widget.value.tableId) : undefined
);
const savedView = computed(() => {
  const current = widget.value;
  return current?.viewId && !current.view
    ? props.views[current.tableId ?? ""]?.find((view) => view.id === current.viewId)
    : undefined;
});
const target = computed(() =>
  widget.value
    ? { mode: "edit" as const, widget: widget.value }
    : { mode: "add" as const, sectionId: addTo.value?.id, sectionType: addTo.value?.type }
);
const submitWidget = (next: Omit<DashboardWidget, "id">, sourceViews: readonly DashboardView[] | undefined) => {
  const edited = widget.value;
  if (edited) {
    props.update((current) => updateDashboardWidget(current, edited.id, next, props.blocks));
    return;
  }
  const source = sourceOf(next.tableId);
  const block = next.block && props.blocks && Object.hasOwn(props.blocks, next.block) ? props.blocks[next.block] : undefined;
  const sectionId = addTo.value?.id;
  props.update((current) =>
    addDashboardWidget(current, next, {
      ...(sectionId ? { sectionId } : {}),
      size: dashboardWidgetSize(next, {
        views: sourceViews,
        table: source && next.tableId ? tableInfo(next.tableId, source) : undefined,
        block,
      }),
      ...(props.blocks ? { blocks: props.blocks } : {}),
    })
  );
};
const applyView = (view: DashboardInlineView) => {
  const edited = widget.value;
  if (edited) {
    props.update((current) => setDashboardWidgetView(current, edited.id, view, savedView.value?.name));
  }
};
const removing = computed(() => {
  const request = props.request;
  return request?.kind === "removeSection"
    ? props.dashboard.sections.find((section) => section.id === request.sectionId)
    : undefined;
});
const removingName = computed(() =>
  removing.value ? dashboardSectionName(props.dashboard, removing.value.id, props.locale, props.translate) : ""
);
const removingCount = computed(() => (removing.value ? dashboardSectionWidgetIds(removing.value).length : 0));
const removeSection = () => {
  const section = removing.value;
  if (section) {
    props.update((current) => removeDashboardSection(current, section.id));
    props.announce(props.label("sectionRemoved", { title: removingName.value }));
  }
  emit("close");
};
</script>

<template>
  <DashboardWidgetDialog
    v-if="widgetDialog"
    :target="target"
    :loader="props.loader"
    :blocks="props.blocks"
    :label="props.label"
    :locale="props.locale"
    :translate="props.translate"
    :renderers="props.renderers"
    :get-row-id="props.getRowId"
    :table-translations="props.tableTranslations"
    @submit="submitWidget"
    @close="emit('close')"
  />
  <DashboardViewEditor
    v-if="viewSource && widget?.tableId"
    :source="viewSource"
    :source-id="widget.tableId"
    :start="dashboardViewEditStart(widget, savedView)"
    :subtitle="props.titleOf(widget)"
    :label="props.label"
    :locale="props.locale"
    :renderers="props.renderers"
    :get-row-id="props.getRowId"
    :translations="props.tableTranslations"
    @apply="applyView"
    @close="emit('close')"
  />
  <DashboardAddFilter
    :open="props.request?.kind === 'addFilter'"
    :tables="props.filterTables"
    :label="props.label"
    @update:open="(open: boolean) => { if (!open) emit('close'); }"
    @add="(filter) => props.update((current) => addDashboardFilter(current, filter))"
  />
  <AlertDialogRoot :open="Boolean(removing)" @update:open="(open: boolean) => { if (!open) emit('close'); }">
    <AlertDialogPortal>
      <AlertDialogOverlay class="yayaw-dashboard-confirm-backdrop" />
      <AlertDialogContent class="yayaw-dashboard-dialog yayaw-dashboard-confirm" data-dashboard-dialog="remove-section">
        <AlertDialogTitle as="h2">{{ props.label("removeSectionTitle", { title: removingName }) }}</AlertDialogTitle>
        <AlertDialogDescription class="yayaw-dashboard-muted">
          {{ removingCount === 1 ? props.label("removeSectionOne") : props.label("removeSectionMany", { count: removingCount }) }}
        </AlertDialogDescription>
        <div class="yayaw-dashboard-dialog-footer">
          <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('close')">{{ props.label("cancel") }}</button>
          <button type="button" class="yayaw-button yayaw-dashboard-danger" @click="removeSection">{{ props.label("remove") }}</button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
