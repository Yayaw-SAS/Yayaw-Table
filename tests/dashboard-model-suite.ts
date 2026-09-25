import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

/** The dashboard model functions both editions run through this suite. */
export type DashboardModelApi = Pick<
  typeof Model,
  | "addDashboardFilter"
  | "addDashboardWidget"
  | "applyGridLayout"
  | "canMoveLayoutItem"
  | "canResizeLayoutItem"
  | "createDashboard"
  | "dashboardColumnsForWidth"
  | "dashboardCompareDayOptions"
  | "dashboardComparison"
  | "dashboardComparisonText"
  | "dashboardDateColumns"
  | "dashboardFilterLabel"
  | "dashboardFilterRules"
  | "dashboardFilterTargetsLabel"
  | "dashboardFitPageSize"
  | "dashboardFitsRecords"
  | "dashboardKpiDisplay"
  | "dashboardKpiPeriods"
  | "dashboardKpiPlan"
  | "dashboardKpiSettings"
  | "dashboardLabel"
  | "dashboardListTotal"
  | "dashboardMoreCount"
  | "dashboardSparklineKeys"
  | "dashboardSparklinePoints"
  | "dashboardSparklineValues"
  | "dashboardTranslate"
  | "dashboardViewParams"
  | "dashboardWidgetFromDraft"
  | "dashboardWidgetSize"
  | "dashboardWidgetTitle"
  | "dashboardWidgetViewId"
  | "defaultWidgetSize"
  | "emptyWidgetDraft"
  | "findFreeSpot"
  | "kpiViewConfig"
  | "loadDashboardKpi"
  | "loadDashboardViews"
  | "mergeDashboardFilters"
  | "moveLayoutItem"
  | "normalizeDashboard"
  | "normalizeLayout"
  | "removeDashboardWidget"
  | "resizeLayoutItem"
  | "resolveLayout"
  | "setDashboardFilterValue"
  | "shiftDashboardDay"
  | "stackLayout"
  | "validateDashboard"
  | "widgetFilterSignature"
  | "widgetOverflow"
  | "widgetViewConfig"
  | "withDashboardFilters"
>;
type Test = (name: string, run: () => void | Promise<void>) => void;
type Layout = Model.DashboardLayoutItem[];
const UNSUPPORTED_VERSION = /version 3 is not supported/;

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
const places = (layout: Layout) =>
  Object.fromEntries(
    layout.map((entry) => [
      entry.widgetId,
      [entry.x, entry.y, entry.w, entry.h],
    ])
  );
/** The layout of a dashboard's grid section (`main`, the one version 1 migrates to). */
const layoutOf = (dashboard: Model.Dashboard, sectionId = "main"): Layout => {
  const section = dashboard.sections.find((entry) => entry.id === sectionId);
  return section?.type === "grid" ? section.layout : [];
};
const overlapping = (layout: Layout) =>
  layout.some((a, index) =>
    layout
      .slice(index + 1)
      .some(
        (b) =>
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h
      )
  );

const DASHBOARD = {
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
    { id: "tasks", type: "view", tableId: "tasks", settings: {} },
    { id: "note", type: "note", settings: { text: "Hello" } },
  ],
  layout: [
    item("count", 0, 0, 1, 1),
    item("chart", 0, 1, 2, 3),
    item("tasks", 2, 1, 2, 3),
    item("note", 1, 0, 1, 1),
  ],
  filters: [
    {
      id: "due",
      type: "dateRange",
      label: "Due date",
      targets: [
        { tableId: "projects", columnId: "dueDate" },
        { tableId: "tasks", columnId: "deadline" },
      ],
    },
    {
      id: "category",
      type: "select",
      label: "Category",
      targets: [
        { tableId: "projects", columnId: "category", widgetIds: ["chart"] },
      ],
    },
  ],
};

const TABLES = {
  projects: {
    name: "Projects",
    columns: [
      { id: "dueDate", header: "Due date", type: "date" },
      {
        id: "category",
        header: "Category",
        type: "select",
        options: [
          { value: "Software", label: "Software" },
          { value: "Hardware" },
        ],
      },
    ],
  },
  tasks: {
    name: "Tasks",
    columns: [{ id: "deadline", header: "Deadline", type: "date" }],
  },
};

