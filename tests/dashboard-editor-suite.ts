import assert from "node:assert/strict";
import type * as Editor from "../src/components/ui/yayaw-table-dashboard/dashboard-editor-model";
import type * as Model from "../src/components/ui/yayaw-table-dashboard/dashboard-model";
import type * as Schema from "../src/components/ui/yayaw-table-dashboard/dashboard-schema";

/** The editor's rules both editions run through this suite. */
export type DashboardEditorApi = Pick<
  typeof Editor,
  | "canAddDashboardSection"
  | "canMoveDashboardSection"
  | "copyDashboardWidgetView"
  | "dashboardBlockPropsText"
  | "dashboardIssueTarget"
  | "dashboardKindReadsSource"
  | "dashboardSaveErrors"
  | "dashboardSectionName"
  | "dashboardSectionTitleInput"
  | "dashboardSectionWidgetIds"
  | "dashboardSourceChoices"
  | "dashboardSourceMatches"
  | "dashboardViewEdited"
  | "dashboardViewEditStart"
  | "dashboardViewToApply"
  | "dashboardWidgetChoices"
  | "dashboardWidgetMoveTargets"
  | "moveDashboardSection"
  | "moveDashboardWidgetToSection"
  | "parseDashboardBlockProps"
  | "recordDashboardViewReport"
  | "removeDashboardSection"
  | "renameDashboardSection"
  | "setDashboardWidgetView"
> &
  Pick<
    typeof Model,
    | "dashboardWidgetDraft"
    | "dashboardWidgetFromDraft"
    | "dashboardTextInput"
    | "editDashboardText"
  > &
  Pick<
    typeof Schema,
    | "addDashboardSection"
    | "addDashboardWidget"
    | "dashboardAcceptedSections"
    | "normalizeDashboard"
    | "validateDashboard"
  >;
type Test = (name: string, run: () => void | Promise<void>) => void;
type Dashboard = Schema.Dashboard;
type Blocks = Schema.DashboardBlocks;

const layoutOf = (dashboard: Dashboard, sectionId: string) => {
  const section = dashboard.sections.find((item) => item.id === sectionId);
  return section?.type === "grid" ? section.layout : [];
};
/** A list's item, which the test knows is there. */
const at = <T>(list: readonly T[], index: number): T => {
  const found = list[index];
  if (found === undefined) {
    throw new Error(`Nothing at ${index}`);
  }
  return found;
};
const flowOf = (dashboard: Dashboard, sectionId: string) => {
  const section = dashboard.sections.find((item) => item.id === sectionId);
  return section?.type === "flow" ? section.widgetIds : [];
};

/** A screen: a grid of two numbers and a note, a flow with a table and a block. */
const SCREEN = {
  version: 2,
  id: "screen",
  name: { en: "Content", fr: "Contenu" },
  sections: [
    {
      id: "cards",
      type: "grid",
      title: { en: "Today", fr: "Aujourd’hui" },
      layout: [
        { widgetId: "published", x: 0, y: 0, w: 1, h: 1 },
        { widgetId: "drafts", x: 1, y: 0, w: 1, h: 1 },
        { widgetId: "hello", x: 2, y: 0, w: 1, h: 2 },
      ],
    },
    { id: "page", type: "flow", widgetIds: ["pages", "storage"] },
  ],
  widgets: [
    {
      id: "published",
      type: "kpi",
      tableId: "pages",
      title: { en: "Published", fr: "Publiées" },
      settings: {
        metric: "count",
        dateColumn: "updatedAt",
        sparkline: { bucket: "week", buckets: 12 },
      },
    },
    {
      id: "drafts",
      type: "view",
      tableId: "pages",
      viewId: "drafts",
      settings: { overflow: "scroll" },
    },
    { id: "hello", type: "note", settings: { text: "Hello" } },
    { id: "pages", type: "table", tableId: "pages", settings: {} },
    {
      id: "storage",
      type: "block",
      block: "media.storage",
      props: { unit: "GB" },
      settings: {},
    },
  ],
  filters: [
    {
      id: "period",
      type: "dateRange",
      label: "Period",
      targets: [
        { tableId: "pages", columnId: "updatedAt", widgetIds: ["published"] },
        { tableId: "pages", columnId: "updatedAt" },
      ],
    },
  ],
};

