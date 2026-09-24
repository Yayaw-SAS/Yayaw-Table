import { QueryClient } from "@tanstack/vue-query";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import {
  defaultSortConfig,
  listRestockRows,
  type RestockFirstPage,
  restockFirstPage,
} from "../../../examples/default-sort";
import { initialRowsSuite } from "../../../tests/initial-rows-suite";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";
import { isSameSorting, resolveInitialRowsUse } from "./initial-rows";
import type { TableListParams, TableRecord } from "./types";

initialRowsSuite(it, { isSameSorting, resolveInitialRowsUse });

enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));

// examples/default-sort.ts: the list orders by `orderBy`, then by id.
const BY_START = ["Desk", "Lamp", "Chair"];
const BY_ID = ["Chair", "Desk", "Lamp"];
const RECORD_NAME_PATTERN = /Chair|Desk|Lamp/g;

/** Record names in document order, each once. */
const recordOrder = (text: string): string[] => [
  ...new Set(text.match(RECORD_NAME_PATTERN) ?? []),
];

/** A list that records the table's requests and answers once released. */
function heldList() {
  const calls: TableListParams[] = [];
  let release: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    calls,
    list: async (params: TableListParams) => {
      calls.push(params);
      await released;
      return await listRestockRows({ ...params });
    },
    release: () => release(),
  };
}

/** The demos' table without its Gantt, whose planning lists rows of its own. */
function restockConfig(configuredSort: boolean) {
  const { table, ...config } = defaultSortConfig(configuredSort);
  const { gantt: _gantt, planning: _planning, ...tableOnly } = table;
  return defineTableConfig({
    ...config,
    table: { ...tableOnly, displayModes: ["table"] },
  });
}

function restockProps({
  configuredSort = true,
  firstPage,
  list,
  queryClient = new QueryClient(),
}: {
  configuredSort?: boolean;
  firstPage: RestockFirstPage;
  list: (params: TableListParams) => ReturnType<typeof listRestockRows>;
  queryClient?: QueryClient;
}) {
  const config = restockConfig(configuredSort);
  const actions = { list };
  return {
    config,
    tableType: config.id,
    getRowId: (row: TableRecord) => String(row.id),
    getTableActions: () => actions,
    initialData: firstPage.initialData,
    initialDataSort: firstPage.initialDataSort,
    initialPageCount: firstPage.initialPageCount,
    initialRowCount: firstPage.initialRowCount,
    queryClient,
  };
}

it("renders the host's rows on the server under columns.sort", async () => {
  for (const sortedLikeTable of [false, true]) {
    const props = restockProps({
      firstPage: restockFirstPage(sortedLikeTable),
      list: (params) => listRestockRows({ ...params }),
    });
    const html = await renderToString(
      createSSRApp({ render: () => h(YayawDataTable, props) })
    );
    expect(recordOrder(html)).toEqual(sortedLikeTable ? BY_START : BY_ID);
  }
});

it("shows rows produced in another order at once, then loads them once in columns.sort", async () => {
  const { calls, list, release } = heldList();
  const wrapper = mount(YayawDataTable, {
    props: restockProps({ firstPage: restockFirstPage(false), list }),
  });
  expect(recordOrder(wrapper.text())).toEqual(BY_ID);
  await flushPromises();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.orderBy).toEqual({ restockFrom: "asc" });

  release();
  await flushPromises();
  expect(recordOrder(wrapper.text())).toEqual(BY_START);
  expect(calls).toHaveLength(1);
});

it("keeps rows produced in columns.sort without loading them again", async () => {
  const { calls, list, release } = heldList();
  const wrapper = mount(YayawDataTable, {
    props: restockProps({ firstPage: restockFirstPage(true), list }),
  });
  release();
  await flushPromises();
  expect(recordOrder(wrapper.text())).toEqual(BY_START);
  expect(calls).toHaveLength(0);
  expect(wrapper.find(".yayaw-loading-overlay").exists()).toBe(false);
});

it("loads current rows again when the table is invalidated or its sort changes", async () => {
  const { calls, list, release } = heldList();
  release();
  const queryClient = new QueryClient();
  const wrapper = mount(YayawDataTable, {
    props: restockProps({
      firstPage: restockFirstPage(true),
      list,
      queryClient,
    }),
  });
  await flushPromises();
  expect(calls).toHaveLength(0);

  await queryClient.invalidateQueries({ queryKey: ["yayaw-table"] });
  await flushPromises();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.orderBy).toEqual({ restockFrom: "asc" });

  const byName = encodeURIComponent(
    JSON.stringify([{ id: "name", desc: true }])
  );
  window.history.replaceState({}, "", `/?restock-sort=${byName}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
  await flushPromises();
  expect(calls).toHaveLength(2);
  expect(calls[1]?.orderBy).toEqual({ name: "desc" });
  expect(recordOrder(wrapper.text())).toEqual(["Lamp", "Desk", "Chair"]);
});

it("loads its own rows when the URL starts it in another sort", async () => {
  const byName = encodeURIComponent(
    JSON.stringify([{ id: "name", desc: true }])
  );
  window.history.replaceState({}, "", `/?restock-sort=${byName}`);
  const { calls, list, release } = heldList();
  const wrapper = mount(YayawDataTable, {
    props: restockProps({ firstPage: restockFirstPage(true), list }),
  });
  await flushPromises();
  expect(calls).toHaveLength(1);
  expect(calls[0]?.orderBy).toEqual({ name: "desc" });

  release();
  await flushPromises();
  expect(recordOrder(wrapper.text())).toEqual(["Lamp", "Desk", "Chair"]);
});

it("loads the rows of a table without a sort again on mount, as before", async () => {
  const { calls, list, release } = heldList();
  release();
  mount(YayawDataTable, {
    props: restockProps({
      configuredSort: false,
      firstPage: restockFirstPage(false),
      list,
    }),
  });
  await flushPromises();
  expect(calls).toHaveLength(1);
});
