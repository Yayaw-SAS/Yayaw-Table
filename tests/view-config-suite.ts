import assert from "node:assert/strict";
import {
  dashboardProjectViews,
  dashboardTaskViews,
} from "../examples/dashboard";
import { chartViews, mapViews, updatesFeedView } from "../examples/views";
import type * as ViewConfig from "../src/components/ui/yayaw-table/utils/view-config";

/** The view settings functions both editions run through this suite. */
export type ViewConfigApi = Pick<
  typeof ViewConfig,
  | "copyJson"
  | "jsonPath"
  | "sanitizeViewConfig"
  | "VIEW_CONFIG_KEYS"
  | "VIEW_CONFIG_LIMITS"
  | "VIEW_FILTER_OPERATORS"
>;
type Test = (name: string, run: () => void | Promise<void>) => void;
type Issue = ViewConfig.ViewConfigIssue;

const codes = (issues: readonly Issue[]) =>
  issues.map((issue) => [issue.code, issue.path, issue.severity]);
const paths = (issues: readonly Issue[], code: Issue["code"]) =>
  issues.filter((issue) => issue.code === code).map((issue) => issue.path);

/** A few settings of every mode, as saved views store them. */
const MODE_VIEWS: Record<string, unknown>[] = [
  {
    displayMode: "calendar",
    calendar: { dateColumn: "dueDate", layout: "week", showWeekends: false },
  },
  {
    displayMode: "filetree",
    filetree: { parentColumn: "parentId", foldersFirst: true, expanded: ["a"] },
  },
  {
    displayMode: "form",
    form: { title: { en: "Apply", fr: "Postuler" }, layout: "steps" },
  },
  { displayMode: "gantt", gantt: { zoom: "week", showDependencies: true } },
  {
    displayMode: "kanban",
    grouping: ["status"],
    kanban: { titleColumn: "name", cardColumnIds: ["owner"] },
  },
  {
    displayMode: "list",
    list: { titleColumn: "name", wrap: true, maxProperties: 3 },
    columnPinning: { left: ["name"], right: [] },
    columnSizing: { name: 240 },
    columnOrder: ["name", "status"],
    columnFilters: [{ id: "status", value: ["Done"] }],
    globalSearch: "alpha",
    pageSize: 25,
    footerCalculationsVisible: false,
  },
];

function knownSuite(test: Test, api: ViewConfigApi) {
  test("demo views and every mode's settings are a fixed point", () => {
    const views = [
      ...dashboardProjectViews(new Date(2026, 8, 25)),
      ...dashboardTaskViews,
      ...chartViews,
      updatesFeedView,
      ...mapViews,
    ].map((view) => view.config as Record<string, unknown>);
    for (const config of [...views, ...MODE_VIEWS]) {
      const { config: sanitized, issues } = api.sanitizeViewConfig(config);
      assert.deepEqual(sanitized, config);
      assert.deepEqual(issues, []);
      assert.deepEqual(api.sanitizeViewConfig(sanitized).config, sanitized);
    }
  });

  test("unknown keys are removed at every level, as warnings", () => {
    const { config, issues } = api.sanitizeViewConfig({
      displayMode: "chart",
      color: "red",
      sorting: [{ id: "name", desc: true, nulls: "last" }],
      advancedFilters: [
        {
          id: "r",
          columnId: "status",
          operator: "is",
          values: ["A"],
          note: "x",
        },
      ],
      chart: { type: "bar", xColumn: "status", foo: 1 },
      kanban: { titleColumn: "name", bogus: true },
      columnPinning: { left: ["name"], middle: ["x"] },
      list: { wrap: true, extra: 1 },
    });
    assert.deepEqual(config, {
      displayMode: "chart",
      sorting: [{ id: "name", desc: true }],
      advancedFilters: [
        {
          id: "r",
          columnId: "status",
          operator: "is",
          values: ["A"],
          isActive: true,
        },
      ],
      chart: { type: "bar", xColumn: "status" },
      kanban: { titleColumn: "name" },
      columnPinning: { left: ["name"], right: [] },
      list: { wrap: true },
    });
    assert.deepEqual(paths(issues, "unknownKey"), [
      "color",
      "sorting[0].nulls",
      "advancedFilters[0].note",
      "chart.foo",
      "kanban.bogus",
      "columnPinning.middle",
      "list.extra",
    ]);
    assert.ok(issues.every((issue) => issue.severity === "warning"));
  });

  test("historical names read as the canonical ones, which win", () => {
    assert.deepEqual(
      api.sanitizeViewConfig({
        search: "old",
        filters: [{ id: "name", value: "A" }],
        pinning: { left: ["name"] },
        kanban: { groupBy: "status", titleColumn: "name" },
      }),
      {
        config: {
          globalSearch: "old",
          columnFilters: [{ id: "name", value: "A" }],
          columnPinning: { left: ["name"], right: [] },
          grouping: ["status"],
          kanban: { titleColumn: "name" },
        },
        issues: [],
      }
    );
    const both = api.sanitizeViewConfig({
      search: "old",
      globalSearch: "new",
      grouping: ["owner"],
      kanban: { groupBy: "status" },
    });
    assert.deepEqual(both.config, { globalSearch: "new", grouping: ["owner"] });
  });

  test("a view matching any rule keeps OR on every rule", () => {
    const rule = (id: string) => ({ id, columnId: id, operator: "is" });
    // The Vue envelope.
    assert.deepEqual(
      api
        .sanitizeViewConfig({
          advancedFilters: {
            filters: [rule("a"), rule("b")],
            joinOperator: "or",
          },
        })
        .config.advancedFilters?.map((item) => item.joinOperator),
      ["or", "or"]
    );
    // React marks the rules.
    assert.deepEqual(
      api
        .sanitizeViewConfig({
          advancedFilters: [{ ...rule("a"), joinOperator: "or" }, rule("b")],
        })
        .config.advancedFilters?.map((item) => item.joinOperator),
      ["or", "or"]
    );
    const and = api.sanitizeViewConfig({
      advancedFilters: [{ ...rule("a"), joinOperator: "and" }, rule("b")],
    });
    assert.deepEqual(
      and.config.advancedFilters?.map((item) => item.joinOperator),
      [undefined, undefined]
    );
  });
}

