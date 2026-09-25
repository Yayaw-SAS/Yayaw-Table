<script setup lang="ts">
import { Check, Pencil, Plus, RefreshCw } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { computed, ref, type VNodeChild } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord } from "../types";
import DashboardAddFilter from "./DashboardAddFilter.vue";
import DashboardAddWidget from "./DashboardAddWidget.vue";
import DashboardFilters from "./DashboardFilters.vue";
import DashboardSectionView from "./DashboardSection.vue";
import DashboardWidgetContent from "./DashboardWidgetContent.vue";
import DashboardWidgetFrame from "./DashboardWidget.vue";
import {
  errorText,
  tableInfo,
  useDashboardDocument,
  useDashboardRevisions,
  useDashboardSources,
  useSourceViews,
  useViewerFilters,
} from "./dashboard-composables";
import type { DashboardDirection, DashboardResize } from "./dashboard-layout";
import {
  addDashboardFilter,
  type DashboardDateRange,
  type DashboardLabelKey,
  type DashboardNotice,
  type DashboardOpenViewContext,
  type DashboardStorage,
  type DashboardTableInfo,
  dashboardDayValue,
  dashboardFilterValues,
  dashboardLabel,
  dashboardNoticeText,
  dashboardOpenViewContext,
  dashboardTranslate,
  dashboardVisibleSections,
  dashboardWidgetSize,
  dashboardWidgetTitle,
  dashboardWidgetViewId,
  removeDashboardFilter,
  setDashboardFilterValue,
  setDashboardText,
  withDashboardFilterValues,
} from "./dashboard-model";
import {
  addDashboardWidget,
  applyDashboardSectionLayout,
  canMoveDashboardWidget,
  canResizeDashboardWidget,
  type Dashboard,
  type DashboardSection,
  type DashboardWidget,
  dashboardText,
  moveDashboardWidget,
  removeDashboardWidget,
  resizeDashboardWidget,
} from "./dashboard-schema";
import {
  type DashboardSources,
  dashboardSourceIds,
  dashboardUnavailableWidgetIds,
  dashboardWidgetAvailability,
} from "./dashboard-sources";
import type {
  DashboardBlockRegistry,
  DashboardLabel,
  DashboardTableSource,
} from "./dashboard-types";
import "./dashboard.css";

/**
 * A Notion-like dashboard, and the screens of an admin (JSON version 2):
 * sections in order, each a 4-column grid users arrange in edit mode or a
 * flow of full-width widgets. Widgets show views of any source (saved or
 * inline, in any display mode), numbers, notes, full-page tables with their
 * toolbar and URL, and the host's blocks. Sources load lazily from the
 * host's catalogue; unavailable ones show a notice and are never removed.
 * Filters join every targeted request; the values readers pick stay in the
 * URL. Older JSON is migrated on load and saved as version 2.
 */
