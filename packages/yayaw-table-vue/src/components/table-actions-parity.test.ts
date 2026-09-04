import { QueryClient } from "@tanstack/vue-query";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineTableConfig } from "../config";
import { exportColumns, rowsToCsv } from "../core";
import type { TableListParams, YayawTableProps } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

const rows = [
  { id: "1", name: "Alpha", secret: "hidden" },
  { id: "2", name: "Beta", secret: "hidden" },
  { id: "3", name: "Gamma", secret: "hidden" },
];
const config = defineTableConfig({
  id: "action-parity",
  translations: { namespace: "actions", keys: {} },
  table: {
    defaultPageSize: 1,
    pageSizeOptions: [1, 10],
    syncUrl: false,
    enableViews: false,
  },
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "id", header: "ID" },
      { id: "secret", header: "Secret" },
    ],
    order: ["name", "id", "secret"],
    visible: ["name", "id"],
    mandatory: [],
  },
});
const mountTable = (props: Partial<YayawTableProps> = {}) =>
  mount(YayawDataTable, {
    props: { tableType: config.id, config, ...props },
  });
type Wrapper = ReturnType<typeof mountTable>;
const next = async (wrapper: Wrapper) => {
  await wrapper.get(".yayaw-pagination button:last-child").trigger("click");
  await flushPromises();
};
const select = async (wrapper: Wrapper, checked = true) => {
  await wrapper.get('tbody input[type="checkbox"]').setValue(checked);
  await flushPromises();
};
const listPage = (params: TableListParams, data = rows) => ({
  data: data.slice(params.page - 1, params.page),
  meta: { totalCount: data.length, pageCount: data.length },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));