const BLOCKS: Blocks = {
  "media.storage": {
    label: { en: "Storage", fr: "Stockage" },
    group: "Media",
    placement: "flow",
    validateProps: (props) => {
      if (props.unit === "TB") {
        return [
          {
            message: "Terabytes are not shown yet.",
            path: "unit",
            severity: "warning",
          },
        ];
      }
      return props.unit === undefined ||
        ["GB", "MB"].includes(String(props.unit))
        ? undefined
        : [{ message: "unit is GB or MB", path: "unit" }];
    },
  },
  shortcuts: { label: "Shortcuts", placement: "any" },
  "home.summary": { label: "Summary", group: "Home", placement: "grid" },
  broken: {
    validateProps: () => {
      throw new Error("boom");
    },
  },
};

function sectionSuite(test: Test, api: DashboardEditorApi) {
  const screen = () => api.normalizeDashboard(SCREEN);

  test("sections are added, moved and removed with their widgets", () => {
    const dashboard = screen();
    assert.equal(api.canAddDashboardSection(dashboard), true);
    assert.equal(api.canAddDashboardSection(dashboard, { sections: 2 }), false);
    // Added at the end, a free id, untitled; a flow takes widgets in order.
    const added = api.addDashboardSection(dashboard, { type: "flow" });
    assert.deepEqual(added.sections.at(-1), {
      id: "section-3",
      type: "flow",
      widgetIds: [],
    });
    assert.deepEqual(
      api.addDashboardSection(dashboard, { type: "grid", title: "Charts" }, 0)
        .sections[0],
      { id: "section-3", type: "grid", title: "Charts", layout: [] }
    );
    // Up and down, one place at a time; the edges cannot move further.
    assert.equal(api.canMoveDashboardSection(added, "cards", "up"), false);
    assert.equal(
      api.canMoveDashboardSection(added, "section-3", "down"),
      false
    );
    assert.equal(api.canMoveDashboardSection(added, "missing", "up"), false);
    const moved = api.moveDashboardSection(added, "section-3", "up");
    assert.deepEqual(
      moved.sections.map((section) => section.id),
      ["cards", "section-3", "page"]
    );
    assert.equal(api.moveDashboardSection(moved, "cards", "up"), moved);
    assert.deepEqual(
      api
        .moveDashboardSection(moved, "cards", "down")
        .sections.map((section) => section.id),
      ["section-3", "cards", "page"]
    );
    // Removing a section removes its widgets and their filter mentions.
    assert.deepEqual(api.dashboardSectionWidgetIds(at(dashboard.sections, 0)), [
      "published",
      "drafts",
      "hello",
    ]);
    const removed = api.removeDashboardSection(dashboard, "cards");
    assert.deepEqual(
      removed.sections.map((section) => section.id),
      ["page"]
    );
    assert.deepEqual(
      removed.widgets.map((widget) => widget.id),
      ["pages", "storage"]
    );
    assert.deepEqual(removed.filters[0]?.targets, [
      { tableId: "pages", columnId: "updatedAt" },
    ]);
    assert.equal(api.removeDashboardSection(dashboard, "missing"), dashboard);
    // What is left is a valid document.
    assert.equal(api.validateDashboard(removed).ok, true);
  });

  test("sections are renamed in the language edited", () => {
    const dashboard = screen();
    // A localized title keeps its other languages.
    const renamed = api.renameDashboardSection(dashboard, "cards", "Now", "en");
    assert.deepEqual(renamed.sections[0]?.title, {
      fr: "Aujourd’hui",
      en: "Now",
    });
    // The input shows exactly that language, never another one's.
    assert.equal(
      api.dashboardSectionTitleInput(at(renamed.sections, 0), "fr-FR"),
      "Aujourd’hui"
    );
    const english = api.renameDashboardSection(dashboard, "cards", "", "en");
    assert.deepEqual(english.sections[0]?.title, { fr: "Aujourd’hui" });
    assert.equal(
      api.dashboardSectionTitleInput(at(english.sections, 0), "en"),
      ""
    );
    // A plain title stays plain; emptied, the section has none.
    const plain = api.renameDashboardSection(dashboard, "page", "Pages", "fr");
    assert.equal(plain.sections[1]?.title, "Pages");
    const untitled = api.renameDashboardSection(plain, "page", "", "fr");
    assert.equal("title" in (untitled.sections[1] ?? {}), false);
    // Menus name untitled sections by their place.
    assert.equal(api.dashboardSectionName(untitled, "page", "en"), "Section 2");
    assert.equal(
      api.dashboardSectionName(untitled, "cards", "fr"),
      "Aujourd’hui"
    );
    assert.equal(api.dashboardSectionName(untitled, "page", "fr"), "Section 2");
    // The shared text helpers.
    assert.equal(api.dashboardTextInput({ fr: "Contenu" }, "en"), "");
    assert.equal(api.editDashboardText(undefined, "en", ""), undefined);
    assert.deepEqual(api.editDashboardText({ en: "A" }, "fr", "B"), {
      en: "A",
      fr: "B",
    });
  });
}

