/**
 * The screen editor's rules, shared by the React and Vue editions (synced to
 * Vue by `scripts/sync-table-contracts.mjs`): sections (add, rename, move,
 * remove), moving widgets between sections, what the widget dialog offers
 * (kinds, blocks, the source catalogue), the view editor (what changed and
 * what to apply), inline copies of saved views, block props typed as JSON and
 * where a validation issue points. Pure and server-safe (no React, Vue or
 * CSS).
 */
import { canonicalViewConfig, type ViewConfig } from "../yayaw-table/utils/view-config";
import {
  type DashboardTranslate,
  type DashboardView,
  dashboardLabel,
  dashboardTextInput,
  dashboardUnavailableText,
  editDashboardText,
} from "./dashboard-model";
import {
  checkDashboardBlockProps,
  DASHBOARD_LIMITS,
  type Dashboard,
  type DashboardBlocks,
  type DashboardInlineView,
  type DashboardIssue,
  type DashboardJsonObject,
  type DashboardLimits,
  type DashboardSection,
  type DashboardSectionType,
  type DashboardWidget,
  dashboardAcceptedSections,
  dashboardText,
  dashboardWidgetSection,
  moveWidgetToSection,
  removeDashboardWidget,
} from "./dashboard-schema";
import type { DashboardSourceSummary } from "./dashboard-sources";

/** What the screen editor opens: one dialog at a time. */
export type DashboardEditorRequest =
  | { kind: "addWidget"; sectionId?: string }
  | { kind: "editWidget"; widgetId: string }
  | { kind: "editView"; widgetId: string }
  | { kind: "removeSection"; sectionId: string }
  | { kind: "addFilter" };

/** What the widget dialog does: add a widget (to a section, else the first that takes it) or edit one. */
export type DashboardWidgetDialogTarget =
  | { mode: "add"; sectionId?: string; sectionType?: DashboardSectionType }
  | { mode: "edit"; widget: DashboardWidget };

// Sections ---------------------------------------------------------------------------

/** Moves a section makes in the page: one place up or down. */
export type DashboardSectionMove = "up" | "down";

/** The widgets a section places, in its order (a grid's layout, a flow's list). */
export const dashboardSectionWidgetIds = (
  section: DashboardSection
): string[] =>
  section.type === "grid"
    ? section.layout.map((item) => item.widgetId)
    : [...section.widgetIds];

/** Whether another section can be added (`DASHBOARD_LIMITS.sections`, 12). */
export const canAddDashboardSection = (
  dashboard: Pick<Dashboard, "sections">,
  limits: Partial<Pick<DashboardLimits, "sections">> = {}
): boolean =>
  dashboard.sections.length < (limits.sections ?? DASHBOARD_LIMITS.sections);

/** Whether a section can move one place that way. */
export function canMoveDashboardSection(
  dashboard: Pick<Dashboard, "sections">,
  sectionId: string,
  direction: DashboardSectionMove
): boolean {
  const index = dashboard.sections.findIndex(
    (section) => section.id === sectionId
  );
  if (index < 0) {
    return false;
  }
  return direction === "up" ? index > 0 : index < dashboard.sections.length - 1;
}

/** A section moved one place up or down; unchanged when it cannot move. */
export function moveDashboardSection(
  dashboard: Dashboard,
  sectionId: string,
  direction: DashboardSectionMove
): Dashboard {
  if (!canMoveDashboardSection(dashboard, sectionId, direction)) {
    return dashboard;
  }
  const sections = [...dashboard.sections];
  const index = sections.findIndex((section) => section.id === sectionId);
  const other = index + (direction === "up" ? -1 : 1);
  const [moved] = sections.splice(index, 1);
  if (moved) {
    sections.splice(other, 0, moved);
  }
  return { ...dashboard, sections };
}

/**
 * Removes a section and the widgets it holds, with their mentions in filter
 * targets. Editors ask first when the section is not empty.
 */
export function removeDashboardSection(
  dashboard: Dashboard,
  sectionId: string
): Dashboard {
  const section = dashboard.sections.find((item) => item.id === sectionId);
  if (!section) {
    return dashboard;
  }
  let next = dashboard;
  for (const widgetId of dashboardSectionWidgetIds(section)) {
    next = removeDashboardWidget(next, widgetId);
  }
  return {
    ...next,
    sections: next.sections.filter((item) => item.id !== sectionId),
  };
}

/**
 * A section renamed in `locale`: a plain title stays plain, a localized one
 * keeps its other languages; an empty title removes it (the section then
 * shows no heading).
 */
