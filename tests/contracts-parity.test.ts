import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { applyFilters } from "../src/components/ui/yayaw-table/hooks/use-data-table-advanced-filters";
import {
  compatibleListParams,
  dateGroupKey,
  emptyGroupLabel,
  groupHeadingLabel,
  groupValueKey,
  normalizeColumnSizing,
  normalizeFilterEnvelope,
  normalizeViewAliases,
  resizedColumnSizeFromKey,
  tableQueryKey,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import fixtures from "./fixtures/parity.json";

it("ships the same contract source in both standalone registries", () => {
  expect(
    readFileSync("packages/yayaw-table-vue/src/table-contracts.ts", "utf8")
  ).toBe(
    readFileSync(
      "src/components/ui/yayaw-table/utils/table-contracts.ts",
      "utf8"
    )
  );
});

it("ships the same range-selection contract in both standalone registries", () => {
  expect(
    readFileSync("packages/yayaw-table-vue/src/row-selection-range.ts", "utf8")
  ).toBe(
    readFileSync(
      "src/components/ui/yayaw-table/utils/row-selection-range.ts",
      "utf8"
    )
  );
});

it("normalizes persisted widths and keyboard resize commands", () => {
  expect(
    normalizeColumnSizing(
      { name: 241.6, status: -1, unknown: 300, empty: Number.NaN },
      ["name", "status"]
    )
  ).toEqual({ name: 242 });
  expect(
    resizedColumnSizeFromKey({
      key: "ArrowRight",
      maxSize: 260,
      minSize: 80,
      size: 255,
    })
  ).toBe(260);
  expect(
    resizedColumnSizeFromKey({
      key: "Home",
      maxSize: 260,
      minSize: 80,
      size: 150,
    })
  ).toBe(80);
});
for (const fixture of fixtures.filters) {
  it(`React filtering: ${fixture.label}`, () => {
    const accessors = Object.fromEntries(
      Object.keys(fixtures.rows[0]).map((key) => [
        key,
        (row: Record<string, unknown>) => row[key],
      ])
    );
    expect(
      applyFilters(fixtures.rows, fixture.input, accessors).map((row) => row.id)
    ).toEqual(fixture.ids);
    const params = compatibleListParams({ advancedFilters: fixture.input });
    expect(normalizeFilterEnvelope(params.advancedFilters).joinOperator).toBe(
      params.advancedFilterJoin
    );
  });
}
for (const fixture of fixtures.requests) {
  it(`React list aliases: page ${fixture.page}`, () => {
    expect(compatibleListParams(fixture.input)).toMatchObject({
      page: fixture.page,
      pageSize: fixture.size,
      limit: fixture.size,
      search: fixture.search,
      q: fixture.search,
      globalSearch: fixture.search,
      sorting: fixture.sorting,
    });
  });
}
// The same query keeps the page; another one starts on the first page.
for (const fixture of fixtures.queries) {
  it(`React query comparison: ${fixture.label}`, () => {
    expect(tableQueryKey(fixture.current) === tableQueryKey(fixture.next)).toBe(
      fixture.sameQuery
    );
  });
}
it("reads Vue saved-view names without discarding canonical names", () => {
  expect(
    normalizeViewAliases({
      search: "old",
      globalSearch: "new",
      filters: [{ id: "name", value: "A" }],
      pinning: { left: ["name"] },
    })
  ).toMatchObject({
    globalSearch: "new",
    columnFilters: [{ id: "name", value: "A" }],
    columnPinning: { left: ["name"] },
  });
});

import { fetchAllContractRows } from "../src/components/ui/yayaw-table/utils/table-contracts";
import pages from "./fixtures/paginated-rows.json";

for (const fixture of pages) {
  it(`all matching rows: ${fixture.label}`, async () => {
    const requests: Record<string, unknown>[] = [];
    const rows = await fetchAllContractRows({
      params: {
        pageSize: fixture.pageSize,
        search: "captured",
        sorting: [{ id: "name", desc: true }],
      },
      list: (params) => {
        requests.push(params);
        const page = fixture.pages[Number(params.page) - 1];
        if (!page) {
          throw new Error("Unexpected extra page");
        }
        return Promise.resolve(page);
      },
    });
    expect(rows.map((row) => row.id)).toEqual(fixture.ids);
    expect(requests).toHaveLength(fixture.pages.length);
    expect(
      requests.every(
        (request) =>
          request.search === "captured" && request.limit === fixture.pageSize
      )
    ).toBe(true);
  });
}
it("rejects inconsistent pagination and the page limit instead of returning truncated results", async () => {
  await expect(
    fetchAllContractRows({
      params: { pageSize: 2 },
      list: async () => ({ data: [], meta: { totalCount: 3, pageCount: 2 } }),
    })
  ).rejects.toThrow("empty page");
  await expect(
    fetchAllContractRows({
      params: { pageSize: 2 },
      maxPages: 1,
      list: async () => ({
        data: [{ id: "1" }],
        meta: { totalCount: 3, pageCount: 3 },
      }),
    })
  ).rejects.toThrow("Too many pages");
});

it("groups dates by month and heads empty groups with one translated label", () => {
  expect(dateGroupKey("2026-03-30")).toBe("2026-03");
  expect(dateGroupKey(new Date(2026, 3, 20, 23, 59))).toBe("2026-04");
  expect(dateGroupKey("not a date")).toBe("");
  expect(dateGroupKey(null)).toBe("");
  expect(
    groupHeadingLabel("2026-03", "2026-03-30", { type: "date" }, "en-US")
  ).toBe("March 2026");
  expect(
    groupHeadingLabel("2026-03", "2026-03-30", { type: "date" }, "fr-FR")
  ).toBe("mars 2026");
  expect(groupHeadingLabel("2026-03", "2026-03", { type: "text" })).toBe(
    "2026-03"
  );
  expect(groupValueKey(null)).toBe("");
  expect(groupValueKey(undefined)).toBe("");
  expect(groupValueKey(0)).toBe("0");
  expect(emptyGroupLabel()).toBe("No value");
  expect(emptyGroupLabel("en-GB")).toBe("No value");
  expect(emptyGroupLabel("fr-FR")).toBe("Aucune valeur");
});