const props = withDefaults(
  defineProps<{
    /**
     * Host storage: `actions.dashboards.list/load/save/remove`. Optional when
     * `dashboard` is given and nobody edits; editing needs `save`.
     */
    actions?: { dashboards: DashboardStorage };
    /** Sources given up front, by id (config, actions, saved views); they win over `sources`. */
    tables?: Record<string, DashboardTableSource>;
    /**
     * The host's lazy catalogue: `list()` for editors, `load(id)` for readers.
     * Only the sources the screen's widgets read are loaded; forbidden, not
     * configured or missing ones show as unavailable (never removed).
     */
    sources?: DashboardSources<DashboardTableSource>;
    /** The host's blocks by key: their schema and component. */
    blocks?: DashboardBlockRegistry;
    /** A document to show instead of loading one (server-fetched, a draft preview, a system screen). */
    dashboard?: unknown;
    /** Dashboard to load; the first one `list()` returns by default. */
    dashboardId?: string;
    /** Whether the user may edit (layout, widgets, filters). Default false. */
    canEdit?: boolean;
    /** Show the dashboard's name (`h2`). Default true. */
    showTitle?: boolean;
    /**
     * Widgets whose source is unavailable, and blocks the host lacks: a muted
     * notice (`show`, the default) or left out of the view, grids closing their
     * gaps (`hide`; never saved so, and shown while editing).
     */
    unavailableWidgets?: "show" | "hide";
    /**
     * Keep the reader's filter values in the URL (`<dashboardId>.<filterId>`)
     * and let full-page tables sync theirs. Default true.
     */
    syncUrl?: boolean;
    /**
     * "Open full view" and "View all" call it (`viewId` null for inline settings
     * and the default view; `context.view` holds a widget's inline view).
     */
    openView?: (
      tableId: string,
      viewId: string | null,
      context?: DashboardOpenViewContext
    ) => void;
    /** Renders note text (e.g. markdown); plain text by default. */
    renderMarkdown?: (text: string) => VNodeChild;
    /** Optional display modes widgets may use, e.g. `{ chart, calendar }`. */
    displayModeRenderers?: DisplayModeRenderers;
    /** Language of the dashboard, its texts (`{ en, fr }`) and every widget (dates, numbers, labels). */
    locale?: string;
    /** Label overrides keyed `dashboard.<key>`. */
    translations?: Record<string, string>;
    /**
     * Table label overrides every widget uses (pagination, empty states, menus…),
     * as `YayawDataTable`'s `translations`; `locale` already picks the built-in French.
     */
    tableTranslations?: DataTableTranslations;
    getRowId?: (row: TableRecord) => string;
  }>(),
  {
    canEdit: false,
    showTitle: true,
    unavailableWidgets: "show",
    syncUrl: true,
    locale: "en",
    dashboard: undefined,
  }
);
/** `change`: the dashboard (version 2) after each change of the document (saved or not). */
const emit = defineEmits<{ change: [dashboard: Dashboard] }>();

const editing = ref(false);
const saving = ref(false);
const addingWidget = ref(false);
const addingFilter = ref(false);
const announcement = ref("");

const { dashboard, state: loadState } = useDashboardDocument({
  input: () => props.dashboard,
  storage: () => props.actions?.dashboards,
  dashboardId: () => props.dashboardId,
  blocks: () => props.blocks,
});
const editable = computed(() => props.canEdit && Boolean(props.actions?.dashboards.save));
const screenIds = computed(() => (dashboard.value ? dashboardSourceIds(dashboard.value) : []));
const tableIds = computed(() => Object.keys(props.tables ?? {}));
// Readers load what the screen shows; editors also the tables they may add.
const loadIds = computed(() =>
  editing.value ? [...new Set([...screenIds.value, ...tableIds.value])] : screenIds.value
);
const { loader, stateOf } = useDashboardSources({
  ids: () => loadIds.value,
  sources: () => props.sources,
  tables: () => props.tables,
});
/** The sources whose saved views widgets name (and in edit mode, the picker's). */
const viewIds = computed(() => {
  if (editing.value) return loadIds.value;
  const ids = new Set<string>();
  for (const widget of dashboard.value?.widgets ?? []) {
    if (widget.tableId && widget.viewId && !widget.view) ids.add(widget.tableId);
  }
  return [...ids];
});
const views = useSourceViews(stateOf, () => viewIds.value);
const viewer = useViewerFilters(() => dashboard.value, () => props.syncUrl);
const revisions = useDashboardRevisions();

const translate = computed(() => dashboardTranslate(props.translations));
const label: DashboardLabel = (key: DashboardLabelKey, params) =>
  dashboardLabel(key, props.locale, translate.value, params);
const noticeText = (notice: DashboardNotice) => dashboardNoticeText(notice, props.locale, translate.value);

const sourceOf = (id?: string): DashboardTableSource | undefined => {
  const state = id ? stateOf(id) : undefined;
  return state?.status === "ready" ? state.source : undefined;
};
const infos = computed<Record<string, DashboardTableInfo>>(() => {
  const found: Record<string, DashboardTableInfo> = {};
  for (const id of loadIds.value) {
    const source = sourceOf(id);
    if (source) found[id] = tableInfo(id, source);
  }
  return found;
});
const widgetTables = computed(() =>
  Object.fromEntries(Object.entries(infos.value).filter(([id]) => screenIds.value.includes(id)))
);
const blockOf = (key?: string) =>
  props.blocks && key && Object.hasOwn(props.blocks, key) ? props.blocks[key] : undefined;