function moveSuite(test: Test, api: DashboardEditorApi) {
  const screen = () => api.normalizeDashboard(SCREEN, { blocks: BLOCKS });

  test("widgets move between sections that take them", () => {
    const dashboard = api.addDashboardSection(screen(), {
      type: "grid",
      id: "more",
    });
    // A card goes to a flow; its grid closes the gap.
    const toFlow = api.moveDashboardWidgetToSection(
      dashboard,
      "drafts",
      "page"
    );
    assert.deepEqual(flowOf(toFlow, "page"), ["pages", "storage", "drafts"]);
    assert.deepEqual(
      layoutOf(toFlow, "cards").map((item) => [item.widgetId, item.x, item.y]),
      [
        ["published", 0, 0],
        ["hello", 2, 0],
      ]
    );
    // Back to a grid: at the first free spot, at the size asked for.
    const toGrid = api.moveDashboardWidgetToSection(toFlow, "drafts", "more", {
      size: { w: 2, h: 3 },
    });
    assert.deepEqual(layoutOf(toGrid, "more"), [
      { widgetId: "drafts", x: 0, y: 0, w: 2, h: 3 },
    ]);
    // A card keeps its own size from grid to grid.
    const card = api.moveDashboardWidgetToSection(dashboard, "hello", "more", {
      size: { w: 4, h: 4 },
    });
    assert.deepEqual(layoutOf(card, "more"), [
      { widgetId: "hello", x: 0, y: 0, w: 1, h: 2 },
    ]);
    // A full-page table only goes in flows; a block where its host puts it.
    assert.equal(
      api.moveDashboardWidgetToSection(dashboard, "pages", "cards"),
      dashboard
    );
    assert.equal(
      api.moveDashboardWidgetToSection(dashboard, "storage", "cards", {
        blocks: BLOCKS,
      }),
      dashboard
    );
    assert.deepEqual(
      api.dashboardAcceptedSections(
        { type: "block", block: "home.summary" },
        BLOCKS
      ),
      ["grid"]
    );
    assert.equal(api.validateDashboard(toGrid, { blocks: BLOCKS }).ok, true);
  });

  test("the widget menu offers the other sections that take the widget", () => {
    const dashboard = api.addDashboardSection(screen(), {
      type: "flow",
      id: "end",
    });
    const names = (widgetId: string) =>
      api
        .dashboardWidgetMoveTargets(dashboard, widgetId, {
          blocks: BLOCKS,
          locale: "fr",
        })
        .map((choice) => `${choice.id}:${choice.type}:${choice.name}`);
    assert.deepEqual(names("hello"), [
      "page:flow:Section 2",
      "end:flow:Section 3",
    ]);
    assert.deepEqual(names("pages"), ["end:flow:Section 3"]);
    assert.deepEqual(names("storage"), ["end:flow:Section 3"]);
    assert.deepEqual(names("drafts"), [
      "page:flow:Section 2",
      "end:flow:Section 3",
    ]);
    assert.deepEqual(
      api
        .dashboardWidgetMoveTargets(dashboard, "pages", { locale: "en" })
        .map((choice) => choice.name),
      ["Section 3"]
    );
    assert.deepEqual(names("missing"), []);
  });
}

