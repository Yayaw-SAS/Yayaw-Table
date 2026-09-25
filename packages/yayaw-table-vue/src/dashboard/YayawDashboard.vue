<script setup lang="ts">
import {
  Check, Copy, LayoutGrid, Pencil, Pin, Plus, RefreshCw, Rows3, Settings2, SlidersHorizontal, X,
} from "lucide-vue-next";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger,
} from "reka-ui";
import { toast } from "vue-sonner";
import { computed, defineAsyncComponent, ref, shallowRef, type VNodeChild } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord } from "../types";
import type { ViewConfig } from "../view-config";
import DashboardEmptySection from "./DashboardEmptySection.vue";
import DashboardFilters from "./DashboardFilters.vue";
import DashboardSectionView from "./DashboardSection.vue";
import DashboardSectionBar from "./DashboardSectionBar.vue";
import DashboardWidgetContent from "./DashboardWidgetContent.vue";
import DashboardWidgetFrame from "./DashboardWidget.vue";
import {
  canAddDashboardSection,
  canMoveDashboardSection,
  copyDashboardWidgetView,
  type DashboardEditorRequest,
  type DashboardSectionMove,
  type DashboardViewEdit,
  dashboardIssueTarget,
  dashboardSaveErrors,
  dashboardSectionName,
  dashboardSectionTitleInput,
  dashboardSectionWidgetIds,
  dashboardViewToApply,
  dashboardWidgetMoveTargets,
  moveDashboardSection,
  moveDashboardWidgetToSection,
  recordDashboardViewReport,
  removeDashboardSection,
  renameDashboardSection,
  setDashboardWidgetView,
} from "./dashboard-editor-model";
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
  type DashboardDateRange,
  type DashboardLabelKey,
  type DashboardNotice,
  type DashboardOpenViewContext,
  type DashboardStorage,
  type DashboardTableInfo,
  dashboardDayValue,
  dashboardFilterLabel,
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
  addDashboardSection,
  applyDashboardSectionLayout,
  canMoveDashboardWidget,
  canResizeDashboardWidget,
  type Dashboard,
  type DashboardIssue,
  type DashboardSection,
  type DashboardSectionType,
  type DashboardWidget,
  dashboardText,
  moveDashboardWidget,
  removeDashboardWidget,
  resizeDashboardWidget,
  validateDashboard,
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
  DashboardWidgetMenuAction,
} from "./dashboard-types";
import "./dashboard.css";

/** The editor's dialogs load with edit mode, never for readers. */
const DashboardEditorLayer = defineAsyncComponent(() => import("./DashboardEditorLayer.vue"));

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
/** The dialog the editor shows: one at a time. */
const request = shallowRef<DashboardEditorRequest | null>(null);
/** Why "Done" did not save: `validateDashboard`'s errors. */
const issues = shallowRef<DashboardIssue[]>([]);
const announcement = ref("");
/** The view each full-page table reported, by widget. */
const pageViews = new Map<string, DashboardViewEdit>();

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
  // Edit mode shows every section, empty ones included.
  if (editing.value) return current.sections;
  const hidden =
    props.unavailableWidgets === "hide"
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
const openFull = (widget: DashboardWidget) => {
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
const tableInfoOf = (id?: string): DashboardTableInfo | undefined => {
  const source = sourceOf(id);
  return source && id ? tableInfo(id, source) : undefined;
};
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
  issues.value = [];
  editing.value = true;
};

// The editor ---------------------------------------------------------------------------

const open = (next: DashboardEditorRequest) => {
  request.value = next;
};
const announce = (message: string) => {
  announcement.value = message;
};
const SOURCED = new Set<DashboardWidget["type"]>(["view", "kpi", "table"]);
/**
 * The editor's entries of a widget's menu: edit it, edit its view in the live
 * table, use a copy of its saved view, make a full-page table's current view
 * the screen's default.
 */
