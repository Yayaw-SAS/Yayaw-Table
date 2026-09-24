import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import type { TableActions } from "../providers/table-provider";
import {
  loadGlobalColumnCalculationResults,
  resolveActiveColumnCalculations,
} from "./use-global-column-calculations";

describe("resolveActiveColumnCalculations", () => {
  it("merges user choices with defaults and drops invalid calculations", () => {
    const resolved = resolveActiveColumnCalculations({
      columnDefinitions: [
        {
          id: "price",
          type: "number",
          defaultCalculation: "sum",
        },
        {
          id: "title",
          type: "text",
          defaultCalculation: "sum",
        },
        {
          id: "status",
          type: "text",
          defaultCalculation: "count_values",
        },
        {
          id: "hidden",
          type: "number",
          defaultCalculation: "average",
          enableCalculation: false,
        },
      ],
      userCalculations: {
        price: "average",
        status: "none",
      },
    });

    assert.deepEqual(resolved.calculations, {
      price: "average",
    });
    assert.deepEqual(resolved.columnTypes, {
      price: "number",
    });
  });

  it("accepts boolean-specific calculations only for boolean columns", () => {
    const resolved = resolveActiveColumnCalculations({
      columnDefinitions: [
        {
          id: "isActive",
          type: "boolean",
          defaultCalculation: "count_true",
        },
        {
          id: "title",
          type: "text",
          defaultCalculation: "count_false",
        },
      ],
      userCalculations: {
        isActive: "percent_false",
        title: "count_true",
      },
    });

    assert.deepEqual(resolved.calculations, {
      isActive: "percent_false",
    });
    assert.deepEqual(resolved.columnTypes, {
      isActive: "boolean",
    });
  });
});

describe("loadGlobalColumnCalculationResults", () => {
  it("prioritizes aggregate action when available", async () => {
    let listCalls = 0;
    let aggregateParams: unknown;

    const actions: TableActions = {
      aggregate: (params) => {
        aggregateParams = params;
        return Promise.resolve({
          results: {
            price: { raw: 42, label: "42" },
          },
        });
      },
      list: () => {
        listCalls += 1;
        return Promise.resolve({
          data: [],
          meta: { pageCount: 0, totalCount: 0 },
        });
      },
    };

    const results = await loadGlobalColumnCalculationResults({
      actions,
      advancedFiltersParam: [
        {
          id: "active",
          isActive: true,
          columnId: "status",
          operator: "equals",
          values: "active",
        },
        { id: "inactive", isActive: false },
      ],
      calculations: { price: "sum" },
      columnTypes: { price: "number" },
      filtersParam: [
        { id: "status", value: "active" },
        { id: "global", value: "ignored" },
      ],
      globalSearchParam: "  acme  ",
      locale: "en-US",
      pageSizeParam: "50",
      sortParam: [{ id: "price", desc: true }],
    });

    assert.deepEqual(results, {
      price: { raw: 42, label: "42" },
    });
    assert.equal(listCalls, 0);
    assert.deepEqual(aggregateParams, {
      filters: { status: "active" },
      advancedFilterJoin: "and",
      advancedFilters: [
        {
          id: "active",
          isActive: true,
          columnId: "status",
          operator: "equals",
          values: "active",
        },
      ],
      search: "acme",
      calculations: { price: "sum" },
      locale: "en-US",
    });
  });

  it("falls back to paginated list strategy when aggregate is unavailable", async () => {
    const listRequests: Record<string, unknown>[] = [];

    const actions: TableActions = {
      list: (params) => {
        listRequests.push(params as Record<string, unknown>);
        const page = params.page as number;

        if (page === 1) {
          return Promise.resolve({
            data: [{ price: "1" }, { price: 2 }],
            meta: { pageCount: 2, totalCount: 3 },
          });
        }

        return Promise.resolve({
          data: [{ price: "3" }],
          meta: { pageCount: 2, totalCount: 3 },
        });
      },
    };

    const results = await loadGlobalColumnCalculationResults({
      actions,
      advancedFiltersParam: [{ id: "stock", isActive: true }],
      calculations: { price: "sum" },
      columnTypes: { price: "number" },
      filtersParam: [{ id: "category", value: "shoes" }],
      globalSearchParam: "shoe",
      locale: "en-US",
      pageSizeParam: "2",
      sortParam: [{ id: "price", desc: false }],
    });

    assert.equal(listRequests.length, 2);
    assert.deepEqual(listRequests[0].orderBy, { price: "asc" });
    assert.equal(listRequests[0].search, "shoe");
    assert.equal(listRequests[0].page, 1);
    assert.equal(listRequests[0].limit, 2);

    assert.deepEqual(results, {
      price: { raw: 6, label: "6" },
    });
  });

  it("returns an empty result map when no action can provide data", async () => {
    const results = await loadGlobalColumnCalculationResults({
      actions: undefined,
      advancedFiltersParam: [],
      calculations: { price: "sum" },
      columnTypes: { price: "number" },
      filtersParam: [],
      globalSearchParam: "",
      locale: "en-US",
      pageSizeParam: "10",
      sortParam: [],
    });

    assert.deepEqual(results, {});
  });

  it("reads results in the column's format: host labels stay, plain values are formatted", async () => {
    const columns = {
      price: {
        id: "price",
        type: "number",
        accessorKey: "amount",
        numberFormat: { style: "currency" as const, currency: "EUR" },
      },
      count: { id: "count", type: "number" },
    };
    const served = await loadGlobalColumnCalculationResults({
      actions: {
        aggregate: () =>
          Promise.resolve({
            // A primitive (as Vue hosts answer) and a host label.
            results: { price: 4049.5, count: { raw: 3, label: "three" } },
          }),
      } as unknown as TableActions,
      advancedFiltersParam: [],
      calculations: { price: "sum", count: "count_all" },
      columns,
      columnTypes: { price: "number", count: "number" },
      filtersParam: [],
      globalSearchParam: "",
      locale: "en-US",
      pageSizeParam: "10",
      sortParam: [],
    });
    assert.deepEqual(served, {
      price: { raw: 4049.5, label: "€4,049.50" },
      count: { raw: 3, label: "three" },
    });

    // The list fallback reads the accessor and the column's format.
    const listed = await loadGlobalColumnCalculationResults({
      actions: {
        list: () =>
          Promise.resolve({
            data: [{ amount: 2499 }, { amount: 1200.5 }],
            meta: { pageCount: 1, totalCount: 2 },
          }),
      },
      advancedFiltersParam: [],
      calculations: { price: "sum" },
      columns,
      columnTypes: { price: "number" },
      filtersParam: [],
      globalSearchParam: "",
      locale: "en-US",
      pageSizeParam: "10",
      sortParam: [],
    });
    assert.deepEqual(listed, { price: { raw: 3699.5, label: "€3,699.50" } });
  });
});
