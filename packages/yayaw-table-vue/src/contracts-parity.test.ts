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

import pages from "../../../tests/fixtures/paginated-rows.json";
import { fetchAllContractRows } from "./table-contracts";

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
