<script setup lang="ts">
import { Check, Pencil, Plus, RefreshCw } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { computed, ref, shallowRef, watch, type VNodeChild } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { TableRecord } from "../types";
import DashboardAddFilter from "./DashboardAddFilter.vue";
import DashboardAddWidget from "./DashboardAddWidget.vue";
import DashboardFilters from "./DashboardFilters.vue";
import DashboardGrid from "./DashboardGrid.vue";
import DashboardWidgetContent from "./DashboardWidgetContent.vue";
import DashboardWidgetFrame from "./DashboardWidget.vue";
import {
  addDashboardFilter,
  addDashboardWidget,
  applyGridLayout,
  type Dashboard,
  type DashboardDirection,
  type DashboardLabelKey,
  type DashboardResize,
  type DashboardStorage,
  type DashboardTableInfo,
  type DashboardView,
  type DashboardWidget,
  dashboardLabel,
  dashboardTranslate,
  dashboardWidgetTitle,
  loadDashboardViews,
  moveDashboardWidget,
  normalizeDashboard,
  removeDashboardFilter,
  removeDashboardWidget,
  resizeDashboardWidget,
  setDashboardFilterValue,
} from "./dashboard-model";
import type { DashboardLabel, DashboardTableSource } from "./dashboard-types";
import "./dashboard.css";

/**
 * A Notion-like dashboard: widgets showing saved views of any table (in any
 * display mode), numbers and notes, on a 4-column grid users arrange in edit
 * mode, with dashboard filters sent to every targeted table's requests.
 */
const props = withDefaults(
  defineProps<{
    /** Host storage: `actions.dashboards.list/load/save/remove`. */
    actions: { dashboards: DashboardStorage };
    /** Tables widgets can show, by id: config, actions and saved views. */
    tables: Record<string, DashboardTableSource>;
    /** Dashboard to load; the first one `list()` returns by default. */
    dashboardId?: string;
    /** Whether the user may edit (layout, widgets, filters). Default false. */
    canEdit?: boolean;
    /** "Open full view" on table and number widgets calls it. */
    openView?: (tableId: string, viewId: string | null) => void;
    /** Renders note text (e.g. markdown); plain text by default. */
    renderMarkdown?: (text: string) => VNodeChild;
    /** Optional display modes widgets may use, e.g. `{ chart, calendar }`. */
    displayModeRenderers?: DisplayModeRenderers;
    locale?: string;
    /** Label overrides keyed `dashboard.<key>`. */
    translations?: Record<string, string>;
    getRowId?: (row: TableRecord) => string;
  }>(),
  { canEdit: false, locale: "en" }
);
/** `change`: the dashboard after each change (saved or not). */
const emit = defineEmits<{ change: [dashboard: Dashboard] }>();

type LoadState = { status: "loading" | "ready" | "empty" } | { status: "error"; message: string };
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const dashboard = shallowRef<Dashboard>();
const loadState = ref<LoadState>({ status: "loading" });
const views = ref<Record<string, DashboardView[] | undefined>>({});
const editing = ref(false);
const saving = ref(false);
const revision = ref(0);
const addingWidget = ref(false);
const addingFilter = ref(false);
const announcement = ref("");

const translate = computed(() => dashboardTranslate(props.translations));
const label: DashboardLabel = (key: DashboardLabelKey, params) =>
  dashboardLabel(key, props.locale, translate.value, params);

let loading = 0;
const load = async () => {
  const attempt = ++loading;
  loadState.value = { status: "loading" };
  try {
    const storage = props.actions.dashboards;
    const id = props.dashboardId ?? (await storage.list())[0]?.id;
    const loaded = id ? normalizeDashboard(await storage.load(id)) : undefined;
    if (attempt !== loading) return;
    dashboard.value = loaded;
    loadState.value = { status: loaded ? "ready" : "empty" };
  } catch (error) {
    if (attempt === loading) loadState.value = { status: "error", message: errorText(error) };
  }
};
watch(() => [props.actions.dashboards, props.dashboardId], load, { immediate: true });

watch(
  () => props.tables,
  (tables) => {
    for (const [tableId, source] of Object.entries(tables)) {
      loadDashboardViews(source, tableId)
        .catch(() => loadDashboardViews({ views: source.views }, tableId))
        .then((loaded) => {
          views.value = { ...views.value, [tableId]: loaded };
        })
        .catch(() => undefined);
    }
  },
  { immediate: true }
);

const infos = computed<Record<string, DashboardTableInfo>>(() =>
  Object.fromEntries(
    Object.entries(props.tables).map(([id, source]) => [
      id,
      {
        name: source.name ?? source.config.translations?.keys?.title ?? id,
        columns: source.config.columns.definitions.map((column) => ({
          id: column.id,
          header: column.header,
          type: column.type,
          options: (column as { options?: { value: unknown; label?: string }[] }).options,
        })),
      },
    ])
  )
);
const widgetTables = computed(() =>
  Object.fromEntries(
    Object.entries(infos.value).filter(([id]) => dashboard.value?.widgets.some((widget) => widget.tableId === id))
  )
);

const update = (change: (current: Dashboard) => Dashboard) => {
  const current = dashboard.value;
  if (!current) return;
  const next = change(current);
  if (next === current) return;
  dashboard.value = next;
  emit("change", next);
};
const widgetOf = (id: string) => dashboard.value?.widgets.find((widget) => widget.id === id);
const titleOf = (widget: DashboardWidget) =>
  dashboardWidgetTitle(widget, {
    locale: props.locale,
    translate: translate.value,
    table: widget.tableId ? infos.value[widget.tableId] : undefined,
    view: views.value[widget.tableId ?? ""]?.find((view) => view.id === widget.viewId),
  });