const SUMMARIES = [
  { id: "pages", name: { en: "Pages", fr: "Pages" }, group: "CMS" },
  {
    id: "media",
    name: { en: "Media", fr: "Médias" },
    group: "CMS",
    keywords: ["images", "files"],
  },
  { id: "users", name: "Users", description: "People who sign in" },
  {
    id: "audit",
    name: { en: "Audit log", fr: "Journal d’audit" },
    group: "Admin",
    available: false,
    unavailableReason: "forbidden" as const,
  },
  {
    id: "billing",
    name: "Invoices",
    group: "Admin",
    available: false,
    unavailableReason: "notConfigured" as const,
    unavailableMessage: "Connect Stripe to see invoices.",
  },
];

function choiceSuite(test: Test, api: DashboardEditorApi) {
  test("the widget dialog offers what the section takes, then the host's blocks by group", () => {
    const kinds = (section?: Schema.DashboardSectionType) =>
      api
        .dashboardWidgetChoices({ section, blocks: BLOCKS, locale: "en" })
        .map(
          (choice) =>
            `${choice.kind}${choice.block ? `:${choice.block}` : ""}@${choice.group}`
        );
    assert.deepEqual(kinds(), [
      "kpi@",
      "view@",
      "table@",
      "note@",
      "block:media.storage@Media",
      "block:shortcuts@Blocks",
      "block:broken@Blocks",
      "block:home.summary@Home",
    ]);
    assert.deepEqual(kinds("grid"), [
      "kpi@",
      "view@",
      "note@",
      "block:shortcuts@Blocks",
      "block:broken@Blocks",
      "block:home.summary@Home",
    ]);
    assert.deepEqual(kinds("flow"), [
      "kpi@",
      "view@",
      "table@",
      "note@",
      "block:media.storage@Media",
      "block:shortcuts@Blocks",
      "block:broken@Blocks",
    ]);
    const french = api.dashboardWidgetChoices({ blocks: BLOCKS, locale: "fr" });
    assert.deepEqual(
      french.map((choice) => choice.label),
      [
        "Nombre",
        "Vue",
        "Page de table",
        "Note",
        "Stockage",
        "Shortcuts",
        "broken",
        "Summary",
      ]
    );
    assert.equal(
      french[0]?.description,
      "Un chiffre calculé sur les enregistrements d’une vue"
    );
    assert.equal(french.at(-2)?.group, "Blocs");
    assert.deepEqual(
      (["kpi", "view", "table", "note", "block"] as const).map(
        api.dashboardKindReadsSource
      ),
      [true, true, true, false, false]
    );
  });

  test("the catalogue is grouped and searched, and unavailable sources say why", () => {
    const all = api.dashboardSourceChoices(SUMMARIES, { locale: "fr" });
    assert.deepEqual(
      all.map((group) => [
        group.label,
        group.sources.map((source) => source.id),
      ]),
      [
        ["CMS", ["pages", "media"]],
        ["", ["users"]],
        ["Admin", ["audit", "billing"]],
      ]
    );
    assert.deepEqual(all[2]?.sources, [
      {
        id: "audit",
        name: "Journal d’audit",
        available: false,
        reason: "Vous n’avez pas accès à ces données.",
      },
      {
        id: "billing",
        name: "Invoices",
        available: false,
        reason: "Connect Stripe to see invoices.",
      },
    ]);
    assert.deepEqual(all[1]?.sources[0], {
      id: "users",
      name: "Users",
      description: "People who sign in",
      available: true,
    });
    const found = (query: string, locale = "en") =>
      api
        .dashboardSourceChoices(SUMMARIES, { query, locale })
        .flatMap((group) => group.sources.map((source) => source.id));
    // Names in the reader's language, accents and case aside; keywords and groups too.
    assert.deepEqual(found("medias", "fr"), ["media"]);
    assert.deepEqual(found("IMAGES"), ["media"]);
    assert.deepEqual(found("admin"), ["audit", "billing"]);
    assert.deepEqual(found("sign in"), ["users"]);
    assert.deepEqual(found("  "), [
      "pages",
      "media",
      "users",
      "audit",
      "billing",
    ]);
    assert.deepEqual(found("nothing"), []);
    assert.equal(
      api.dashboardSourceMatches(at(SUMMARIES, 0), "pag", "en"),
      true
    );
  });
}