function layoutSuite(test: Test, api: DashboardModelApi) {
  test("dashboard layouts are normalized inside four columns", () => {
    const layout = api.normalizeLayout(
      [
        item("a", 3, -2, 3, 0),
        item("a", 0, 0, 1, 1),
        item("gone", 0, 0, 1, 1),
        { widgetId: "b", x: 1.7, y: 20, w: 9, h: 40 },
      ],
      [
        { id: "a", type: "view" },
        { id: "b", type: "view" },
        { id: "c", type: "note" },
      ]
    );
    // One item per widget, whole numbers inside the grid, risen to the top;
    // the missing note takes the first spot it fits in.
    assert.deepEqual(places(layout), {
      a: [1, 0, 3, 1],
      b: [0, 1, 4, 12],
      c: [0, 13, 1, 2],
    });
    assert.equal(overlapping(layout), false);
  });

  test("dashboard collisions move the other widgets below the fixed one", () => {
    const layout = api.resolveLayout(
      [item("a", 0, 0, 2, 2), item("b", 0, 1, 2, 2), item("c", 2, 0, 2, 1)],
      "b"
    );
    assert.deepEqual(places(layout), {
      b: [0, 0, 2, 2],
      a: [0, 2, 2, 2],
      c: [2, 0, 2, 1],
    });
    assert.deepEqual(api.findFreeSpot(layout, { w: 2, h: 1 }), { x: 2, y: 1 });
    assert.deepEqual(api.findFreeSpot(layout, { w: 4, h: 1 }), { x: 0, y: 4 });
  });

  test("dashboard keyboard moves swap widgets like a drag would", () => {
    const layout = [
      item("a", 0, 0, 2, 2),
      item("b", 2, 0, 2, 2),
      item("c", 0, 2, 2, 3),
    ];
    assert.deepEqual(places(api.moveLayoutItem(layout, "b", "left")), {
      a: [2, 0, 2, 2],
      b: [0, 0, 2, 2],
      c: [0, 2, 2, 3],
    });
    assert.deepEqual(places(api.moveLayoutItem(layout, "c", "up")), {
      a: [0, 3, 2, 2],
      b: [2, 0, 2, 2],
      c: [0, 0, 2, 3],
    });
    assert.deepEqual(places(api.moveLayoutItem(layout, "a", "down")), {
      a: [0, 3, 2, 2],
      b: [2, 0, 2, 2],
      c: [0, 0, 2, 3],
    });
    // A widget alone on its row moves one column at a time.
    assert.deepEqual(
      places(api.moveLayoutItem([item("n", 1, 0, 1, 1)], "n", "right")),
      { n: [2, 0, 1, 1] }
    );
    assert.equal(api.canMoveLayoutItem(layout, "a", "left"), false);
    assert.equal(api.canMoveLayoutItem(layout, "a", "up"), false);
    assert.equal(api.canMoveLayoutItem(layout, "a", "down"), true);
    assert.equal(api.canMoveLayoutItem(layout, "b", "down"), false);
    assert.equal(api.canMoveLayoutItem(layout, "missing", "down"), false);
    // Impossible moves leave the layout as it is.
    assert.deepEqual(api.moveLayoutItem(layout, "a", "up"), layout);
  });

  test("dashboard keyboard resizing stays in the grid and pushes neighbours", () => {
    const layout = [item("a", 2, 0, 2, 1), item("b", 0, 1, 4, 1)];
    assert.deepEqual(places(api.resizeLayoutItem(layout, "a", "wider")), {
      a: [1, 0, 3, 1],
      b: [0, 1, 4, 1],
    });
    assert.deepEqual(places(api.resizeLayoutItem(layout, "a", "taller")), {
      a: [2, 0, 2, 2],
      b: [0, 2, 4, 1],
    });
    assert.equal(api.canResizeLayoutItem(layout, "b", "wider"), false);
    assert.equal(api.canResizeLayoutItem(layout, "a", "shorter"), false);
    assert.equal(
      api.canResizeLayoutItem([item("t", 0, 0, 1, 12)], "t", "taller"),
      false
    );
    assert.deepEqual(api.resizeLayoutItem(layout, "b", "wider"), layout);
  });

  test("dashboards stack in reading order on phones", () => {
    assert.equal(api.dashboardColumnsForWidth(375), 1);
    assert.equal(api.dashboardColumnsForWidth(639), 1);
    assert.equal(api.dashboardColumnsForWidth(640), 4);
    assert.equal(api.dashboardColumnsForWidth(0), 4);
    assert.deepEqual(
      places(
        api.stackLayout([
          item("chart", 0, 1, 2, 3),
          item("tasks", 2, 1, 2, 2),
          item("count", 0, 0, 1, 1),
        ])
      ),
      {
        count: [0, 0, 1, 1],
        chart: [0, 1, 1, 3],
        tasks: [0, 4, 1, 2],
      }
    );
  });

  test("grid changes are normalized and unchanged layouts keep the section", () => {
    const section = {
      id: "main",
      layout: layoutOf(api.normalizeDashboard(DASHBOARD)),
    };
    assert.equal(api.applyGridLayout(section, section.layout), section);
    const moved = api.applyGridLayout(section, [
      item("note", 0, 0, 1, 1),
      item("count", 1, 0, 1, 1),
    ]);
    assert.notEqual(moved, section);
    assert.equal(moved.id, "main");
    assert.deepEqual(places(moved.layout).note, [0, 0, 1, 1]);
    assert.deepEqual(places(moved.layout).count, [1, 0, 1, 1]);
  });
}

