import assert from "node:assert/strict";
import type * as Schema from "../src/components/ui/yayaw-table-dashboard/dashboard-schema";
import type * as Sources from "../src/components/ui/yayaw-table-dashboard/dashboard-sources";

/** The grammar functions and constants both editions run through this suite. */
export type DashboardSchemaApi = Pick<
  typeof Schema,
  | "addDashboardSection"
  | "addDashboardWidget"
  | "applyDashboardSectionLayout"
  | "canMoveDashboardWidget"
  | "canResizeDashboardWidget"
  | "canonicalDashboardJson"
  | "checkDashboardReferences"
  | "createDashboard"
  | "DASHBOARD_DATE_PRESETS"
  | "DASHBOARD_FILTER_TYPES"
  | "DASHBOARD_ISSUE_SEVERITY"
  | "DASHBOARD_KPI_METRICS"
  | "DASHBOARD_LIMITS"
  | "DASHBOARD_OVERFLOWS"
  | "DASHBOARD_SECTION_TYPES"
  | "DASHBOARD_SPARKLINE_BUCKETS"
  | "DASHBOARD_VERSION"
  | "DASHBOARD_WIDGET_TYPES"
  | "dashboardFingerprint"
  | "dashboardJsonSchema"
  | "dashboardSlug"
  | "dashboardText"
  | "moveDashboardWidget"
  | "moveWidgetToSection"
  | "normalizeDashboard"
  | "removeDashboardWidget"
  | "resizeDashboardWidget"
  | "sha256Hex"
  | "validateDashboard"
> & {
  /** The enums the JSON Schema must list, from the table's own modules. */
  displayModes: readonly string[];
  densities: readonly string[];
  operators: readonly string[];
  viewKeys: readonly string[];
  /** The platform's SHA-256, to check the pure implementation. */
  sha256: (text: string) => string;
};
type Test = (name: string, run: () => void | Promise<void>) => void;
type Issue = Schema.DashboardIssue;

const UNSUPPORTED_VERSION = /version 3 is not supported/;
const UNREADABLE_PROPS = /props are unreadable/;
const SHA256 = /^[0-9a-f]{64}$/;
type Dashboard = Schema.Dashboard;

const codes = (issues: readonly Issue[]) =>
  issues.map((issue) => [issue.code, issue.path ?? ""]);
const layoutOf = (dashboard: Dashboard | undefined, sectionId = "main") => {
  const section = dashboard?.sections.find((item) => item.id === sectionId);
  return section?.type === "grid" ? section.layout : [];
};
const flowOf = (dashboard: Dashboard | undefined, sectionId: string) => {
  const section = dashboard?.sections.find((item) => item.id === sectionId);
  return section?.type === "flow" ? section.widgetIds : [];
};
const item = (
  widgetId: string,
  x: number,
  y: number,
  w: number,
  h: number
) => ({
  widgetId,
  x,
  y,
  w,
  h,
});

/** A version 1 dashboard, as the library wrote them before sections. */
const V1 = {
  version: 1,
  id: "overview",
  name: "Overview",
  widgets: [
    {
      id: "count",
      type: "kpi",
      tableId: "projects",
      settings: { metric: "count" },
    },
    {
      id: "chart",
      type: "view",
      tableId: "projects",
      viewId: "by-category",
      settings: {},
    },
    { id: "note", type: "note", settings: { text: "Hello" } },
  ],
  layout: [
    item("count", 0, 0, 1, 1),
    item("chart", 1, 0, 2, 2),
    item("note", 3, 0, 1, 2),
  ],
  filters: [
    {
      id: "category",
      type: "select",
      label: "Category",
      targets: [
        { tableId: "projects", columnId: "category", widgetIds: ["chart"] },
      ],
      value: ["Software"],
    },
  ],
  updatedAt: "2026-09-24T10:00:00.000Z",
};

/** A screen: a grid of cards, then a full-width flow with a page table and a block. */
const SCREEN = {
  version: 2,
  id: "cms",
  name: { en: "Content", fr: "Contenu" },
  description: "Pages and media",
  sections: [
    {
      id: "cards",
      type: "grid",
      title: { en: "Today", fr: "Aujourd'hui" },
      layout: [item("published", 0, 0, 1, 1)],
    },
    { id: "page", type: "flow", widgetIds: ["pages", "storage"] },
  ],
  widgets: [
    {
      id: "published",
      type: "kpi",
      tableId: "pages",
      title: { en: "Published", fr: "Publiées" },
      view: {
        advancedFilters: [
          {
            id: "p",
            columnId: "status",
            operator: "is",
            values: ["published"],
            isActive: true,
          },
        ],
      },
      settings: { metric: "count" },
    },
    {
      id: "pages",
      type: "table",
      tableId: "pages",
      view: {
        displayMode: "table",
        sorting: [{ id: "updatedAt", desc: true }],
      },
      settings: {},
    },
    {
      id: "storage",
      type: "block",
      block: "media.storage",
      props: { unit: "GB" },
      settings: {},
    },
  ],
  filters: [],
};