const SAVED_VIEW = {
  id: "drafts",
  name: "Drafts",
  config: {
    displayMode: "table",
    sorting: [{ id: "updatedAt", desc: true }],
    advancedFilters: [
      {
        id: "d",
        columnId: "status",
        operator: "isAnyOf",
        values: ["draft"],
        isActive: true,
      },
    ],
    columnOrder: ["select", "title", "status", "actions"],
    evil: true,
  },
};

function viewEditorSuite(test: Test, api: DashboardEditorApi) {
  test("the view editor starts from the widget's view and applies what changed", () => {
    // Inline settings, a saved view's (sanitized), or the source's default.
    assert.deepEqual(
      api.dashboardViewEditStart({ view: { displayMode: "list" } }).initial,
      { displayMode: "list" }
    );
    assert.deepEqual(
      api.dashboardViewEditStart({ viewId: "drafts" }, SAVED_VIEW).initial,
      {
        displayMode: "table",
        sorting: [{ id: "updatedAt", desc: true }],
        advancedFilters: [
          {
            id: "d",
            columnId: "status",
            operator: "isAnyOf",
            isActive: true,
            values: ["draft"],
          },
        ],
        columnOrder: ["title", "status"],
      }
    );
    assert.deepEqual(
      api.dashboardViewEditStart({ viewId: "other" }, SAVED_VIEW).initial,
      {}
    );
    assert.deepEqual(api.dashboardViewEditStart({}).initial, {});

    // The table reports its view when it starts, then after each change.
    const started = {
      displayMode: "table" as const,
      pageSize: 10,
      columnOrder: ["title"],
    };
    let edit = api.dashboardViewEditStart({});
    assert.equal(api.dashboardViewToApply(edit), undefined);
    edit = api.recordDashboardViewReport(edit, started);
    assert.equal(api.dashboardViewEdited(edit), false);
    // The same view, keys in another order: nothing changed.
    edit = api.recordDashboardViewReport(edit, {
      columnOrder: ["title"],
      pageSize: 10,
      displayMode: "table",
    });
    assert.equal(api.dashboardViewEdited(edit), false);
    edit = api.recordDashboardViewReport(edit, {
      ...started,
      globalSearch: "Ada",
    });
    assert.equal(api.dashboardViewEdited(edit), true);
    assert.deepEqual(edit.baseline, started);
    // The page size the table started with is left out...
    assert.deepEqual(api.dashboardViewToApply(edit), {
      displayMode: "table",
      globalSearch: "Ada",
      columnOrder: ["title"],
    });
    // ...unless the admin changed it...
    assert.equal(
      api.dashboardViewToApply(
        api.recordDashboardViewReport(edit, { ...started, pageSize: 25 })
      )?.pageSize,
      25
    );
    // ...or the view had one ("Top 5").
    const top = api.recordDashboardViewReport(
      api.recordDashboardViewReport(
        api.dashboardViewEditStart({ view: { pageSize: 5 } }),
        { pageSize: 5 }
      ),
      { pageSize: 5, sorting: [{ id: "views", desc: true }] }
    );
    assert.deepEqual(api.dashboardViewToApply(top), {
      pageSize: 5,
      sorting: [{ id: "views", desc: true }],
    });
    // Reported settings are sanitized before they are stored.
    const hostile = api.recordDashboardViewReport(
      api.dashboardViewEditStart({}),
      {
        displayMode: "table",
        __proto__: { polluted: true },
        unknown: 1,
      } as never
    );
    assert.deepEqual(api.dashboardViewToApply(hostile), {
      displayMode: "table",
    });
  });

  test("applying a view and using a copy of a saved view make it inline", () => {
    const dashboard = api.normalizeDashboard(SCREEN);
    // A view widget without a title keeps its saved view's name.
    const copied = api.copyDashboardWidgetView(dashboard, "drafts", SAVED_VIEW);
    const drafts = copied.widgets.find((widget) => widget.id === "drafts");
    assert.deepEqual(drafts, {
      id: "drafts",
      type: "view",
      tableId: "pages",
      title: "Drafts",
      settings: { overflow: "scroll" },
      view: {
        displayMode: "table",
        sorting: [{ id: "updatedAt", desc: true }],
        advancedFilters: [
          {
            id: "d",
            columnId: "status",
            operator: "isAnyOf",
            isActive: true,
            values: ["draft"],
          },
        ],
        columnOrder: ["title", "status"],
      },
    });
    assert.equal("viewId" in (drafts ?? {}), false);
    // Only a widget naming that saved view.
    assert.equal(
      api.copyDashboardWidgetView(copied, "drafts", SAVED_VIEW),
      copied
    );
    assert.equal(
      api.copyDashboardWidgetView(dashboard, "published", SAVED_VIEW),
      dashboard
    );
    // The copy is a valid document, and no longer follows the saved view.
    const checked = api.validateDashboard(copied);
    assert.equal(checked.ok, true);
    assert.deepEqual(checked.issues, []);
    // "Make the current view the screen default": a table widget's inline view.
    const table = api.setDashboardWidgetView(dashboard, "pages", {
      sorting: [{ id: "title", desc: false }],
    });
    assert.deepEqual(
      table.widgets.find((widget) => widget.id === "pages"),
      {
        id: "pages",
        type: "table",
        tableId: "pages",
        settings: {},
        view: { sorting: [{ id: "title", desc: false }] },
      }
    );
  });
}

