import assert from "node:assert/strict";
import type * as Chart from "../src/components/ui/yayaw-table/utils/chart-model";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";
import type * as Contracts from "../src/components/ui/yayaw-table/utils/table-contracts";

type ChartApi = Pick<
  typeof Chart,
  | "aggregateChartRows"
  | "buildChartModel"
  | "canAddChartFilters"
  | "chartAggregateParams"
  | "chartAggregateRequest"
  | "chartAlignedTicks"
  | "chartBucketKey"
  | "chartBucketLabel"
  | "chartBucketRange"
  | "chartFunnelLayout"
  | "chartFunnelOrientation"
  | "chartGroupFilters"
  | "chartLabel"
  | "chartMetricUnit"
  | "chartSettingFields"
  | "chartShares"
  | "chartStageList"
  | "chartValueTicks"
  | "fitChartLabel"
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
/** The shared rule matcher hosts and both tables filter with. */
type ContractsApi = Pick<typeof Contracts, "matchesContractFilter">;
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
/** A percent column for combo charts: margins exact in binary, so averages compare exactly. */
const MARGIN_COLUMNS = [
  ...COLUMNS,
  {
    id: "margin",
    type: "number",
    header: "Margin",
    numberFormat: { style: "percent" as const, maximumFractionDigits: 1 },
  },
  { id: "units", type: "number", header: "Units" },
];
const MARGINS = [0.5, 0.25, 0.125, 0.5, 0.25, 0.75];
const MARGIN_ROWS = ROWS.map((row, index) => ({
  ...row,
  margin: MARGINS[index],
  units: index + 1,
}));
const COMBO = {
  type: "combo",
  xColumn: "category",
  metric: "sum",
  metricColumn: "price",
  lineMetric: "avg",
  lineMetricColumn: "margin",
} as const;