function migrationSuite(test: Test, api: DashboardSchemaApi) {
  test("version 1 becomes one grid section and round-trips as version 2", () => {
    const result = api.validateDashboard(V1);
    assert.equal(result.ok, true);
    assert.equal(result.migratedFrom, 1);
    assert.deepEqual(result.issues, []);
    const dashboard = result.dashboard;
    assert.equal(dashboard?.version, 2);
    assert.deepEqual(dashboard?.sections, [
      { id: "main", type: "grid", layout: V1.layout },
    ]);
    assert.equal("layout" in (dashboard ?? {}), false);
    assert.equal(dashboard?.updatedAt, V1.updatedAt);
    // Saved and read again: version 2, unchanged, nothing to report.
    const saved = JSON.parse(JSON.stringify(dashboard));
    assert.deepEqual(api.validateDashboard(saved), {
      dashboard,
      issues: [],
      ok: true,
    });
  });

  test("version 0 reads react-grid-layout items; newer versions are refused", () => {
    const legacy = api.validateDashboard({
      id: "old",
      name: "Old",
      widgets: [{ id: "n", type: "note", settings: { text: "Hi" } }],
      layout: [{ i: "n", x: 1, y: 0, w: 2, h: 2, static: true }],
    });
    assert.equal(legacy.migratedFrom, 0);
    assert.deepEqual(layoutOf(legacy.dashboard), [item("n", 1, 0, 2, 2)]);
    assert.deepEqual(legacy.issues, []);
    const newer = api.validateDashboard({ ...SCREEN, version: 3 });
    assert.equal(newer.dashboard, undefined);
    assert.equal(newer.ok, false);
    assert.deepEqual(codes(newer.issues), [["unsupportedVersion", ""]]);
    assert.throws(
      () => api.normalizeDashboard({ ...SCREEN, version: 3 }),
      UNSUPPORTED_VERSION
    );
    assert.throws(() => api.normalizeDashboard({ name: "No id" }));
    assert.equal(api.validateDashboard("nope").ok, false);
  });

  test("widget types a version does not know are dropped", () => {
    const result = api.validateDashboard({
      ...V1,
      widgets: [
        ...V1.widgets,
        { id: "page", type: "table", tableId: "projects", settings: {} },
      ],
    });
    assert.deepEqual(codes(result.issues), [
      ["invalidWidget", "widgets[3].type"],
    ]);
    assert.equal(result.ok, false);
    const v2 = api.validateDashboard({
      ...SCREEN,
      widgets: [...SCREEN.widgets, { id: "x", type: "iframe" }],
    });
    assert.deepEqual(codes(v2.issues), [["invalidWidget", "widgets[3].type"]]);
  });

  test("a version 2 screen is valid as written", () => {
    const result = api.validateDashboard(SCREEN, {
      blocks: { "media.storage": { placement: "flow" } },
    });
    assert.deepEqual(result.issues, []);
    assert.equal(result.ok, true);
    assert.equal(result.migratedFrom, undefined);
    assert.deepEqual(result.dashboard?.sections, SCREEN.sections);
    assert.deepEqual(result.dashboard?.widgets.at(0)?.title, {
      en: "Published",
      fr: "Publiées",
    });
    assert.equal(api.dashboardText(result.dashboard?.name, "fr-CA"), "Contenu");
    assert.equal(api.dashboardText(result.dashboard?.name, "de"), "Content");
    assert.equal(api.dashboardText("Plain", "fr"), "Plain");
    assert.equal(api.dashboardText(undefined, "fr"), "");
  });
}

