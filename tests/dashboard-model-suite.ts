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
  | "dashboardFilterRules"
  | "dashboardFilterTargetsLabel"
  | "dashboardLabel"
  | "dashboardTranslate"
  | "dashboardWidgetTitle"
  | "findFreeSpot"
  | "kpiViewConfig"
  | "loadDashboardViews"
  | "mergeDashboardFilters"
  | "moveLayoutItem"
  | "normalizeDashboard"
  | "normalizeLayout"
  | "removeDashboardWidget"
  | "resizeLayoutItem"
  | "resolveLayout"
  | "setDashboardFilterValue"
  | "stackLayout"
  | "validateDashboard"
  | "widgetFilterSignature"
  | "withDashboardFilters"
>;
type Test = (name: string, run: () => void | Promise<void>) => void;
type Layout = Model.DashboardLayoutItem[];
const UNSUPPORTED_VERSION = /version 2 is not supported/;

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

  test("grid changes are normalized and unchanged layouts keep the dashboard", () => {
    const dashboard = api.normalizeDashboard(DASHBOARD);
    assert.equal(api.applyGridLayout(dashboard, dashboard.layout), dashboard);
    const moved = api.applyGridLayout(dashboard, [
      item("note", 0, 0, 1, 1),
      item("count", 1, 0, 1, 1),
    ]);
    assert.notEqual(moved, dashboard);
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
      added.layout.find((entry) => entry.widgetId === "widget-5"),
      item("widget-5", 2, 3, 1, 1)
    );
    const removed = api.removeDashboardWidget(added, "chart");
    assert.equal(
      removed.widgets.some((entry) => entry.id === "chart"),
      false
    );
    assert.equal(
      removed.layout.some((entry) => entry.widgetId === "chart"),
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
    assert.equal(dashboard?.version, 1);
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
        "invalidLayout",
        "invalidFilter",
      ]
    );
    // A valid dashboard round-trips without issues.
    const normalized = api.normalizeDashboard(DASHBOARD);
    assert.deepEqual(api.validateDashboard(normalized), {
      dashboard: normalized,
      issues: [],
    });
  });

  test("dashboards without a version are migrated and newer ones refused", () => {
    const legacy = api.normalizeDashboard({
      id: "old",
      name: "Old",
      widgets: [{ id: "n", type: "note", settings: { text: "Hi" } }],
      layout: [{ i: "n", x: 1, y: 0, w: 2, h: 2 }],
    });
    assert.equal(legacy.version, 1);
    assert.deepEqual(legacy.layout, [item("n", 1, 0, 2, 2)]);
    assert.deepEqual(legacy.filters, []);
    assert.throws(
      () => api.normalizeDashboard({ ...DASHBOARD, version: 2 }),
      UNSUPPORTED_VERSION
    );
    assert.throws(() => api.normalizeDashboard({ name: "No id" }));
    assert.equal(api.validateDashboard("nope").dashboard, undefined);
  });
}

/** Shared by `bun test` (React sources) and Vitest (the synced Vue copy). */
export function dashboardModelSuite(test: Test, api: DashboardModelApi): void {
  layoutSuite(test, api);
  widgetSuite(test, api);
  filterSuite(test, api);
  versionSuite(test, api);
}