const availabilityContext = {
  state: stateOf,
  hasBlock: (key: string) => Boolean(blockOf(key)),
};

const shown = computed(() =>
  dashboard.value && !editing.value ? withDashboardFilterValues(dashboard.value, viewer.values.value) : dashboard.value
);
const today = computed(() => dashboardDayValue(new Date()));
const filterValues = computed(() => (shown.value ? dashboardFilterValues(shown.value, today.value) : {}));
const sections = computed<DashboardSection[]>(() => {
  const current = dashboard.value;
  if (!current) return [];
  const hidden =
    !editing.value && props.unavailableWidgets === "hide"
      ? dashboardUnavailableWidgetIds(current, availabilityContext)
      : new Set<string>();
  return dashboardVisibleSections(current.sections, hidden);
});

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
    block: blockOf(widget.block),
  });
const availabilityOf = (widget: DashboardWidget) => dashboardWidgetAvailability(widget, availabilityContext);
const openable = (widget: DashboardWidget) =>
  Boolean(
    props.openView &&
      widget.tableId &&
      (widget.type === "view" || widget.type === "kpi") &&
      availabilityOf(widget).status === "ready"
  );
const open = (widget: DashboardWidget) => {
  if (widget.tableId) {
    props.openView?.(widget.tableId, dashboardWidgetViewId(widget), dashboardOpenViewContext(widget));
  }
};
const sizeOf = (section: DashboardSection, widgetId: string) => {
  const place = section.type === "grid" ? section.layout.find((item) => item.widgetId === widgetId) : undefined;
  return { w: place?.w ?? 1, h: place?.h ?? 1 };
};
const hasTitle = (widget: DashboardWidget) => Boolean(dashboardText(widget.title, props.locale));
const canMove = (widgetId: string) => (direction: DashboardDirection) =>
  dashboard.value ? canMoveDashboardWidget(dashboard.value, widgetId, direction) : false;
const canResize = (widgetId: string) => (change: DashboardResize) =>
  dashboard.value ? canResizeDashboardWidget(dashboard.value, widgetId, change) : false;
const name = computed(() => dashboardText(dashboard.value?.name, props.locale));
const rename = (value: string) =>
  update((current) => ({ ...current, name: setDashboardText(current.name, props.locale, value) }));
const addWidget = (widget: Omit<DashboardWidget, "id">) =>
  update((current) =>
    addDashboardWidget(current, widget, {
      size: dashboardWidgetSize(widget, {
        views: views.value[widget.tableId ?? ""],
        table: infos.value[widget.tableId ?? ""],
      }),
    })
  );
const move = (widget: DashboardWidget, direction: DashboardDirection) => {
  update((current) => moveDashboardWidget(current, widget.id, direction));
  announcement.value = label("moved", { title: titleOf(widget) });
};
const resize = (widget: DashboardWidget, change: DashboardResize) => {
  update((current) => resizeDashboardWidget(current, widget.id, change));
  announcement.value = label("resized", { title: titleOf(widget) });
};
const changeFilter = (filterId: string, value: DashboardDateRange | string[] | undefined) => {
  if (editing.value) update((current) => setDashboardFilterValue(current, filterId, value));
  else viewer.set(filterId, value);
};
const startEditing = () => {
  // Edit mode shows and changes the document's default values.
  viewer.clear();
  editing.value = true;
};
const refreshAll = () => {
  revisions.refresh();
  for (const id of screenIds.value) {
    if (loader.value.state(id)?.status === "error") loader.value.retry(id).catch(() => undefined);
  }
};