function repairSuite(test: Test, api: DashboardSchemaApi) {
  test("unknown keys are removed at every level, as warnings", () => {
    const result = api.validateDashboard({
      ...SCREEN,
      owner: "ada",
      sections: [
        {
          ...SCREEN.sections[0],
          color: "red",
          layout: [{ ...item("published", 0, 0, 1, 1), static: true }],
        },
        { ...SCREEN.sections[1], layout: [] },
      ],
      widgets: [
        {
          ...SCREEN.widgets[0],
          settings: { metric: "count", size: "xl" },
          view: { sorting: [], theme: "dark" },
        },
        { ...SCREEN.widgets[1], block: "x" },
        SCREEN.widgets[2],
      ],
      filters: [
        {
          id: "f",
          type: "select",
          label: "Status",
          targets: [{ tableId: "pages", columnId: "status" }],
          pinned: true,
        },
      ],
    });
    assert.deepEqual(codes(result.issues), [
      ["unknownKey", "owner"],
      ["unknownKey", "widgets[0].view.theme"],
      ["unknownKey", "widgets[0].settings.size"],
      ["unknownKey", "widgets[1].block"],
      ["unknownKey", "sections[0].color"],
      ["unknownKey", "sections[0].layout[0].static"],
      ["unknownKey", "sections[1].layout"],
      ["unknownKey", "filters[0].pinned"],
    ]);
    assert.equal(result.ok, true);
    assert.ok(result.issues.every((issue) => issue.severity === "warning"));
  });

  test("lists and texts are cut at the limits; oversized documents are errors", () => {
    const { sections, widgets, filters, title, note } = api.DASHBOARD_LIMITS;
    const notes = Array.from({ length: widgets + 5 }, (_, index) => ({
      id: `n${index}`,
      type: "note",
      settings: { text: "x" },
    }));
    const result = api.validateDashboard({
      version: 2,
      id: "big",
      name: "N".repeat(title + 30),
      sections: Array.from({ length: sections + 1 }, (_, index) => ({
        id: `s${index}`,
        type: "flow",
        widgetIds: [],
      })),
      widgets: [
        { id: "long", type: "note", settings: { text: "y".repeat(note + 10) } },
        ...notes,
      ],
      filters: Array.from({ length: filters + 3 }, (_, index) => ({
        id: `f${index}`,
        type: "dateRange",
        label: "D",
        targets: [],
      })),
    });
    const dashboard = result.dashboard;
    assert.equal(dashboard?.sections.length, sections);
    assert.equal(dashboard?.widgets.length, widgets);
    assert.equal(dashboard?.filters.length, filters);
    assert.equal(String(dashboard?.name).length, title);
    assert.equal(String(dashboard?.widgets[0]?.settings.text).length, note);
    assert.deepEqual(
      result.issues
        .filter((issue) => issue.code === "truncated")
        .map((issue) => issue.path),
      ["widgets", "widgets[0].settings.text", "sections", "filters", "name"]
    );
    assert.equal(result.ok, false);
    // Fifty long notes weigh more than the document limit.
    const heavy = api.validateDashboard({
      version: 2,
      id: "heavy",
      name: "Heavy",
      sections: [],
      widgets: notes
        .slice(0, widgets)
        .map((entry) => ({ ...entry, settings: { text: "z".repeat(note) } })),
      filters: [],
    });
    assert.ok(heavy.dashboard);
    assert.deepEqual(
      codes(heavy.issues).filter(([code]) => code === "tooLarge"),
      [["tooLarge", ""]]
    );
    assert.equal(heavy.ok, false);
    const tight = api.validateDashboard(SCREEN, { limits: { widgets: 1 } });
    assert.equal(tight.dashboard?.widgets.length, 1);
  });

  test("invalid ids become unique slugs and every reference follows", () => {
    const result = api.validateDashboard({
      version: 2,
      id: "ids",
      name: "Ids",
      sections: [
        {
          id: "Main grid",
          type: "grid",
          layout: [
            item("Chiffre d'affaires", 0, 0, 1, 1),
            item("chiffre-d-affaires", 1, 0, 1, 1),
          ],
        },
        { id: "page", type: "flow", widgetIds: ["Pages (all)"] },
      ],
      widgets: [
        {
          id: "Chiffre d'affaires",
          type: "kpi",
          tableId: "sales",
          settings: {},
        },
        {
          id: "chiffre-d-affaires",
          type: "kpi",
          tableId: "sales",
          settings: {},
        },
        { id: "Pages (all)", type: "table", tableId: "pages", settings: {} },
        { type: "note", settings: { text: "No id" } },
      ],
      filters: [
        {
          id: "Période",
          type: "dateRange",
          label: "Period",
          targets: [
            {
              tableId: "sales",
              columnId: "date",
              widgetIds: ["Chiffre d'affaires"],
            },
          ],
        },
      ],
    });
    const dashboard = result.dashboard;
    assert.deepEqual(
      dashboard?.widgets.map((widget) => widget.id),
      ["chiffre-d-affaires-2", "chiffre-d-affaires", "pages-all", "widget-4"]
    );
    assert.deepEqual(
      dashboard?.sections.map((section) => section.id),
      ["main-grid", "page"]
    );
    assert.deepEqual(
      layoutOf(dashboard, "main-grid").map((entry) => entry.widgetId),
      ["chiffre-d-affaires-2", "chiffre-d-affaires", "widget-4"]
    );
    assert.deepEqual(flowOf(dashboard, "page"), ["pages-all"]);
    assert.equal(dashboard?.filters[0]?.id, "periode");
    assert.deepEqual(dashboard?.filters[0]?.targets[0]?.widgetIds, [
      "chiffre-d-affaires-2",
    ]);
    assert.deepEqual(
      codes(result.issues).filter(([code]) => code === "invalidId"),
      [
        ["invalidId", "widgets[0].id"],
        ["invalidId", "widgets[2].id"],
        ["invalidId", "widgets[3].id"],
        ["invalidId", "sections[0].id"],
        ["invalidId", "filters[0].id"],
      ]
    );
    assert.equal(
      api.dashboardSlug("  Événements à venir ! "),
      "evenements-a-venir"
    );
  });

  test("orphans join the first section that takes them; table widgets need a flow", () => {
    const result = api.validateDashboard({
      version: 2,
      id: "places",
      name: "Places",
      sections: [
        { id: "cards", type: "grid", layout: [item("pages", 0, 0, 4, 2)] },
      ],
      widgets: [
        { id: "pages", type: "table", tableId: "pages", settings: {} },
        { id: "count", type: "kpi", tableId: "pages", settings: {} },
      ],
      filters: [],
    });
    assert.deepEqual(result.dashboard?.sections, [
      { id: "cards", type: "grid", layout: [item("count", 0, 0, 1, 1)] },
      { id: "section-2", type: "flow", widgetIds: ["pages"] },
    ]);
    assert.deepEqual(codes(result.issues), [
      ["misplacedWidget", "sections[0].layout[0]"],
      ["orphanWidget", "widgets[1]"],
    ]);
    assert.equal(result.ok, true);
    // Without sections, cards get a grid named main.
    const bare = api.validateDashboard({
      ...V1,
      version: 2,
      layout: undefined,
      sections: undefined,
    });
    assert.deepEqual(
      bare.dashboard?.sections.map((section) => [section.id, section.type]),
      [["main", "grid"]]
    );
    // A block goes where its host places it.
    const blocks = api.validateDashboard(
      {
        ...SCREEN,
        sections: [
          SCREEN.sections[0],
          { id: "page", type: "flow", widgetIds: ["pages"] },
        ],
        widgets: SCREEN.widgets,
      },
      { blocks: { "media.storage": { placement: "flow" } } }
    );
    assert.deepEqual(flowOf(blocks.dashboard, "page"), ["pages", "storage"]);
  });

  test("a widget with both a saved and an inline view keeps the inline one", () => {
    const result = api.validateDashboard({
      ...SCREEN,
      widgets: [
        {
          ...SCREEN.widgets[0],
          viewId: "published",
          view: { sorting: [{ id: 3 }], displayMode: "list" },
        },
        ...SCREEN.widgets.slice(1),
      ],
    });
    const widget = result.dashboard?.widgets[0];
    assert.equal(widget?.viewId, undefined);
    assert.deepEqual(widget?.view, { displayMode: "list" });
    assert.deepEqual(codes(result.issues), [
      ["invalidValue", "widgets[0].view.sorting[0].id"],
      ["conflictingView", "widgets[0].viewId"],
    ]);
    assert.deepEqual(
      result.issues.map((issue) => issue.severity),
      ["error", "warning"]
    );
  });

  test("settings are checked by widget type", () => {
    const result = api.validateDashboard({
      ...SCREEN,
      widgets: [
        { id: "a", type: "kpi", tableId: "t", settings: { metric: "median" } },
        {
          id: "b",
          type: "kpi",
          tableId: "t",
          settings: { metric: "sum", compare: true },
        },
        { id: "c", type: "view", tableId: "t", settings: { overflow: "clip" } },
        { id: "d", type: "note", settings: { text: 42 } },
        {
          id: "e",
          type: "kpi",
          tableId: "t",
          settings: {
            metric: "sum",
            metricColumn: "price",
            dateColumn: "due",
            compare: { days: 90 },
            sparkline: true,
          },
        },
      ],
      sections: [],
    });
    assert.deepEqual(
      codes(result.issues).filter(([code]) => code !== "orphanWidget"),
      [
        ["invalidValue", "widgets[0].settings.metric"],
        ["invalidValue", "widgets[1].settings.metricColumn"],
        ["invalidValue", "widgets[1].settings.compare"],
        ["invalidValue", "widgets[2].settings.overflow"],
        ["invalidValue", "widgets[3].settings.text"],
      ]
    );
    assert.deepEqual(result.dashboard?.widgets[4]?.settings, {
      metric: "sum",
      metricColumn: "price",
      dateColumn: "due",
      compare: { period: "previous", days: 90, better: "up" },
      sparkline: { bucket: "month", buckets: 6 },
    });
  });
}

