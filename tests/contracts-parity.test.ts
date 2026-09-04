import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { applyFilters } from "../src/components/ui/yayaw-table/hooks/use-data-table-advanced-filters";
import {
  compatibleListParams,
  normalizeFilterEnvelope,
  normalizeViewAliases,
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