export function renameDashboardSection(
  dashboard: Dashboard,
  sectionId: string,
  title: string,
  locale: string
): Dashboard {
  return {
    ...dashboard,
    sections: dashboard.sections.map((section) => {
      if (section.id !== sectionId) {
        return section;
      }
      const { title: previous, ...rest } = section;
      const next = editDashboardText(previous, locale, title);
      return (next ? { ...rest, title: next } : rest) as DashboardSection;
    }),
  };
}

/** What a section's title input shows in `locale` (no other language's version). */
export const dashboardSectionTitleInput = (
  section: Pick<DashboardSection, "title">,
  locale: string
): string => dashboardTextInput(section.title, locale);

/** A section's name in menus: its title, else "Section 2". */
export function dashboardSectionName(
  dashboard: Pick<Dashboard, "sections">,
  sectionId: string,
  locale: string,
  translate?: DashboardTranslate
): string {
  const index = dashboard.sections.findIndex(
    (section) => section.id === sectionId
  );
  const title = dashboardText(dashboard.sections[index]?.title, locale);
  return (
    title ||
    dashboardLabel("sectionNumber", locale, translate, { number: index + 1 })
  );
}

// Moving widgets between sections -----------------------------------------------------

/** A section a widget can move to. */
export interface DashboardSectionChoice {
  id: string;
  type: DashboardSectionType;
  /** Its title, else "Section 2". */
  name: string;
}

/** The other sections that take a widget (a full-page table only flows, a block where its host puts it), in order. */
export function dashboardWidgetMoveTargets(
  dashboard: Dashboard,
  widgetId: string,
  options: {
    blocks?: DashboardBlocks;
    locale: string;
    translate?: DashboardTranslate;
  }
): DashboardSectionChoice[] {
  const widget = dashboard.widgets.find((item) => item.id === widgetId);
  if (!widget) {
    return [];
  }
  const from = dashboardWidgetSection(dashboard, widgetId);
  const accepted = dashboardAcceptedSections(widget, options.blocks);
  return dashboard.sections
    .filter(
      (section) => section.id !== from?.id && accepted.includes(section.type)
    )
    .map((section) => ({
      id: section.id,
      type: section.type,
      name: dashboardSectionName(
        dashboard,
        section.id,
        options.locale,
        options.translate
      ),
    }));
}

/**
 * Moves a widget to another section: at the first free spot of a grid (a
 * card keeps its size; one from a flow takes `size`, its type's by default),
 * at the end of a flow. Unchanged when the section cannot hold it.
 */
export function moveDashboardWidgetToSection(
  dashboard: Dashboard,
  widgetId: string,
  sectionId: string,
  options: { blocks?: DashboardBlocks; size?: { w: number; h: number } } = {}
): Dashboard {
  const from = dashboardWidgetSection(dashboard, widgetId);
  return moveWidgetToSection(dashboard, widgetId, sectionId, {
    ...(options.blocks ? { blocks: options.blocks } : {}),
    ...(from?.type !== "grid" && options.size ? { size: options.size } : {}),
  });
}

/**
 * A widget changed in the widget dialog: its id and place are kept. A widget
 * whose section can no longer hold it (another block) moves to the first
 * section that can.
 */
export function updateDashboardWidget(
  dashboard: Dashboard,
  widgetId: string,
  widget: Omit<DashboardWidget, "id">,
  blocks?: DashboardBlocks
): Dashboard {
  if (!dashboard.widgets.some((item) => item.id === widgetId)) {
    return dashboard;
  }
  const next: Dashboard = {
    ...dashboard,
    widgets: dashboard.widgets.map((item) =>
      item.id === widgetId ? { ...widget, id: widgetId } : item
    ),
  };
  const section = dashboardWidgetSection(next, widgetId);
  const accepted = dashboardAcceptedSections(widget, blocks);
  if (!section || accepted.includes(section.type)) {
    return next;
  }
  const target = next.sections.find((item) => accepted.includes(item.type));
  return target
    ? moveWidgetToSection(next, widgetId, target.id, blocks ? { blocks } : {})
    : next;
}

// What the widget dialog offers ---------------------------------------------------------

/** What a widget can be, as the widget dialog lists it. */
export type DashboardWidgetKind = DashboardWidget["type"];

export interface DashboardWidgetChoice {
  kind: DashboardWidgetKind;
  /** Blocks: the host's key. */
  block?: string;
  label: string;
  description?: string;
  /** The heading it is listed under: empty for the built-in kinds, a block's `group` (else "Blocks"). */
  group: string;
}

const KIND_LABELS = {
  kpi: ["kindKpi", "kindKpiHint"],
  view: ["kindView", "kindViewHint"],
  table: ["kindTable", "kindTableHint"],
  note: ["kindNote", "kindNoteHint"],
} as const;