function blockSuite(test: Test, api: DashboardSchemaApi) {
  test("block props are safe JSON copies, checked by the host's block", () => {
    const seen: unknown[] = [];
    const blocks: Schema.DashboardBlocks = {
      ok: {
        validateProps: (props) => {
          seen.push(props);
        },
      },
      picky: {
        validateProps: (props) => [
          "Missing a title.",
          {
            message: "Unknown unit.",
            path: "unit",
            severity: "warning" as const,
          },
          ...(props.unit === "GB" ? [] : ["never"]),
        ],
      },
      broken: {
        validateProps: () => {
          throw new Error("props are unreadable");
        },
      },
    };
    let deep: Record<string, unknown> = { leaf: 1 };
    for (let level = 0; level < 12; level += 1) {
      deep = { deep };
    }
    const widget = (id: string, block: string, props: unknown) => ({
      id,
      type: "block",
      block,
      props,
      settings: {},
    });
    const result = api.validateDashboard(
      {
        ...SCREEN,
        sections: [],
        widgets: [
          widget(
            "a",
            "ok",
            JSON.parse(
              '{"title":"Hi","__proto__":{"polluted":1},"list":[1,{"constructor":2}]}'
            )
          ),
          widget("b", "picky", { unit: "GB" }),
          widget("c", "broken", {}),
          widget("d", "ok", deep),
          widget("e", "ok", {
            text: "x".repeat(api.DASHBOARD_LIMITS.blockProps),
          }),
          widget("f", "missing", {}),
        ],
      },
      { blocks }
    );
    const widgets = result.dashboard?.widgets ?? [];
    assert.deepEqual(widgets[0]?.props, { title: "Hi", list: [1, {}] });
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.deepEqual(seen.at(0), { title: "Hi", list: [1, {}] });
    assert.equal(widgets[4]?.props, undefined);
    assert.deepEqual(
      result.issues
        .filter((issue) => issue.code !== "orphanWidget")
        .map((issue) => [issue.code, issue.path, issue.severity]),
      [
        ["invalidBlockProps", "widgets[0].props.__proto__", "error"],
        ["invalidBlockProps", "widgets[0].props.list[1].constructor", "error"],
        ["invalidBlockProps", "widgets[1].props", "error"],
        ["invalidBlockProps", "widgets[1].props.unit", "warning"],
        ["invalidBlockProps", "widgets[2].props", "error"],
        [
          "invalidBlockProps",
          "widgets[3].props.deep.deep.deep.deep.deep.deep.deep.deep",
          "error",
        ],
        ["tooLarge", "widgets[4].props", "error"],
        ["unknownBlock", "widgets[5].block", "warning"],
      ]
    );
    assert.match(
      result.issues.find((issue) => issue.path === "widgets[2].props")
        ?.message ?? "",
      UNREADABLE_PROPS
    );
    // Without the host's blocks, keys are not checked.
    assert.equal(
      api
        .validateDashboard({
          ...SCREEN,
          widgets: [widget("x", "missing", {})],
          sections: [],
        })
        .issues.some((issue) => issue.code === "unknownBlock"),
      false
    );
  });

  test("every issue's severity is its code's; ok means no error", () => {
    const results = [
      api.validateDashboard(V1),
      api.validateDashboard({ ...SCREEN, owner: 1 }),
      api.validateDashboard({ ...SCREEN, widgets: [{ id: "x", type: "kpi" }] }),
      api.validateDashboard({ ...SCREEN, version: 9 }),
    ];
    for (const result of results) {
      for (const issue of result.issues) {
        assert.equal(issue.severity, api.DASHBOARD_ISSUE_SEVERITY[issue.code]);
      }
      assert.equal(
        result.ok,
        Boolean(result.dashboard) &&
          !result.issues.some((issue) => issue.severity === "error")
      );
    }
    assert.deepEqual(
      results.map((result) => result.ok),
      [true, true, false, false]
    );
  });

  test("hostile documents never throw", () => {
    const cyclic: Record<string, unknown> = {
      id: "c",
      type: "note",
      settings: {},
    };
    cyclic.settings = cyclic;
    const inputs: unknown[] = [
      Object.defineProperty({ id: "x", version: 2 }, "widgets", {
        enumerable: true,
        get: () => {
          throw new Error("boom");
        },
      }),
      new Proxy(
        { id: "p" },
        {
          ownKeys: () => {
            throw new Error("no keys");
          },
        }
      ),
      {
        id: "c",
        version: 2,
        widgets: [cyclic],
        sections: [{ id: "s", type: "flow", widgetIds: [cyclic] }],
      },
      {
        id: "l",
        version: 2,
        widgets: Array.from({ length: 100_000 }, () => ({})),
      },
      {
        id: "n",
        version: 2,
        sections: "grid",
        widgets: {},
        filters: 7,
        name: 5,
      },
      { id: 12, version: "2" },
    ];
    for (const input of inputs) {
      const result = api.validateDashboard(input);
      assert.ok(Array.isArray(result.issues));
      assert.ok(result.issues.length <= 201);
    }
    assert.equal(
      api.validateDashboard({ id: 12, version: "2" }).dashboard?.id,
      "12"
    );
  });
}