function widgetSuite(test: Test, api: DashboardModelApi) {
  test("dashboard widgets are added in a free spot and removed everywhere", () => {
    const dashboard = api.normalizeDashboard(DASHBOARD);
    const added = api.addDashboardWidget(dashboard, {
      type: "kpi",
      tableId: "tasks",
      settings: { metric: "count" },
    });
    const widget = added.widgets.at(-1);
    assert.equal(widget?.id, "widget-5");
    assert.deepEqual(
      layoutOf(added).find((entry) => entry.widgetId === "widget-5"),
      item("widget-5", 2, 3, 1, 1)
    );
    const removed = api.removeDashboardWidget(added, "chart");
    assert.equal(
      removed.widgets.some((entry) => entry.id === "chart"),
      false
    );
    assert.equal(
      layoutOf(removed).some((entry) => entry.widgetId === "chart"),
      false
    );
    // A filter only targeting the removed widget loses that target.
    assert.deepEqual(
      removed.filters.find((filter) => filter.id === "category")?.targets,
      []
    );
  });

  test("KPI widgets render as number charts over their view", () => {
    const widget = {
      id: "k",
      type: "kpi" as const,
      tableId: "projects",
      settings: { metric: "sum", metricColumn: "price" },
    };
    assert.deepEqual(
      api.kpiViewConfig(widget, { advancedFilters: [{ id: "x" }] }),
      {
        advancedFilters: [{ id: "x" }],
        displayMode: "chart",
        chart: { type: "number", metric: "sum", metricColumn: "price" },
      }
    );
    assert.deepEqual(
      api.kpiViewConfig({ ...widget, settings: { metric: "sum" } }).chart,
      { type: "number", metric: "count" }
    );
  });

  test("widget titles and labels exist in English and French", () => {
    const context = { locale: "en", table: { name: "Projects" } };
    const view = {
      id: "v",
      type: "view" as const,
      tableId: "projects",
      settings: {},
    };
    assert.equal(
      api.dashboardWidgetTitle(view, context),
      "Projects › Default view"
    );
    assert.equal(
      api.dashboardWidgetTitle(view, { ...context, view: { name: "Board" } }),
      "Board"
    );
    assert.equal(
      api.dashboardWidgetTitle({ ...view, title: "Mine" }, context),
      "Mine"
    );
    assert.equal(
      api.dashboardWidgetTitle(
        { id: "n", type: "note", settings: {} },
        { locale: "fr" }
      ),
      "Note"
    );
    assert.equal(api.dashboardLabel("moveDown", "fr"), "Déplacer vers le bas");
    assert.equal(
      api.dashboardLabel("appliesTo", "en", undefined, { targets: "X" }),
      "Applies to X"
    );
    const translate = api.dashboardTranslate({ "dashboard.edit": "Arrange" });
    assert.equal(api.dashboardLabel("edit", "en", translate), "Arrange");
    assert.equal(api.dashboardLabel("done", "en", translate), "Done");
  });

  test("titles and filter names follow the locale; inline views need no saved view", () => {
    const localized = {
      id: "k",
      type: "kpi" as const,
      tableId: "projects",
      title: { en: "Revenue", fr: "Chiffre d’affaires" },
      settings: {},
    };
    const context = { locale: "fr-CA", table: { name: "Projects" } };
    assert.equal(
      api.dashboardWidgetTitle(localized, context),
      "Chiffre d’affaires"
    );
    assert.equal(
      api.dashboardWidgetTitle(localized, { ...context, locale: "de" }),
      "Revenue"
    );
    const inline = {
      id: "i",
      type: "view" as const,
      tableId: "projects",
      view: {
        displayMode: "list" as const,
        sorting: [{ id: "revenue", desc: true }],
      },
      settings: {},
    };
    // An inline view is the table's; a saved one is named after its view.
    assert.equal(api.dashboardWidgetTitle(inline, context), "Projects");
    assert.equal(api.dashboardWidgetViewId(inline), null);
    assert.equal(api.dashboardWidgetViewId({ viewId: "board" }), "board");
    assert.deepEqual(
      api.widgetViewConfig(inline, { config: { displayMode: "table" } }),
      { displayMode: "list", sorting: [{ id: "revenue", desc: true }] }
    );
    assert.deepEqual(
      api.widgetViewConfig({ ...inline, type: "kpi" as const }).chart,
      { type: "number", metric: "count" }
    );
    assert.deepEqual(api.dashboardWidgetSize(inline), { w: 2, h: 2 });
    assert.equal(
      api.dashboardWidgetTitle(
        { id: "t", type: "table", tableId: "projects", settings: {} },
        context
      ),
      "Projects"
    );
    assert.equal(
      api.dashboardWidgetTitle(
        { id: "b", type: "block", block: "home.summary", settings: {} },
        context
      ),
      "home.summary"
    );
    assert.equal(
      api.dashboardFilterLabel(
        { id: "due", label: { en: "Due", fr: "Échéance" } },
        "fr"
      ),
      "Échéance"
    );
    assert.equal(
      api.dashboardFilterLabel({ id: "due", label: "" }, "fr"),
      "due"
    );
    assert.equal(
      api.dashboardLabel("notAvailableYet", "fr"),
      "Pas encore disponible"
    );
  });

  test("saved views come from the source and the views action", async () => {
    const views = await api.loadDashboardViews(
      {
        views: [{ id: "a", name: "A", config: { displayMode: "list" } }],
        actions: {
          views: {
            list: () =>
              Promise.resolve({
                success: true,
                data: [
                  { id: "a", name: "A again", config: {} },
                  { id: "b", config: { displayMode: "chart" } },
                ],
              }),
          },
        },
      },
      "projects"
    );
    assert.deepEqual(views, [
      { id: "a", name: "A again", config: {} },
      { id: "b", name: "b", config: { displayMode: "chart" } },
    ]);
  });
}