/**
 * What the widget dialog offers for a section (for any section without one):
 * a number, a view, a full-page table (flows only), a note, then the host's
 * blocks that section takes (their `placement`), by group in the order the
 * host lists them.
 */
export function dashboardWidgetChoices(options: {
  section?: DashboardSectionType;
  blocks?: DashboardBlocks;
  locale: string;
  translate?: DashboardTranslate;
}): DashboardWidgetChoice[] {
  const { blocks, locale, section, translate } = options;
  const label = (key: Parameters<typeof dashboardLabel>[0]) =>
    dashboardLabel(key, locale, translate);
  const takes = (type: DashboardWidgetKind, block?: string) =>
    !section ||
    dashboardAcceptedSections({ type, block }, blocks).includes(section);
  const builtIn = (Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[])
    .filter((kind) => takes(kind))
    .map((kind) => ({
      kind,
      label: label(KIND_LABELS[kind][0]),
      description: label(KIND_LABELS[kind][1]),
      group: "",
    }));
  const hosted = Object.entries(blocks ?? {})
    .filter(([key]) => takes("block", key))
    .map(([key, block]): DashboardWidgetChoice => {
      const description = dashboardText(block.description, locale);
      return {
        kind: "block",
        block: key,
        label: dashboardText(block.label, locale) || key,
        ...(description ? { description } : {}),
        group: dashboardText(block.group, locale) || label("blocks"),
      };
    });
  const groups = [...new Set(hosted.map((choice) => choice.group))];
  return [
    ...builtIn,
    ...groups.flatMap((group) =>
      hosted.filter((choice) => choice.group === group)
    ),
  ];
}

/** Whether a widget of this kind reads a source (the dialog then asks for one). */
export const dashboardKindReadsSource = (kind: DashboardWidgetKind): boolean =>
  kind === "kpi" || kind === "view" || kind === "table";

// The source catalogue ------------------------------------------------------------------

/** A source as the widget dialog lists it. */
export interface DashboardSourceChoice {
  id: string;
  name: string;
  description?: string;
  /** False for sources this user cannot use: listed, not picked. */
  available: boolean;
  /** Why it is unavailable: the host's message, else its reason's text. */
  reason?: string;
}

/** Sources under one heading (a summary's `group`; empty for the others). */
export interface DashboardSourceGroup {
  label: string;
  sources: DashboardSourceChoice[];
}

const COMBINING_MARKS = /[̀-ͯ]/g;
const fold = (value: string): string =>
  value.normalize("NFD").replace(COMBINING_MARKS, "").toLocaleLowerCase();

/** Whether a source matches what is typed: its name, id, description, group or keywords, accents and case aside. */
export function dashboardSourceMatches(
  summary: DashboardSourceSummary,
  query: string,
  locale: string
): boolean {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) {
    return true;
  }
  const haystack = fold(
    [
      summary.id,
      dashboardText(summary.name, locale),
      dashboardText(summary.description, locale),
      dashboardText(summary.group, locale),
      ...(summary.keywords ?? []),
    ].join(" ")
  );
  return words.every((word) => haystack.includes(word));
}

/**
 * The catalogue as the widget dialog lists it: the sources matching `query`,
 * under their group (in the order groups first appear), unavailable ones
 * with the reason they cannot be picked.
 */
export function dashboardSourceChoices(
  summaries: readonly DashboardSourceSummary[],
  options: { query?: string; locale: string; translate?: DashboardTranslate }
): DashboardSourceGroup[] {
  const { locale, translate } = options;
  const groups = new Map<string, DashboardSourceChoice[]>();
  for (const summary of summaries) {
    if (!dashboardSourceMatches(summary, options.query ?? "", locale)) {
      continue;
    }
    const group = dashboardText(summary.group, locale);
    const description = dashboardText(summary.description, locale);
    const available = summary.available !== false;
    const choice: DashboardSourceChoice = {
      id: summary.id,
      name: dashboardText(summary.name, locale) || summary.id,
      ...(description ? { description } : {}),
      available,
      ...(available
        ? {}
        : {
            reason: dashboardUnavailableText(
              summary.unavailableReason,
              summary.unavailableMessage,
              locale,
              translate
            ),
          }),
    };
    groups.set(group, [...(groups.get(group) ?? []), choice]);
  }
  return [...groups].map(([label, sources]) => ({ label, sources }));
}

// The view editor -------------------------------------------------------------------------

/**
 * One session of the view editor: the settings the table starts from and
 * what it reported since (`onViewConfigChange` / `view-config-change`).
 */