const SOURCES: Record<string, Sources.DashboardSourceSummary> = {
  pages: {
    id: "pages",
    name: { en: "Pages", fr: "Pages" },
    columns: [{ id: "status" }, { id: "updatedAt" }, { id: "title" }],
    displayModes: ["table", "list"],
    views: [{ id: "drafts", name: "Drafts", displayMode: "list" }],
  },
  secret: {
    id: "secret",
    name: "Secret",
    available: false,
    unavailableReason: "forbidden",
  },
  loose: { id: "loose", name: "Loose" },
};

function referenceSuite(test: Test, api: DashboardSchemaApi) {
  test("references are checked against the host's sources and blocks", () => {
    const dashboard = api.normalizeDashboard({
      ...SCREEN,
      sections: [],
      widgets: [
        {
          id: "a",
          type: "view",
          tableId: "pages",
          view: {
            displayMode: "calendar",
            sorting: [{ id: "createdAt", desc: true }],
            columnVisibility: { title: true, body: false },
            list: {
              titleColumn: "headline",
              cardColumnIds: ["status", "author"],
            },
            advancedFilters: [{ id: "r", columnId: "state", operator: "is" }],
          },
          settings: {},
        },
        {
          id: "b",
          type: "kpi",
          tableId: "pages",
          viewId: "published",
          settings: {
            metric: "sum",
            metricColumn: "words",
            dateColumn: "updatedAt",
          },
        },
        { id: "c", type: "view", tableId: "nowhere", settings: {} },
        { id: "d", type: "view", tableId: "secret", settings: {} },
        {
          id: "e",
          type: "view",
          tableId: "loose",
          viewId: "any",
          view: undefined,
          settings: {},
        },
        { id: "f", type: "block", block: "media.storage", settings: {} },
      ],
      filters: [
        {
          id: "g",
          type: "select",
          label: "G",
          targets: [
            { tableId: "pages", columnId: "kind" },
            { tableId: "nowhere", columnId: "x" },
          ],
        },
      ],
    });
    const checked = api.checkDashboardReferences(dashboard, {
      sources: SOURCES,
      blocks: {},
    });
    assert.deepEqual(codes(checked.issues), [
      ["unsupportedDisplayMode", "widgets[0].view.displayMode"],
      ["unknownColumn", "widgets[0].view.sorting[0].id"],
      ["unknownColumn", "widgets[0].view.advancedFilters[0].columnId"],
      ["unknownColumn", "widgets[0].view.columnVisibility.body"],
      ["unknownColumn", "widgets[0].view.list.titleColumn"],
      ["unknownColumn", "widgets[0].view.list.cardColumnIds[1]"],
      ["unknownView", "widgets[1].viewId"],
      ["unknownColumn", "widgets[1].settings.metricColumn"],
      ["unknownSource", "widgets[2].tableId"],
      ["unavailableSource", "widgets[3].tableId"],
      ["unknownBlock", "widgets[5].block"],
      ["unknownColumn", "filters[0].targets[0].columnId"],
      ["unknownSource", "filters[0].targets[1].tableId"],
    ]);
    assert.equal(checked.ok, false);
    assert.equal(
      checked.issues.find((issue) => issue.code === "unavailableSource")
        ?.severity,
      "warning"
    );
    assert.deepEqual(
      api.checkDashboardReferences(api.normalizeDashboard(SCREEN), {
        sources: SOURCES,
        blocks: { "media.storage": {} },
      }),
      { issues: [], ok: true }
    );
  });
}

