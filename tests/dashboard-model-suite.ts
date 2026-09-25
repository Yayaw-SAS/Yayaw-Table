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
  | "dashboardDatePresetOptions"
  | "dashboardDateRangeText"
  | "dashboardFilterRule"
  | "dashboardFilterValues"
  | "dashboardListNotice"
  | "dashboardNoticeText"
  | "dashboardOpenViewContext"
  | "dashboardScreenView"
  | "dashboardScreenViewId"
  | "dashboardTableInstanceId"
  | "dashboardTableViews"
  | "dashboardUnavailableText"
  | "dashboardVisibleSections"
  | "decodeDashboardFilterValue"
  | "encodeDashboardFilterValue"
  | "isDashboardFilterActive"
  | "isDashboardViewId"
  | "readDashboardFilterValues"
  | "resolveDashboardDateRange"
  | "resolveWidgetView"
  | "setDashboardViewerFilter"
  | "withDashboardFilterValues"
  | "withDashboardTableViews"
  | "withMutationSignal"
  | "writeDashboardFilterValues"
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
const LOCKED = /locked/;

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
      api.dashboardWidgetTitle(
        { id: "b", type: "block", block: "home.summary", settings: {} },
        { ...context, block: { label: { en: "Summary", fr: "Résumé" } } }
      ),
      "Résumé"
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
/** A screen: numbers in a grid, then a flow with a full-page table, another flow with a second one. */
const SCREEN_DOCUMENT = {
  version: 2,
  id: "cms",
  name: "Content",
  sections: [
    { id: "top", type: "flow", widgetIds: ["notes", "media-table"] },
    {
      id: "cards",
      type: "grid",
      layout: [{ widgetId: "count", x: 0, y: 0, w: 1, h: 1 }],
    },
    { id: "bottom", type: "flow", widgetIds: ["pages-table"] },
  ],
  widgets: [
    { id: "pages-table", type: "table", tableId: "pages", settings: {} },
    { id: "count", type: "kpi", tableId: "pages", settings: {} },
    { id: "notes", type: "note", settings: { text: "Hi" } },
    { id: "media-table", type: "table", tableId: "media", settings: {} },
  ],
  filters: [],
};