const menuActionsOf = (widget: DashboardWidget): DashboardWidgetMenuAction[] => {
  if (!editing.value) return [];
  const widgetId = widget.id;
  const actions: DashboardWidgetMenuAction[] = [
    { id: "edit", label: label("editWidget"), icon: Settings2, onSelect: () => open({ kind: "editWidget", widgetId }) },
  ];
  const ready = availabilityOf(widget).status === "ready";
  if (SOURCED.has(widget.type) && ready) {
    actions.push({
      id: "edit-view",
      label: label("editView"),
      icon: SlidersHorizontal,
      onSelect: () => open({ kind: "editView", widgetId }),
    });
  }
  const saved =
    widget.viewId && !widget.view
      ? views.value[widget.tableId ?? ""]?.find((view) => view.id === widget.viewId)
      : undefined;
  if (saved) {
    actions.push({
      id: "copy-view",
      label: label("useViewCopy"),
      icon: Copy,
      onSelect: () => {
        update((current) => copyDashboardWidgetView(current, widgetId, saved));
        announce(label("viewCopied", { title: titleOf(widget) }));
      },
    });
  }
  if (widget.type === "table" && ready) {
    actions.push({
      id: "screen-default",
      label: label("makeScreenDefault"),
      icon: Pin,
      onSelect: () => {
        const live = pageViews.get(widgetId);
        const view = live ? dashboardViewToApply(live) : undefined;
        if (view) {
          update((current) => setDashboardWidgetView(current, widgetId, view));
          announce(label("screenDefaultSet"));
          toast.success(label("screenDefaultSet"));
        }
      },
    });
  }
  return actions;
};
const recordPageView = (widget: DashboardWidget, config: ViewConfig) => {
  pageViews.set(
    widget.id,
    recordDashboardViewReport(pageViews.get(widget.id) ?? { initial: widget.view ?? {} }, config)
  );
};
const moveTargetsOf = (widget: DashboardWidget) =>
  editing.value && dashboard.value
    ? dashboardWidgetMoveTargets(dashboard.value, widget.id, {
        blocks: props.blocks,
        locale: props.locale,
        translate: translate.value,
      })
    : [];
const moveToSection = (widget: DashboardWidget, sectionId: string) => {
  const target = moveTargetsOf(widget).find((item) => item.id === sectionId);
  update((current) =>
    moveDashboardWidgetToSection(current, widget.id, sectionId, {
      blocks: props.blocks,
      size: dashboardWidgetSize(widget, {
        views: views.value[widget.tableId ?? ""],
        table: tableInfoOf(widget.tableId),
        block: blockOf(widget.block),
      }),
    })
  );
  announce(label("movedToSection", { title: titleOf(widget), section: target?.name ?? sectionId }));
};
const sectionName = (section: DashboardSection) =>
  dashboard.value ? dashboardSectionName(dashboard.value, section.id, props.locale, translate.value) : section.id;
const canMoveSection = (section: DashboardSection) => (direction: DashboardSectionMove) =>
  dashboard.value ? canMoveDashboardSection(dashboard.value, section.id, direction) : false;
const moveSection = (section: DashboardSection, direction: DashboardSectionMove) => {
  const name = sectionName(section);
  update((current) => moveDashboardSection(current, section.id, direction));
  announce(label("moved", { title: name }));
};
const removeSection = (section: DashboardSection) => {
  if (dashboardSectionWidgetIds(section).length) {
    open({ kind: "removeSection", sectionId: section.id });
    return;
  }
  const name = sectionName(section);
  update((current) => removeDashboardSection(current, section.id));
  announce(label("sectionRemoved", { title: name }));
};
const renameSection = (section: DashboardSection, title: string) =>
  update((current) => renameDashboardSection(current, section.id, title, props.locale));
const addSection = (type: DashboardSectionType) => update((current) => addDashboardSection(current, { type }));
const canAddSection = computed(() => (dashboard.value ? canAddDashboardSection(dashboard.value) : false));
/** What an issue of "Done" is about: its widget's title, section, filter, else its path. */
const issueSubject = (issue: DashboardIssue): string => {
  const current = dashboard.value;
  if (!current) return issue.path ?? "";
  const target = dashboardIssueTarget(current, issue);
  const widget = current.widgets.find((item) => item.id === target.widgetId);
  if (widget) return titleOf(widget);
  if (target.sectionId) return dashboardSectionName(current, target.sectionId, props.locale, translate.value);
  const filter = current.filters.find((item) => item.id === target.filterId);
  return filter ? dashboardFilterLabel(filter, props.locale) : (issue.path ?? "");
};
const refreshAll = () => {
  revisions.refresh();
  for (const id of screenIds.value) {
    if (loader.value.state(id)?.status === "error") loader.value.retry(id).catch(() => undefined);
  }
};

