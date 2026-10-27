import { QueryClient } from "@tanstack/vue-query";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";
import { loadAllGroupedRows, shouldGroupAllRows } from "./grouping-scope";
import type { TableListParams, TableRecord } from "./types";

enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));

const ROW_COUNT = 25;
const RECORDS = Array.from({ length: ROW_COUNT }, (_, index) => ({
  id: String(index + 1),
  name: `Record ${index + 1}`,
  // Web rows sit on every page, Print rows only past the first one.
  category: index % 2 === 0 || index < 10 ? "Web" : "Print",
}));

const groupHeadings = (wrapper: ReturnType<typeof mount>): string[] =>
  wrapper
    .findAll("tbody tr.grouped")
    .map((group) => group.text().replace("▾", ""));

/** A server list that pages the records and records each request. */
function pagedList() {
  const calls: TableListParams[] = [];
  return {
    calls,
    list: (params: TableListParams) => {
      calls.push(params);
      const pageSize = Number(params.pageSize);
      const start = (Number(params.page) - 1) * pageSize;
      return Promise.resolve({
        data: RECORDS.slice(start, start + pageSize),
        meta: {
          pageCount: Math.ceil(ROW_COUNT / pageSize),
          totalCount: ROW_COUNT,
        },
      });
    },
  };
}

function mountGrouped(table: Record<string, unknown>) {
  window.history.replaceState(
    {},
    "",
    `/?scoped-grouping=${encodeURIComponent(JSON.stringify(["category"]))}`
  );
  const config = defineTableConfig({
    id: "scoped",
    columns: {
      mandatory: ["name"],
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "category", header: "Category", type: "text" },
      ],
      visible: ["name", "category"],
      order: ["name", "category"],
    },
    table: { enableGrouping: true, enableRowSelection: false, ...table },
    translations: { namespace: "scoped", keys: {} },
  });
  const { calls, list } = pagedList();
  const actions = { list };
  const wrapper = mount(YayawDataTable, {
    props: {
      config,
      tableType: config.id,
      getRowId: (row: TableRecord) => String(row.id),
      getTableActions: () => actions,
      queryClient: new QueryClient(),
    },
  });
  return { calls, wrapper };
}

it("groups only the page shown by default", async () => {
  const { calls, wrapper } = mountGrouped({});
  await flushPromises();
  expect(groupHeadings(wrapper)).toEqual(["Category:Web10"]);
  expect(calls.at(-1)?.pageSize).toBe(10);
  expect(wrapper.find("[data-yayaw-pagination]").exists()).toBe(true);
});

it("groups every matching row with groupingScope all", async () => {
  const { calls, wrapper } = mountGrouped({ groupingScope: "all" });
  await flushPromises();
  expect(groupHeadings(wrapper)).toEqual(["Category:Web18", "Category:Print7"]);
  expect(calls.at(-1)).toMatchObject({ page: 1, pageSize: 100 });
  expect(wrapper.find("[data-yayaw-pagination]").exists()).toBe(false);
  expect(wrapper.find("[data-grouping-notice]").exists()).toBe(false);
});

it("says when the groups stop at groupingMaxRows", async () => {
  const { wrapper } = mountGrouped({
    groupingMaxRows: 20,
    groupingScope: "all",
  });
  await flushPromises();
  expect(wrapper.get("[data-grouping-notice]").text()).toBe(
    "Groups cover the first 20 rows. Narrow the filters to group all of them."
  );
});

it("loads every page of the list for grouping", async () => {
  const { calls, list } = pagedList();
  const loaded = await loadAllGroupedRows(
    (params) => list(params as unknown as TableListParams),
    { filters: { status: "open" }, page: 3, pageSize: 10 },
    12
  );
  expect(loaded).toMatchObject({ pageCount: 1, rowCount: 12, truncated: true });
  expect(calls[0]).toMatchObject({ filters: { status: "open" }, page: 1 });
  expect(shouldGroupAllRows({ groupingScope: "all" }, ["category"])).toBe(true);
  expect(shouldGroupAllRows({ groupingScope: "all" }, [])).toBe(false);
  expect(
    shouldGroupAllRows({ enableGrouping: false, groupingScope: "all" }, [
      "category",
    ])
  ).toBe(false);
  expect(shouldGroupAllRows({}, ["category"])).toBe(false);
});
