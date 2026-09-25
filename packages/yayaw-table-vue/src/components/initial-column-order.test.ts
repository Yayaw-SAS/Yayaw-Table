import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { inlineTestPortals } from "../../tests/menu-helpers";
import { defineTableConfig } from "../config";
import type { TableView } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

// As in React `tests/initial-column-order.test.tsx`: a table whose
// `columns.order` differs from its definitions starts in that order, and its
// favorite or default view applies on arrival.

inlineTestPortals();

const config = defineTableConfig({
  id: "arrival-order",
  translations: { namespace: "arrival-order", keys: {} },
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      { id: "status", header: "Status" },
      { id: "amount", header: "Amount", type: "number" },
    ],
    // `status` is not listed: it follows, in definition order.
    order: ["amount", "name"],
    visible: ["name", "status", "amount"],
    mandatory: ["name"],
  },
  table: { enableViews: true, viewTabs: false, displayModes: ["table"] },
});
const CONFIGURED_ORDER = ["amount", "name", "status"];
const compact: TableView = {
  id: "compact",
  tableId: config.id,
  name: "Compact",
  config: { density: "small" },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Opens the table without URL state. Its rows show at once; its saved views
 * only load once it has rendered them, as a slower server call would.
 */
async function openTable({
  favoriteId = null,
  views = [],
}: {
  favoriteId?: null | string;
  views?: TableView[];
} = {}) {
  const viewList = deferred<{ data: TableView[] }>();
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config,
      tableType: config.id,
      data: [
        { id: "1", name: "Alpha", status: "Open", amount: 3 },
        { id: "2", name: "Bravo", status: "Done", amount: 5 },
      ],
      getTableActions: () => ({
        views: {
          getFavorite: () => ({ data: { viewId: favoriteId } }),
          list: () => viewList.promise,
        },
      }),
      syncUrl: true,
    },
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
  await flushPromises();
  const rowsShown = wrapper.text().includes("Alpha");
  viewList.resolve({ data: views });
  await flushPromises();
  return {
    rowsShown,
    /** The data columns of the first row, left to right. */
    columns: () =>
      wrapper
        .get("tbody tr")
        .findAll("td[data-column-id]")
        .map((cell) => cell.attributes("data-column-id"))
        .filter((id) => id !== "select" && id !== "actions"),
    currentView: () => wrapper.get(".yayaw-view-trigger").text(),
  };
}

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    localStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  })
);
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

it("starts in the configured column order", async () => {
  const table = await openTable();
  expect(table.rowsShown).toBe(true);
  expect(table.columns()).toEqual(CONFIGURED_ORDER);
  expect(table.currentView()).toBe("Default view");
});

it("opens on its favorite view when its column order differs from its definitions", async () => {
  const table = await openTable({ favoriteId: compact.id, views: [compact] });
  expect(table.rowsShown).toBe(true);
  expect(table.currentView()).toBe(compact.name);
  expect(table.columns()).toEqual(CONFIGURED_ORDER);
});

it("opens on its default view when its column order differs from its definitions", async () => {
  const table = await openTable({ views: [{ ...compact, isDefault: true }] });
  expect(table.rowsShown).toBe(true);
  expect(table.currentView()).toBe(compact.name);
  expect(table.columns()).toEqual(CONFIGURED_ORDER);
});