/** The value at a path of objects and lists. */
function dig(
  value: unknown,
  path: readonly (string | number)[]
): object | undefined {
  let current: unknown = value;
  for (const key of path) {
    current =
      current && typeof current === "object"
        ? (current as Record<string | number, unknown>)[key]
        : undefined;
  }
  return current && typeof current === "object" ? current : undefined;
}

/** The same JSON with every object's keys in reverse order. */
function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reversedKeys);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reversedKeys(child)])
  );
}

/** Every `enum` and `const` of a JSON Schema, by the property that holds it. */
function schemaEnums(
  schema: unknown,
  key = "",
  found = new Map<string, Set<unknown>>()
) {
  if (Array.isArray(schema)) {
    for (const entry of schema) {
      schemaEnums(entry, key, found);
    }
    return found;
  }
  if (!schema || typeof schema !== "object") {
    return found;
  }
  const record = schema as Record<string, unknown>;
  const values = found.get(key) ?? new Set<unknown>();
  for (const value of Array.isArray(record.enum) ? record.enum : []) {
    values.add(value);
  }
  if ("const" in record) {
    values.add(record.const);
  }
  found.set(key, values);
  for (const [name, value] of Object.entries(record)) {
    if (name === "properties" && value && typeof value === "object") {
      for (const [property, child] of Object.entries(value)) {
        schemaEnums(child, property, found);
      }
    } else if (name !== "enum" && name !== "const") {
      schemaEnums(value, key, found);
    }
  }
  return found;
}

