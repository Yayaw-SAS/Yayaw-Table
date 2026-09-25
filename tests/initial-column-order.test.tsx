import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import type { DragEndEvent } from "@dnd-kit/core";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useColumnDnd } from "../src/components/ui/yayaw-table/components/columns/hooks/use-column-dnd";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import type { TableView } from "../src/components/ui/yayaw-table/types/view-types";

// A table whose `columns.order` differs from its definitions starts in that
// order, as in Vue (`use-table-state.ts`), and writes nothing to the URL until
// the user changes something: its favorite or default view applies on arrival,
// and back and forward show the column order each URL names.

const TABLE_ID = "arrival-order";
const ORDER_KEY = `${TABLE_ID}-order`;
const CONFIGURED_ORDER = ["amount", "name", "status"];
const ROWS = [
  { id: "1", name: "Alpha", status: "Open", amount: 3 },
  { id: "2", name: "Bravo", status: "Done", amount: 5 },
];

const config = defineTableConfig({
  id: TABLE_ID,
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "status", header: "Status", type: "text" },
      { id: "amount", header: "Amount", type: "number" },
    ],
    // `status` is not listed: it follows, in definition order.
    order: ["amount", "name"],
    visible: ["name", "status", "amount"],
    mandatory: ["name"],
  },
  table: { displayModes: ["table"], syncUrl: true, viewTabs: false },
  translations: { namespace: TABLE_ID, keys: {} },
});

const compact: TableView = {
  id: "compact",
  tableId: TABLE_ID,
  name: "Compact",
  createdById: "teammate",
  config: { density: "small" },
};

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

/**
 * Lets the table render, frame after frame, past its batched URL writes. One
 * long `act` would hold React Query's notifications.
 */
const settle = async (frames = 10): Promise<void> => {
  if (frames === 0) {
    return;
  }
  await act(() => new Promise((resolve) => setTimeout(resolve, 52)));
  await settle(frames - 1);
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * Renders `tree` at a URL and records what it writes to the URL; opening
 * another URL stands for back or forward.
 */
function urlHarness(tree: () => ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const store = createStore();
  const urlWrites: string[] = [];
  let params = new URLSearchParams();
  const open = async (keys: Record<string, string> = {}) => {
    params = new URLSearchParams(keys);
    await act(() => {
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={(event) => {
              params = event.searchParams;
              urlWrites.push(event.queryString);
            }}
            searchParams={keys}
          >
            {tree()}
          </NuqsTestingAdapter>
        </Provider>
      );
    });
  };
  return {
    container,
    open,
    get params() {
      return params;
    },
    urlWrites,
  };
}

/** The table; its saved views load once `views` resolves. */
function table(views: Promise<{ data: TableView[] }>, favoriteId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const page = urlHarness(() => (
    <DataTable
      getRowId={(row) => String(row.id)}
      getTableActions={() => ({
        list: () =>
          Promise.resolve({
            data: ROWS,
            meta: { pageCount: 1, totalCount: ROWS.length },
          }),
        views: {
          getFavorite: () =>
            Promise.resolve({
              success: true,
              data: { viewId: favoriteId ?? null },
            }),
          list: () => views,
        },
      })}
      getTableConfig={() => config}
      queryClient={client}
      tableType={TABLE_ID}
    />
  ));
  // Menus open in a portal, outside the table's container.
  const click = async (name: string) => {
    const target = [
      ...document.querySelectorAll<HTMLElement>("button, [role=menuitem]"),
    ].find(
      (element) =>
        element.getAttribute("aria-label") === name ||
        element.textContent?.trim().startsWith(name)
    );
    if (!target) {
      throw new Error(`Missing control: ${name}`);
    }
    await act(() => target.click());
    await settle(3);
  };
  return {
    ...page,
    get params() {
      return page.params;
    },
    /** The data columns of the first row, left to right. */
    columns: () =>
      [
        ...(page.container
          .querySelector("tbody tr")
          ?.querySelectorAll<HTMLElement>("[data-column-id]") ?? []),
      ]
        .map((cell) => cell.dataset.columnId)
        .filter((id) => id !== "select" && id !== "actions"),
    currentView: () =>
      page.container.querySelector('button[aria-label="Current View"]')
        ?.textContent ?? "",
    /** The columns the "Properties" menu lists, top to bottom. */
    menuColumns: async () => {
      await click("View settings");
      await click("Properties");
      const menu = document.querySelector('[data-slot="popover-content"]');
      const labels = new Set(
        config.columns.definitions.map((column) => column.header)
      );
      return [...(menu?.querySelectorAll("button") ?? [])]
        .map((element) => element.textContent?.trim() ?? "")
        .filter((text) => labels.has(text));
    },
    shows: (text: string) => page.container.textContent?.includes(text),
  };
}