const openable = (widget: DashboardWidget) => Boolean(props.openView && widget.tableId && widget.type !== "note");
const open = (widget: DashboardWidget) => {
  if (widget.tableId) props.openView?.(widget.tableId, widget.viewId ?? null);
};
const move = (widget: DashboardWidget, direction: DashboardDirection) => {
  update((current) => moveDashboardWidget(current, widget.id, direction));
  announcement.value = label("moved", { title: titleOf(widget) });
};
const resize = (widget: DashboardWidget, change: DashboardResize) => {
  update((current) => resizeDashboardWidget(current, widget.id, change));
  announcement.value = label("resized", { title: titleOf(widget) });
};

const save = async () => {
  const current = dashboard.value;
  if (!current) return;
  saving.value = true;
  try {
    await props.actions.dashboards.save({ ...current, updatedAt: new Date().toISOString() });
    editing.value = false;
    toast.success(label("saved"));
  } catch (error) {
    toast.error(label("saveError", { error: errorText(error) }));
  } finally {
    saving.value = false;
  }
};
const loadMessage = computed(() => {
  const state = loadState.value;
  if (state.status === "error") return label("loadError", { error: state.message });
  return label(state.status === "empty" ? "notFound" : "loading");
});
</script>

<template>
  <div v-if="loadState.status !== 'ready' || !dashboard" class="yayaw-dashboard" data-dashboard="">
    <div class="yayaw-dashboard-message" :data-widget-state="loadState.status === 'error' ? 'error' : 'muted'">
      <p v-if="loadState.status === 'error'" role="alert">{{ loadMessage }}</p>
      <output v-else>{{ loadMessage }}</output>
    </div>
  </div>
  <div v-else class="yayaw-dashboard" :data-dashboard="dashboard.id" :data-editing="editing ? '' : undefined">
    <header class="yayaw-dashboard-header">
      <input
        v-if="editing"
        class="yayaw-input yayaw-dashboard-name-input"
        :aria-label="label('dashboard')"
        :value="dashboard.name"
        @input="update((current) => ({ ...current, name: ($event.target as HTMLInputElement).value }))"
      >
      <h2 v-else class="yayaw-dashboard-name">{{ dashboard.name || label("dashboard") }}</h2>
      <div class="yayaw-dashboard-actions">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="revision += 1">
          <RefreshCw :size="16" aria-hidden="true" />{{ label("refresh") }}
        </button>
        <button v-if="editing" type="button" class="yayaw-button yayaw-button-outline" @click="addingWidget = true">
          <Plus :size="16" aria-hidden="true" />{{ label("addWidget") }}
        </button>
        <button v-if="props.canEdit && editing" type="button" class="yayaw-button" :disabled="saving" @click="save">
          <Check :size="16" aria-hidden="true" />{{ saving ? label("saving") : label("done") }}
        </button>
        <button v-if="props.canEdit && !editing" type="button" class="yayaw-button yayaw-button-outline" @click="editing = true">
          <Pencil :size="16" aria-hidden="true" />{{ label("edit") }}
        </button>
      </div>
    </header>
    <DashboardFilters
      :filters="dashboard.filters"
      :tables="infos"
      :editing="editing"
      :label="label"
      @change="(filterId, value) => update((current) => setDashboardFilterValue(current, filterId, value))"
      @remove="(filterId) => update((current) => removeDashboardFilter(current, filterId))"
      @add="addingFilter = true"
    />
    <DashboardGrid
      v-if="dashboard.widgets.length"
      :layout="dashboard.layout"
      :editing="editing"
      @layout-change="(layout) => update((current) => applyGridLayout(current, layout))"
    >
      <template #item="{ widgetId, phone }">
        <DashboardWidgetFrame
          v-if="widgetOf(widgetId)"
          :widget="widgetOf(widgetId)!"
          :title="titleOf(widgetOf(widgetId)!)"
          :editing="editing"
          :phone="phone"
          :layout="dashboard.layout"
          :label="label"
          :openable="openable(widgetOf(widgetId)!)"
          @move="(direction) => move(widgetOf(widgetId)!, direction)"
          @resize="(change) => resize(widgetOf(widgetId)!, change)"
          @remove="update((current) => removeDashboardWidget(current, widgetId))"
          @open="open(widgetOf(widgetId)!)"
        >
          <DashboardWidgetContent
            :dashboard="dashboard"
            :widget="widgetOf(widgetId)!"
            :tables="props.tables"
            :views="views"
            :revision="revision"
            :label="label"
            :locale="props.locale"
            :renderers="props.displayModeRenderers"
            :render-markdown="props.renderMarkdown"
            :get-row-id="props.getRowId"
          />
        </DashboardWidgetFrame>
      </template>
    </DashboardGrid>
    <div v-else class="yayaw-dashboard-message" data-widget-state="muted">
      <output>{{ label(editing ? "emptyEditable" : "empty") }}</output>
    </div>
    <output aria-live="polite" class="yayaw-dashboard-sr-only">{{ announcement }}</output>
    <template v-if="editing">
      <DashboardAddWidget
        v-model:open="addingWidget"
        :tables="infos"
        :views="views"
        :label="label"
        :locale="props.locale"
        :translate="translate"
        @add="(widget) => update((current) => addDashboardWidget(current, widget))"
      />
      <DashboardAddFilter
        v-model:open="addingFilter"
        :tables="widgetTables"
        :label="label"
        @add="(filter) => update((current) => addDashboardFilter(current, filter))"
      />
    </template>
  </div>
</template>