function blockPropsSuite(test: Test, api: DashboardEditorApi) {
  test("block props typed as JSON are checked before they apply", () => {
    const parse = (text: string, block = "media.storage") =>
      api.parseDashboardBlockProps(text, block, { blocks: BLOCKS });
    assert.deepEqual(parse('{ "unit": "MB" }'), {
      json: true,
      ok: true,
      issues: [],
      props: { unit: "MB" },
    });
    // Nothing typed: no props.
    assert.deepEqual(parse("  ").props, {});
    // Invalid JSON is refused.
    assert.deepEqual(parse('{ unit: "MB" '), {
      json: false,
      ok: false,
      issues: [],
    });
    // JSON that is not an object, or props the block rejects, are refused with the issues.
    const list = parse("[1, 2]");
    assert.equal(list.ok, false);
    assert.equal(list.props, undefined);
    assert.deepEqual(
      list.issues.map((issue) => issue.code),
      ["invalidBlockProps"]
    );
    const rejected = parse('{ "unit": "KB" }');
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.issues, [
      {
        code: "invalidBlockProps",
        message: "unit is GB or MB",
        severity: "error",
        path: "unit",
      },
    ]);
    // Warnings let them through.
    const warned = parse('{ "unit": "TB" }');
    assert.equal(warned.ok, true);
    assert.deepEqual(warned.props, { unit: "TB" });
    assert.equal(warned.issues[0]?.severity, "warning");
    // A check that throws refuses them; prototype keys never pass.
    assert.equal(parse("{}", "broken").ok, false);
    const proto = parse('{ "__proto__": { "admin": true }, "unit": "GB" }');
    assert.equal(proto.ok, false);
    assert.equal(({} as Record<string, unknown>).admin, undefined);
    // Too large: refused.
    assert.equal(
      api.parseDashboardBlockProps(
        JSON.stringify({ text: "x".repeat(40) }),
        "shortcuts",
        {
          blocks: BLOCKS,
          limits: { blockProps: 20 },
        }
      ).ok,
      false
    );
    // Blocks the host lacks only get the JSON checks.
    assert.equal(parse('{ "a": [1, { "b": null }] }', "legacy.box").ok, true);
    assert.equal(
      api.dashboardBlockPropsText({ unit: "GB" }),
      '{\n  "unit": "GB"\n}'
    );
    assert.equal(api.dashboardBlockPropsText(undefined), "{}");
  });
}