function jsonSchemaSuite(test: Test, api: DashboardSchemaApi) {
  test("the JSON Schema's enums are the grammar's constants", () => {
    const schema = api.dashboardJsonSchema();
    const enums = schemaEnums(schema);
    const sorted = (values: Iterable<unknown>) =>
      [...values].map(String).sort();
    assert.deepEqual(sorted(enums.get("version") ?? []), [
      String(api.DASHBOARD_VERSION),
    ]);
    assert.deepEqual(
      sorted(enums.get("type") ?? []),
      sorted([
        ...api.DASHBOARD_WIDGET_TYPES,
        ...api.DASHBOARD_SECTION_TYPES,
        ...api.DASHBOARD_FILTER_TYPES,
      ])
    );
    assert.deepEqual(
      sorted(enums.get("metric") ?? []),
      sorted(api.DASHBOARD_KPI_METRICS)
    );
    assert.deepEqual(
      sorted(enums.get("bucket") ?? []),
      sorted(api.DASHBOARD_SPARKLINE_BUCKETS)
    );
    assert.deepEqual(
      sorted(enums.get("overflow") ?? []),
      sorted(api.DASHBOARD_OVERFLOWS)
    );
    assert.deepEqual(
      sorted(enums.get("preset") ?? []),
      sorted(api.DASHBOARD_DATE_PRESETS)
    );
    assert.deepEqual(
      sorted(enums.get("displayMode") ?? []),
      sorted(api.displayModes)
    );
    assert.deepEqual(sorted(enums.get("density") ?? []), sorted(api.densities));
    assert.deepEqual(
      sorted(enums.get("operator") ?? []),
      sorted(api.operators)
    );
    const view = dig(schema, [
      "properties",
      "widgets",
      "items",
      "oneOf",
      0,
      "properties",
      "view",
      "properties",
    ]);
    assert.deepEqual(Object.keys(view ?? {}).sort(), [...api.viewKeys].sort());
    assert.deepEqual(JSON.parse(JSON.stringify(schema)), schema);
  });

  test("sources and blocks narrow the schema", () => {
    const schema = api.dashboardJsonSchema({
      sourceIds: ["pages", "media"],
      blocks: {
        "media.storage": {
          label: { en: "Storage", fr: "Stockage" },
          description: "Space the media take.",
          group: "Media",
          placement: "flow",
          defaultSize: { w: 1, h: 2 },
          defaultProps: { unit: "GB" },
          propsSchema: {
            type: "object",
            properties: { unit: { enum: ["GB", "MB"] } },
          },
        },
        "home.summary": {},
      },
    });
    const descriptions = JSON.stringify(schema);
    assert.equal(
      descriptions.includes(
        'The \\"media.storage\\" block (flow sections): Storage. Space the media take.'
      ),
      true
    );
    const enums = schemaEnums(schema);
    assert.deepEqual([...(enums.get("tableId") ?? [])].sort(), [
      "media",
      "pages",
    ]);
    assert.deepEqual([...(enums.get("block") ?? [])].sort(), [
      "home.summary",
      "media.storage",
    ]);
    assert.deepEqual([...(enums.get("unit") ?? [])], ["GB", "MB"]);
  });
}