/**
 * Opens the table without URL state. Its rows load at once; its saved views
 * only once the table shows them, as a slower server call would.
 */
async function openTable({
  favoriteId,
  views = [],
}: {
  favoriteId?: string;
  views?: TableView[];
} = {}) {
  const viewList = deferred<{ data: TableView[] }>();
  const opened = table(viewList.promise, favoriteId);
  await opened.open();
  await settle();
  const rowsShown = opened.shows("Alpha");
  await act(() => viewList.resolve({ data: views }));
  await settle();
  return Object.assign(opened, { rowsShown });
}

it("starts in the configured column order and writes nothing to the URL on arrival", async () => {
  const opened = await openTable();
  expect(opened.rowsShown).toBe(true);
  expect(opened.urlWrites).toEqual([]);
  expect(opened.params.has(ORDER_KEY)).toBe(false);
  expect(opened.columns()).toEqual(CONFIGURED_ORDER);
  expect(opened.currentView()).toContain("Default view");
  // The columns menu lists them as the table shows them.
  expect(await opened.menuColumns()).toEqual(["Amount", "Name", "Status"]);
});

it("opens on its favorite view when its column order differs from its definitions", async () => {
  const opened = await openTable({ favoriteId: compact.id, views: [compact] });
  expect(opened.rowsShown).toBe(true);
  expect(opened.currentView()).toContain(compact.name);
  expect(opened.params.get("view")).toBe(compact.id);
  expect(opened.columns()).toEqual(CONFIGURED_ORDER);
});

it("opens on its default view when its column order differs from its definitions", async () => {
  const opened = await openTable({
    views: [{ ...compact, isDefault: true }],
  });
  expect(opened.rowsShown).toBe(true);
  expect(opened.currentView()).toContain(compact.name);
  expect(opened.params.get("view")).toBe(compact.id);
  expect(opened.columns()).toEqual(CONFIGURED_ORDER);
});

it("shows the column order each URL names on back and forward, and writes none back", async () => {
  const history = table(Promise.resolve({ data: [] }));
  const statusFirst = ["status", "name", "amount"];
  const nameFirst = ["name", "amount", "status"];
  const openOrder = async (order?: string[]) => {
    await history.open(order ? { [ORDER_KEY]: JSON.stringify(order) } : {});
    await settle();
  };
  await openOrder(statusFirst);
  expect(history.columns()).toEqual(statusFirst);
  await openOrder(nameFirst);
  expect(history.columns()).toEqual(nameFirst);
  await openOrder(statusFirst);
  expect(history.columns()).toEqual(statusFirst);
  // An entry without a column order shows the configured one.
  await openOrder();
  expect(history.columns()).toEqual(CONFIGURED_ORDER);
  expect(history.urlWrites).toEqual([]);
});

it("moves a dragged column within the order on screen while the URL has none", async () => {
  let dnd: ReturnType<typeof useColumnDnd> | undefined;
  const moves: string[][] = [];
  function Header() {
    dnd = useColumnDnd(TABLE_ID, (order) => moves.push(order), true, true, [
      "select",
      ...CONFIGURED_ORDER,
      "actions",
    ]);
    return null;
  }
  const page = urlHarness(() => <Header />);
  await page.open();
  await settle(2);
  await act(() =>
    dnd?.handleDragEnd({
      active: { id: "status" },
      over: { id: "amount" },
    } as unknown as DragEndEvent)
  );
  await settle(2);
  const moved = ["select", "status", "amount", "name", "actions"];
  expect(moves).toEqual([moved]);
  expect(JSON.parse(page.params.get(ORDER_KEY) ?? "[]")).toEqual(moved);
});