function filterSuite(test: Test, api: DashboardModelApi) {
  test("dashboard filters become rules on each widget's own column", () => {
    let dashboard = api.normalizeDashboard(DASHBOARD);
    const chart = dashboard.widgets[1] as Model.DashboardWidget;
    const tasks = dashboard.widgets[2] as Model.DashboardWidget;
    const note = dashboard.widgets[3] as Model.DashboardWidget;
    assert.deepEqual(api.dashboardFilterRules(dashboard, chart), []);
    dashboard = api.setDashboardFilterValue(dashboard, "due", {
      start: "2026-09-01",
      end: "2026-09-10",
    });
    dashboard = api.setDashboardFilterValue(dashboard, "category", [
      "Software",
      "Software",
      "",
    ]);
    assert.deepEqual(api.dashboardFilterRules(dashboard, chart), [
      {
        id: "dashboard-due",
        columnId: "dueDate",
        isActive: true,
        type: "date",
        operator: "between",
        values: ["2026-09-01", "2026-09-10"],
      },
      {
        id: "dashboard-category",
        columnId: "category",
        isActive: true,
        type: "select",
        operator: "isAnyOf",
        values: ["Software"],
      },
    ]);
    // Tasks use their own date column; the category filter targets the chart only.
    assert.deepEqual(
      api
        .dashboardFilterRules(dashboard, tasks)
        .map((rule) => [rule.columnId, rule.operator]),
      [["deadline", "between"]]
    );
    assert.deepEqual(api.dashboardFilterRules(dashboard, note), []);
    const from = api.setDashboardFilterValue(dashboard, "due", {
      start: "2026-09-05",
    });
    assert.deepEqual(
      api.dashboardFilterRules(from, tasks).at(0)?.operator,
      "greaterThanOrEqual"
    );
    const cleared = api.setDashboardFilterValue(dashboard, "due", undefined);
    assert.equal(
      cleared.filters.find((filter) => filter.id === "due")?.value,
      undefined
    );
    assert.notEqual(
      api.widgetFilterSignature(dashboard, chart),
      api.widgetFilterSignature(cleared, chart)
    );
    assert.equal(
      api.dashboardFilterTargetsLabel(
        dashboard.filters[0] as Model.DashboardFilter,
        TABLES
      ),
      "Projects › Due date, Tasks › Deadline"
    );
  });

  test("dashboard rules join the view's filters with AND", () => {
    const rule = {
      id: "dashboard-due",
      columnId: "dueDate",
      operator: "between",
    };
    const own = {
      id: "own",
      columnId: "status",
      operator: "is",
      values: ["A"],
    };
    const params = { advancedFilters: [own], search: "x" };
    assert.equal(api.mergeDashboardFilters(params, []), params);
    assert.deepEqual(api.mergeDashboardFilters(params, [rule]), {
      search: "x",
      advancedFilters: [{ ...own, isActive: true }, rule],
      advancedFilterJoin: "and",
      requiredFilters: [rule],
    });
    // "(A or B) and C" cannot be a flat list: the rules travel apart.
    const anyOf = {
      advancedFilters: {
        filters: [own, { ...own, id: "other" }],
        joinOperator: "or",
      },
    };
    assert.deepEqual(api.mergeDashboardFilters(anyOf, [rule]), {
      ...anyOf,
      requiredFilters: [rule],
    });
    // Inactive rules of the view are not sent.
    assert.deepEqual(
      api.mergeDashboardFilters(
        { advancedFilters: [{ ...own, isActive: false }] },
        [rule]
      ).advancedFilters,
      [rule]
    );
  });

  test("dashboard rules reach list and aggregate requests", async () => {
    const calls: Record<string, unknown>[] = [];
    const actions = api.withDashboardFilters(
      {
        list: (params: Record<string, unknown>) => {
          calls.push(params);
          return Promise.resolve({ data: [] });
        },
        aggregate: (params: Record<string, unknown>) => {
          calls.push(params);
          return Promise.resolve({ groups: [] });
        },
        update: () => Promise.resolve({ success: true }),
      },
      [{ id: "r", columnId: "c", operator: "is", values: ["v"] }]
    );
    await actions.list({ page: 1 });
    await actions.aggregate({ groupBy: [] });
    assert.deepEqual(
      calls.map((call) => call.requiredFilters),
      [
        [{ id: "r", columnId: "c", operator: "is", values: ["v"] }],
        [{ id: "r", columnId: "c", operator: "is", values: ["v"] }],
      ]
    );
    const plain = { list: () => Promise.resolve({ data: [] }) };
    assert.equal(api.withDashboardFilters(plain, []), plain);
  });

  test("dashboard filters are added with their columns only", () => {
    const dashboard = api.createDashboard("d", "D");
    const added = api.addDashboardFilter(dashboard, {
      type: "select",
      label: "Team",
      targets: [
        { tableId: "tasks", columnId: "team" },
        { tableId: "projects", columnId: "" },
      ],
    });
    assert.deepEqual(added.filters, [
      {
        id: "filter-1",
        type: "select",
        label: "Team",
        targets: [{ tableId: "tasks", columnId: "team" }],
      },
    ]);
  });
}