export interface DashboardViewEdit {
  /** The widget's view before editing: its inline settings, its saved view's, or `{}`. */
  initial: DashboardInlineView;
  /** The table's first report: the view as the table started. */
  baseline?: ViewConfig;
  /** The table's last report. */
  latest?: ViewConfig;
}

/**
 * The settings a widget's view editor starts from: its inline view, else its
 * saved view's settings (sanitized), else the source's default view (`{}`).
 */
export function dashboardViewEditStart(
  widget: Pick<DashboardWidget, "view" | "viewId">,
  view?: Pick<DashboardView, "id" | "config">
): DashboardViewEdit {
  if (widget.view) {
    return { initial: { ...widget.view } };
  }
  const saved = widget.viewId && view?.id === widget.viewId ? view : undefined;
  return { initial: saved ? canonicalViewConfig(saved.config) : {} };
}

/** The session with the table's report recorded: the first is the baseline. */
export const recordDashboardViewReport = (
  edit: DashboardViewEdit,
  config: ViewConfig
): DashboardViewEdit => ({
  ...edit,
  baseline: edit.baseline ?? config,
  latest: config,
});

const viewJson = (config: unknown) =>
  JSON.stringify(canonicalViewConfig(config));

/** Whether the admin changed the view since the table started (closing then asks first). */
export const dashboardViewEdited = (edit: DashboardViewEdit): boolean =>
  Boolean(edit.baseline && edit.latest) &&
  viewJson(edit.baseline) !== viewJson(edit.latest);

/**
 * What "Apply" stores in `widget.view`: the table's last report, sanitized.
 * The page size is left out unless the admin changed it (a fit widget sizes
 * its records to its card), or the view already had one. Undefined before
 * the table reported.
 */
export function dashboardViewToApply(
  edit: DashboardViewEdit
): DashboardInlineView | undefined {
  if (!edit.latest) {
    return;
  }
  const { pageSize, ...config } = canonicalViewConfig(edit.latest);
  const changed =
    pageSize !== undefined && pageSize !== edit.baseline?.pageSize;
  const kept = changed ? pageSize : edit.initial.pageSize;
  return kept === undefined ? config : { ...config, pageSize: kept };
}

/**
 * Actions that change records or send them somewhere: the view editor's
 * table leaves them out (a manual order is stored per view by `reorder`).
 */
const WRITE_ACTIONS: ReadonlySet<string> = new Set([
  "create",
  "update",
  "delete",
  "duplicate",
  "bulkDelete",
  "bulkCopy",
  "bulkUpdate",
  "import",
  "reorder",
  "destinations",
  "formLinks",
]);
/** The file tree's writes (`actions.tree`); its reads stay. */
const TREE_WRITES: ReadonlySet<string> = new Set(["move", "createFolder"]);
/** The file tree's upload hook (`table.filetree.onDropFiles`). */
const DROP_HOOKS: ReadonlySet<string> = new Set(["onDropFiles"]);

const withoutKeys = (
  value: object,
  keys: ReadonlySet<string>
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)));

/**
 * The source's actions as the view editor's table gets them: reading only
 * (`list`, `aggregate`, the file tree's `path`, planning's reads, which
 * `allowEdit: false` keeps read-only…), so editing a view never changes
 * records.
 */
export function dashboardViewEditorActions<T extends object>(actions: T): T {
  const kept = withoutKeys(actions, WRITE_ACTIONS);
  const { tree } = kept;
  return (
    typeof tree === "object" && tree !== null
      ? { ...kept, tree: withoutKeys(tree, TREE_WRITES) }
      : kept
  ) as T;
}

/**
 * The source's config as the view editor's table gets it: its toolbar
 * (search, filters, sort, columns, display and every mode's settings) without
 * URL sync, saved views, selection or record changes.
 */
export function dashboardViewEditorConfig<T extends { table?: object }>(
  config: T
): T {
  // Files dropped from the desktop would upload through the host's hook.
  const filetree = (config.table as { filetree?: unknown } | undefined)
    ?.filetree;
  const tree =
    typeof filetree === "object" && filetree !== null
      ? { filetree: withoutKeys(filetree, DROP_HOOKS) }
      : {};
  return {
    ...config,
    table: {
      ...config.table,
      ...tree,
      syncUrl: false,
      enableViews: false,
      allowViewSave: false,
      enableRowSelection: false,
      showToolbar: true,
      showToolbarHeader: false,
      allowCreate: false,
      allowEdit: false,
      allowInlineEdit: false,
      allowDelete: false,
      allowDuplicate: false,
      allowBulkEdit: false,
      allowBulkDelete: false,
    },
  };
}