function fingerprintSuite(test: Test, api: DashboardSchemaApi) {
  test("fingerprints ignore versions, key order and save times", () => {
    const migrated = api.normalizeDashboard(V1);
    const reordered = reversedKeys(migrated) as Dashboard;
    assert.equal(
      api.dashboardFingerprint(V1),
      api.dashboardFingerprint(migrated)
    );
    assert.equal(
      api.canonicalDashboardJson({ ...V1, updatedAt: "2030-01-01" }),
      api.canonicalDashboardJson(V1)
    );
    assert.equal(
      api.dashboardFingerprint(reordered),
      api.dashboardFingerprint(migrated)
    );
    assert.notEqual(JSON.stringify(reordered), JSON.stringify(migrated));
    assert.notEqual(
      api.dashboardFingerprint({ ...V1, name: "Other" }),
      api.dashboardFingerprint(V1)
    );
    assert.match(api.dashboardFingerprint(V1), SHA256);
    assert.equal(api.canonicalDashboardJson(V1).includes("updatedAt"), false);
    assert.equal(
      api.canonicalDashboardJson(V1).startsWith('{"filters":'),
      true
    );
  });

  test("SHA-256 matches the platform's, in UTF-8", () => {
    assert.equal(
      api.sha256Hex(""),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert.equal(
      api.sha256Hex("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    for (const text of [
      "é😀 Tableau de bord",
      "x".repeat(55),
      "x".repeat(56),
      "x".repeat(64),
      "€".repeat(10_000),
    ]) {
      assert.equal(api.sha256Hex(text), api.sha256(text));
    }
  });
}

function builderSuite(test: Test, api: DashboardSchemaApi) {
  test("builders add sections and widgets where they fit", () => {
    let dashboard = api.createDashboard("d", { en: "Home", fr: "Accueil" });
    assert.deepEqual(dashboard.sections, [
      { id: "main", type: "grid", layout: [] },
    ]);
    dashboard = api.addDashboardSection(dashboard, {
      type: "flow",
      id: "page",
      title: "Everything",
    });
    dashboard = api.addDashboardSection(
      dashboard,
      { type: "grid", id: "page" },
      0
    );
    assert.deepEqual(
      dashboard.sections.map((section) => [section.id, section.type]),
      [
        ["section-3", "grid"],
        ["main", "grid"],
        ["page", "flow"],
      ]
    );
    dashboard = api.addDashboardWidget(dashboard, {
      type: "table",
      tableId: "pages",
      settings: {},
    });
    dashboard = api.addDashboardWidget(
      dashboard,
      { type: "kpi", tableId: "pages", settings: {} },
      { sectionId: "main" }
    );
    dashboard = api.addDashboardWidget(
      dashboard,
      { type: "view", tableId: "pages", settings: {} },
      { w: 2, h: 3 }
    );
    dashboard = api.addDashboardWidget(
      dashboard,
      { type: "note", settings: { text: "Hi" } },
      { sectionId: "page", index: 0 }
    );
    assert.deepEqual(flowOf(dashboard, "page"), ["widget-4", "widget-1"]);
    assert.deepEqual(layoutOf(dashboard, "main"), [
      item("widget-2", 0, 0, 1, 1),
    ]);
    assert.deepEqual(layoutOf(dashboard, "section-3"), [
      item("widget-3", 0, 0, 2, 3),
    ]);
    assert.equal(api.validateDashboard(dashboard).ok, true);
  });

  test("widgets move between sections and around their own", () => {
    let dashboard = api.normalizeDashboard(SCREEN);
    // Grid to flow and back: the card keeps its size.
    dashboard = api.moveWidgetToSection(dashboard, "published", "page", {
      index: 1,
    });
    assert.deepEqual(flowOf(dashboard, "page"), [
      "pages",
      "published",
      "storage",
    ]);
    assert.deepEqual(layoutOf(dashboard, "cards"), []);
    dashboard = api.moveWidgetToSection(dashboard, "published", "cards", {
      size: { w: 2, h: 1 },
    });
    assert.deepEqual(layoutOf(dashboard, "cards"), [
      item("published", 0, 0, 2, 1),
    ]);
    // Tables never go in grids.
    assert.equal(
      api.moveWidgetToSection(dashboard, "pages", "cards"),
      dashboard
    );
    // Flows move up and down only; grids resize.
    assert.equal(api.canMoveDashboardWidget(dashboard, "pages", "up"), false);
    assert.equal(api.canMoveDashboardWidget(dashboard, "pages", "down"), true);
    assert.equal(api.canMoveDashboardWidget(dashboard, "pages", "left"), false);
    dashboard = api.moveDashboardWidget(dashboard, "pages", "down");
    assert.deepEqual(flowOf(dashboard, "page"), ["storage", "pages"]);
    assert.equal(
      api.canResizeDashboardWidget(dashboard, "pages", "taller"),
      false
    );
    assert.equal(
      api.resizeDashboardWidget(dashboard, "pages", "taller"),
      dashboard
    );
    dashboard = api.resizeDashboardWidget(dashboard, "published", "taller");
    assert.deepEqual(layoutOf(dashboard, "cards"), [
      item("published", 0, 0, 2, 2),
    ]);
    // The grid reports what gridstack did; the same layout keeps the dashboard.
    assert.equal(
      api.applyDashboardSectionLayout(
        dashboard,
        "cards",
        layoutOf(dashboard, "cards")
      ),
      dashboard
    );
    const dragged = api.applyDashboardSectionLayout(dashboard, "cards", [
      item("published", 2, 3, 2, 2),
    ]);
    assert.deepEqual(layoutOf(dragged, "cards"), [
      item("published", 2, 0, 2, 2),
    ]);
    // Removing a widget clears its place and the filters naming it.
    const filtered: Dashboard = {
      ...dashboard,
      filters: [
        {
          id: "f",
          type: "select",
          label: "F",
          targets: [
            { tableId: "pages", columnId: "status", widgetIds: ["pages"] },
          ],
        },
      ],
    };
    const removed = api.removeDashboardWidget(filtered, "pages");
    assert.deepEqual(flowOf(removed, "page"), ["storage"]);
    assert.deepEqual(removed.filters[0]?.targets, []);
  });
}

export function dashboardSchemaSuite(test: Test, api: DashboardSchemaApi) {
  migrationSuite(test, api);
  repairSuite(test, api);
  blockSuite(test, api);
  referenceSuite(test, api);
  jsonSchemaSuite(test, api);
  fingerprintSuite(test, api);
  builderSuite(test, api);
}