describe("table actions parity", () => {
  it("exports all local filtered and sorted results, not just the displayed page", async () => {
    const onExport = vi.fn();
    const wrapper = mountTable({ data: rows, onExport });
    await flushPromises();
    await wrapper.get('input[type="search"]').setValue("a");
    await wrapper.get("th.sortable").trigger("click");
    await wrapper.get("th.sortable").trigger("click");
    await next(wrapper);
    await wrapper.get('.yayaw-toolbar [aria-label="Export"]').trigger("click");
    await flushPromises();
    expect(onExport).toHaveBeenCalledExactlyOnceWith([...rows].reverse());
  });

  it("exports every server page with a captured query and locks duplicate exports", async () => {
    const firstPage = deferred<ReturnType<typeof listPage>>();
    let exporting = false;
    const requests: TableListParams[] = [];
    const list = vi.fn(async (params: TableListParams) => {
      if (exporting && params.search === "a") {
        requests.push(params);
        if (params.page === 1) {
          return await firstPage.promise;
        }
      }
      return listPage(params);
    });
    const onExport = vi.fn();
    const wrapper = mountTable({ getTableActions: () => ({ list }), onExport });
    await flushPromises();
    await wrapper.get('input[type="search"]').setValue("a");
    await flushPromises();
    exporting = true;
    const button = wrapper.get('.yayaw-toolbar [aria-label="Export"]');
    await button.trigger("click");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    await wrapper.get('input[type="search"]').setValue("new query");
    firstPage.resolve(listPage({ page: 1 } as TableListParams));
    await flushPromises();
    expect(requests.map((request) => request.page)).toEqual([1, 2, 3]);
    expect(requests.every((request) => request.search === "a")).toBe(true);
    expect(onExport).toHaveBeenCalledExactlyOnceWith(rows);
    expect(button.attributes("disabled")).toBeUndefined();
  });

  it("reports failed exports, does not deliver partial rows and allows retry", async () => {
    let fail = true;
    const list = vi.fn((params: TableListParams) => {
      if (params.page === 2 && fail) {
        throw new Error("Export unavailable");
      }
      return listPage(params);
    });
    const onExport = vi.fn();
    const wrapper = mountTable({ getTableActions: () => ({ list }), onExport });
    await flushPromises();
    await wrapper.get('.yayaw-toolbar [aria-label="Export"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain(
      "Export unavailable"
    );
    expect(onExport).not.toHaveBeenCalled();
    fail = false;
    await wrapper.get('.yayaw-toolbar [aria-label="Export"]').trigger("click");
    await flushPromises();
    expect(onExport).toHaveBeenCalledExactlyOnceWith(rows);
  });

  it("keeps manual selections across pages and removes only unchecked rows", async () => {
    const onBulkExport = vi.fn();
    const wrapper = mountTable({
      getTableActions: () => ({ list: async (params) => listPage(params) }),
      onBulkExport,
    });
    await flushPromises();
    await select(wrapper);
    await next(wrapper);
    await select(wrapper);
    await next(wrapper);
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("2 selected");
    await wrapper.get('.yayaw-bulk-bar [aria-label="Export"]').trigger("click");
    expect(onBulkExport).toHaveBeenCalledExactlyOnceWith(rows.slice(0, 2));
    await wrapper
      .get(".yayaw-pagination button:nth-last-child(2)")
      .trigger("click");
    await flushPromises();
    await select(wrapper, false);
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("1 selected");
    await wrapper.get('input[type="search"]').setValue("Gamma");
    await flushPromises();
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(false);
    expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([{}]);
  });

  it("loads all selectable rows and preserves the rest when one row is unchecked", async () => {
    const wrapper = mountTable({
      config: {
        ...config,
        table: { ...config.table, canSelectRow: (row) => row.id !== "3" },
      },
      getTableActions: () => ({ list: async (params) => listPage(params) }),
    });
    await flushPromises();
    await select(wrapper);
    await wrapper.get('[aria-label="Select all 3"]').trigger("click");
    await flushPromises();
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("2 selected");
    await select(wrapper, false);
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("1 selected");
    expect(wrapper.emitted("rowSelectionChange")?.at(-1)?.[0]).toMatchObject({
      "2": true,
    });
  });

  it("ignores an old select-all response after the filter changes", async () => {
    const pending = deferred<ReturnType<typeof listPage>>();
    let loadingAll = false;
    const list = vi.fn(async (params: TableListParams) => {
      if (loadingAll && !params.search && params.page === 1) {
        return await pending.promise;
      }
      return listPage(params);
    });
    const wrapper = mountTable({ getTableActions: () => ({ list }) });
    await flushPromises();
    await select(wrapper);
    loadingAll = true;
    await wrapper.get('[aria-label="Select all 3"]').trigger("click");
    await wrapper.get('input[type="search"]').setValue("Beta");
    await flushPromises();
    pending.resolve(listPage({ page: 1 } as TableListParams));
    await flushPromises();
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(false);
    expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([{}]);
  });

  it("returns to a populated page after deleting the last row of the last page", async () => {
    let serverRows = [...rows];
    const list = vi.fn(async (params: TableListParams) =>
      listPage(params, serverRows)
    );
    const bulkDelete = vi.fn((ids: string[]) => {
      serverRows = serverRows.filter((row) => !ids.includes(row.id));
      return { success: true };
    });
    const wrapper = mountTable({
      getTableActions: () => ({ list, bulkDelete }),
    });
    await flushPromises();
    await next(wrapper);
    await next(wrapper);
    await select(wrapper);
    await wrapper.get('.yayaw-bulk-bar [aria-label="Delete"]').trigger("click");
    await wrapper
      .get('[role="alertdialog"] .yayaw-button-danger')
      .trigger("click");
    await flushPromises();
    expect(wrapper.get("tbody").text()).toContain("Beta");
    expect(wrapper.get(".yayaw-pagination").text()).toContain("2 / 2");
  });

  it("refreshes the active list once on broad invalidation, without refetching for aggregates", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const list = vi.fn(async (params: TableListParams) => listPage(params));
    const wrapper = mountTable({
      queryClient,
      getTableActions: () => ({ list }),
    });
    await flushPromises();
    await next(wrapper);
    queryClient.setQueryData(["yayaw-table", config.id, "aggregate", {}], {});
    list.mockClear();
    await queryClient.invalidateQueries({
      queryKey: ["yayaw-table", config.id, "aggregate"],
    });
    await flushPromises();
    expect(list).not.toHaveBeenCalled();
    await queryClient.invalidateQueries({
      queryKey: ["yayaw-table", config.id],
    });
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[0].page).toBe(2);
    wrapper.unmount();
    queryClient.clear();
  });

  it("discards a pre-mutation response when an explicit refresh starts a fresh request", async () => {
    const beforeWrite = deferred<ReturnType<typeof listPage>>();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const list = vi
      .fn()
      .mockImplementationOnce(() => beforeWrite.promise)
      .mockResolvedValue({
        data: [{ ...rows[0], name: "After mutation" }],
        meta: { totalCount: 1, pageCount: 1 },
      });
    const wrapper = mountTable({
      queryClient,
      getTableActions: () => ({ list }),
      toolbarActions: [
        {
          id: "refresh",
          label: "Refresh rows",
          handler: async (context) => {
            await context.refresh();
          },
        },
      ],
    });
    await flushPromises();
    const refreshButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "Refresh rows");
    expect(refreshButton).toBeDefined();
    await refreshButton?.trigger("click");
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
    expect(wrapper.get("tbody").text()).toContain("After mutation");
    beforeWrite.resolve(listPage({ page: 1 } as TableListParams));
    await flushPromises();
    expect(wrapper.get("tbody").text()).toContain("After mutation");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
    queryClient.clear();
  });

  it("clamps local pagination when refreshed data removes the last page", async () => {
    const wrapper = mountTable({ data: rows });
    await flushPromises();
    await next(wrapper);
    await next(wrapper);
    await wrapper.setProps({ data: rows.slice(0, 2) });
    await flushPromises();
    expect(wrapper.get("tbody").text()).toContain("Beta");
    expect(wrapper.get(".yayaw-pagination").text()).toContain("2 / 2");
  });

  it("exports visible columns in display order, without utility columns", () => {
    const columns = exportColumns(
      [
        ...config.columns.definitions,
        { id: "menu", header: "Menu", type: "actions" },
        { id: "select", header: "Select" },
      ],
      { secret: false },
      ["id", "select", "name", "menu"]
    );
    expect(rowsToCsv(rows.slice(0, 1), columns)).toBe("ID,Name\n1,Alpha");
  });
});