function strictSuite(test: Test, api: ViewConfigApi) {
  test("values of the wrong type are dropped as errors", () => {
    const { config, issues } = api.sanitizeViewConfig({
      displayMode: "pie",
      density: 3,
      pageSize: -1,
      sorting: "name",
      columnVisibility: [],
      columnSizing: { name: "10", status: 0 },
      gallery: { imageColumn: 5, titleColumn: { x: 1 }, cardSize: "small" },
      globalSearch: {},
      footerCalculationsVisible: "yes",
      advancedFilters: [
        { columnId: "a", operator: "hack" },
        { operator: "is" },
        { columnId: "b", operator: "is", isActive: "no" },
      ],
      chart: { type: "pie" },
      calendar: [],
    });
    assert.deepEqual(config, {
      gallery: { cardSize: "small" },
      advancedFilters: [
        { id: "rule-3", columnId: "b", operator: "is", isActive: true },
      ],
    });
    assert.deepEqual(codes(issues), [
      ["invalidValue", "displayMode", "error"],
      ["invalidValue", "density", "error"],
      ["invalidValue", "pageSize", "error"],
      ["invalidValue", "sorting", "error"],
      ["invalidValue", "columnVisibility", "error"],
      ["invalidValue", "columnSizing.name", "error"],
      ["invalidValue", "columnSizing.status", "error"],
      ["invalidValue", "gallery.imageColumn", "error"],
      ["invalidValue", "gallery.titleColumn", "error"],
      ["invalidValue", "globalSearch", "error"],
      ["invalidValue", "footerCalculationsVisible", "error"],
      ["invalidValue", "advancedFilters[0].operator", "error"],
      ["invalidValue", "advancedFilters[1].columnId", "error"],
      ["invalidValue", "advancedFilters[2].isActive", "error"],
      ["invalidValue", "chart.type", "error"],
      ["invalidValue", "calendar", "error"],
    ]);
    assert.deepEqual(api.sanitizeViewConfig("nope").config, {});
    assert.equal(api.sanitizeViewConfig(null).issues.at(0)?.path, "");
  });

  test("sizes are capped: rules, values, texts, page sizes and mode settings", () => {
    const { rules, values, text, pageSize } = api.VIEW_CONFIG_LIMITS;
    const many = Array.from({ length: rules + 10 }, (_, index) => ({
      id: `c${index}`,
      desc: false,
    }));
    const { config, issues } = api.sanitizeViewConfig({
      sorting: many,
      advancedFilters: [
        {
          id: "r",
          columnId: "status",
          operator: "isAnyOf",
          values: Array.from(
            { length: values + 50 },
            (_, index) => `v${index}`
          ),
        },
      ],
      globalSearch: "x".repeat(text + 100),
      pageSize: 10_000,
      form: { title: "y".repeat(api.VIEW_CONFIG_LIMITS.modeSettings) },
    });
    assert.equal(config.sorting?.length, rules);
    assert.equal(
      (config.advancedFilters?.[0]?.values as unknown[]).length,
      values
    );
    assert.equal(config.globalSearch?.length, text);
    assert.equal(config.pageSize, pageSize);
    assert.equal(config.form, undefined);
    assert.deepEqual(paths(issues, "truncated"), [
      "sorting",
      "advancedFilters[0].values",
      "globalSearch",
      "pageSize",
      "form",
    ]);
    assert.ok(issues.every((issue) => issue.severity === "error"));
    // Hosts pass their own limits.
    const small = api.sanitizeViewConfig(
      { sorting: many.slice(0, 5) },
      { rules: 2 }
    );
    assert.equal(small.config.sorting?.length, 2);
  });

  test("hostile JSON never throws nor pollutes prototypes", () => {
    let deep: unknown = "bottom";
    for (let level = 0; level < 20_000; level += 1) {
      deep = [deep];
    }
    const cyclic: Record<string, unknown> = { titleColumn: "name" };
    cyclic.self = cyclic;
    const throwing = Object.defineProperty({}, "displayMode", {
      enumerable: true,
      get: () => {
        throw new Error("boom");
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("no keys");
        },
      }
    );
    const inputs: unknown[] = [
      JSON.parse(
        '{"__proto__":{"polluted":1},"columnVisibility":{"__proto__":true},"chart":{"__proto__":{"x":1},"constructor":{"prototype":{"y":1}}}}'
      ),
      { columnFilters: [{ id: "a", value: deep }] },
      { chart: { stageOrder: deep }, form: { questions: deep } },
      { list: cyclic },
      throwing,
      proxy,
      { sorting: Array.from({ length: 100_000 }, () => ({ id: "a" })) },
      { gallery: { imageColumn: Symbol("x"), cardColumnIds: [() => 1] } },
      { columnSizing: { a: Number.NaN, b: Number.POSITIVE_INFINITY } },
    ];
    for (const input of inputs) {
      const result = api.sanitizeViewConfig(input);
      assert.equal(typeof result.config, "object");
      assert.ok(Array.isArray(result.issues));
      assert.ok(result.issues.length <= 101);
    }
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal(({} as Record<string, unknown>).y, undefined);
    assert.deepEqual(api.sanitizeViewConfig(throwing).config, {});
  });

  test("the known keys and operators are exported for schemas", () => {
    assert.ok(api.VIEW_CONFIG_KEYS.includes("advancedFilters"));
    assert.ok(api.VIEW_CONFIG_KEYS.includes("gantt"));
    assert.ok(api.VIEW_CONFIG_KEYS.includes("form"));
    assert.equal(new Set(api.VIEW_FILTER_OPERATORS).size, 27);
    assert.equal(api.jsonPath("", "sorting"), "sorting");
    assert.equal(api.jsonPath("sorting", 0), "sorting[0]");
    assert.equal(api.jsonPath("a", "odd key"), 'a["odd key"]');
  });
}