export function chartModelSuite(
  test: Test,
  chart: ChartApi,
  modes: ModesApi,
  contracts: ContractsApi
) {
  const settings = (view: Chart.ChartViewSettings = {}) =>
    chart.resolveChartSettings(COLUMNS, undefined, view);
  const build = (
    view: Chart.ChartViewSettings,
    columns: readonly Chart.ChartColumn[],
    rows: readonly unknown[]
  ) => {
    const resolved = chart.resolveChartSettings(columns, undefined, view);
    const request = chart.chartAggregateRequest(resolved, columns);
    if (!request) {
      throw new Error("The chart has no x axis.");
    }
    return chart.buildChartModel({
      result: chart.aggregateChartRows(rows, request),
      settings: resolved,
      columns,
      locale: "en-US",
      palette: PALETTE,
      otherColor: "grey",
    });
  };
  const model = (view: Chart.ChartViewSettings, rows = ROWS) =>
    build(view, COLUMNS, rows);
  const combo = (view: Chart.ChartViewSettings = {}) =>
    build({ ...COMBO, ...view }, MARGIN_COLUMNS, MARGIN_ROWS);
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
      "isAnyOf"
    );
    const top = model({ topN: 1 });
    assert.equal(
      chart.chartGroupFilters(settings({ topN: 1 }), COLUMNS, {
        category: top.categories.at(-1),
      }),
      undefined
    );
  });

  test("group rules are the table's own filter rules, for yes/no, option, date and empty groups", () => {
    const columns = [
      ...COLUMNS,
      { id: "email", type: "email", header: "Email" },
    ];
    const rule = (
      xColumn: string,
      key: unknown,
      view: Chart.ChartViewSettings = {}
    ) =>
      chart
        .chartGroupFilters(
          chart.resolveChartSettings(columns, undefined, { xColumn, ...view }),
          columns,
          {
            category: {
              id: "x",
              key,
              label: "",
              color: "",
              total: 1,
              values: {},
            },
          }
        )
        ?.map(({ columnId, type, operator, values }) => [
          columnId,
          type,
          operator,
          values,
        ]);
    // Yes/no columns filter as selects of their stored value, as in the filter menus.
    assert.deepEqual(rule("done", true), [
      ["done", "select", "isAnyOf", [true]],
    ]);
    assert.deepEqual(rule("done", false), [
      ["done", "select", "isAnyOf", [false]],
    ]);
    assert.deepEqual(rule("done", null), [["done", "select", "isEmpty", []]]);
    assert.deepEqual(rule("category", "Service"), [
      ["category", "select", "isAnyOf", ["Service"]],
    ]);
    assert.deepEqual(rule("category", null), [
      ["category", "select", "isEmpty", []],
    ]);
    assert.deepEqual(rule("tags", "a"), [
      ["tags", "multiSelect", "contains", ["a"]],
    ]);
    assert.deepEqual(rule("tags", null), [
      ["tags", "multiSelect", "isEmpty", []],
    ]);
    assert.deepEqual(rule("due", "2026-Q3", { bucket: "quarter" }), [
      ["due", "date", "between", ["2026-07-01", "2026-09-30"]],
    ]);
    assert.deepEqual(rule("due", null), [["due", "date", "isEmpty", []]]);
    // Emails and links are text filters.
    assert.deepEqual(rule("email", "ada@example.com"), [
      ["email", "text", "equals", ["ada@example.com"]],
    ]);
    assert.deepEqual(rule("price", 49), [["price", "number", "equals", [49]]]);
    // Each group's rules select exactly its records, with the shared matcher.
    for (const view of [
      { xColumn: "done" },
      { xColumn: "category" },
      { xColumn: "tags" },
      { xColumn: "due", bucket: "month" },
      { xColumn: "due", bucket: "week" },
    ] as const) {
      const resolved = settings(view);
      for (const category of model(view).categories) {
        const rules = chart.chartGroupFilters(resolved, COLUMNS, { category });
        assert.ok(rules, `${view.xColumn}: ${category.label}`);
        const matched = ROWS.filter((row) =>
          rules.every((item) =>
            contracts.matchesContractFilter(
              row[item.columnId as keyof (typeof ROWS)[number]],
              { ...item }
            )
          )
        );
        assert.equal(
          matched.length,
          category.total,
          `${view.xColumn}: ${category.label}`
        );
      }
    }
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
        ?.options.find((option) => option.value === "donut")?.label,
      "Anneau"
    );
  });

  test("keeps the area, combo and funnel settings, with defaults for older views", () => {
    assert.deepEqual(
      chart.normalizeChartViewConfig({
        type: "funnel",
        stacking: "percent",
        curve: "linear",
        lineMetric: "avg",
        lineMetricColumn: " price ",
        stageOrder: ["Service", "", 3, "Service", "Software"],
      }),
      {
        type: "funnel",
        lineMetricColumn: "price",
        stacking: "percent",
        curve: "linear",
        lineMetric: "avg",
        stageOrder: ["Service", "Software"],
      }
    );
    assert.equal(
      chart.normalizeChartViewConfig({
        stacking: "stream",
        curve: "step",
        lineMetric: "median",
        stageOrder: "Service",
      }),
      undefined
    );
    // Views saved before these types resolve as they did, with the new defaults.
    const older = settings({ type: "line", xColumn: "due" });
    assert.equal(older.stacking, "stacked");
    assert.equal(older.curve, "smooth");
    assert.equal(older.lineMetric, "count");
    assert.equal(older.lineMetricColumn, undefined);
    assert.equal(older.stageOrder, undefined);
    // A line metric reading a column falls back to a count without a fitting one.
    assert.equal(
      settings({ type: "combo", lineMetric: "sum", lineMetricColumn: "name" })
        .lineMetric,
      "count"
    );
    // Combo charts and funnels have no series; areas do.
    for (const type of ["combo", "funnel"] as const) {
      assert.equal(
        settings({ type, seriesColumn: "done" }).seriesColumn,
        undefined
      );
    }
    assert.equal(
      settings({ type: "area", seriesColumn: "done" }).seriesColumn,
      "done"
    );
  });

  test("areas stack their series as values, as shares of 100% or not at all", () => {
    const view = {
      type: "area",
      xColumn: "due",
      seriesColumn: "category",
      hideEmpty: true,
    } as const;
    const stacked = model(view);
    assert.equal(stacked.stacked, true);
    assert.equal(stacked.percent, false);
    assert.deepEqual(totals(stacked), [
      ["Sep 2026", 3],
      ["Nov 2026", 2],
    ]);
    // Stacked areas fit their totals: 3 records in September.
    assert.deepEqual(stacked.valueTicks, [0, 1, 2, 3]);

    const percent = model({ ...view, stacking: "percent" });
    assert.equal(percent.percent, true);
    assert.deepEqual(percent.valueTicks, [0, 0.25, 0.5, 0.75, 1]);
    assert.deepEqual(percent.categories.at(1)?.shares, {
      "string:Software": 0,
      "string:Hardware": 0.5,
      "string:Service": 0.5,
    });
    // Values stay the records counted; shares of each category add up to 1.
    assert.deepEqual(percent.categories.at(1)?.values, {
      "string:Software": 0,
      "string:Hardware": 1,
      "string:Service": 1,
    });
    for (const category of percent.categories) {
      const sum = Object.values(category.shares ?? {}).reduce(
        (total, share) => total + share,
        0
      );
      assert.ok(Math.abs(sum - 1) < 1e-9);
    }
    assert.equal(percent.formatShare(1 / 3), "33.3%");
    assert.deepEqual(chart.chartShares({ a: 1, b: 3 }), { a: 0.25, b: 0.75 });
    assert.deepEqual(chart.chartShares({ a: 0, b: 0 }), { a: 0, b: 0 });

    // Running totals, stacked: 3 in September, 5 by November.
    const cumulative = model({ ...view, cumulative: true });
    assert.deepEqual(totals(cumulative), [
      ["Sep 2026", 3],
      ["Nov 2026", 5],
    ]);
    assert.deepEqual(cumulative.valueTicks, [0, 2, 4, 6]);
    // Overlapping areas fit each value instead.
    const overlapping = model({ ...view, cumulative: true, stacking: "none" });
    assert.equal(overlapping.stacked, false);
    assert.deepEqual(overlapping.valueTicks, [0, 1, 2]);
    // One series has nothing to share: percent stacking does not apply.
    const single = model({
      type: "area",
      xColumn: "due",
      stacking: "percent",
      hideEmpty: true,
    });
    assert.equal(single.percent, false);
    assert.equal(single.categories.at(0)?.shares, undefined);
    assert.deepEqual(single.valueTicks, [0, 1, 2, 3]);
  });

  test("combo charts ask for both metrics at once and chart them on two axes when their units differ", () => {
    const resolved = chart.resolveChartSettings(MARGIN_COLUMNS, undefined, {
      ...COMBO,
      seriesColumn: "done",
    });
    const request = chart.chartAggregateRequest(resolved, MARGIN_COLUMNS);
    assert.deepEqual(request, {
      groupBy: [{ columnId: "category" }],
      metrics: [
        { columnId: "price", fn: "sum" },
        { columnId: "margin", fn: "avg" },
      ],
      weekStartsOn: 1,
    });
    // Both metrics, computed over the rows too.
    assert.ok(request);
    const software = chart
      .aggregateChartRows(MARGIN_ROWS, request)
      .groups.find((group) => group.keys[0] === "Software");
    assert.deepEqual(software?.values, [64, 0.625]);

    const built = combo();
    assert.equal(built.title, "Sum of Price and Average of Margin by Category");
    assert.deepEqual(
      built.series.map(({ id, label, mark, axis, color }) => ({
        id,
        label,
        mark,
        axis,
        color,
      })),
      [
        {
          id: "bars",
          label: "Sum of Price",
          mark: "bar",
          axis: "left",
          color: "c1",
        },
        {
          id: "line",
          label: "Average of Margin",
          mark: "line",
          axis: "right",
          color: "c2",
        },
      ]
    );
    assert.deepEqual(
      built.categories.map((category) => [category.label, category.values]),
      [
        ["Software", { bars: 64, line: 0.625 }],
        ["Hardware", { bars: 478, line: 0.1875 }],
        ["Service", { bars: 219, line: 0.375 }],
        ["Other", { bars: 0, line: 0 }],
      ]
    );
    assert.equal(built.single, false);
    assert.equal(built.totalColumn, false);
    // Currency on the left, percent on the right, with the same grid lines.
    assert.deepEqual(built.valueTicks, [0, 200, 400, 600]);
    assert.deepEqual(built.secondaryTicks, [0, 0.25, 0.5, 0.75]);
    assert.equal(built.format(478), "€478.00");
    assert.equal(built.series.at(1)?.format?.(0.1875), "18.8%");
    // Sorting by value follows the bars.
    assert.deepEqual(
      combo({ sort: "valueDesc", hideEmpty: true }).categories.map(
        (category) => category.label
      ),
      ["Hardware", "Service", "Software"]
    );

    // The same unit shares one axis fitting both metrics.
    const sameUnit = combo({ lineMetric: "max", lineMetricColumn: "price" });
    assert.equal(sameUnit.series.at(1)?.axis, "left");
    assert.equal(sameUnit.secondaryTicks, undefined);
    assert.deepEqual(sameUnit.valueTicks, [0, 200, 400, 600]);
    // Counts and plain numbers are different units.
    const counts = combo({
      metric: "count",
      lineMetric: "sum",
      lineMetricColumn: "units",
    });
    assert.deepEqual(counts.valueTicks, [0, 1, 2]);
    assert.deepEqual(counts.secondaryTicks, [0, 5, 10]);
  });

  test("resolves each metric's unit from its column's number format", () => {
    const unit = (metric: Chart.ChartMetricFn, metricColumn?: string) =>
      chart.chartMetricUnit({ metric, metricColumn }, MARGIN_COLUMNS);
    assert.equal(unit("count"), "count");
    assert.equal(unit("countDistinct", "tags"), "count");
    assert.equal(unit("sum", "price"), "currency:EUR");
    assert.equal(unit("avg", "margin"), "percent:fraction");
    assert.equal(unit("max", "units"), "number");
    assert.deepEqual(
      chart.chartAlignedTicks([0.625, 0.1875], 3),
      [0, 0.25, 0.5, 0.75]
    );
    assert.deepEqual(chart.chartAlignedTicks([7, 8], 2, true), [0, 5, 10]);
    assert.deepEqual(
      chart.chartAlignedTicks([-30, 45], 4),
      [-50, -25, 0, 25, 50]
    );
    assert.deepEqual(chart.chartAlignedTicks([], 2), [0, 0.5, 1]);
  });

  test("combo charts fold the top N into Other only when both metrics add up", () => {
    const additive = combo({
      lineMetric: "sum",
      lineMetricColumn: "units",
      sort: "valueDesc",
      topN: 1,
    });
    assert.deepEqual(
      additive.categories.map((category) => [category.label, category.values]),
      [
        ["Hardware", { bars: 478, line: 8 }],
        ["Other", { bars: 283, line: 13 }],
      ]
    );
    const averages = combo({ sort: "valueDesc", topN: 1 });
    assert.deepEqual(
      averages.categories.map((category) => category.label),
      ["Hardware"]
    );
    // A clicked bar or point selects its category; the metric adds no rule.
    const rules = chart.chartGroupFilters(
      chart.resolveChartSettings(MARGIN_COLUMNS, undefined, COMBO),
      MARGIN_COLUMNS,
      {
        category: additive.categories.at(0),
        series: additive.series.at(1),
      }
    );
    assert.deepEqual(
      rules?.map(({ columnId, operator, values }) => ({
        columnId,
        operator,
        values,
      })),
      [{ columnId: "category", operator: "isAnyOf", values: ["Hardware"] }]
    );
    // Empty groups are those where both metrics are zero.
    assert.deepEqual(
      combo({ hideEmpty: true }).categories.map((category) => category.label),
      ["Software", "Hardware", "Service"]
    );
  });

  test("combo charts fall back to the rows when the host answers one metric only", async () => {
    const resolved = chart.resolveChartSettings(
      MARGIN_COLUMNS,
      undefined,
      COMBO
    );
    const request = chart.chartAggregateRequest(resolved, MARGIN_COLUMNS);
    assert.ok(request);
    let received: Record<string, unknown> = {};
    const server = await chart.loadChartData({
      aggregate: (params) => {
        received = params;
        return chart.aggregateChartRows(MARGIN_ROWS, request);
      },
      rows: MARGIN_ROWS,
      params: {},
      request,
      locale: "en-US",
    });
    assert.equal(server.source, "server");
    assert.deepEqual(received.metrics, request.metrics);
    const oneMetric = await chart.loadChartData({
      aggregate: () => ({
        groups: chart
          .aggregateChartRows(MARGIN_ROWS, request)
          .groups.map((group) => ({
            ...group,
            values: group.values.slice(0, 1),
          })),
      }),
      rows: MARGIN_ROWS,
      params: {},
      request,
      locale: "en-US",
    });
    assert.equal(oneMetric.source, "client");
    assert.deepEqual(oneMetric.groups, server.groups);
  });

  test("funnels order their stages and show shares of the first and conversions", () => {
    const view = {
      type: "funnel",
      xColumn: "category",
      metric: "sum",
      metricColumn: "price",
      topN: 1,
    } as const;
    // Option order by default; top N does not cut a funnel.
    assert.deepEqual(
      model(view).stages?.map((stage) => stage.label),
      ["Software", "Hardware", "Service", "Other"]
    );
    const built = model({
      ...view,
      stageOrder: ["Hardware", "Service", "Gone"],
    });
    const stages = built.stages ?? [];
    assert.deepEqual(
      stages.map((stage) => [stage.label, stage.value, stage.color]),
      [
        ["Hardware", 478, "c1"],
        ["Service", 219, "#ff0000"],
        ["Software", 64, "c3"],
        ["Other", 0, "c4"],
      ]
    );
    assert.deepEqual(
      stages.map((stage) => [stage.shareOfFirst, stage.conversion]),
      [
        [1, undefined],
        [219 / 478, 219 / 478],
        [64 / 478, 64 / 219],
        [0, 0],
      ]
    );
    assert.deepEqual(
      stages.map((stage) => [
        stage.valueText,
        stage.shareText,
        stage.conversionText,
      ]),
      [
        ["€478.00", "100% of first", undefined],
        ["€219.00", "45.8% of first", "45.8% from previous"],
        ["€64.00", "13.4% of first", "29.2% from previous"],
        ["€0.00", "0% of first", "0% from previous"],
      ]
    );
    // Hidden empty stages; a stage after a zero has no conversion.
    assert.deepEqual(
      model({ ...view, hideEmpty: true }).stages?.map((stage) => stage.label),
      ["Software", "Hardware", "Service"]
    );
    const afterZero = model({ ...view, stageOrder: ["Other", "Service"] });
    assert.equal(afterZero.stages?.at(0)?.shareText, "— of first");
    assert.equal(afterZero.stages?.at(1)?.conversionText, "— from previous");
    // Records without a stage are in none: dates ascending, no "No value".
    assert.deepEqual(
      model({ type: "funnel", xColumn: "due" }).stages?.map((stage) => [
        stage.label,
        stage.value,
      ]),
      [
        ["Sep 2026", 3],
        ["Oct 2026", 0],
        ["Nov 2026", 2],
      ]
    );
    // A stage filters the table to its records.
    assert.deepEqual(
      chart
        .chartGroupFilters(settings(view), COLUMNS, {
          category: stages.at(1)?.category,
        })
        ?.map(({ operator, values }) => [operator, values]),
      [["isAnyOf", ["Service"]]]
    );
    assert.equal(chart.chartLabel("typeFunnel", "fr"), "Entonnoir");
  });

  test("funnel shapes are drawn the same in both editions, side by side or stacked", () => {
    const stages =
      model({
        type: "funnel",
        xColumn: "category",
        metric: "sum",
        metricColumn: "price",
        stageOrder: ["Hardware", "Service"],
      }).stages ?? [];
    assert.equal(chart.chartFunnelOrientation(800, 4), "vertical");
    assert.equal(chart.chartFunnelOrientation(470, 3), "horizontal");
    assert.equal(chart.chartFunnelOrientation(560, 5), "horizontal");
    const wide = chart.chartFunnelLayout(stages, 800);
    assert.equal(wide.orientation, "vertical");
    assert.deepEqual([wide.width, wide.height], [800, 320]);
    // The first stage is the largest: full height, narrowing to the next stage.
    assert.equal(wide.shapes.at(0)?.points, "3,48 197,108.7 197,211.3 3,272");
    // A zero stage keeps a sliver and ends square.
    assert.equal(wide.shapes.at(3)?.points, "603,159 797,159 797,161 603,161");
    assert.deepEqual(wide.shapes.at(1)?.box, {
      x: 200,
      y: 0,
      width: 200,
      height: 320,
    });
    assert.deepEqual(wide.shapes.at(0)?.name, {
      x: 100,
      y: 16,
      anchor: "middle",
      text: "Hardware",
    });
    assert.equal(wide.shapes.at(0)?.conversion, undefined);
    assert.deepEqual(wide.shapes.at(1)?.conversion, {
      x: 300,
      y: 314,
      anchor: "middle",
      text: "45.8% from previous",
    });

    const narrow = chart.chartFunnelLayout(stages, 300);
    assert.equal(narrow.orientation, "horizontal");
    assert.deepEqual([narrow.width, narrow.height], [300, 304]);
    assert.equal(narrow.shapes.at(0)?.points, "0,22 300,22 218.7,50 81.3,50");
    assert.deepEqual(narrow.shapes.at(1)?.box, {
      x: 0,
      y: 76,
      width: 300,
      height: 76,
    });
    assert.deepEqual(narrow.shapes.at(1)?.value, {
      x: 300,
      y: 91,
      anchor: "end",
      text: "€219.00",
    });
    assert.deepEqual(narrow.shapes.at(1)?.share, {
      x: 0,
      y: 142,
      anchor: "start",
      text: "45.8% of first",
    });
    // Before it is measured, a funnel is drawn 640 pixels wide.
    assert.equal(chart.chartFunnelLayout(stages, 0).width, 640);
    assert.equal(chart.fitChartLabel("Hardware and services", 70), "Hardware…");
    assert.equal(chart.fitChartLabel("Service", 70), "Service");
  });

  test("the funnel's stage order moves by drag or arrows and is saved with the view", () => {
    let saved: Record<string, unknown> | undefined;
    const list = (
      view: Chart.ChartViewSettings,
      defaults?: Chart.ChartViewSettings
    ) =>
      chart.chartStageList({
        columns: COLUMNS,
        defaults,
        view,
        locale: "en-US",
        update: (next) => {
          saved = next;
        },
      });
    const funnel = { type: "funnel", xColumn: "category" } as const;
    const stages = list(funnel);
    assert.ok(stages);
    assert.deepEqual(
      stages.stages.map((stage) => stage.value),
      ["Software", "Hardware", "Service", "Other"]
    );
    assert.equal(stages.label, "Stage order");
    assert.equal(stages.stages.at(0)?.moveUpLabel, "Move Software up");
    assert.equal(stages.stages.at(0)?.moveDownLabel, "Move Software down");
    assert.equal(stages.customized, false);
    stages.move(0, 2);
    assert.deepEqual(saved, {
      ...funnel,
      stageOrder: ["Hardware", "Service", "Software", "Other"],
    });
    // Saved values that are no longer options are left out.
    const moved = list({
      ...funnel,
      stageOrder: ["Hardware", "Gone", "Service", "Software", "Other"],
    });
    assert.deepEqual(
      moved?.stages.map((stage) => stage.label),
      ["Hardware", "Service", "Software", "Other"]
    );
    assert.equal(moved?.customized, true);
    // Back to the option order: the view keeps no order of its own.
    moved?.move(2, 0);
    assert.deepEqual(saved, funnel);
    moved?.reset();
    assert.deepEqual(saved, funnel);
    // The table's order is the starting point.
    list(funnel, { stageOrder: ["Service"] })?.move(0, 1);
    assert.deepEqual(saved, {
      ...funnel,
      stageOrder: ["Software", "Service", "Hardware", "Other"],
    });
    list(
      { ...funnel, stageOrder: ["Software", "Service"] },
      { stageOrder: ["Service"] }
    )?.move(0, 1);
    assert.deepEqual(saved, funnel);
    // Only funnels on option columns have an order to set.
    assert.equal(list({ type: "bar", xColumn: "category" }), undefined);
    assert.equal(list({ type: "funnel", xColumn: "due" }), undefined);
    assert.equal(
      chart
        .chartStageList({
          columns: COLUMNS,
          view: funnel,
          locale: "fr-FR",
          update: () => undefined,
        })
        ?.stages.at(0)?.moveUpLabel,
      "Monter Software"
    );
  });

  test("settings offer the fields of areas, combo charts and funnels", () => {
    let saved: Record<string, unknown> = {};
    const fields = (
      view: Chart.ChartViewSettings,
      columns: readonly Chart.ChartColumn[] = COLUMNS
    ) =>
      chart.chartSettingFields({
        columns,
        view,
        locale: "en-US",
        update: (next) => {
          saved = next;
        },
      });
    const ids = (view: Chart.ChartViewSettings) =>
      fields(view).map((field) => field.id);
    assert.deepEqual(ids({ type: "area" }), [
      "type",
      "xColumn",
      "metric",
      "seriesColumn",
      "curve",
      "sort",
      "cumulative",
      "hideEmpty",
      "topN",
      "showDataLabels",
      "showLegend",
      "colors",
    ]);
    assert.deepEqual(ids({ type: "area", seriesColumn: "done" }).slice(3, 6), [
      "seriesColumn",
      "stacking",
      "curve",
    ]);
    assert.ok(ids({ type: "line" }).includes("curve"));
    assert.ok(!ids({ type: "bar" }).includes("curve"));
    assert.deepEqual(ids({ type: "combo" }), [
      "type",
      "xColumn",
      "metric",
      "lineMetric",
      "curve",
      "sort",
      "hideEmpty",
      "topN",
      "showDataLabels",
      "showLegend",
    ]);
    assert.deepEqual(ids({ type: "funnel" }), [
      "type",
      "xColumn",
      "metric",
      "hideEmpty",
      "showLegend",
      "colors",
    ]);
    const comboFields = fields(COMBO, MARGIN_COLUMNS);
    assert.deepEqual(
      comboFields.map((field) => [field.id, field.label]).slice(2, 6),
      [
        ["metric", "Bars"],
        ["metricColumn", "Bars of"],
        ["lineMetric", "Line"],
        ["lineMetricColumn", "Line of"],
      ]
    );
    // Choosing a line metric picks a column it can read.
    fields({ type: "combo" })
      .find((field) => field.id === "lineMetric")
      ?.onChange("avg");
    assert.deepEqual(saved, {
      type: "combo",
      lineMetric: "avg",
      lineMetricColumn: "price",
    });
    fields({ type: "area", seriesColumn: "done" })
      .find((field) => field.id === "stacking")
      ?.onChange("percent");
    assert.deepEqual(saved, {
      type: "area",
      seriesColumn: "done",
      stacking: "percent",
    });
    fields({ type: "line" })
      .find((field) => field.id === "curve")
      ?.onChange("linear");
    assert.deepEqual(saved, { type: "line", curve: "linear" });
    const french = chart
      .chartSettingFields({
        columns: COLUMNS,
        view: {},
        locale: "fr-FR",
        update: () => undefined,
      })
      .find((field) => field.id === "type")
      ?.options.map((option) => option.label);
    assert.deepEqual(french, [
      "Barres verticales",
      "Barres horizontales",
      "Courbe",
      "Aires",
      "Barres et courbe",
      "Anneau",
      "Entonnoir",
      "Nombre",
    ]);
  });
}
