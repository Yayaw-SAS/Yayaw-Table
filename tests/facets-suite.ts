import assert from "node:assert/strict";
import type * as Facets from "../src/components/ui/yayaw-table/utils/facets-model";
import type * as Folders from "../src/components/ui/yayaw-table/utils/folder-directory";
import type * as DashboardFacets from "../src/components/ui/yayaw-table-dashboard/dashboard-facets";
import type * as DashboardModel from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

type Row = Record<string, unknown>;
const FAILED = /Failed/;
type Test = (name: string, run: () => Promise<void> | void) => void;

export interface FacetsSuiteApi {
  facets: Pick<
    typeof Facets,
    | "FACET_EMPTY_KEY"
    | "canToggleFacet"
    | "clearFacets"
    | "countFacetValues"
    | "facetAggregateParams"
    | "facetCountParams"
    | "facetEntries"
    | "facetKeyTarget"
    | "facetLabel"
    | "facetSelection"
    | "facetsShownIn"
    | "loadFacetCounts"
    | "normalizeFacetsConfig"
    | "resolveFacets"
    | "selectedFacetCount"
    | "toggleFacetValue"
    | "visibleFacetEntries"
  >;
  folders: Pick<
    typeof Folders,
    | "buildFolderDirectory"
    | "canCreateFolderUnder"
    | "createFolderRecord"
    | "defaultNewFolderParent"
    | "folderChoiceComplete"
    | "folderChoiceOf"
    | "folderChoiceText"
    | "folderFacetLabel"
    | "folderLocationText"
    | "folderPathText"
    | "folderTableOptions"
    | "folderTreeOf"
    | "loadFolderDirectory"
    | "newFolderName"
    | "newFolderShownIn"
    | "searchFolders"
    | "toggleFolderChoice"
  >;
  dashboard: Pick<
    typeof DashboardModel,
    "checkDashboardFilterValue" | "dashboardSourceFilterRules"
  >;
  block: Pick<
    typeof DashboardFacets,
    | "facetBlockColumn"
    | "facetBlockEntries"
    | "facetBlockProblems"
    | "facetBlockProps"
    | "facetBlockSchema"
    | "loadFacetBlockCounts"
    | "toggleFacetBlockValue"
  >;
}

const COLUMNS = [
  { id: "name", header: "Name", type: "text" },
  {
    id: "category",
    header: "Category",
    type: "select",
    options: [
      { value: "Software", label: "Software" },
      { value: "Hardware", label: "Hardware" },
      { value: "Service", label: "Service" },
    ],
  },
  {
    id: "tags",
    header: "Tags",
    type: "multiSelect",
    options: [
      { value: "new", label: "New" },
      { value: "popular", label: "Popular" },
    ],
  },
  { id: "active", header: "Active", type: "boolean" },
  { id: "price", header: "Price", type: "number" },
  { id: "status", header: "Status", type: "text", options: [{ value: "on" }] },
  { id: "hidden", header: "Hidden", type: "select", enableFiltering: false },
  { id: "parentId", header: "Folder", type: "text" },
];

const ROWS: Row[] = [
  { id: "1", category: "Software", tags: ["new", "popular"], active: true },
  { id: "2", category: "Hardware", tags: ["popular"], active: false },
  { id: "3", category: "Software", tags: [], active: true },
  { id: "4", category: "", tags: ["new"], active: true },
  { id: "5", category: "Service", tags: ["new"], active: false },
];

const rule = (columnId: string, operator: string, values: unknown) => ({
  id: `${columnId}-${operator}`,
  columnId,
  type: "select",
  operator,
  values,
  isActive: true,
});

/** Folders and files: Brand › Logos, Campaigns › 2026, a file at the root, an orphan. */
const TREE: Row[] = [
  { id: "f-brand", name: "Brand", kind: "folder", parentId: null },
  { id: "f-logos", name: "Logos", kind: "folder", parentId: "f-brand" },
  { id: "logo", name: "Logo.png", kind: "file", parentId: "f-logos" },
  { id: "f-campaigns", name: "Campaigns", kind: "folder", parentId: null },
  { id: "f-2026", name: "2026", kind: "folder", parentId: "f-campaigns" },
  { id: "f-ete", name: "Été", kind: "folder", parentId: "f-2026" },
  { id: "readme", name: "README.md", kind: "file", parentId: null },
  { id: "lost", name: "Lost", kind: "folder", parentId: "f-gone" },
];
const TREE_SETTINGS = {
  parentColumn: "parentId",
  kindColumn: "kind",
  nameColumn: "name",
  foldersFirst: true,
};