function copySuite(test: Test, api: ViewConfigApi) {
  test("JSON copies drop what is not JSON and stop at their limits", () => {
    const source = JSON.parse(
      '{"a":1,"__proto__":{"x":1},"list":[1,"two",null,true],"nested":{"deep":{"deeper":{"deepest":1}}}}'
    );
    source.fn = () => 1;
    source.nan = Number.NaN;
    source.when = new Date("2026-09-25T10:00:00Z");
    const copy = api.copyJson(source, { depth: 3, size: 1000 }, "props");
    assert.deepEqual(copy.value, {
      a: 1,
      list: [1, "two", null, true],
      nested: { deep: {} },
      when: "2026-09-25T10:00:00.000Z",
    });
    assert.deepEqual(
      copy.issues.map((issue) => [issue.code, issue.path]),
      [
        ["invalidValue", "props.__proto__"],
        ["truncated", "props.nested.deep.deeper"],
        ["invalidValue", "props.fn"],
        ["invalidValue", "props.nan"],
      ]
    );
    assert.equal(copy.oversize, false);
    const big = api.copyJson({ text: "x".repeat(100) }, { depth: 3, size: 50 });
    assert.equal(big.oversize, true);
    assert.equal(big.value, undefined);
    const capped = api.copyJson(
      { list: [1, 2, 3, 4], text: "abcdef" },
      { depth: 3, size: 1000, items: 2, text: 3 }
    );
    assert.deepEqual(capped.value, { list: [1, 2], text: "abc" });
  });
}

export function viewConfigSuite(test: Test, api: ViewConfigApi) {
  knownSuite(test, api);
  strictSuite(test, api);
  copySuite(test, api);
}