function screenSuite(test: Test, api: DashboardModelApi) {
  test("widgets resolve their inline, saved or default view", () => {
    const views = [
      { id: "board", name: "Board", config: { displayMode: "kanban" } },
    ];
    assert.deepEqual(
      api.resolveWidgetView({ view: { displayMode: "list" } }, undefined),
      { status: "ready", viewId: null, config: { displayMode: "list" } }
    );
    // Inline settings win over a saved view and need no views.
    assert.deepEqual(
      api.resolveWidgetView(
        { viewId: "board", view: { displayMode: "table" } },
        undefined
      ),
      { status: "ready", viewId: null, config: { displayMode: "table" } }
    );
    assert.deepEqual(api.resolveWidgetView({}, undefined), {
      status: "ready",
      viewId: null,
      config: {},
    });
    assert.deepEqual(api.resolveWidgetView({ viewId: "board" }, undefined), {
      status: "loading",
    });
    assert.deepEqual(api.resolveWidgetView({ viewId: "gone" }, views), {
      status: "missing",
    });
    assert.deepEqual(api.resolveWidgetView({ viewId: "board" }, views), {
      status: "ready",
      viewId: "board",
      view: views[0],
      config: { displayMode: "kanban" },
    });
    assert.deepEqual(
      api.dashboardOpenViewContext({ view: { displayMode: "list" } }),
      { view: { displayMode: "list" } }
    );
    assert.equal(api.dashboardOpenViewContext({}), undefined);
  });

  test("the screen's first table keeps the canonical URL keys, the others their widget id", () => {
    const screen = api.normalizeDashboard(SCREEN_DOCUMENT);
    // Display order: the top flow's table comes first, whatever the widgets' order.
    assert.equal(
      api.dashboardTableInstanceId(screen, "media-table"),
      undefined
    );
    assert.equal(
      api.dashboardTableInstanceId(screen, "pages-table"),
      "pages-table"
    );
  });

  test("a table widget's inline view becomes the screen's default view", async () => {
    const widget = {
      id: "pages",
      tableId: "pages",
      view: {
        displayMode: "table" as const,
        sorting: [{ id: "updatedAt", desc: true }],
      },
    };
    const view = api.dashboardScreenView("cms", widget, "Screen default");
    assert.deepEqual(view, {
      id: "screen:cms:pages",
      tableId: "pages",
      name: "Screen default",
      config: {
        displayMode: "table",
        sorting: [{ id: "updatedAt", desc: true }],
      },
      createdById: "screen",
      isSystem: true,
      isDefault: true,
      isGlobal: true,
      canEdit: false,
      canDelete: false,
    });
    assert.equal(api.dashboardScreenViewId("cms", "pages"), "screen:cms:pages");
    assert.equal(api.isDashboardViewId("screen:cms:pages"), true);
    assert.equal(api.isDashboardViewId("drafts"), false);
    assert.equal(api.isDashboardViewId(undefined), false);
    assert.equal(
      api.dashboardScreenView("cms", { id: "p", tableId: "pages" }, "x"),
      undefined
    );
    const saved = [{ id: "drafts", isDefault: true }, { id: "mine" }];
    const flags = (views: { id: string; isDefault?: boolean }[]) =>
      views.map((entry) => [entry.id, Boolean(entry.isDefault)]);
    // The screen's view comes first and is the only default: arrival shows
    // the reader's favorite, else it.
    assert.deepEqual(
      flags(api.dashboardTableViews(saved, { screenView: view })),
      [
        ["screen:cms:pages", true],
        ["drafts", false],
        ["mine", false],
      ]
    );
    assert.deepEqual(
      flags(api.dashboardTableViews(saved, { defaultViewId: "mine" })),
      [
        ["drafts", false],
        ["mine", true],
      ]
    );
    assert.deepEqual(flags(api.dashboardTableViews(saved, {})), [
      ["drafts", true],
      ["mine", false],
    ]);
    assert.equal(
      api.dashboardTableViews(saved, { defaultViewId: "drafts" })[0],
      saved[0]
    );
    // The host's views come back with the screen's default marked.
    const listed = api.withDashboardTableViews(
      {
        views: {
          list: () =>
            Promise.resolve({
              success: true,
              data: [{ id: "drafts", isDefault: true }, { id: "mine" }],
            }),
        },
      },
      "mine"
    );
    assert.deepEqual(await listed.views?.list?.(), {
      success: true,
      data: [
        { id: "drafts", isDefault: false },
        { id: "mine", isDefault: true },
      ],
    });
    const plain = api.withDashboardTableViews(
      { views: { list: () => [{ id: "a" }] } },
      "a"
    );
    assert.deepEqual(await plain.views?.list?.(), [
      { id: "a", isDefault: true },
    ]);
    const untouched = { views: { list: () => [] } };
    assert.equal(api.withDashboardTableViews(untouched, undefined), untouched);
  });

  test("a page table's changes signal the screen once each settles", async () => {
    let signals = 0;
    const path = () => [];
    const actions = api.withMutationSignal(
      {
        list: () => Promise.resolve({ data: [] }),
        create: (row: Record<string, unknown>) =>
          Promise.resolve({ success: true, data: row }),
        update: () => Promise.resolve({ success: true }),
        delete: () => Promise.reject(new Error("locked")),
        bulkDelete: () => ({ success: true }),
        import: {
          csv: true,
          importRows: () => Promise.resolve({ created: 2 }),
        },
        tree: { path, move: () => ({ moved: 1 }) },
      },
      () => {
        signals += 1;
      }
    );
    await actions.list();
    assert.equal(signals, 0);
    assert.deepEqual(await actions.create({ name: "A" }), {
      success: true,
      data: { name: "A" },
    });
    assert.equal(signals, 1);
    await actions.update();
    // A failed change may have changed something: the screen reloads too.
    await assert.rejects(actions.delete(), LOCKED);
    assert.equal(signals, 3);
    await actions.bulkDelete();
    await actions.import.importRows();
    await actions.tree.move();
    assert.equal(signals, 6);
    assert.equal(actions.import.csv, true);
    assert.equal(actions.tree.path, path);
  });

  test("readers see sections without the hidden widgets, grids closing their gaps", () => {
    const sections: Model.DashboardSection[] = [
      {
        id: "cards",
        type: "grid",
        layout: [
          item("a", 0, 0, 1, 1),
          item("b", 1, 0, 1, 1),
          item("c", 0, 1, 1, 1),
          item("d", 1, 1, 1, 2),
        ],
      },
      { id: "page", type: "flow", widgetIds: ["t", "n"] },
      { id: "gone", type: "flow", widgetIds: ["x"] },
      { id: "empty", type: "grid", layout: [] },
    ];
    const visible = api.dashboardVisibleSections(
      sections,
      new Set(["a", "x", "n"])
    );
    assert.deepEqual(
      visible.map((section) => section.id),
      ["cards", "page"]
    );
    const [cards, page] = visible;
    assert.deepEqual(places(cards?.type === "grid" ? cards.layout : []), {
      c: [0, 0, 1, 1],
      b: [1, 0, 1, 1],
      d: [1, 1, 1, 2],
    });
    assert.deepEqual(page?.type === "flow" ? page.widgetIds : [], ["t"]);
    // Nothing hidden: empty sections are left out, the others kept as they are.
    const all = api.dashboardVisibleSections(sections);
    assert.deepEqual(
      all.map((section) => section.id),
      ["cards", "page", "gone"]
    );
    assert.equal(all[0], sections[0]);
    // The document keeps every place.
    assert.equal(sections[0]?.type === "grid" && sections[0].layout.length, 4);
  });

  test("a list or aggregate answer's meta.notice is read, and shown instead of a number", async () => {
    assert.deepEqual(
      api.dashboardListNotice({
        data: [],
        meta: { notice: { code: "notConfigured", message: " Connect. " } },
      }),
      { code: "notConfigured", message: "Connect." }
    );
    assert.deepEqual(api.dashboardListNotice({ meta: { notice: "Soon" } }), {
      message: "Soon",
    });
    assert.equal(api.dashboardListNotice({ meta: { notice: {} } }), undefined);
    assert.equal(api.dashboardListNotice({ data: [] }), undefined);
    assert.equal(api.dashboardListNotice(null), undefined);
    const plan = api.dashboardKpiPlan(
      { filters: [] },
      { id: "views", type: "kpi", tableId: "analytics", settings: {} },
      "2026-03-15"
    );
    const notice = { code: "notConfigured", message: "Connect analytics." };
    const result = await api.loadDashboardKpi({
      plan,
      actions: {
        aggregate: () => Promise.resolve({ groups: [], meta: { notice } }),
        list: () => Promise.resolve({ data: [], meta: { notice } }),
      },
      params: {},
      locale: "en",
    });
    assert.deepEqual(result.notice, notice);
    assert.equal(api.dashboardNoticeText(notice, "fr"), "Connect analytics.");
    assert.equal(
      api.dashboardNoticeText({ code: "notConfigured" }, "en"),
      "This source is not configured yet."
    );
    assert.equal(
      api.dashboardNoticeText({ code: "custom" }, "fr"),
      "Rien à afficher pour l’instant."
    );
  });

  test("unavailable sources, unknown blocks and screen views have English and French labels", () => {
    assert.equal(
      api.dashboardUnavailableText("forbidden", undefined, "en"),
      "You don’t have access to this data."
    );
    assert.equal(
      api.dashboardUnavailableText("notConfigured", undefined, "fr"),
      "Cette source n’est pas encore configurée."
    );
    assert.equal(
      api.dashboardUnavailableText("notFound", undefined, "fr"),
      "Cette source n’existe plus."
    );
    // The host's message wins.
    assert.equal(
      api.dashboardUnavailableText("forbidden", "Ask Ada for access.", "fr"),
      "Ask Ada for access."
    );
    assert.equal(
      api.dashboardUnavailableText(undefined, undefined, "en"),
      "This source is not available."
    );
    assert.equal(api.dashboardLabel("unknownBlock", "en"), "Unavailable block");
    assert.equal(api.dashboardLabel("unknownBlock", "fr"), "Bloc indisponible");
    assert.equal(
      api.dashboardLabel("screenDefaultView", "en"),
      "Screen default"
    );
    assert.equal(
      api.dashboardLabel("screenDefaultView", "fr"),
      "Vue de l’écran"
    );
    assert.equal(api.dashboardLabel("typeTable", "fr"), "Table pleine page");
    assert.equal(api.dashboardLabel("refresh", "fr"), "Tout actualiser");
  });
}