function versionSuite(test: Test, api: DashboardModelApi) {
  test("dashboard JSON is validated, repaired and versioned", () => {
    const { dashboard, issues } = api.validateDashboard({
      ...DASHBOARD,
      widgets: [
        ...DASHBOARD.widgets,
        { id: "count", type: "note", settings: {} },
        { id: "bad", type: "iframe" },
        { id: "no-table", type: "view", settings: {} },
      ],
      filters: [...DASHBOARD.filters, { id: "x", type: "slider" }],
      layout: [...DASHBOARD.layout, item("bad", 0, 0, 1, 1)],
    });
    assert.equal(dashboard?.version, 2);
    assert.deepEqual(
      dashboard?.widgets.map((widget) => widget.id),
      ["count", "chart", "tasks", "note"]
    );
    assert.deepEqual(
      issues.map((issue) => issue.code),
      [
        "duplicateWidget",
        "invalidWidget",
        "invalidWidget",
        // The layout names a missing widget, and "tasks" rises into free space.
        "invalidLayout",
        "invalidLayout",
        "invalidFilter",
      ]
    );
    // A valid dashboard round-trips without issues.
    const normalized = api.normalizeDashboard(DASHBOARD);
    assert.deepEqual(api.validateDashboard(normalized), {
      dashboard: normalized,
      issues: [],
      ok: true,
    });
  });

  test("version 1 JSON is saved back as version 2", () => {
    // What "Done" hands to `actions.dashboards.save` after loading version 1.
    const saved = JSON.parse(JSON.stringify(api.normalizeDashboard(DASHBOARD)));
    assert.equal(saved.version, 2);
    assert.equal("layout" in saved, false);
    assert.deepEqual(saved.sections, [
      {
        id: "main",
        type: "grid",
        layout: layoutOf(api.normalizeDashboard(DASHBOARD)),
      },
    ]);
    assert.deepEqual(
      saved.widgets.map((widget: Model.DashboardWidget) => widget.id),
      DASHBOARD.widgets.map((widget) => widget.id)
    );
    // Read again, it is version 2 as it is.
    const again = api.validateDashboard(saved);
    assert.deepEqual(again, { dashboard: saved, issues: [], ok: true });
  });

  test("dashboards without a version are migrated and newer ones refused", () => {
    const legacy = api.normalizeDashboard({
      id: "old",
      name: "Old",
      widgets: [{ id: "n", type: "note", settings: { text: "Hi" } }],
      layout: [{ i: "n", x: 1, y: 0, w: 2, h: 2 }],
    });
    assert.equal(legacy.version, 2);
    assert.deepEqual(layoutOf(legacy), [item("n", 1, 0, 2, 2)]);
    assert.deepEqual(legacy.filters, []);
    assert.throws(
      () => api.normalizeDashboard({ ...DASHBOARD, version: 3 }),
      UNSUPPORTED_VERSION
    );
    assert.throws(() => api.normalizeDashboard({ name: "No id" }));
    assert.equal(api.validateDashboard("nope").dashboard, undefined);
  });
}

function fitSuite(test: Test, api: DashboardModelApi) {
  test("new widgets take a size that suits their type and display mode", () => {
    assert.deepEqual(api.defaultWidgetSize("kpi"), { w: 1, h: 1 });
    assert.deepEqual(api.defaultWidgetSize("note"), { w: 1, h: 2 });
    assert.deepEqual(api.defaultWidgetSize("view"), { w: 2, h: 2 });
    assert.deepEqual(api.defaultWidgetSize("view", "chart"), { w: 2, h: 2 });
    assert.deepEqual(api.defaultWidgetSize("view", "list"), { w: 2, h: 2 });
    assert.deepEqual(api.defaultWidgetSize("view", "kanban"), { w: 2, h: 3 });
    assert.deepEqual(api.defaultWidgetSize("view", "gantt"), { w: 4, h: 3 });
    const views = [
      { id: "board", name: "Board", config: { displayMode: "kanban" } },
    ];
    assert.deepEqual(
      api.dashboardWidgetSize({ type: "view", viewId: "board" }, { views }),
      { w: 2, h: 3 }
    );
    assert.deepEqual(
      api.dashboardWidgetSize(
        { type: "view" },
        { table: { defaultDisplayMode: "gallery" } }
      ),
      { w: 2, h: 3 }
    );
    assert.deepEqual(api.dashboardWidgetSize({ type: "kpi" }), { w: 1, h: 1 });
    const added = api.addDashboardWidget(
      api.createDashboard("d", "D"),
      { type: "view", tableId: "projects", settings: {} },
      { w: 2, h: 3 }
    );
    assert.deepEqual(layoutOf(added), [item("widget-1", 0, 0, 2, 3)]);
  });

  test("fit widgets load enough records to fill their size", () => {
    assert.equal(api.widgetOverflow({ settings: {} }), "fit");
    assert.equal(
      api.widgetOverflow({ settings: { overflow: "scroll" } }),
      "scroll"
    );
    assert.equal(api.widgetOverflow({ settings: { overflow: "clip" } }), "fit");
    assert.equal(api.dashboardFitsRecords("list"), true);
    assert.equal(api.dashboardFitsRecords("feed"), true);
    assert.equal(api.dashboardFitsRecords("chart"), false);
    assert.equal(api.dashboardFitsRecords("calendar"), false);
    // Rows of 120px hold lines of at least 28px (tables), cards of 140px, lanes of 4.
    assert.equal(api.dashboardFitPageSize("table", { w: 2, h: 2 }), 9);
    assert.equal(api.dashboardFitPageSize("gallery", { w: 2, h: 3 }), 12);
    assert.equal(api.dashboardFitPageSize("kanban", { w: 2, h: 3 }), 36);
    assert.equal(api.dashboardFitPageSize("feed", { w: 2, h: 3 }), 5);
    assert.equal(api.dashboardFitPageSize("kanban", { w: 4, h: 12 }), 100);
    // A view's own page size ("Top 5") wins.
    assert.equal(api.dashboardFitPageSize("list", { w: 2, h: 4 }, 5), 5);
    assert.equal(api.dashboardFitPageSize("list", { w: 2, h: 4 }, 500), 100);
  });

  test("+N more counts what the view matches beyond the records shown", () => {
    assert.equal(api.dashboardMoreCount(32, 4), 28);
    assert.equal(api.dashboardMoreCount(3, 5), 0);
    assert.equal(api.dashboardMoreCount(Number.NaN, 1), 0);
    assert.equal(
      api.dashboardListTotal({ data: [1, 2], meta: { totalCount: 9 } }),
      9
    );
    assert.equal(api.dashboardListTotal({ data: [1, 2] }), 2);
    assert.equal(api.dashboardListTotal({ meta: { rowCount: 4 } }), 4);
    assert.equal(api.dashboardListTotal(null), undefined);
    assert.equal(
      api.dashboardLabel("moreCount", "en", undefined, { count: 3 }),
      "+3 more"
    );
    assert.equal(api.dashboardLabel("viewAll", "fr"), "Tout voir");
  });
}

