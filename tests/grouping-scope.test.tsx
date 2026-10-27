import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import {
  loadAllGroupedRows,
  shouldGroupAllRows,
} from "../src/components/ui/yayaw-table/utils/grouping-scope";

const roots: Root[] = [];
const clients: QueryClient[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  for (const client of clients.splice(0)) {
    client.clear();
  }
  document.body.replaceChildren();
});

const ROW_COUNT = 25;
const RECORDS = Array.from({ length: ROW_COUNT }, (_, index) => ({
  id: String(index + 1),
  name: `Record ${index + 1}`,
  // Web rows sit on every page, Print rows only past the first one.
  category: index % 2 === 0 || index < 10 ? "Web" : "Print",
}));
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

/** A server list that pages the records and records each request. */
function pagedList() {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    list: (params: Record<string, unknown>) => {
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

async function mountGrouped(table: Record<string, unknown>) {
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const { calls, list } = pagedList();
  const actions = { list };
  await act(async () => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter
          hasMemory
          searchParams={{ "scoped-grouping": JSON.stringify(["category"]) }}
        >
          <DataTable
            getTableActions={() => actions}
            getTableConfig={() => config}
            queryClient={client}
            tableType="scoped"
          />
        </NuqsTestingAdapter>
      </Provider>
    );
    await settle();
  });
  await act(settle);
  return { calls, container };
}

const groupHeadings = (container: HTMLElement): string[] =>
  Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      "tbody td[colspan] button[aria-expanded]"
    )
  ).map((button) => button.textContent?.replace("▾", "").trim() ?? "");

it("groups only the page shown by default", async () => {
  const { calls, container } = await mountGrouped({});
  expect(groupHeadings(container)).toEqual(["Category:Web10"]);
  expect(calls.at(-1)?.pageSize).toBe(10);
});

it("groups every matching row with groupingScope all", async () => {
  const { calls, container } = await mountGrouped({ groupingScope: "all" });
  expect(groupHeadings(container)).toEqual([
    "Category:Web18",
    "Category:Print7",
  ]);
  expect(calls.at(-1)).toMatchObject({ page: 1, pageSize: 100 });
  expect(container.querySelector("[data-grouping-notice]")).toBeNull();
});

it("says when the groups stop at groupingMaxRows", async () => {
  const { container } = await mountGrouped({
    groupingMaxRows: 20,
    groupingScope: "all",
  });
  expect(container.querySelector("[data-grouping-notice]")?.textContent).toBe(
    "Groups cover the first 20 rows. Narrow the filters to group all of them."
  );
});

it("loads every page of the list for grouping", async () => {
  const { calls, list } = pagedList();
  const loaded = await loadAllGroupedRows(
    list,
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