const PRESET_TODAY = "2026-03-15";

function presetSuite(test: Test, api: DashboardModelApi) {
  test("relative date presets resolve around the reader's day", () => {
    const days = (preset: string, today = PRESET_TODAY) =>
      api.resolveDashboardDateRange({ preset }, today);
    assert.deepEqual(days("last7Days"), {
      start: "2026-03-09",
      end: "2026-03-15",
    });
    assert.deepEqual(days("last30Days"), {
      start: "2026-02-14",
      end: "2026-03-15",
    });
    assert.deepEqual(days("last90Days"), {
      start: "2025-12-16",
      end: "2026-03-15",
    });
    assert.deepEqual(days("thisMonth"), {
      start: "2026-03-01",
      end: "2026-03-31",
    });
    assert.deepEqual(days("lastMonth"), {
      start: "2026-02-01",
      end: "2026-02-28",
    });
    assert.deepEqual(days("thisYear"), {
      start: "2026-01-01",
      end: "2026-12-31",
    });
    assert.deepEqual(days("lastMonth", "2026-01-10"), {
      start: "2025-12-01",
      end: "2025-12-31",
    });
    assert.deepEqual(days("thisMonth", "2028-02-10"), {
      start: "2028-02-01",
      end: "2028-02-29",
    });
    // Days stay days; unknown presets give none.
    assert.deepEqual(
      api.resolveDashboardDateRange({ start: "2026-01-01" }, PRESET_TODAY),
      { start: "2026-01-01" }
    );
    assert.deepEqual(days("someday"), {});
  });

  test("presets filter, read and compare as the days they stand for", () => {
    const filter = {
      id: "period",
      type: "dateRange" as const,
      value: { preset: "last7Days" as const },
    };
    assert.equal(api.isDashboardFilterActive(filter), true);
    assert.deepEqual(
      api.dashboardFilterRule(filter, "updatedAt", PRESET_TODAY),
      {
        id: "dashboard-period",
        columnId: "updatedAt",
        isActive: true,
        type: "date",
        operator: "between",
        values: ["2026-03-09", "2026-03-15"],
      }
    );
    assert.equal(
      api.dashboardDateRangeText({ preset: "lastMonth" }, "en"),
      "Last month"
    );
    assert.equal(
      api.dashboardDateRangeText({ preset: "lastMonth" }, "fr"),
      "Le mois dernier"
    );
    assert.deepEqual(
      api.dashboardDatePresetOptions("fr").map((option) => option.label),
      [
        "7 derniers jours",
        "30 derniers jours",
        "90 derniers jours",
        "Ce mois-ci",
        "Le mois dernier",
        "Cette année",
      ]
    );
    assert.deepEqual(
      api.dashboardDatePresetOptions("en").map((option) => option.value),
      [
        "last7Days",
        "last30Days",
        "last90Days",
        "thisMonth",
        "lastMonth",
        "thisYear",
      ]
    );
    // A number compares the preset's month with the days just before.
    const plan = api.dashboardKpiPlan(
      {
        filters: [
          {
            id: "period",
            type: "dateRange",
            label: "Period",
            targets: [{ tableId: "projects", columnId: "due" }],
            value: { preset: "thisMonth" },
          },
        ],
      },
      {
        id: "revenue",
        type: "kpi",
        tableId: "projects",
        settings: { metric: "count", dateColumn: "due", compare: true },
      },
      PRESET_TODAY
    );
    assert.deepEqual(plan.periods, {
      current: { start: "2026-03-01", end: "2026-03-31" },
      previous: { start: "2026-01-29", end: "2026-02-28" },
    });
    // Documents keep a preset as their default; unknown presets are dropped.
    const document = api.validateDashboard({
      version: 2,
      id: "d",
      name: "D",
      sections: [],
      widgets: [],
      filters: [
        {
          id: "period",
          type: "dateRange",
          label: "Period",
          targets: [],
          value: { preset: "last30Days", start: "2026-01-01" },
        },
        {
          id: "old",
          type: "dateRange",
          label: "Old",
          targets: [],
          value: { preset: "someday" },
        },
      ],
    }).dashboard;
    assert.deepEqual(
      document?.filters.map((entry) => entry.value),
      [{ preset: "last30Days" }, undefined]
    );
  });
}