/**
 * The widget with inline settings `view` instead of a saved view. A view
 * widget without a title of its own keeps the saved view's name as its
 * title (`name`), so it reads the same.
 */
export function setDashboardWidgetView(
  dashboard: Dashboard,
  widgetId: string,
  view: DashboardInlineView,
  name?: string
): Dashboard {
  return {
    ...dashboard,
    widgets: dashboard.widgets.map((widget) => {
      if (widget.id !== widgetId) {
        return widget;
      }
      const { viewId: _viewId, ...rest } = widget;
      const keepsName =
        widget.type === "view" &&
        widget.title === undefined &&
        Boolean(widget.viewId && name);
      return {
        ...rest,
        ...(keepsName ? { title: name } : {}),
        view,
      };
    }),
  };
}

/**
 * "Use a copy of this view": a widget's saved view becomes inline settings (a
 * sanitized copy of its `config`), so the screen no longer follows changes
 * to the saved view. Unchanged when the widget does not name that view.
 */
export function copyDashboardWidgetView(
  dashboard: Dashboard,
  widgetId: string,
  view: Pick<DashboardView, "id" | "name" | "config">
): Dashboard {
  const widget = dashboard.widgets.find((item) => item.id === widgetId);
  if (!widget || widget.view || widget.viewId !== view.id) {
    return dashboard;
  }
  return setDashboardWidgetView(
    dashboard,
    widgetId,
    canonicalViewConfig(view.config),
    view.name
  );
}

// Block props ---------------------------------------------------------------------------

/** Props typed as JSON in the widget dialog, as the editor reads them. */
export interface DashboardBlockPropsDraft {
  /** False when the text is not JSON: the props are refused. */
  json: boolean;
  /** The props to apply, when nothing refused them. */
  props?: DashboardJsonObject;
  /** Why they are refused (errors) or what to know (warnings), with paths inside the props. */
  issues: DashboardIssue[];
  ok: boolean;
}

/** The props as the dialog's JSON text shows them. */
export const dashboardBlockPropsText = (
  props: DashboardJsonObject | undefined
): string => JSON.stringify(props ?? {}, null, 2);

/**
 * Props typed as JSON: parsed, then checked as `validateDashboard` does (a
 * JSON object, copied safely, then the block's `validateProps`). Invalid
 * JSON and errors refuse them.
 */
export function parseDashboardBlockProps(
  text: string,
  block: string,
  options: { blocks?: DashboardBlocks; limits?: Partial<DashboardLimits> } = {}
): DashboardBlockPropsDraft {
  let value: unknown;
  try {
    value = text.trim() ? JSON.parse(text) : {};
  } catch {
    return { json: false, issues: [], ok: false };
  }
  const checked = checkDashboardBlockProps(block, value, options);
  return {
    json: true,
    issues: checked.issues,
    ok: checked.ok,
    ...(checked.ok ? { props: checked.props } : {}),
  };
}

// Validation before saving ------------------------------------------------------------------

const WIDGET_PATH = /^widgets\[(\d+)\]/;
const SECTION_PATH = /^sections\[(\d+)\]/;
const FILTER_PATH = /^filters\[(\d+)\]/;

/** What a validation issue is about, by id: a widget, a section or a filter of the document checked. */
export interface DashboardIssueTarget {
  widgetId?: string;
  sectionId?: string;
  filterId?: string;
}

/** The widget, section or filter an issue's path (`widgets[2].props.unit`) points into. */
export function dashboardIssueTarget(
  dashboard: Pick<Dashboard, "widgets" | "sections" | "filters">,
  issue: Pick<DashboardIssue, "path">
): DashboardIssueTarget {
  const path = issue.path ?? "";
  const at = (pattern: RegExp) => {
    const match = pattern.exec(path);
    return match ? Number(match[1]) : undefined;
  };
  const widget = at(WIDGET_PATH);
  if (widget !== undefined) {
    const id = dashboard.widgets[widget]?.id;
    return id ? { widgetId: id } : {};
  }
  const section = at(SECTION_PATH);
  if (section !== undefined) {
    const id = dashboard.sections[section]?.id;
    return id ? { sectionId: id } : {};
  }
  const filter = at(FILTER_PATH);
  const id = filter === undefined ? undefined : dashboard.filters[filter]?.id;
  return id ? { filterId: id } : {};
}

/** Issues that stop a save: the errors (`validateDashboard`'s `ok` is false with any). */
export const dashboardSaveErrors = (
  issues: readonly DashboardIssue[]
): DashboardIssue[] => issues.filter((issue) => issue.severity === "error");
