import assert from "node:assert/strict";
import type * as Chart from "../src/components/ui/yayaw-table/utils/chart-model";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";

type ChartApi = Pick<
  typeof Chart,
  | "aggregateChartRows"
  | "buildChartModel"
  | "canAddChartFilters"
  | "chartAggregateParams"
  | "chartAggregateRequest"
  | "chartBucketKey"
  | "chartBucketLabel"
  | "chartBucketRange"
  | "chartGroupFilters"
  | "chartLabel"
  | "chartSettingFields"
  | "chartValueTicks"
  | "loadChartData"
  | "nextChartBucketKey"
  | "normalizeChartAggregateResult"
  | "normalizeChartViewConfig"
  | "resolveChartSettings"
  | "withChartFilters"
>;
type ModesApi = Pick<
  typeof Modes,
  | "modeDefaultsOf"
  | "normalizeModeConfig"
  | "resolveDisplayModes"
  | "withoutDisabledModeRenderers"
>;
type Test = (name: string, run: () => void | Promise<void>) => void;

const COLUMNS = [
  { id: "select", type: "text", header: "" },
  { id: "name", type: "text", header: "Name" },
  {
    id: "category",
    type: "select",
    header: "Category",
    options: [
      { value: "Software", label: "Software" },
      { value: "Hardware", label: "Hardware" },
      { value: "Service", label: "Service", color: "#ff0000" },
      { value: "Other", label: "Other" },
    ],
    coloredTags: false,
  },
  {
    id: "tags",
    type: "multiSelect",
    header: "Tags",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  {
    id: "price",
    type: "number",
    header: "Price",
    numberFormat: { currency: "EUR", locale: "en-US" },
  },
  { id: "done", type: "boolean", header: "Done" },
  { id: "due", type: "date", header: "Due" },
  { id: "at", type: "date", header: "At", timeZone: "Europe/Paris" },
];
const ROWS = [
  {
    id: "1",
    name: "A",
    category: "Software",
    price: 49,
    due: "2026-09-02",
    tags: ["a", "b"],
    done: true,
  },
  {
    id: "2",
    name: "B",
    category: "Service",
    price: 120,
    due: "2026-09-05",
    tags: ["a"],
    done: false,
  },
  {
    id: "3",
    name: "C",
    category: "Hardware",
    price: 399,
    due: "2026-09-09",
    tags: [],
    done: true,
  },
  {
    id: "4",
    name: "D",
    category: "Service",
    price: 99,
    due: "2026-11-12",
    tags: ["b"],
    done: false,
  },
  {
    id: "5",
    name: "E",
    category: "Hardware",
    price: 79,
    due: "2026-11-15",
    tags: ["a"],
    done: false,
  },
  {
    id: "6",
    name: "F",
    category: "Software",
    price: 15,
    due: "",
    tags: ["a"],
    done: true,
  },
];
const PALETTE = ["c1", "c2", "c3", "c4", "c5"];

export function chartModelSuite(test: Test, chart: ChartApi, modes: ModesApi) {
  const settings = (view: Chart.ChartViewSettings = {}) =>
    chart.resolveChartSettings(COLUMNS, undefined, view);
  const model = (view: Chart.ChartViewSettings, rows = ROWS) => {
    const resolved = settings(view);
    const request = chart.chartAggregateRequest(resolved, COLUMNS);
    if (!request) {
      throw new Error("The chart has no x axis.");
    }
    return chart.buildChartModel({
      result: chart.aggregateChartRows(rows, request),
      settings: resolved,
      columns: COLUMNS,
      locale: "en-US",
      palette: PALETTE,
      otherColor: "grey",
    });
  };
  const totals = (built: Chart.ChartModel) =>
    built.categories.map((category) => [category.label, category.total]);

  test("keeps only valid chart settings", () => {
    assert.deepEqual(
      chart.normalizeChartViewConfig({
        type: "donut",
        xColumn: " category ",
        bucket: "fortnight",
        metric: "sum",
        metricColumn: "price",
        topN: "5",
        weekStartsOn: 0,
        showLegend: "yes",
        cumulative: true,
        colors: "palette",
      }),
      {
        type: "donut",
        xColumn: "category",
        metric: "sum",
        metricColumn: "price",
        topN: 5,
        weekStartsOn: 0,
        cumulative: true,
        colors: "palette",
      }
    );
    assert.equal(
      chart.normalizeChartViewConfig({ topN: 0, type: "pie" }),
      undefined
    );
    assert.equal(chart.normalizeChartViewConfig([]), undefined);
    assert.deepEqual(modes.normalizeModeConfig("chart", { type: "line" }), {
      type: "line",
    });
  });

  test("chooses an option column and a count by default", () => {
    const resolved = settings();
    assert.equal(resolved.type, "bar");
    assert.equal(resolved.xColumn, "category");
    assert.equal(resolved.metric, "count");
    // A sum needs a number column; without one the chart counts records.
    assert.equal(
      settings({ metric: "sum", metricColumn: "name" }).metric,
      "count"
    );
    assert.equal(
      settings({ seriesColumn: "category" }).seriesColumn,
      undefined
    );
    assert.equal(
      settings({ type: "donut", seriesColumn: "done" }).seriesColumn,
      undefined
    );
  });

  test("asks the server for groups and metrics with the query", () => {
    const request = chart.chartAggregateRequest(
      settings({
        xColumn: "at",
        bucket: "week",
        seriesColumn: "category",
        metric: "avg",
        metricColumn: "price",
      }),
      COLUMNS
    );
    assert.deepEqual(request, {
      groupBy: [{ columnId: "at", bucket: "week" }, { columnId: "category" }],
      metrics: [{ columnId: "price", fn: "avg" }],
      weekStartsOn: 1,
      timeZone: "Europe/Paris",
    });
    assert.ok(request);
    const params = chart.chartAggregateParams(
      {
        search: "alpha",
        filters: { status: "Active" },
        advancedFilters: {
          filters: [
            { columnId: "price", operator: "greaterThan", values: [10] },
            {
              columnId: "name",
              operator: "contains",
              values: ["x"],
              isActive: false,
            },
          ],
          joinOperator: "and",
        },
      },
      request,
      "fr-FR"
    );
    assert.equal(params.search, "alpha");
    assert.deepEqual(params.filters, { status: "Active" });
    assert.equal((params.advancedFilters as unknown[]).length, 1);
    assert.equal(params.advancedFilterJoin, "and");
    assert.deepEqual(params.calculations, {});
    assert.equal(params.locale, "fr-FR");
    assert.deepEqual(params.groupBy, request.groupBy);
    assert.deepEqual(
      chart.chartAggregateRequest(settings({ type: "number" }), COLUMNS)
        ?.groupBy,
      []
    );
  });

  test("buckets dates by day, week, month, quarter and year", () => {
    assert.equal(chart.chartBucketKey("2026-09-02", "day"), "2026-09-02");
    assert.equal(chart.chartBucketKey("2026-09-02", "month"), "2026-09");
    assert.equal(chart.chartBucketKey("2026-09-02", "quarter"), "2026-Q3");
    assert.equal(chart.chartBucketKey("2026-02-01", "quarter"), "2026-Q1");
    assert.equal(chart.chartBucketKey("2026-09-02", "year"), "2026");
    // Wednesday 2 September 2026: Monday weeks start on 31 August, Sunday weeks on 30.
    assert.equal(chart.chartBucketKey("2026-09-02", "week"), "2026-08-31");
    assert.equal(
      chart.chartBucketKey("2026-09-02", "week", { weekStartsOn: 0 }),
      "2026-08-30"
    );
    assert.equal(
      chart.chartBucketKey("2026-09-02", "week", { weekStartsOn: 6 }),
      "2026-08-29"
    );
    // Weeks across a year boundary.
    assert.equal(chart.chartBucketKey("2027-01-01", "week"), "2026-12-28");
    assert.equal(chart.chartBucketKey("", "month"), null);
    assert.equal(chart.chartBucketKey("not a date", "month"), null);
  });

  test("buckets instants in the table's time zone, across DST changes", () => {
    const paris = { timeZone: "Europe/Paris" };
    // 23:30 UTC on 28 March is 00:30 on 29 March in Paris (CET, the night DST starts).
    assert.equal(
      chart.chartBucketKey("2026-03-28T23:30:00Z", "day", paris),
      "2026-03-29"
    );
    assert.equal(
      chart.chartBucketKey("2026-03-28T23:30:00Z", "day", { timeZone: "UTC" }),
      "2026-03-28"
    );
    // Summer time: 22:30 UTC on 29 March is 00:30 on 30 March in Paris (CEST).
    assert.equal(
      chart.chartBucketKey("2026-03-29T22:30:00Z", "day", paris),
      "2026-03-30"
    );
    // After DST ends: 22:30 UTC on 25 October is 23:30 the same day in Paris.
    assert.equal(
      chart.chartBucketKey("2026-10-25T22:30:00Z", "day", paris),
      "2026-10-25"
    );
    assert.equal(
      chart.chartBucketKey("2026-09-30T22:30:00Z", "month", paris),
      "2026-10"
    );
    assert.equal(
      chart.chartBucketKey("2026-12-31T23:30:00Z", "year", paris),
      "2027"
    );
    // Date-only values are calendar days whatever the zone.
    assert.equal(
      chart.chartBucketKey("2026-03-29", "day", {
        timeZone: "Pacific/Auckland",
      }),
      "2026-03-29"
    );
  });

  test("walks and bounds buckets", () => {
    assert.equal(chart.nextChartBucketKey("2026-12", "month"), "2027-01");
    assert.equal(chart.nextChartBucketKey("2026-Q4", "quarter"), "2027-Q1");
    assert.equal(chart.nextChartBucketKey("2026-08-31", "week"), "2026-09-07");
    assert.equal(chart.nextChartBucketKey("2026-10-24", "day"), "2026-10-25");
    assert.equal(chart.nextChartBucketKey("2026-10-25", "day"), "2026-10-26");
    assert.deepEqual(chart.chartBucketRange("2026-02", "month"), [
      "2026-02-01",
      "2026-02-28",
    ]);
    assert.deepEqual(chart.chartBucketRange("2028-02", "month"), [
      "2028-02-01",
      "2028-02-29",
    ]);
    assert.deepEqual(chart.chartBucketRange("2026-Q3", "quarter"), [
      "2026-07-01",
      "2026-09-30",
    ]);
    assert.deepEqual(chart.chartBucketRange("2026-08-31", "week"), [
      "2026-08-31",
      "2026-09-06",
    ]);
    assert.deepEqual(chart.chartBucketRange("2026", "year"), [
      "2026-01-01",
      "2026-12-31",
    ]);
    assert.equal(chart.chartBucketRange("nope", "month"), undefined);
  });

  test("number groups read in the column's format, also as server text", () => {
    const built = chart.buildChartModel({
      // Hosts may answer SQL decimals as strings.
      result: {
        groups: [
          { keys: ["49"], values: [1] },
          { keys: [120], values: [2] },
        ],
      },
      settings: settings({ type: "bar", xColumn: "price" }),
      columns: COLUMNS,
      locale: "en-US",
      palette: PALETTE,
      otherColor: "grey",
    });
    assert.deepEqual(
      built.categories.map((category) => category.label),
      ["€49.00", "€120.00"]
    );
    // Counts stay plain whole numbers; sums keep the column's currency.
    assert.equal(built.format(1234), "1,234");
    const sums = model({ type: "bar", metric: "sum", metricColumn: "price" });
    assert.equal(sums.format(1234.5), "€1,234.50");
  });

  test("labels buckets in the viewer's language", () => {
    assert.equal(
      chart.chartBucketLabel("2026-09", "month", "en-US"),
      "Sep 2026"
    );
    assert.equal(
      chart.chartBucketLabel("2026-Q3", "quarter", "en-US"),
      "Q3 2026"
    );
    assert.equal(
      chart.chartBucketLabel("2026-Q3", "quarter", "fr-FR"),
      "T3 2026"
    );
    assert.equal(
      chart.chartBucketLabel("2026-08-31", "week", "en-US"),
      "Week of Aug 31, 2026"
    );
    assert.equal(chart.chartBucketLabel("2026", "year", "en-US"), "2026");
    // Days and weeks read in the date column's format, without its time.
    const due = {
      id: "due",
      type: "date",
      dateFormat: "dd/MM/yyyy HH:mm",
      timeZone: "Europe/Paris",
    };
    assert.equal(
      chart.chartBucketLabel("2026-09-06", "day", "en-US", undefined, due),
      "06/09/2026"
    );
    assert.equal(
      chart.chartBucketLabel("2026-08-31", "week", "fr-FR", undefined, due),
      "Semaine du 31/08/2026"
    );
    assert.equal(
      chart.chartBucketLabel("2026-09-06", "day", "en-US", undefined, {
        id: "due",
        type: "date",
        dateDisplayPreset: "dateTime",
      }),
      "Sep 6, 2026"
    );
    assert.equal(
      chart.chartBucketLabel("2026-09", "month", "en-US", undefined, due),
      "Sep 2026"
    );
    assert.equal(chart.chartLabel("other", "fr"), "Autres");
    assert.equal(
      chart.chartLabel(
        "top",
        "en",
        (key, fallback) => (key === "top" ? "Best {count}" : fallback),
        { count: 3 }
      ),
      "Best 3"
    );
  });

  test("computes every metric per group", () => {
    const request = (fn: Chart.ChartMetricFn, columnId?: string) => ({
      groupBy: [{ columnId: "category" }],
      metrics: [columnId ? { fn, columnId } : { fn }],
      weekStartsOn: 1,
    });
    const byKey = (result: Chart.ChartAggregateResult) =>
      Object.fromEntries(
        result.groups.map((group) => [String(group.keys[0]), group.values[0]])
      );
    assert.deepEqual(byKey(chart.aggregateChartRows(ROWS, request("count"))), {
      Software: 2,
      Service: 2,
      Hardware: 2,
    });
    assert.deepEqual(
      byKey(chart.aggregateChartRows(ROWS, request("sum", "price"))),
      {
        Software: 64,
        Service: 219,
        Hardware: 478,
      }
    );
    assert.deepEqual(
      byKey(chart.aggregateChartRows(ROWS, request("avg", "price"))),
      {
        Software: 32,
        Service: 109.5,
        Hardware: 239,
      }
    );
    assert.deepEqual(
      byKey(chart.aggregateChartRows(ROWS, request("min", "price"))),
      {
        Software: 15,
        Service: 99,
        Hardware: 79,
      }
    );
    assert.deepEqual(
      byKey(chart.aggregateChartRows(ROWS, request("max", "price"))),
      {
        Software: 49,
        Service: 120,
        Hardware: 399,
      }
    );
    assert.deepEqual(
      byKey(chart.aggregateChartRows(ROWS, request("countDistinct", "tags"))),
      {
        Software: 2,
        Service: 2,
        Hardware: 1,
      }
    );
    // One total without grouping, also over no rows.
    assert.deepEqual(
      chart.aggregateChartRows([], {
        groupBy: [],
        metrics: [{ fn: "sum", columnId: "price" }],
        weekStartsOn: 1,
      }),
      { groups: [{ keys: [], values: [0] }] }
    );
  });

  test("multi-select values count in each of their groups; empty values group as null", () => {
    const result = chart.aggregateChartRows(ROWS, {
      groupBy: [{ columnId: "tags" }],
      metrics: [{ fn: "count" }],
      weekStartsOn: 1,
    });
    const byKey = Object.fromEntries(
      result.groups.map((group) => [String(group.keys[0]), group.values[0]])
    );
    assert.deepEqual(byKey, { a: 4, b: 2, null: 1 });
  });

  test("groups by series and stacks them in option order", () => {
    const built = model({ xColumn: "done", seriesColumn: "category" });
    assert.deepEqual(
      built.series.map((item) => item.label),
      ["Software", "Hardware", "Service"]
    );
    assert.deepEqual(
      built.categories.map((category) => [category.label, category.values]),
      [
        [
          "Checked",
          { "string:Software": 2, "string:Hardware": 1, "string:Service": 0 },
        ],
        [
          "Unchecked",
          { "string:Software": 0, "string:Hardware": 1, "string:Service": 2 },
        ],
      ]
    );
    assert.equal(built.single, false);
    assert.equal(built.total, 6);
  });

  test("sorts by option order, label or value", () => {
    assert.deepEqual(totals(model({})), [
      ["Software", 2],
      ["Hardware", 2],
      ["Service", 2],
      ["Other", 0],
    ]);
    assert.deepEqual(
      totals(
        model({ metric: "sum", metricColumn: "price", sort: "valueDesc" })
      ).map(([label]) => label),
      ["Hardware", "Service", "Software", "Other"]
    );
    assert.deepEqual(
      totals(
        model({ metric: "sum", metricColumn: "price", sort: "valueAsc" })
      ).map(([label]) => label),
      ["Other", "Software", "Service", "Hardware"]
    );
    assert.deepEqual(
      totals(model({ sort: "keyDesc" })).map(([label]) => label),
      ["Software", "Service", "Other", "Hardware"]
    );
  });

  test("fills empty date buckets and the no-value group unless empty groups are hidden", () => {
    const monthly = model({ xColumn: "due", type: "line" });
    assert.deepEqual(totals(monthly), [
      ["Sep 2026", 3],
      ["Oct 2026", 0],
      ["Nov 2026", 2],
      ["No value", 1],
    ]);
    assert.deepEqual(
      totals(model({ xColumn: "due", type: "line", hideEmpty: true })),
      [
        ["Sep 2026", 3],
        ["Nov 2026", 2],
      ]
    );
    assert.deepEqual(
      totals(model({ hideEmpty: true })).map(([label]) => label),
      ["Software", "Hardware", "Service"]
    );
  });

  test("adds up values along the axis when cumulative", () => {
    const built = model({
      xColumn: "due",
      type: "line",
      cumulative: true,
      hideEmpty: true,
    });
    assert.deepEqual(totals(built), [
      ["Sep 2026", 3],
      ["Nov 2026", 5],
    ]);
    // Donuts never cumulate.
    assert.deepEqual(
      totals(model({ type: "donut", cumulative: true, hideEmpty: true })).map(
        ([, total]) => total
      ),
      [2, 2, 2]
    );
  });

  test("keeps the top groups and folds the rest into Other for additive metrics", () => {
    const top = model({
      metric: "sum",
      metricColumn: "price",
      sort: "valueDesc",
      topN: 2,
    });
    assert.deepEqual(totals(top), [
      ["Hardware", 478],
      ["Service", 219],
      ["Other", 64],
    ]);
    assert.equal(top.categories.at(-1)?.other, true);
    const averages = model({
      metric: "avg",
      metricColumn: "price",
      sort: "valueDesc",
      topN: 2,
    });
    assert.deepEqual(
      totals(averages).map(([label]) => label),
      ["Hardware", "Service"]
    );
  });

  test("formats values with the metric column's number format", () => {
    const built = model({ metric: "sum", metricColumn: "price" });
    assert.equal(built.format(478), "€478.00");
    assert.equal(built.valueLabel, "Sum of Price");
    assert.equal(built.title, "Sum of Price by Category");
    assert.equal(model({}).format(1234), "1,234");
    const number = model({
      type: "number",
      metric: "avg",
      metricColumn: "price",
    });
    assert.equal(number.total, 761 / 6);
    assert.equal(number.categories.length, 0);
  });

  test("colors groups with option colors or the palette", () => {
    const options = model({ type: "donut", hideEmpty: true });
    // Colored tags are off for the column: explicit option colors only, else the palette.
    assert.deepEqual(
      options.categories.map((category) => category.color),
      ["c1", "c2", "#ff0000"]
    );
    const palette = model({
      type: "donut",
      hideEmpty: true,
      colors: "palette",
    });
    assert.deepEqual(
      palette.categories.map((category) => category.color),
      ["c1", "c2", "c3"]
    );
    // Bars without series and option colors share the first palette color.
    const bars = model({ xColumn: "due", hideEmpty: true });
    assert.deepEqual(
      [...new Set(bars.categories.map((category) => category.color))],
      ["c1"]
    );
  });

  test("turns a clicked group into filter rules", () => {
    const monthly = settings({ xColumn: "due", seriesColumn: "category" });
    const built = model({ xColumn: "due", seriesColumn: "category" });
    const september = built.categories.at(0);
    const service = built.series.find((item) => item.key === "Service");
    assert.deepEqual(
      chart
        .chartGroupFilters(monthly, COLUMNS, {
          category: september,
          series: service,
        })
        ?.map(({ columnId, operator, values, type }) => ({
          columnId,
          operator,
          values,
          type,
        })),
      [
        {
          columnId: "due",
          operator: "between",
          values: ["2026-09-01", "2026-09-30"],
          type: "date",
        },
        {
          columnId: "category",
          operator: "isAnyOf",
          values: ["Service"],
          type: "select",
        },
      ]
    );
    const empty = built.categories.find((category) => category.key === null);
    assert.equal(
      chart.chartGroupFilters(monthly, COLUMNS, { category: empty })?.at(0)
        ?.operator,
      "isEmpty"
    );
    const done = settings({ xColumn: "done" });
    assert.equal(
      chart
        .chartGroupFilters(done, COLUMNS, {
          category: {
            id: "x",
            key: false,
            label: "",
            color: "",
            total: 1,
            values: {},
          },
        })
        ?.at(0)?.operator,
      "isFalse"
    );
    const top = model({ topN: 1 });
    assert.equal(
      chart.chartGroupFilters(settings({ topN: 1 }), COLUMNS, {
        category: top.categories.at(-1),
      }),
      undefined
    );
  });

  test("adds group rules to the view's filters unless they match any rule", () => {
    const rule = {
      id: "chart-category-0",
      columnId: "category",
      type: "select",
      operator: "isAnyOf",
      values: ["Service"],
      isActive: true as const,
    };
    assert.equal(chart.canAddChartFilters(undefined), true);
    const or = {
      filters: [
        { columnId: "a", operator: "isEmpty" },
        { columnId: "b", operator: "isEmpty" },
      ],
      joinOperator: "or",
    };
    assert.equal(chart.canAddChartFilters(or), false);
    assert.equal(
      chart.canAddChartFilters({ ...or, filters: or.filters.slice(0, 1) }),
      true
    );
    const merged = chart.withChartFilters(
      [{ id: "x", columnId: "price", operator: "greaterThan", values: [10] }],
      [rule],
      "1"
    );
    assert.equal(merged.joinOperator, "and");
    assert.deepEqual(
      merged.filters.map((filter) => filter.id),
      ["x", "chart-category-0-1"]
    );
  });

  test("reads host answers and falls back to loaded rows with the same groups", async () => {
    assert.equal(
      chart.normalizeChartAggregateResult({ results: {} }),
      undefined
    );
    assert.deepEqual(
      chart.normalizeChartAggregateResult({
        groups: [{ keys: ["a", undefined], values: ["2"] }, { keys: "bad" }],
        truncated: true,
      }),
      { groups: [{ keys: ["a", null], values: [2] }], truncated: true }
    );
    const request = chart.chartAggregateRequest(
      settings({
        xColumn: "due",
        seriesColumn: "category",
        metric: "sum",
        metricColumn: "price",
      }),
      COLUMNS
    );
    assert.ok(request);
    const pages: number[] = [];
    const list = (params: Record<string, unknown>) => {
      pages.push(Number(params.page));
      const size = Number(params.pageSize);
      const start = (Number(params.page) - 1) * size;
      return Promise.resolve({
        data: ROWS.slice(start, start + size),
        meta: { totalCount: ROWS.length },
      });
    };
    let received: Record<string, unknown> = {};
    const server = await chart.loadChartData({
      aggregate: (params) => {
        received = params;
        return { groups: chart.aggregateChartRows(ROWS, request).groups };
      },
      list,
      params: { search: "" },
      request,
      locale: "en-US",
    });
    assert.equal(server.source, "server");
    assert.deepEqual(received.groupBy, request.groupBy);
    assert.equal(pages.length, 0);
    // A host that answers only column calculations is aggregated here instead.
    const fallback = await chart.loadChartData({
      aggregate: () => ({ results: {} }),
      list,
      params: {},
      request,
      locale: "en-US",
    });
    assert.equal(fallback.source, "client");
    assert.deepEqual(fallback.groups, server.groups);
    const local = await chart.loadChartData({
      rows: ROWS,
      params: {},
      request,
      locale: "en-US",
      maxRows: 4,
    });
    assert.equal(local.truncated, true);
  });

  test("the Chart mode needs its renderer and can be turned off", () => {
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "chart"], { renderers: [] }),
      ["table"]
    );
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "chart"], { renderers: ["chart"] }),
      ["table", "chart"]
    );
    const renderers = { chart: 1, calendar: 2, form: 3 };
    assert.deepEqual(
      modes.withoutDisabledModeRenderers(renderers, {
        chart: false,
        form: false,
      }),
      { calendar: 2, form: 3 }
    );
    assert.equal(
      modes.withoutDisabledModeRenderers(renderers, {
        chart: { type: "line" },
      }),
      renderers
    );
    assert.deepEqual(modes.modeDefaultsOf({ chart: true }, "chart"), {});
    assert.deepEqual(
      modes.modeDefaultsOf({ chart: { type: "line" } }, "chart"),
      { type: "line" }
    );
  });

  test("value axes use round ticks, whole numbers for counts", () => {
    assert.deepEqual(chart.chartValueTicks([478, 219, 64]), [0, 200, 400, 600]);
    assert.deepEqual(chart.chartValueTicks([2, 1], true), [0, 1, 2]);
    assert.deepEqual(
      chart.chartValueTicks([0.35, 0.1]),
      [0, 0.1, 0.2, 0.3, 0.4]
    );
    assert.deepEqual(
      chart.chartValueTicks([-30, 45]),
      [-40, -20, 0, 20, 40, 60]
    );
    assert.deepEqual(chart.chartValueTicks([]), [0, 0.5, 1]);
    // Stacked bars fit their totals, other charts each value.
    assert.equal(model({ seriesColumn: "done" }).valueTicks.at(-1), 2);
  });

  test("settings offer the fields of the chart type and pick a column for a metric", () => {
    let saved: Record<string, unknown> = {};
    const fields = (view: Chart.ChartViewSettings) =>
      chart.chartSettingFields({
        columns: COLUMNS,
        view,
        locale: "en-US",
        update: (next) => {
          saved = next;
        },
      });
    assert.deepEqual(
      fields({}).map((field) => field.id),
      [
        "type",
        "xColumn",
        "metric",
        "seriesColumn",
        "sort",
        "cumulative",
        "hideEmpty",
        "topN",
        "showDataLabels",
        "showLegend",
        "colors",
      ]
    );
    assert.deepEqual(
      fields({ xColumn: "due", bucket: "week" })
        .map((field) => field.id)
        .slice(0, 4),
      ["type", "xColumn", "bucket", "weekStartsOn"]
    );
    assert.deepEqual(
      fields({ type: "number" }).map((field) => field.id),
      ["type", "metric"]
    );
    fields({ xColumn: "due" })
      .find((field) => field.id === "metric")
      ?.onChange("sum");
    assert.deepEqual(saved, {
      xColumn: "due",
      metric: "sum",
      metricColumn: "price",
    });
    fields({ metric: "sum", metricColumn: "price" })
      .find((field) => field.id === "metric")
      ?.onChange("count");
    assert.deepEqual(saved, { metric: "count" });
    fields({ sort: "valueDesc" })
      .find((field) => field.id === "sort")
      ?.onChange("auto");
    assert.deepEqual(saved, {});
    const french = fields({}).find((field) => field.id === "type");
    assert.equal(french?.label, "Chart type");
    assert.equal(
      chart
        .chartSettingFields({
          columns: COLUMNS,
          view: {},
          locale: "fr-FR",
          update: () => undefined,
        })
        .find((field) => field.id === "type")
        ?.options.at(3)?.label,
      "Anneau"
    );
  });
}