export function facetsSuite(test: Test, api: FacetsSuiteApi) {
  const { facets, folders, dashboard, block } = api;
  const resolved = () => {
    const result = facets.resolveFacets(
      {
        columns: [
          "category",
          { id: "tags", label: "Labels", limit: 3, showEmpty: false },
          "active",
          "price",
          "status",
          "hidden",
          "missing",
          "parentId",
          "category",
        ],
      },
      COLUMNS,
      { folderColumn: "parentId", locale: "en" }
    );
    if (!result) {
      throw new Error("The facets did not resolve.");
    }
    return result;
  };
  const facet = (id: string) => {
    const found = resolved().columns.find((item) => item.id === id);
    if (!found) {
      throw new Error(`No facet ${id}.`);
    }
    return found;
  };

  test("resolves the facets a table lists, with their kinds and defaults", () => {
    const result = resolved();
    assert.deepEqual(
      result.columns.map((item) => [item.id, item.kind, item.operator]),
      [
        ["category", "select", "isAnyOf"],
        ["tags", "multiSelect", "contains"],
        ["active", "boolean", "isAnyOf"],
        ["status", "select", "isAnyOf"],
        ["parentId", "folder", "isAnyOf"],
      ]
    );
    assert.equal(result.position, "left");
    assert.equal(result.defaultOpen, true);
    assert.equal(result.limit, 8);
    assert.equal(result.showCounts, true);
    assert.equal(result.showZero, false);
    assert.equal(result.width, 256);
    const tags = facet("tags");
    assert.equal(tags.label, "Labels");
    assert.equal(tags.limit, 3);
    assert.equal(tags.showEmpty, false);
    assert.equal(tags.type, "multiSelect");
    assert.deepEqual(
      facet("active").options.map((option) => option.label),
      ["Yes", "No"]
    );
    assert.equal(facet("category").sort, "options");
    assert.equal(facet("parentId").sort, "count");
    assert.deepEqual(facet("parentId").options, []);
  });

  test("keeps only valid facet settings", () => {
    assert.equal(facets.normalizeFacetsConfig(undefined), undefined);
    assert.equal(facets.normalizeFacetsConfig({ columns: [] }), undefined);
    assert.equal(
      facets.normalizeFacetsConfig({ columns: [" ", 3] }),
      undefined
    );
    assert.deepEqual(
      facets.normalizeFacetsConfig({
        columns: [" category ", { id: "tags", sort: "label", limit: 500 }],
        position: "right",
        defaultOpen: false,
        limit: 0,
        width: 9000,
        showCounts: false,
        showZero: true,
        other: 1,
      }),
      {
        columns: [
          { id: "category" },
          { id: "tags", limit: 100, sort: "label" },
        ],
        position: "right",
        defaultOpen: false,
        limit: 1,
        showCounts: false,
        showZero: true,
        width: 480,
      }
    );
    assert.equal(
      facets.resolveFacets({ columns: ["price", "name"] }, COLUMNS),
      undefined
    );
    assert.equal(facets.facetsShownIn("gallery"), true);
    assert.equal(facets.facetsShownIn("form"), false);
  });

  test("a click writes the rule the filter menus write, and toggles it", () => {
    const category = facet("category");
    const other = rule("price", "greaterThan", [10]);
    const first = facets.toggleFacetValue([other], category, "Software", "1");
    assert.equal(first.joinOperator, "and");
    assert.deepEqual(first.filters, [
      other,
      {
        id: "facet-category-1",
        columnId: "category",
        type: "select",
        isActive: true,
        operator: "isAnyOf",
        values: ["Software"],
      },
    ]);
    const second = facets.toggleFacetValue(first, category, "Service", "2");
    assert.equal(second.filters.length, 2);
    assert.equal(second.filters[1]?.id, "facet-category-1");
    assert.deepEqual(second.filters[1]?.values, ["Software", "Service"]);
    assert.deepEqual(facets.facetSelection(second, category), {
      values: ["Software", "Service"],
      empty: false,
    });
    const fewer = facets.toggleFacetValue(second, category, "Software");
    assert.deepEqual(fewer.filters[1]?.values, ["Service"]);
    const none = facets.toggleFacetValue(fewer, category, "Service");
    assert.deepEqual(none.filters, [other]);
    // Lists write `contains` (any of the values), yes/no their stored value.
    const tags = facets.toggleFacetValue([], facet("tags"), "new", "3");
    assert.deepEqual(
      [
        tags.filters[0]?.type,
        tags.filters[0]?.operator,
        tags.filters[0]?.values,
      ],
      ["multiSelect", "contains", ["new"]]
    );
    const active = facets.toggleFacetValue([], facet("active"), true, "4");
    assert.deepEqual(active.filters[0]?.values, [true]);
    assert.equal(active.filters[0]?.operator, "isAnyOf");
  });

  test('"No value" selects records without one, alone', () => {
    const category = facet("category");
    const empty = facets.toggleFacetValue(
      [rule("category", "isAnyOf", ["Software"])],
      category,
      null
    );
    assert.deepEqual(
      [empty.filters[0]?.operator, empty.filters[0]?.values],
      ["isEmpty", []]
    );
    assert.deepEqual(facets.facetSelection(empty, category), {
      values: [],
      empty: true,
    });
    const value = facets.toggleFacetValue(empty, category, "Hardware");
    assert.deepEqual(
      [value.filters[0]?.operator, value.filters[0]?.values],
      ["isAnyOf", ["Hardware"]]
    );
    assert.deepEqual(
      facets.toggleFacetValue(empty, category, null).filters,
      []
    );
  });

  test("a facet reads rules the filter menus wrote, and keeps their id", () => {
    const category = facet("category");
    const menu = [rule("category", "is", "Software")];
    assert.deepEqual(facets.facetSelection(menu, category).values, [
      "Software",
    ]);
    const next = facets.toggleFacetValue(menu, category, "Hardware");
    assert.deepEqual(next.filters, [
      {
        ...menu[0],
        operator: "isAnyOf",
        values: ["Software", "Hardware"],
      },
    ]);
    // Other operators and inactive rules are other filters.
    const others = [
      rule("category", "isNoneOf", ["Service"]),
      { ...rule("category", "isAnyOf", ["Software"]), isActive: false },
    ];
    assert.deepEqual(facets.facetSelection(others, category), {
      values: [],
      empty: false,
    });
  });

  test("clicks need every rule required; clear removes the facets' own rules", () => {
    const category = facet("category");
    const or = {
      filters: [
        rule("price", "greaterThan", [10]),
        rule("name", "contains", "a"),
      ],
      joinOperator: "or",
    };
    assert.equal(facets.canToggleFacet(or, category), false);
    assert.equal(
      facets.canToggleFacet(
        {
          filters: [rule("category", "isAnyOf", ["Software"])],
          joinOperator: "or",
        },
        category
      ),
      true
    );
    assert.equal(
      facets.canToggleFacet([rule("price", "equals", 1)], category),
      true
    );
    const orAlone = facets.toggleFacetValue(
      {
        filters: [rule("category", "isAnyOf", ["Software"])],
        joinOperator: "or",
      },
      category,
      "Service"
    );
    assert.equal(orAlone.joinOperator, "and");
    assert.equal("joinOperator" in (orAlone.filters[0] ?? {}), false);
    const filters = [
      rule("category", "isAnyOf", ["Software"]),
      rule("tags", "contains", ["new"]),
      rule("price", "greaterThan", [10]),
    ];
    assert.deepEqual(
      facets.clearFacets(filters, [category]).filters.map((item) => item.id),
      ["tags-contains", "price-greaterThan"]
    );
    assert.deepEqual(
      facets
        .clearFacets(filters, [category, facet("tags")])
        .filters.map((item) => item.id),
      ["price-greaterThan"]
    );
    assert.equal(
      facets.selectedFacetCount(filters, [
        category,
        facet("tags"),
        facet("active"),
      ]),
      2
    );
  });

  test("a facet's counts answer the query without its own rule", () => {
    const category = facet("category");
    const params = {
      search: "pro",
      filters: { status: ["on"] },
      advancedFilters: [
        rule("category", "isAnyOf", ["Software"]),
        rule("tags", "contains", ["new"]),
        { ...rule("price", "greaterThan", [5]), isActive: false },
      ],
    };
    const counted = facets.facetCountParams(params, category);
    assert.equal(counted.search, "pro");
    assert.deepEqual(counted.filters, { status: ["on"] });
    assert.deepEqual(counted.advancedFilters, {
      filters: [rule("tags", "contains", ["new"])],
      joinOperator: "and",
    });
    const aggregate = facets.facetAggregateParams(params, category, "fr");
    assert.deepEqual(aggregate.groupBy, [{ columnId: "category" }]);
    assert.deepEqual(aggregate.metrics, [{ fn: "count" }]);
    assert.deepEqual(aggregate.calculations, {});
    assert.equal(aggregate.locale, "fr");
    assert.equal(aggregate.search, "pro");
    assert.deepEqual(aggregate.advancedFilters, [
      rule("tags", "contains", ["new"]),
    ]);
    assert.equal(aggregate.advancedFilterJoin, "and");
    // The tags facet keeps the category rule.
    assert.deepEqual(
      (
        facets.facetAggregateParams(params, facet("tags"), "en")
          .advancedFilters as Row[]
      ).map((item) => item.id),
      ["category-isAnyOf"]
    );
  });

  test("counts come from aggregate groups, one request per facet", async () => {
    const requests: Row[] = [];
    const counts = await facets.loadFacetCounts({
      facets: [facet("category"), facet("tags")],
      params: { advancedFilters: [rule("category", "isAnyOf", ["Software"])] },
      aggregate: (params) => {
        requests.push(params);
        const column = (params.groupBy as { columnId: string }[])[0]?.columnId;
        return Promise.resolve({
          groups:
            column === "category"
              ? [
                  { keys: ["Software"], values: [2] },
                  { keys: [null], values: [1] },
                ]
              : [{ keys: ["new"], values: [1] }],
          truncated: column === "tags",
        });
      },
      locale: "en",
    });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0]?.advancedFilters, []);
    assert.deepEqual(
      (requests[1]?.advancedFilters as Row[]).map((item) => item.id),
      ["category-isAnyOf"]
    );
    assert.deepEqual(counts.category?.counts, {
      Software: 2,
      [facets.FACET_EMPTY_KEY]: 1,
    });
    assert.equal(counts.category?.source, "server");
    assert.equal(counts.category?.truncated, false);
    assert.equal(counts.tags?.truncated, true);
  });

  test("without aggregate groups, counts come from the rows list returns", async () => {
    const lists: Row[] = [];
    const list = (params: Row) => {
      lists.push(params);
      const rules = params.advancedFilters as Row[];
      const rows = rules.length
        ? ROWS.filter((row) => row.category === "Software")
        : ROWS;
      return Promise.resolve({
        data: rows,
        meta: { totalCount: rows.length },
      });
    };
    const counts = await facets.loadFacetCounts({
      facets: [facet("tags"), facet("active"), facet("category")],
      params: { advancedFilters: [rule("category", "isAnyOf", ["Software"])] },
      aggregate: () => Promise.reject(new Error("no groups")),
      list,
      locale: "en",
    });
    // Tags and yes/no share the query that keeps the category rule.
    assert.equal(lists.length, 2);
    assert.deepEqual(counts.tags?.counts, {
      new: 1,
      popular: 1,
      [facets.FACET_EMPTY_KEY]: 1,
    });
    assert.deepEqual(counts.active?.counts, { true: 2 });
    assert.deepEqual(counts.category?.counts, {
      Software: 2,
      Hardware: 1,
      Service: 1,
      [facets.FACET_EMPTY_KEY]: 1,
    });
    assert.equal(counts.category?.source, "client");
    const truncated = await facets.loadFacetCounts({
      facets: [facet("category")],
      params: {},
      list,
      locale: "en",
      maxRows: 3,
    });
    assert.equal(truncated.category?.truncated, true);
    // Tables without a list action count their own rows under the query.
    const local = await facets.loadFacetCounts({
      facets: [facet("category")],
      params: { search: "x" },
      rows: ROWS,
      filterRows: (rows, params) =>
        params.search === "x" ? rows.slice(0, 2) : rows,
      locale: "en",
    });
    assert.deepEqual(local.category?.counts, { Software: 1, Hardware: 1 });
  });

  test("lists count once per record and folders read ids", () => {
    const { counts, values } = facets.countFacetValues(
      [
        { tags: ["new", "new", "popular"] },
        { tags: [] },
        { tags: null },
        { tags: ["popular"] },
      ],
      facet("tags")
    );
    assert.deepEqual(counts, {
      new: 1,
      popular: 2,
      [facets.FACET_EMPTY_KEY]: 2,
    });
    assert.equal(values[facets.FACET_EMPTY_KEY], null);
    assert.deepEqual(
      facets.countFacetValues(
        [{ parentId: { id: "f-1" } }, { parentId: "f-1" }, { parentId: null }],
        facet("parentId")
      ).counts,
      { "f-1": 2, [facets.FACET_EMPTY_KEY]: 1 }
    );
  });

  test("entries: options first, counts, selected kept, No value last", () => {
    const category = facet("category");
    const entries = facets.facetEntries(category, {
      counts: {
        counts: { Software: 2, Other: 3, [facets.FACET_EMPTY_KEY]: 1 },
        values: {
          Software: "Software",
          Other: "Other",
          [facets.FACET_EMPTY_KEY]: null,
        },
      },
      selection: { values: ["Service"], empty: false },
      locale: "en",
    });
    assert.deepEqual(
      entries.map((entry) => [entry.label, entry.count, entry.selected]),
      [
        ["Software", 2, false],
        ["Service", 0, true],
        ["Other", 3, false],
        ["No value", 1, false],
      ]
    );
    assert.equal(entries.at(-1)?.empty, true);
    assert.equal(entries.at(-1)?.value, null);
    // While counts load, the options show without numbers.
    assert.deepEqual(
      facets
        .facetEntries(category, {
          selection: { values: [], empty: false },
          locale: "fr",
        })
        .map((entry) => [entry.label, entry.count]),
      [
        ["Software", undefined],
        ["Hardware", undefined],
        ["Service", undefined],
      ]
    );
    // Every option, and "No value", even without records.
    assert.deepEqual(
      facets
        .facetEntries(category, {
          counts: { counts: {}, values: {} },
          selection: { values: [], empty: false },
          locale: "en",
          showZero: true,
        })
        .map((entry) => entry.count),
      [0, 0, 0, 0]
    );
    const byCount = facets.facetEntries(
      { ...category, options: [], sort: "count" },
      {
        counts: {
          counts: { b: 1, a: 1, c: 5 },
          values: { a: "a", b: "b", c: "c" },
        },
        selection: { values: [], empty: true },
        locale: "fr",
      }
    );
    assert.deepEqual(
      byCount.map((entry) => entry.label),
      ["c", "a", "b", "Aucune valeur"]
    );
    assert.equal(byCount.at(-1)?.selected, true);
  });

  test("folder entries read names and locations, in the tree's order", () => {
    const directory = folders.buildFolderDirectory(TREE, {
      settings: TREE_SETTINGS,
    });
    const entries = facets.facetEntries(facet("parentId"), {
      counts: {
        counts: {
          "f-ete": 1,
          "f-logos": 1,
          "f-gone": 1,
          [facets.FACET_EMPTY_KEY]: 3,
        },
        values: { "f-ete": "f-ete", "f-logos": "f-logos", "f-gone": "f-gone" },
      },
      selection: { values: [], empty: false },
      locale: "en",
      folderLabel: (id) => folders.folderFacetLabel(directory, id, "en"),
    });
    assert.deepEqual(
      entries.map((entry) => [entry.label, entry.detail]),
      [
        ["Root", undefined],
        ["Logos", "Brand"],
        ["Été", "Campaigns › 2026"],
        ["f-gone", "Unfiled"],
      ]
    );
  });

  test("visible entries: the first ones and the selected ones, or the matches", () => {
    const entries = ["Alpha", "Beta", "Gamma", "Delta", "Épsilon"].map(
      (label, index) => ({
        key: label,
        value: label,
        label,
        count: 1,
        selected: index === 4,
        empty: false,
      })
    );
    const shown = facets.visibleFacetEntries(entries, { limit: 2 });
    assert.deepEqual(
      shown.entries.map((entry) => entry.label),
      ["Alpha", "Beta", "Épsilon"]
    );
    assert.equal(shown.hidden, 2);
    assert.equal(
      facets.visibleFacetEntries(entries, { limit: 2, expanded: true }).hidden,
      0
    );
    assert.deepEqual(
      facets
        .visibleFacetEntries(entries, { limit: 2, query: "eps" })
        .entries.map((entry) => entry.label),
      ["Épsilon"]
    );
    assert.equal(facets.facetKeyTarget("ArrowDown", 4, 5), 4);
    assert.equal(facets.facetKeyTarget("ArrowUp", 0, 5), 0);
    assert.equal(facets.facetKeyTarget("Home", 3, 5), 0);
    assert.equal(facets.facetKeyTarget("End", 0, 5), 4);
    assert.equal(facets.facetKeyTarget("Enter", 0, 5), undefined);
    assert.equal(facets.facetLabel("clearAll", "fr"), "Tout effacer");
    assert.equal(
      facets.facetLabel("truncated", "en", undefined, { count: "2,000" }),
      "Counts cover the first 2,000 records."
    );
    assert.equal(
      facets.facetLabel("title", "en", (key, fallback) =>
        key === "title" ? "Refine" : fallback
      ),
      "Refine"
    );
  });

  test("setFilter takes the values the filter bar would set", () => {
    const screen = {
      filters: [
        {
          id: "tag",
          type: "select" as const,
          label: { en: "Tag", fr: "Étiquette" },
          targets: [{ tableId: "pages", columnId: "tags" }],
        },
        {
          id: "status",
          type: "select" as const,
          label: "Status",
          targets: [{ tableId: "pages", columnId: "status" }],
          options: [
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
          ],
        },
        {
          id: "period",
          type: "dateRange" as const,
          label: "Period",
          targets: [{ tableId: "pages", columnId: "updatedAt" }],
        },
      ],
    };
    const check = dashboard.checkDashboardFilterValue;
    assert.deepEqual(check(screen, "tag", "news"), {
      ok: true,
      value: ["news"],
    });
    assert.deepEqual(check(screen, "tag", ["a", 2, "a"]), {
      ok: true,
      value: ["a", "2"],
    });
    assert.deepEqual(check(screen, "tag", []), { ok: true });
    assert.deepEqual(check(screen, "tag", undefined), { ok: true });
    assert.deepEqual(check(screen, "tag", null), { ok: true });
    const missing = check(screen, "section", ["a"]);
    assert.equal(missing.ok, false);
    assert.equal(!missing.ok && missing.code, "unknownFilter");
    assert.equal(
      !missing.ok && missing.message,
      "The screen has no filter “section”."
    );
    for (const value of [true, { a: 1 }, [""], [Number.NaN], [["a"]]]) {
      const refused = check(screen, "tag", value);
      assert.equal(!refused.ok && refused.code, "invalidValue", String(value));
    }
    assert.deepEqual(check(screen, "status", ["draft"]), {
      ok: true,
      value: ["draft"],
    });
    const unknown = check(screen, "status", ["archived"], { locale: "fr" });
    assert.equal(
      !unknown.ok && unknown.message,
      "« archived » n’est pas une option du filtre « Status »."
    );
    // The renderer passes the target column's options when the filter has none.
    const column = check(screen, "tag", ["x"], {
      options: [{ value: "news", label: "News" }],
    });
    assert.equal(!column.ok && column.code, "invalidValue");
    assert.deepEqual(check(screen, "period", { start: "2026-09-01" }), {
      ok: true,
      value: { start: "2026-09-01" },
    });
    assert.deepEqual(check(screen, "period", { preset: "last7Days" }), {
      ok: true,
      value: { preset: "last7Days" },
    });
    assert.deepEqual(check(screen, "period", {}), { ok: true });
    for (const value of [
      "2026-09-01",
      { start: "2026-13-01" },
      { start: "2026-09-10", end: "2026-09-01" },
      { preset: "yesterday" },
      { preset: "last7Days", start: "2026-09-01" },
      { from: "2026-09-01" },
    ]) {
      const refused = check(screen, "period", value);
      assert.equal(
        !refused.ok && refused.code,
        "invalidValue",
        JSON.stringify(value)
      );
    }
    assert.deepEqual(
      dashboard
        .dashboardSourceFilterRules(
          {
            filters: [
              { ...screen.filters[0], value: ["news"] },
              { ...screen.filters[1], value: ["draft"] },
              { ...screen.filters[2], value: { preset: "last7Days" } },
            ] as never,
          },
          "pages",
          { exclude: ["tag"], today: "2026-09-25" }
        )
        .map((item) => [item.columnId, item.operator, item.values]),
      [
        ["status", "isAnyOf", ["draft"]],
        ["updatedAt", "between", ["2026-09-19", "2026-09-25"]],
      ]
    );
  });

  test("the facet list block: its schema, props, clicks and counts", async () => {
    const options = {
      filterId: "section",
      tableId: "pages",
      column: COLUMNS[1] as Row & { id: string },
    };
    const schema = block.facetBlockSchema(options);
    assert.deepEqual(schema.label, {
      en: "Facet list",
      fr: "Liste de facettes",
    });
    assert.equal(schema.placement, "any");
    assert.deepEqual(schema.defaultProps, { layout: "list" });
    assert.equal(schema.validateProps?.({ layout: "chips" }), undefined);
    assert.deepEqual(
      block
        .facetBlockProblems({
          filterId: "no way",
          layout: "grid",
          showCounts: 1,
        })
        ?.map((problem) => problem.path),
      ["filterId", "layout", "showCounts"]
    );
    assert.deepEqual(block.facetBlockProps({}, options), {
      filterId: "section",
      layout: "list",
      showCounts: true,
    });
    assert.deepEqual(
      block.facetBlockProps(
        { filterId: "tag", layout: "chips", showCounts: false },
        options
      ),
      { filterId: "tag", layout: "chips", showCounts: false }
    );
    assert.deepEqual(block.toggleFacetBlockValue(["a"], "b"), ["a", "b"]);
    assert.deepEqual(block.toggleFacetBlockValue(["a", "b"], "a"), ["b"]);
    assert.deepEqual(block.toggleFacetBlockValue(undefined, "a"), ["a"]);
    const column = block.facetBlockColumn(options.column, "en");
    assert.equal(column.showEmpty, false);
    const requests: Row[] = [];
    const counts = await block.loadFacetBlockCounts({
      actions: {
        aggregate: ((params: Row) => {
          requests.push(params);
          return Promise.resolve({
            groups: [
              { keys: ["Software"], values: [4] },
              { keys: [null], values: [2] },
            ],
          });
        }) as never,
      },
      column,
      rules: [rule("status", "isAnyOf", ["draft"])],
      locale: "en",
    });
    assert.deepEqual(requests[0]?.requiredFilters, [
      rule("status", "isAnyOf", ["draft"]),
    ]);
    assert.deepEqual(requests[0]?.groupBy, [{ columnId: "category" }]);
    assert.deepEqual(
      block
        .facetBlockEntries(column, {
          counts,
          selected: ["Software"],
          locale: "en",
        })
        .map((entry) => [entry.label, entry.count, entry.selected]),
      [["Software", 4, true]]
    );
    assert.equal(
      await block.loadFacetBlockCounts({ column, rules: [], locale: "en" }),
      undefined
    );
    const booleans = block.facetBlockColumn(
      { id: "active", type: "boolean" },
      "fr"
    );
    assert.deepEqual(
      booleans.options.map((option) => [option.value, option.label]),
      [
        ["true", "Oui"],
        ["false", "Non"],
      ]
    );
  });

  test("folders: the tree's folders with their locations, searched", () => {
    const directory = folders.buildFolderDirectory(TREE, {
      settings: TREE_SETTINGS,
    });
    assert.deepEqual(
      directory.folders.map((entry) => [entry.name, entry.depth, entry.order]),
      [
        ["Brand", 0, 0],
        ["Logos", 1, 1],
        ["Campaigns", 0, 2],
        ["2026", 1, 3],
        ["Été", 2, 4],
        ["Lost", 0, 5],
      ]
    );
    const ete = directory.folders[4];
    assert.ok(ete);
    assert.equal(folders.folderPathText(ete), "Campaigns › 2026 › Été");
    assert.equal(folders.folderLocationText(ete, "Root"), "Campaigns › 2026");
    assert.equal(
      folders.folderLocationText(directory.folders[0] as never, "Root"),
      "Root"
    );
    assert.deepEqual(
      folders.searchFolders(directory, "ete").map((entry) => entry.id),
      ["f-ete"]
    );
    assert.deepEqual(
      folders.searchFolders(directory, "campaigns").map((entry) => entry.id),
      ["f-campaigns", "f-2026", "f-ete"]
    );
    assert.equal(folders.searchFolders(directory, "").length, 6);
    assert.deepEqual(folders.folderFacetLabel(directory, "f-2026", "fr"), {
      label: "2026",
      detail: "Campaigns",
      order: 3,
    });
    assert.deepEqual(folders.folderFacetLabel(directory, "f-brand", "fr"), {
      label: "Brand",
      detail: "Racine",
      order: 0,
    });
  });

  test("folders load with the subtree scope, else page by page", async () => {
    const requests: Row[] = [];
    const scoped = await folders.loadFolderDirectory({
      list: (params) => {
        requests.push(params);
        return Promise.resolve({
          data: TREE,
          meta: { scope: "applied", truncated: true },
        });
      },
      settings: TREE_SETTINGS,
    });
    assert.deepEqual(requests[0]?.scope, { kind: "subtree", parentId: null });
    assert.deepEqual(
      (requests[0]?.advancedFilters as Row[]).map((item) => [
        item.columnId,
        item.operator,
        item.values,
      ]),
      [["kind", "isAnyOf", ["folder"]]]
    );
    assert.equal(requests[0]?.pageSize, 2000);
    assert.equal(scoped.truncated, true);
    assert.equal(scoped.folders.length, 6);
    const pages: Row[] = [];
    const listed = await folders.loadFolderDirectory({
      list: (params) => {
        pages.push(params);
        return Promise.resolve({
          data: params.scope ? [] : TREE,
          meta: { totalCount: TREE.length },
        });
      },
      settings: { ...TREE_SETTINGS, kindColumn: undefined },
    });
    assert.equal(pages.length, 2);
    assert.equal(pages[1]?.scope, undefined);
    assert.deepEqual(pages[1]?.advancedFilters, []);
    // Without a kind column, folders are the rows with children.
    assert.deepEqual(
      listed.folders.map((entry) => entry.id),
      ["f-brand", "f-logos", "f-campaigns", "f-2026"]
    );
    const local = await folders.loadFolderDirectory({
      rows: TREE,
      settings: TREE_SETTINGS,
    });
    assert.equal(local.folders.length, 6);
  });

  test("the folder filter: the root alone or folders, as rules", () => {
    assert.deepEqual(folders.folderChoiceOf({ operator: "isEmpty" }), {
      root: true,
      ids: [],
    });
    assert.deepEqual(
      folders.folderChoiceOf({
        operator: "isAnyOf",
        values: ["a", "a", "", 2],
      }),
      { root: false, ids: ["a", "2"] }
    );
    const root = folders.toggleFolderChoice(
      { operator: "isAnyOf", values: ["a"] },
      null
    );
    assert.deepEqual(root, { operator: "isEmpty", values: [] });
    assert.deepEqual(folders.toggleFolderChoice(root, null), {
      operator: "isAnyOf",
      values: [],
    });
    assert.deepEqual(folders.toggleFolderChoice(root, "b"), {
      operator: "isAnyOf",
      values: ["b"],
    });
    assert.deepEqual(
      folders.toggleFolderChoice(
        { operator: "isAnyOf", values: ["a", "b"] },
        "a"
      ),
      { operator: "isAnyOf", values: ["b"] }
    );
    assert.equal(
      folders.folderChoiceComplete({ operator: "isAnyOf", values: [] }),
      false
    );
    assert.equal(folders.folderChoiceComplete(root), true);
    const directory = folders.buildFolderDirectory(TREE, {
      settings: TREE_SETTINGS,
    });
    assert.equal(folders.folderChoiceText(root, directory, "fr"), "Racine");
    assert.equal(
      folders.folderChoiceText(
        { operator: "isAnyOf", values: ["f-ete", "x"] },
        directory,
        "en"
      ),
      "Été, x"
    );
    assert.equal(
      folders.defaultNewFolderParent(
        [rule("parentId", "isAnyOf", ["f-2026"])],
        "parentId"
      ),
      "f-2026"
    );
    assert.equal(
      folders.defaultNewFolderParent(
        [rule("parentId", "isAnyOf", ["a", "b"])],
        "parentId"
      ),
      null
    );
    assert.equal(folders.defaultNewFolderParent([], "parentId"), null);
  });

  test("new folders: where they go, their name, how they are created", async () => {
    assert.equal(folders.newFolderShownIn("gallery"), true);
    assert.equal(folders.newFolderShownIn("table"), true);
    assert.equal(folders.newFolderShownIn("filetree"), false);
    assert.equal(folders.newFolderShownIn("form"), false);
    assert.equal(folders.newFolderName("  Summer ", "en"), "Summer");
    assert.equal(folders.newFolderName(" ", "fr"), "Nouveau dossier");
    const tree = folders.folderTreeOf(
      { parentColumn: "parentId", kindColumn: "kind" },
      [{ id: "name" }, { id: "parentId" }, { id: "kind" }]
    );
    assert.equal(tree?.parentColumn, "parentId");
    assert.equal(tree?.nameColumn, "name");
    assert.equal(folders.folderTreeOf(false, [{ id: "parentId" }]), undefined);
    assert.equal(folders.folderTreeOf({}, [{ id: "name" }]), undefined);
    assert.deepEqual(folders.folderTableOptions({ newFolderAction: false }), {
      newFolderAction: false,
      folderFilter: true,
    });
    const createFolder = (input: { parentId: string | null; name: string }) =>
      Promise.resolve({
        id: "new",
        name: input.name,
        parentId: input.parentId,
      });
    assert.equal(
      folders.canCreateFolderUnder(null, { tree: { createFolder } }),
      true
    );
    assert.equal(
      folders.canCreateFolderUnder(null, {
        tree: { createFolder },
        hooks: { canCreateFolder: (parent) => parent !== null },
      }),
      false
    );
    assert.equal(folders.canCreateFolderUnder(null, {}), false);
    assert.equal(
      folders.canCreateFolderUnder(null, {
        canCreate: true,
        createRecord: () => Promise.resolve({ success: true }),
      }),
      true
    );
    const settings = {
      parentColumn: "parentId",
      kindColumn: "kind",
      nameColumn: "name",
    };
    assert.deepEqual(
      await folders.createFolderRecord({
        tree: { createFolder },
        settings,
        parentId: "f-1",
        name: "Summer",
        failure: "Failed",
      }),
      { id: "new", row: { id: "new", name: "Summer", parentId: "f-1" } }
    );
    const created: Row[] = [];
    assert.deepEqual(
      await folders.createFolderRecord({
        createRecord: (values) => {
          created.push(values);
          return Promise.resolve({ success: true });
        },
        settings,
        parentId: null,
        name: "Summer",
        failure: "Failed",
      }),
      {}
    );
    assert.deepEqual(created, [
      { name: "Summer", parentId: null, kind: "folder" },
    ]);
    await assert.rejects(
      folders.createFolderRecord({
        createRecord: () => Promise.resolve({ success: false }),
        settings,
        parentId: null,
        name: "Summer",
        failure: "Failed",
      }),
      FAILED
    );
  });
}