function draftSuite(test: Test, api: DashboardEditorApi) {
  test("editing a widget keeps its other languages and the settings the dialog does not show", () => {
    const dashboard = api.normalizeDashboard(SCREEN);
    const widget = (id: string) => {
      const found = dashboard.widgets.find((item) => item.id === id);
      assert.ok(found);
      return found;
    };
    // A number with a localized title and a weekly trend.
    const published = widget("published");
    const draft = api.dashboardWidgetDraft(published, "fr");
    assert.equal(draft.title, "Publiées");
    assert.equal(draft.sparkline, true);
    assert.equal(draft.dateColumn, "updatedAt");
    const edited = api.dashboardWidgetFromDraft(
      { ...draft, title: "En ligne", metric: "sum", metricColumn: "views" },
      { widget: published, locale: "fr" }
    );
    assert.deepEqual(edited, {
      type: "kpi",
      tableId: "pages",
      title: { en: "Published", fr: "En ligne" },
      settings: {
        metric: "sum",
        metricColumn: "views",
        dateColumn: "updatedAt",
        sparkline: { bucket: "week", buckets: 12 },
      },
    });
    // A view widget: its saved view, overflow and title round-trip.
    const drafts = widget("drafts");
    assert.deepEqual(
      api.dashboardWidgetFromDraft(api.dashboardWidgetDraft(drafts, "en"), {
        widget: drafts,
        locale: "en",
      }),
      {
        type: "view",
        tableId: "pages",
        viewId: "drafts",
        settings: { overflow: "scroll" },
      }
    );
    // A custom view wins over the saved view.
    assert.deepEqual(
      api.dashboardWidgetFromDraft(
        {
          ...api.dashboardWidgetDraft(drafts, "en"),
          view: { displayMode: "list" },
        },
        { widget: drafts, locale: "en" }
      ).view,
      { displayMode: "list" }
    );
    // Tables, notes and blocks.
    assert.deepEqual(
      api.dashboardWidgetFromDraft({
        ...api.dashboardWidgetDraft(widget("pages"), "en"),
        title: "All pages",
      }),
      { type: "table", tableId: "pages", title: "All pages", settings: {} }
    );
    assert.deepEqual(
      api.dashboardWidgetFromDraft(
        api.dashboardWidgetDraft(widget("hello"), "en")
      ),
      { type: "note", settings: { text: "Hello" } }
    );
    const storage = api.dashboardWidgetDraft(widget("storage"), "en");
    assert.equal(storage.block, "media.storage");
    assert.deepEqual(
      api.dashboardWidgetFromDraft({ ...storage, props: { unit: "MB" } }),
      {
        type: "block",
        block: "media.storage",
        props: { unit: "MB" },
        settings: {},
      }
    );
    assert.deepEqual(api.dashboardWidgetFromDraft({ ...storage, props: {} }), {
      type: "block",
      block: "media.storage",
      settings: {},
    });
    // A new widget in a chosen section, where the host's block may go.
    const added = api.addDashboardWidget(
      dashboard,
      api.dashboardWidgetFromDraft({ ...storage, props: { unit: "MB" } }),
      { sectionId: "cards", blocks: BLOCKS }
    );
    assert.deepEqual(flowOf(added, "page"), ["pages", "storage", "widget-6"]);
  });
}

function issueSuite(test: Test, api: DashboardEditorApi) {
  test("validation issues point to their widget, section or filter", () => {
    const dashboard = api.normalizeDashboard(SCREEN);
    const target = (path?: string) =>
      api.dashboardIssueTarget(dashboard, { path });
    assert.deepEqual(target("widgets[4].props.unit"), { widgetId: "storage" });
    assert.deepEqual(target("sections[1].title.en"), { sectionId: "page" });
    assert.deepEqual(target("filters[0].targets[1]"), { filterId: "period" });
    assert.deepEqual(target("widgets[9]"), {});
    assert.deepEqual(target("name"), {});
    assert.deepEqual(target(), {});
    // Saving stops on errors, not on warnings.
    const invalid = {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) =>
        widget.id === "storage" ? { ...widget, props: { unit: "KB" } } : widget
      ),
    };
    const checked = api.validateDashboard(invalid, { blocks: BLOCKS });
    assert.equal(checked.ok, false);
    assert.deepEqual(
      api
        .dashboardSaveErrors(checked.issues)
        .map((issue) => [issue.code, issue.path]),
      [["invalidBlockProps", "widgets[4].props.unit"]]
    );
    assert.deepEqual(
      api.dashboardSaveErrors([
        { code: "unknownBlock", message: "", severity: "warning" },
      ]),
      []
    );
  });
}

/** Shared by `bun test` (React sources) and Vitest (the synced Vue copy). */
export function dashboardEditorSuite(test: Test, api: DashboardEditorApi) {
  sectionSuite(test, api);
  moveSuite(test, api);
  choiceSuite(test, api);
  viewEditorSuite(test, api);
  blockPropsSuite(test, api);
  draftSuite(test, api);
  issueSuite(test, api);
}