/** Filters of a screen: a period defaulting to the last 30 days, and a status. */
const VIEWER_DOCUMENT = {
  id: "cms",
  filters: [
    {
      id: "period",
      type: "dateRange" as const,
      label: "Period",
      targets: [{ tableId: "pages", columnId: "updatedAt" }],
      value: { preset: "last30Days" as const },
    },
    {
      id: "status",
      type: "select" as const,
      label: "Status",
      targets: [{ tableId: "pages", columnId: "status" }],
    },
  ],
};

function viewerSuite(test: Test, api: DashboardModelApi) {
  test("the values readers pick go to the URL, one key per filter", () => {
    const range = { type: "dateRange" as const };
    const select = { type: "select" as const };
    assert.deepEqual(
      api.encodeDashboardFilterValue(range, { preset: "last7Days" }),
      ["last7Days"]
    );
    assert.deepEqual(
      api.encodeDashboardFilterValue(range, {
        start: "2026-03-01",
        end: "2026-03-31",
      }),
      ["2026-03-01..2026-03-31"]
    );
    assert.deepEqual(
      api.encodeDashboardFilterValue(range, { start: "2026-03-01" }),
      ["2026-03-01.."]
    );
    assert.deepEqual(api.encodeDashboardFilterValue(range, {}), [""]);
    assert.deepEqual(api.encodeDashboardFilterValue(select, ["a", "b,c"]), [
      "a",
      "b,c",
    ]);
    assert.deepEqual(api.encodeDashboardFilterValue(select, []), [""]);
    assert.deepEqual(api.decodeDashboardFilterValue(range, ["..2026-03-31"]), {
      end: "2026-03-31",
    });
    assert.deepEqual(api.decodeDashboardFilterValue(range, ["last90Days"]), {
      preset: "last90Days",
    });
    assert.equal(api.decodeDashboardFilterValue(range, [""]), null);
    assert.equal(api.decodeDashboardFilterValue(range, ["nonsense"]), null);
    assert.deepEqual(api.decodeDashboardFilterValue(select, ["a", "", "a"]), [
      "a",
    ]);
    assert.equal(api.decodeDashboardFilterValue(select, [""]), null);
    assert.deepEqual(
      api.readDashboardFilterValues(
        VIEWER_DOCUMENT,
        "?cms.period=2026-03-01..2026-03-31&cms.status=a&cms.status=b%2Cc&pages-page=2&other.status=x"
      ),
      {
        period: { start: "2026-03-01", end: "2026-03-31" },
        status: ["a", "b,c"],
      }
    );
    assert.deepEqual(
      api.readDashboardFilterValues(VIEWER_DOCUMENT, "?cms.period="),
      { period: null }
    );
    // The table's keys and other dashboards' stay.
    assert.equal(
      api.writeDashboardFilterValues(
        VIEWER_DOCUMENT,
        "pages-page=2&cms.status=old&other.status=x",
        { period: null, status: ["x"] }
      ),
      "pages-page=2&other.status=x&cms.period=&cms.status=x"
    );
    assert.equal(
      api.writeDashboardFilterValues(VIEWER_DOCUMENT, "cms.status=old", {}),
      ""
    );
  });

  test("readers' values replace the defaults for widgets, never in the document", () => {
    const set = (
      values: Model.DashboardViewerFilters,
      filterId: string,
      value: Model.DashboardFilterValue | null | undefined
    ) => api.setDashboardViewerFilter(VIEWER_DOCUMENT, values, filterId, value);
    // The default is no reader's value; clearing a default is one.
    assert.deepEqual(set({}, "period", { preset: "last30Days" }), {});
    assert.deepEqual(set({}, "period", undefined), { period: null });
    assert.deepEqual(set({}, "status", undefined), {});
    assert.deepEqual(set({ period: null }, "status", ["a"]), {
      period: null,
      status: ["a"],
    });
    assert.deepEqual(set({ status: ["a"] }, "status", []), {});
    assert.deepEqual(set({}, "unknown", ["a"]), {});
    const shown = api.withDashboardFilterValues(VIEWER_DOCUMENT, {
      period: null,
      status: ["a"],
    });
    assert.deepEqual(
      shown.filters.map((filter) => filter.value),
      [undefined, ["a"]]
    );
    assert.deepEqual(VIEWER_DOCUMENT.filters[0]?.value, {
      preset: "last30Days",
    });
    assert.equal(
      api.withDashboardFilterValues(VIEWER_DOCUMENT, {}),
      VIEWER_DOCUMENT
    );
    // Blocks read each filter's current value, presets resolved.
    assert.deepEqual(
      api.dashboardFilterValues(
        api.withDashboardFilterValues(VIEWER_DOCUMENT, { status: ["a"] }),
        PRESET_TODAY
      ),
      {
        period: {
          start: "2026-02-14",
          end: "2026-03-15",
          preset: "last30Days",
        },
        status: ["a"],
      }
    );
    assert.deepEqual(api.dashboardFilterValues(shown, PRESET_TODAY), {
      period: undefined,
      status: ["a"],
    });
  });
}

export function dashboardModelSuite(test: Test, api: DashboardModelApi): void {
  layoutSuite(test, api);
  widgetSuite(test, api);
  filterSuite(test, api);
  versionSuite(test, api);
  fitSuite(test, api);
  kpiSuite(test, api);
  draftSuite(test, api);
  screenSuite(test, api);
  presetSuite(test, api);
  viewerSuite(test, api);
}