// "Done" saves version 2 once `validateDashboard` finds no error.
const save = async () => {
  const current = dashboard.value;
  const storage = props.actions?.dashboards;
  if (!(current && storage)) return;
  const checked = validateDashboard(current, { blocks: props.blocks });
  if (!(checked.ok && checked.dashboard)) {
    issues.value = dashboardSaveErrors(checked.issues);
    return;
  }
  issues.value = [];
  saving.value = true;
  try {
    await storage.save({ ...checked.dashboard, updatedAt: new Date().toISOString() });
    editing.value = false;
    request.value = null;
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
        <button v-if="editing" type="button" class="yayaw-button yayaw-button-outline" @click="open({ kind: 'addWidget' })">
          <Plus :size="16" aria-hidden="true" />{{ label("addWidget") }}
        </button>
        <DropdownMenuRoot v-if="editing" :modal="false">
          <DropdownMenuTrigger as-child>
            <button type="button" class="yayaw-button yayaw-button-outline" data-add-section="" :disabled="!canAddSection">
              <Plus :size="16" aria-hidden="true" />{{ label("addSection") }}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent class="yayaw-row-actions-menu yayaw-dashboard-menu" align="end" :side-offset="4" :collision-padding="8">
              <DropdownMenuItem as-child @select="addSection('grid')">
                <button type="button" class="yayaw-row-action-item"><LayoutGrid :size="16" aria-hidden="true" />{{ label("sectionGrid") }}</button>
              </DropdownMenuItem>
              <DropdownMenuItem as-child @select="addSection('flow')">
                <button type="button" class="yayaw-row-action-item"><Rows3 :size="16" aria-hidden="true" />{{ label("sectionFlow") }}</button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
        <button v-if="editable && editing" type="button" class="yayaw-button" :disabled="saving" @click="save">
          <Check :size="16" aria-hidden="true" />{{ saving ? label("saving") : label("done") }}
        </button>
        <button v-if="editable && !editing" type="button" class="yayaw-button yayaw-button-outline" @click="startEditing">
          <Pencil :size="16" aria-hidden="true" />{{ label("edit") }}
        </button>
      </div>
    </header>
    <div v-if="editing && issues.length" class="yayaw-dashboard-issues" data-dashboard-issues="" role="alert">
      <div class="yayaw-dashboard-issues-body">
        <p class="yayaw-dashboard-issues-title">{{ label("saveIssues") }}</p>
        <ul>
          <li v-for="issue in issues" :key="`${issue.code}:${issue.path ?? ''}:${issue.message}`" :data-issue-code="issue.code">
            {{ issueSubject(issue) ? `${issueSubject(issue)}: ` : "" }}{{ issue.message }}
          </li>
        </ul>
      </div>
      <button type="button" class="yayaw-dashboard-icon-button" :aria-label="label('dismiss')" @click="issues = []">
        <X :size="16" aria-hidden="true" />
      </button>
    </div>
    <DashboardFilters
      :filters="shown.filters"
      :tables="infos"
      :editing="editing"
      :label="label"
      :locale="props.locale"
      :translate="translate"
      @change="changeFilter"
      @remove="(filterId) => update((current) => removeDashboardFilter(current, filterId))"
      @add="open({ kind: 'addFilter' })"
    />
    <!-- Widgets query once the reader's filter values are read from the URL. -->
    <template v-if="(editing || dashboard.widgets.length) && viewer.ready.value">
      <DashboardSectionView
        v-for="section in sections"
        :key="section.id"
        :section="section"
        :title="dashboardText(section.title, props.locale)"
        :editing="editing"
        @layout-change="(layout) => update((current) => applyDashboardSectionLayout(current, section.id, layout))"
      >
        <template #bar>
          <DashboardSectionBar
            :section="section"
            :name="sectionName(section)"
            :title-input="dashboardSectionTitleInput(section, props.locale)"
            :label="label"
            :can-move="canMoveSection(section)"
            @rename="(title) => renameSection(section, title)"
            @move="(direction) => moveSection(section, direction)"
            @add-widget="open({ kind: 'addWidget', sectionId: section.id })"
            @remove="removeSection(section)"
          />
        </template>
        <template #empty>
          <DashboardEmptySection :label="label" @add-widget="open({ kind: 'addWidget', sectionId: section.id })" />
        </template>
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
            :menu-actions="menuActionsOf(widgetOf(widgetId)!)"
            :move-targets="moveTargetsOf(widgetOf(widgetId)!)"
            @move-to-section="(sectionId) => moveToSection(widgetOf(widgetId)!, sectionId)"
            @move="(direction) => move(widgetOf(widgetId)!, direction)"
            @resize="(change) => resize(widgetOf(widgetId)!, change)"
            @remove="update((current) => removeDashboardWidget(current, widgetId))"
            @open="openFull(widgetOf(widgetId)!)"
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
              @view-all="openFull(widgetOf(widgetId)!)"
              @mutated="revisions.mutated"
              @page-view="(config) => recordPageView(widgetOf(widgetId)!, config)"
            />
          </DashboardWidgetFrame>
        </template>
      </DashboardSectionView>
    </template>
    <div v-if="!dashboard.widgets.length" class="yayaw-dashboard-message" data-widget-state="muted">
      <output>{{ label(editing ? "emptyEditable" : "empty") }}</output>
    </div>
    <output aria-live="polite" class="yayaw-dashboard-sr-only">{{ announcement }}</output>
    <DashboardEditorLayer
      v-if="editing"
      :request="request"
      :dashboard="dashboard"
      :update="update"
      :announce="announce"
      :loader="loader"
      :views="views"
      :filter-tables="widgetTables"
      :blocks="props.blocks"
      :label="label"
      :locale="props.locale"
      :translate="translate"
      :renderers="props.displayModeRenderers"
      :get-row-id="props.getRowId"
      :table-translations="props.tableTranslations"
      :title-of="titleOf"
      @close="request = null"
    />
  </div>
</template>