const TODAY = "2026-09-24";
const KPI_COLUMNS = [
  { id: "name", header: "Name", type: "text" },
  {
    id: "revenue",
    header: "Revenue",
    type: "number",
    numberFormat: { currency: "EUR", locale: "en-US", decimals: 0 },
  },
  { id: "dueDate", header: "Due", type: "date" },
  { id: "category", header: "Category", type: "select" },
];
const KPI_ROWS = [
  { id: "a", revenue: 100, dueDate: "2026-07-30", category: "Software" },
  { id: "b", revenue: 50, dueDate: "2026-08-20", category: "Hardware" },
  { id: "c", revenue: 150, dueDate: "2026-09-10", category: "Software" },
  { id: "d", revenue: 80, dueDate: "2026-09-20", category: "Hardware" },
];
const REVENUE: Model.DashboardWidget = {
  id: "revenue",
  type: "kpi",
  tableId: "projects",
  settings: {
    metric: "sum",
    metricColumn: "revenue",
    label: "Revenue",
    dateColumn: "dueDate",
    compare: { period: "previous", days: 30 },
    sparkline: { bucket: "month", buckets: 3 },
  },
};

/** Like a host: rows whose due date is within every required `between` rule. */
const requiredRows = (params: Record<string, unknown>) => {
  const rules = (params.requiredFilters ?? []) as {
    columnId: string;
    operator: string;
    values: string[];
  }[];
  return KPI_ROWS.filter((row) =>
    rules.every((rule) => {
      const value = String(row[rule.columnId as keyof typeof row]);
      if (rule.operator === "between") {
        return (
          value >= String(rule.values[0]) && value <= String(rule.values[1])
        );
      }
      return rule.values.includes(value);
    })
  );
};

