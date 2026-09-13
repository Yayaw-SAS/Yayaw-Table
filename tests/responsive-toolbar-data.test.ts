import { expect, it } from "bun:test";
import { queryToolbarRows } from "../examples/responsive-toolbar-data";

const rows = [
  { id: "atlas", name: "Atlas", status: "Open", price: 24, active: true },
  { id: "beacon", name: "Beacon", status: "Closed", price: 12, active: false },
  { id: "current", name: "Current", status: "Open", price: 36, active: true },
];
const open = {
  columnId: "status",
  type: "select",
  operator: "is",
  values: "Open",
  isActive: true,
};

it("searches text, status, numbers and booleans across all data columns", () => {
  for (const [search, expected] of [
    ["Closed", ["beacon"]],
    ["36", ["current"]],
    ["false", ["beacon"]],
    ["OPEN", ["atlas", "current"]],
  ] as const) {
    expect(
      queryToolbarRows(rows, { search }).data.map((row) => row.id)
    ).toEqual(expected);
  }
});

it("filters the preview records and sorts the actual result in both directions", () => {
  expect(
    queryToolbarRows(rows, { orderBy: { price: "asc" } }).data.map(
      (row) => row.id
    )
  ).toEqual(["beacon", "atlas", "current"]);
  expect(
    queryToolbarRows(rows, {
      advancedFilters: [open],
      orderBy: { price: "desc" },
    }).data.map((row) => row.id)
  ).toEqual(["current", "atlas"]);
  expect(
    queryToolbarRows(rows, {
      advancedFilters: [open],
      sorting: [{ id: "name", desc: false }],
    }).data.map((row) => row.id)
  ).toEqual(["atlas", "current"]);
  expect(rows.map((row) => row.id)).toEqual(["atlas", "beacon", "current"]);
});

it("combines search, typed quick filters and advanced predicates before pagination", () => {
  expect(
    queryToolbarRows(rows, {
      filters: { active: [false] },
      search: "BEA",
    }).data.map((row) => row.id)
  ).toEqual(["beacon"]);
  expect(
    queryToolbarRows(rows, { filters: { name: { contains: "las" } } }).data.map(
      (row) => row.id
    )
  ).toEqual(["atlas"]);
  const result = queryToolbarRows(rows, {
    advancedFilters: [open],
    orderBy: { price: "desc" },
    page: 2,
    limit: 1,
  });
  expect(result.data.map((row) => row.id)).toEqual(["atlas"]);
  expect(result.meta).toEqual({ totalCount: 2, pageCount: 2 });
});

it("supports OR rules, inactive rules, empty results and reset", () => {
  const rules = [
    open,
    { columnId: "price", type: "number", operator: "lessThan", values: 20 },
  ];
  expect(queryToolbarRows(rows, { advancedFilters: rules }).data).toEqual([]);
  expect(
    queryToolbarRows(rows, {
      advancedFilters: { filters: rules, joinOperator: "or" },
    }).meta.totalCount
  ).toBe(3);
  expect(
    queryToolbarRows(rows, { advancedFilters: [{ ...open, isActive: false }] })
      .data
  ).toEqual(rows);
  expect(
    queryToolbarRows(rows, {
      filters: { status: [] },
      sorting: [],
      advancedFilters: [],
    }).data
  ).toEqual(rows);
});
