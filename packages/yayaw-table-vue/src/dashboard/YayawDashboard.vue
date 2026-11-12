<script setup lang="ts">
import {
  Copy, Pencil, Pin, RefreshCw, Settings2, SlidersHorizontal, X,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { computed, defineAsyncComponent, ref, shallowRef, type VNodeChild } from "vue";
import type { DisplayModeRenderers } from "../display-mode-renderer";
import type { DataTableTranslations, TableRecord, TableViewRequest } from "../types";
import type { ViewConfig } from "../view-config";
import DashboardEditBanner from "./DashboardEditBanner.vue";
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
  type DashboardSetFilterResult,
  type DashboardStorage,
  type DashboardTableInfo,
  checkDashboardFilterValue,
  dashboardDayValue,
  dashboardFilterLabel,
  dashboardFilterOptions,
  dashboardFilterValues,
  dashboardHeaderFilterId,
  dashboardKpiLink,
  dashboardKpiLinkRequest,
  dashboardLabel,
  dashboardNoticeText,
  dashboardOpenViewContext,
  dashboardSourceFilterRules,
  dashboardTranslate,
  dashboardVisibleSections,
  dashboardWidgetSize,
  dashboardWidgetTitle,
  dashboardWidgetViewId,
  isDashboardKpiLinkActive,
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
    /**
     * Numbers drive the full-page table of their source: a click shows their
     * records there (their saved view, else their filters), a second one
     * clears them; the number is pressed while the table shows them. Default false.
     */
    kpiLinks?: boolean;
    /**
     * Readers pick the screen's first date range filter in the header row,
     * beside "Refresh all"; the other filters keep their place. Default false.
     */
    periodInHeader?: boolean;
    /** The host's version history: edit mode shows "History" when given. */
    onHistory?: () => void;
    /** The host's default screen: edit mode shows "Back to the default screen" when given. */
    onResetToDefault?: () => void;
    /**
     * The host publishes the saved draft: edit mode shows "Publish", and "Done"
     * becomes "Save draft" (it saves and stays in edit mode).
     */
    onPublish?: (dashboard: Dashboard) => Promise<unknown> | unknown;
  }>(),
  {
    canEdit: false,
    kpiLinks: false,
    periodInHeader: false,
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
const publishing = ref(false);
/** `kpiLinks`: the view each full-page table shows, and what numbers ask them. */
const tableViews = ref<Record<string, ViewConfig | undefined>>({});
const viewRequests = ref<Record<string, TableViewRequest | undefined>>({});
let requestCount = 0;
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
// A block sets a screen filter as the filter bar does, once the value fits the filter.
const setBlockFilter = (filterId: string, value: unknown): DashboardSetFilterResult => {
  const current = dashboard.value;
  const filter = current?.filters.find((item) => item.id === filterId);
  const checked = checkDashboardFilterValue(current ?? { filters: [] }, filterId, value, {
    options: filter ? dashboardFilterOptions(filter, infos.value) : undefined,
    locale: props.locale,
    translate: translate.value,
  });
  if (checked.ok) changeFilter(filterId, checked.value);
  return checked;
};
const blockFilterRules = (tableId: string, options?: { exclude?: readonly string[] }) =>
  shown.value ? dashboardSourceFilterRules(shown.value, tableId, { exclude: options?.exclude, today: today.value }) : [];
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
  if (props.kpiLinks) tableViews.value = { ...tableViews.value, [widget.id]: config };
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

/** A number's link to its source's full-page table (`kpiLinks`), outside edit mode. */
const linkOf = (widget: DashboardWidget) => {
  const current = dashboard.value;
  if (!(props.kpiLinks && current) || editing.value || availabilityOf(widget).status !== "ready") return;
  const saved = views.value[widget.tableId ?? ""]?.find((view) => view.id === widget.viewId);
  const link = dashboardKpiLink(current, widget, saved);
  if (!link) return;
  const active = isDashboardKpiLinkActive(
    link,
    tableViews.value[link.tableWidgetId] as Record<string, unknown> | undefined
  );
  return { link, active, label: label("kpiShow", { title: titleOf(widget) }) };
};
const followLink = (widget: DashboardWidget) => {
  const found = linkOf(widget);
  if (!found) return;
  const asked = dashboardKpiLinkRequest(found.link, found.active);
  requestCount += 1;
  viewRequests.value = {
    ...viewRequests.value,
    [found.link.tableWidgetId]: { ...asked, config: asked.config as ViewConfig, key: requestCount },
  };
};
/** `periodInHeader`: the filter readers pick in the header row. */
const headerFilter = computed(() => {
  const current = shown.value;
  if (!(props.periodInHeader && current) || editing.value) return;
  const id = dashboardHeaderFilterId(current);
  return current.filters.find((filter) => filter.id === id);
});
const barFilters = computed(() => {
  const filters = shown.value?.filters ?? [];
  const header = headerFilter.value;
  return header ? filters.filter((filter) => filter.id !== header.id) : filters;
});

// The version 2 document to save, once `validateDashboard` finds no error.
const checkedDocument = (): Dashboard | undefined => {
  const current = dashboard.value;
  if (!current) return;
  const checked = validateDashboard(current, { blocks: props.blocks });
  if (!(checked.ok && checked.dashboard)) {
    issues.value = dashboardSaveErrors(checked.issues);
    return;
  }
  issues.value = [];
  return { ...checked.dashboard, updatedAt: new Date().toISOString() };
};
// "Done" saves and leaves edit mode; beside "Publish" it saves the draft and stays.
const save = async () => {
  const storage = props.actions?.dashboards;
  const next = storage ? checkedDocument() : undefined;
  if (!(storage && next)) return;
  saving.value = true;
  try {
    await storage.save(next);
    if (!props.onPublish) {
      editing.value = false;
      request.value = null;
    }
    toast.success(label("saved"));
  } catch (error) {
    toast.error(label("saveError", { error: errorText(error) }));
  } finally {
    saving.value = false;
  }
};
// "Publish": the draft is saved, then the host publishes it.
const publish = async () => {
  const storage = props.actions?.dashboards;
  const onPublish = props.onPublish;
  const next = storage && onPublish ? checkedDocument() : undefined;
  if (!(storage && onPublish && next)) return;
  publishing.value = true;
  try {
    await storage.save(next);
    await onPublish(next);
    editing.value = false;
    request.value = null;
    toast.success(label("published"));
  } catch (error) {
    toast.error(label("publishError", { error: errorText(error) }));
  } finally {
    publishing.value = false;
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
    <DashboardEditBanner
      v-if="editing"
      :label="label"
      :can-add-section="canAddSection"
      :saving="saving"
      :publishing="publishing"
      :history="Boolean(props.onHistory)"
      :resettable="Boolean(props.onResetToDefault)"
      :publishable="Boolean(props.onPublish)"
      @add-widget="open({ kind: 'addWidget' })"
      @add-section="addSection"
      @done="save"
      @history="props.onHistory?.()"
      @reset="props.onResetToDefault?.()"
      @publish="publish"
    />
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
        <DashboardFilters
          v-if="headerFilter"
          compact
          :filters="[headerFilter]"
          :tables="infos"
          :editing="false"
          :label="label"
          :locale="props.locale"
          :translate="translate"
          @change="changeFilter"
        />
        <button type="button" class="yayaw-button yayaw-button-outline" @click="refreshAll">
          <RefreshCw :size="16" aria-hidden="true" />{{ label("refresh") }}
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
      :filters="barFilters"
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
        v-for="(section, index) in sections"
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
            :number="index + 1"
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
            :link="linkOf(widgetOf(widgetId)!)"
            :menu-actions="menuActionsOf(widgetOf(widgetId)!)"
            :move-targets="moveTargetsOf(widgetOf(widgetId)!)"
            @move-to-section="(sectionId) => moveToSection(widgetOf(widgetId)!, sectionId)"
            @move="(direction) => move(widgetOf(widgetId)!, direction)"
            @resize="(change) => resize(widgetOf(widgetId)!, change)"
            @remove="update((current) => removeDashboardWidget(current, widgetId))"
            @open="openFull(widgetOf(widgetId)!)"
            @link="followLink(widgetOf(widgetId)!)"
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
              :view-request="viewRequests[widgetId]"
              :renderers="props.displayModeRenderers"
              :render-markdown="props.renderMarkdown"
              :get-row-id="props.getRowId"
              :natural="flow"
              :refresh="revisions.refresh"
              :set-filter="setBlockFilter"
              :filter-rules="blockFilterRules"
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