function kpiSuite(test: Test, api: DashboardModelApi) {
  test("KPI settings ask for a date column before comparing or drawing a trend", () => {
    assert.deepEqual(
      api.dashboardKpiSettings({
        settings: { metric: "sum", compare: true, sparkline: true },
      }),
      { metric: "count" }
    );
    assert.deepEqual(
      api.dashboardKpiSettings({
        settings: {
          metric: "avg",
          metricColumn: "revenue",
          dateColumn: "dueDate",
          compare: { days: 0, better: "down" },
          sparkline: { bucket: "hour", buckets: 99 },
        },
      }),
      {
        metric: "avg",
        metricColumn: "revenue",
        dateColumn: "dueDate",
        compare: { period: "previous", days: 1, better: "down" },
        sparkline: { bucket: "month", buckets: 24 },
      }
    );
    assert.equal(
      api.dashboardKpiSettings({
        settings: { dateColumn: "dueDate", compare: { period: "next" } },
      }).compare,
      undefined
    );
  });

  test("KPI periods follow the dashboard's dates, else the last days to today", () => {
    assert.deepEqual(api.dashboardKpiPeriods(30, TODAY), {
      current: { start: "2026-08-26", end: "2026-09-24" },
      previous: { start: "2026-07-27", end: "2026-08-25" },
    });
    assert.deepEqual(
      api.dashboardKpiPeriods(30, TODAY, {
        start: "2026-09-01",
        end: "2026-09-30",
      }),
      {
        current: { start: "2026-09-01", end: "2026-09-30" },
        previous: { start: "2026-08-02", end: "2026-08-31" },
      }
    );
    assert.deepEqual(
      api.dashboardKpiPeriods(30, TODAY, { start: "2026-09-10" }).previous,
      { start: "2026-08-26", end: "2026-09-09" }
    );
    assert.deepEqual(
      api.dashboardKpiPeriods(7, TODAY, { end: "2026-09-30" }).current,
      { start: "2026-09-24", end: "2026-09-30" }
    );
    assert.deepEqual(
      api.dashboardKpiPeriods(30, TODAY, {
        start: "2026-09-30",
        end: "2026-09-01",
      }).current,
      { start: "2026-09-01", end: "2026-09-30" }
    );
    assert.equal(api.shiftDashboardDay("2026-03-01", -1), "2026-02-28");
    assert.equal(api.shiftDashboardDay("2026-12-31", 1), "2027-01-01");
  });

  test("comparisons give the change, its direction and whether it is good", () => {
    const up = api.dashboardComparison(157_000, 114_000);
    assert.equal(up.trend, "up");
    assert.equal(up.tone, "positive");
    assert.equal(Math.round((up.change ?? 0) * 1000), 377);
    assert.equal(api.dashboardComparison(90, 100, "down").tone, "positive");
    assert.equal(api.dashboardComparison(110, 100, "down").tone, "negative");
    assert.deepEqual(api.dashboardComparison(0, 0), {
      current: 0,
      previous: 0,
      change: 0,
      trend: "flat",
      tone: "neutral",
    });
    assert.equal(api.dashboardComparison(5, 0).change, undefined);
    assert.equal(
      api.dashboardComparisonText(up, "en"),
      "+38% vs previous period"
    );
    const percent = (locale: string, value: number, digits: number) =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        signDisplay: "exceptZero",
        maximumFractionDigits: digits,
      }).format(value);
    assert.equal(
      api.dashboardComparisonText(up, "fr"),
      `${percent("fr", up.change ?? 0, 0)} vs période précédente`
    );
    assert.equal(
      api.dashboardComparisonText(api.dashboardComparison(1004, 1000), "en"),
      "+0.4% vs previous period"
    );
    assert.equal(
      api.dashboardComparisonText(api.dashboardComparison(90, 100), "en"),
      "-10% vs previous period"
    );
    assert.equal(
      api.dashboardComparisonText(api.dashboardComparison(5, 0), "en"),
      "Nothing in the previous period"
    );
  });

  test("sparklines cover the last buckets and scale into their box", () => {
    assert.deepEqual(api.dashboardSparklineKeys(TODAY, "month", 3), [
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    assert.deepEqual(api.dashboardSparklineKeys(TODAY, "week", 3), [
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    assert.deepEqual(api.dashboardSparklineKeys("2026-02-10", "quarter", 2), [
      "2025-Q4",
      "2026-Q1",
    ]);
    assert.deepEqual(
      api.dashboardSparklineValues(
        ["2026-08", "2026-09"],
        [
          { keys: ["2026-09"], values: [5] },
          { keys: ["2026-07"], values: [1] },
        ]
      ),
      [0, 5]
    );
    assert.equal(api.dashboardSparklinePoints([0, 10], 100, 32), "2,30 98,2");
    assert.equal(api.dashboardSparklinePoints([3, 3], 100, 32), "2,16 98,16");
    assert.equal(api.dashboardSparklinePoints([5], 100, 32), "50,16");
    assert.equal(api.dashboardSparklinePoints([], 100, 32), "");
  });

  test("KPI plans give the dashboard's date rule way to each period", () => {
    const dashboard = {
      filters: [
        {
          id: "due",
          type: "dateRange" as const,
          label: "Due",
          targets: [{ tableId: "projects", columnId: "dueDate" }],
          value: { start: "2026-09-01", end: "2026-09-30" },
        },
        {
          id: "category",
          type: "select" as const,
          label: "Category",
          targets: [{ tableId: "projects", columnId: "category" }],
          value: ["Software"],
        },
      ],
    };
    const plan = api.dashboardKpiPlan(dashboard, REVENUE, TODAY, KPI_COLUMNS);
    assert.deepEqual(plan.periods?.previous, {
      start: "2026-08-02",
      end: "2026-08-31",
    });
    assert.deepEqual(
      plan.queries.map((query) => [
        query.key,
        query.rules.map(
          (rule) => `${rule.columnId} ${JSON.stringify(rule.values)}`
        ),
        query.request.groupBy,
      ]),
      [
        [
          "value",
          ['category ["Software"]', 'dueDate ["2026-09-01","2026-09-30"]'],
          [],
        ],
        [
          "previous",
          ['category ["Software"]', 'dueDate ["2026-08-02","2026-08-31"]'],
          [],
        ],
        [
          "trend",
          ['category ["Software"]', 'dueDate ["2026-07-01","2026-09-30"]'],
          [{ columnId: "dueDate", bucket: "month" }],
        ],
      ]
    );
    // Without a comparison or a trend: one total with the dashboard's rules.
    const count = api.dashboardKpiPlan(
      dashboard,
      { ...REVENUE, settings: { metric: "count" } },
      TODAY
    );
    assert.deepEqual(
      count.queries.map((query) => query.rules.map((rule) => rule.columnId)),
      [["dueDate", "category"]]
    );
    assert.deepEqual(
      api.dashboardViewParams({
        globalSearch: " x ",
        columnFilters: [{ id: "a", value: 1 }],
      }),
      {
        advancedFilters: [],
        filters: { a: 1 },
        search: "x",
      }
    );
  });

  test("KPIs load through aggregate, or list, and show in the column format", async () => {
    const plan = api.dashboardKpiPlan(
      { filters: [] },
      REVENUE,
      TODAY,
      KPI_COLUMNS
    );
    const sent: Record<string, unknown>[] = [];
    const aggregated = await api.loadDashboardKpi({
      plan,
      actions: {
        aggregate: (params: Record<string, unknown>) => {
          sent.push(params);
          const rows = requiredRows(params);
          const groupBy = params.groupBy as { columnId: string }[];
          if (!groupBy.length) {
            return Promise.resolve({
              groups: [
                {
                  keys: [],
                  values: [rows.reduce((sum, row) => sum + row.revenue, 0)],
                },
              ],
            });
          }
          return Promise.resolve({
            groups: rows.map((row) => ({
              keys: [row.dueDate.slice(0, 7)],
              values: [row.revenue],
            })),
          });
        },
      } as never,
      params: {},
      locale: "en",
    });
    // Last 30 days: Aug 26 – Sep 24 (c, d); before: Jul 27 – Aug 25 (a, b).
    assert.deepEqual(aggregated, {
      value: 230,
      previous: 150,
      trend: [100, 50, 230],
    });
    assert.equal(sent.length, 3);
    assert.ok(sent.every((params) => Array.isArray(params.requiredFilters)));
    const listed = await api.loadDashboardKpi({
      plan,
      actions: {
        list: (params: Record<string, unknown>) =>
          Promise.resolve({
            data: requiredRows(params),
            meta: { pageCount: 1, totalCount: requiredRows(params).length },
          }),
      } as never,
      params: {},
      locale: "en",
    });
    assert.deepEqual(listed, aggregated);
    const display = api.dashboardKpiDisplay({
      plan,
      result: aggregated,
      columns: KPI_COLUMNS,
      locale: "en",
    });
    assert.equal(display.value, "€230");
    assert.equal(display.caption, "Sum · Revenue");
    assert.equal(display.comparison?.text, "+53% vs previous period");
    assert.equal(display.comparison?.tone, "positive");
    assert.equal(
      display.comparison?.periods,
      "Aug 26, 2026 – Sep 24, 2026 vs Jul 27, 2026 – Aug 25, 2026"
    );
    assert.equal(display.trend?.points, "2,22.22 50,30 98,2");
    assert.equal(
      display.trend?.title,
      "Trend: Jul 2026 €100, Aug 2026 €50, Sep 2026 €230"
    );
  });
}

function draftSuite(test: Test, api: DashboardModelApi) {
  test("the widget picker's draft becomes a widget", () => {
    const blank = api.emptyWidgetDraft("projects");
    assert.deepEqual(api.dashboardWidgetFromDraft(blank), {
      type: "view",
      tableId: "projects",
      settings: {},
    });
    assert.deepEqual(
      api.dashboardWidgetFromDraft({
        ...blank,
        viewId: "board",
        title: " Board ",
        overflow: "scroll",
      }),
      {
        type: "view",
        tableId: "projects",
        viewId: "board",
        title: "Board",
        settings: { overflow: "scroll" },
      }
    );
    assert.deepEqual(
      api.dashboardWidgetFromDraft({
        ...blank,
        type: "kpi",
        metric: "sum",
        metricColumn: "revenue",
        title: "Revenue",
        dateColumn: "dueDate",
        compare: true,
        compareDays: 90,
        sparkline: true,
      }).settings,
      {
        metric: "sum",
        metricColumn: "revenue",
        label: "Revenue",
        dateColumn: "dueDate",
        compare: { period: "previous", days: 90 },
        sparkline: { bucket: "month", buckets: 6 },
      }
    );
    // A fall can be the good news ("Needs attention").
    assert.deepEqual(
      api.dashboardWidgetFromDraft({
        ...blank,
        type: "kpi",
        dateColumn: "dueDate",
        compare: true,
        compareBetter: "down",
      }).settings,
      {
        metric: "count",
        dateColumn: "dueDate",
        compare: { period: "previous", days: 30, better: "down" },
      }
    );
    // Without a date column, neither the comparison nor the trend is kept.
    assert.deepEqual(
      api.dashboardWidgetFromDraft({ ...blank, type: "kpi", compare: true })
        .settings,
      { metric: "count" }
    );
    assert.deepEqual(
      api.dashboardWidgetFromDraft({ ...blank, type: "note", text: "Hi" }),
      { type: "note", settings: { text: "Hi" } }
    );
    assert.deepEqual(
      api.dashboardDateColumns(KPI_COLUMNS).map((column) => column.id),
      ["dueDate"]
    );
    assert.deepEqual(
      api.dashboardCompareDayOptions("fr").map((option) => option.label),
      [
        "7 derniers jours",
        "30 derniers jours",
        "90 derniers jours",
        "365 derniers jours",
      ]
    );
  });
}

/** Shared by `bun test` (React sources) and Vitest (the synced Vue copy). */
export function dashboardModelSuite(test: Test, api: DashboardModelApi): void {
  layoutSuite(test, api);
  widgetSuite(test, api);
  filterSuite(test, api);
  versionSuite(test, api);
  fitSuite(test, api);
  kpiSuite(test, api);
  draftSuite(test, api);
}
