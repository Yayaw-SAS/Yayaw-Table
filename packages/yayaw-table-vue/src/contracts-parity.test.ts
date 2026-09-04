import { expect, it } from "vitest";
import fixtures from "../../../tests/fixtures/parity.json";
import { applyAdvancedFilters } from "./core";
import { compatibleListParams } from "./table-contracts";
import type { AdvancedFiltersState } from "./types";

for (const fixture of fixtures.filters) {
  it(`Vue filtering: ${fixture.label}`, () => {
    expect(
      applyAdvancedFilters(
        fixtures.rows,
        fixture.input as unknown as AdvancedFiltersState
      ).map((row) => row.id)
    ).toEqual(fixture.ids);
  });
}
for (const fixture of fixtures.requests) {
  it(`Vue list aliases: page ${fixture.page}`, () => {
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