const save = async () => {
  const current = dashboard.value;
  const storage = props.actions?.dashboards;
  if (!(current && storage)) return;
  saving.value = true;
  try {
    await storage.save({ ...current, updatedAt: new Date().toISOString() });
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
  <div v-if="loadState.status !== 'ready' || !dashboard || !shown" class="yayaw-dashboard" data-dashboard="">
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
        :value="name"
        @input="rename(($event.target as HTMLInputElement).value)"
      >
      <h2 v-else-if="props.showTitle" class="yayaw-dashboard-name">{{ name || label("dashboard") }}</h2>
      <div class="yayaw-dashboard-actions">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="refreshAll">
          <RefreshCw :size="16" aria-hidden="true" />{{ label("refresh") }}
        </button>
        <button v-if="editing" type="button" class="yayaw-button yayaw-button-outline" @click="addingWidget = true">
          <Plus :size="16" aria-hidden="true" />{{ label("addWidget") }}
        </button>
        <button v-if="editable && editing" type="button" class="yayaw-button" :disabled="saving" @click="save">
          <Check :size="16" aria-hidden="true" />{{ saving ? label("saving") : label("done") }}
        </button>
        <button v-if="editable && !editing" type="button" class="yayaw-button yayaw-button-outline" @click="startEditing">
          <Pencil :size="16" aria-hidden="true" />{{ label("edit") }}
        </button>
      </div>
    </header>
    <DashboardFilters
      :filters="shown.filters"
      :tables="infos"
      :editing="editing"
      :label="label"
      :locale="props.locale"
      :translate="translate"
      @change="changeFilter"
      @remove="(filterId) => update((current) => removeDashboardFilter(current, filterId))"
      @add="addingFilter = true"
    />
    <!-- Widgets query once the reader's filter values are read from the URL. -->
    <template v-if="dashboard.widgets.length && viewer.ready.value">
      <DashboardSectionView
        v-for="section in sections"
        :key="section.id"
        :section="section"
        :title="dashboardText(section.title, props.locale)"
        :editing="editing"
        @layout-change="(layout) => update((current) => applyDashboardSectionLayout(current, section.id, layout))"
      >
        <template #item="{ widgetId, phone, flow, titled }">
          <DashboardWidgetFrame
            v-if="widgetOf(widgetId)"
            :widget="widgetOf(widgetId)!"
            :title="titleOf(widgetOf(widgetId)!)"
            :editing="editing"
            :draggable="!(phone || flow)"
            :resizable="!flow"
            :heading-level="titled ? 4 : 3"
            :frame="widgetOf(widgetId)!.type === 'table' ? 'page' : 'card'"
            :show-heading="widgetOf(widgetId)!.type === 'table' && hasTitle(widgetOf(widgetId)!)"
            :can-move="canMove(widgetId)"
            :can-resize="canResize(widgetId)"
            :label="label"
            :openable="openable(widgetOf(widgetId)!)"
            @move="(direction) => move(widgetOf(widgetId)!, direction)"
            @resize="(change) => resize(widgetOf(widgetId)!, change)"
            @remove="update((current) => removeDashboardWidget(current, widgetId))"
            @open="open(widgetOf(widgetId)!)"
          >
            <DashboardWidgetContent
              :dashboard="dashboard"
              :shown="shown"
              :widget="widgetOf(widgetId)!"
              :availability="availabilityOf(widgetOf(widgetId)!)"
              :source="sourceOf(widgetOf(widgetId)!.tableId)"
              :loader="loader"
              :views="views"
              :block="blockOf(widgetOf(widgetId)!.block)"
              :today="today"
              :editing="editing"
              :sync-url="props.syncUrl"
              :revision="revisions.widgetRevision(widgetOf(widgetId)!.tableId)"
              :page-revision="revisions.pageRevision(widgetOf(widgetId)!.tableId ?? '')"
              :block-revision="revisions.blockRevision.value"
              :filter-values="filterValues"
              :label="label"
              :locale="props.locale"
              :translate="translate"
              :notice-text="noticeText"
              :table-translations="props.tableTranslations"
              :size="sizeOf(section, widgetId)"
              :openable="openable(widgetOf(widgetId)!)"
              :renderers="props.displayModeRenderers"
              :render-markdown="props.renderMarkdown"
              :get-row-id="props.getRowId"
              :natural="flow"
              :refresh="revisions.refresh"
              :open-view="props.openView"
              @view-all="open(widgetOf(widgetId)!)"
              @mutated="revisions.mutated"
            />
          </DashboardWidgetFrame>
        </template>
      </DashboardSectionView>
    </template>
    <div v-if="!dashboard.widgets.length" class="yayaw-dashboard-message" data-widget-state="muted">
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
        @add="addWidget"
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
