import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { DataTableViewManager } from "../src/components/ui/yayaw-table/components/toolbar/table-view-manager";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import { TableStateSyncProvider } from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";
import type {
  SetTableViewOrderInput,
  TableView,
  TableViewActions,
} from "../src/components/ui/yayaw-table/types/view-types";
import { getTableViewOrderStorageKey } from "../src/components/ui/yayaw-table/utils/view-order";
import type { ViewTabsConfig } from "../src/components/ui/yayaw-table/utils/view-tabs";

const TABLE_ID = "orders";
const context = { tableId: TABLE_ID, tableType: "products" };
const ORDER_KEY = getTableViewOrderStorageKey(context);
const view = (id: string, extra: Partial<TableView> = {}): TableView => ({
  id,
  name: `View ${id}`,
  tableId: TABLE_ID,
  createdById: "me",
  config: { density: "small" },
  ...extra,
});
const cleanups: (() => Promise<void>)[] = [];
const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 30)));

async function mountManager(options: {
  views: TableView[];
  actions?: TableViewActions;
  initialActiveViewId?: string;
  tabs?: ViewTabsConfig;
  /** A second manager of the same table, as two instances on one page. */
  twice?: boolean;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const unmount = async () => {
    await act(() => root.unmount());
    queryClient.clear();
    container.remove();
  };
  cleanups.push(unmount);
  const actions: TableViewActions = {
    list: async () => ({ data: options.views }),
    ...options.actions,
  };
  const manager = (key: string) => (
    <DataTableViewManager
      initialActiveViewId={options.initialActiveViewId}
      key={key}
      tableId={TABLE_ID}
      tableType={context.tableType}
      tabs={options.tabs}
    />
  );
  await act(() => {
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter hasMemory>
          <TableStateSyncProvider enabled={false}>
            <TableProvider
              getTableActions={() => ({ views: actions })}
              queryClient={queryClient}
              tableId={TABLE_ID}
              translations={defaultTranslations}
            >
              {manager("first")}
              {options.twice ? manager("second") : null}
            </TableProvider>
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    );
  });
  await settle();
  return { unmount };
}

const find = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const button = (label: string) => {
  const result = find(label);
  if (!result) {
    throw new Error(`Missing button: ${label}`);
  }
  return result;
};
const tabNames = () =>
  Array.from(document.querySelectorAll('[role="tab"]')).map(
    (tab) => tab.textContent
  );
const announcement = () =>
  document.querySelector("output[aria-live]")?.textContent;
const openViewMenu = async (label = "View actions") => {
  if (button(label).getAttribute("aria-expanded") !== "true") {
    await act(() => button(label).click());
    await settle();
  }
};
const press = async (label: string) => {
  const target = button(label);
  target.focus();
  await act(() => target.click());
  await settle();
  return target;
};

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
  window.localStorage.clear();
});

it("moves the current view from the view menu, announces it, keeps the focus and the order in this browser", async () => {
  const views = [view("a"), view("b"), view("c")];
  const first = await mountManager({ views, initialActiveViewId: "a" });
  expect(tabNames()).toEqual(["Default view", "View a", "View b", "View c"]);
  await openViewMenu();
  // The first view cannot move left: the action stays, inactive.
  expect(button("Move left").getAttribute("aria-disabled")).toBe("true");

  const moveRight = await press("Move right");
  expect(tabNames()).toEqual(["Default view", "View b", "View a", "View c"]);
  expect(announcement()).toBe("View “View a” moved to position 3 of 4");
  expect(JSON.parse(window.localStorage.getItem(ORDER_KEY) ?? "null")).toEqual([
    "b",
    "a",
    "c",
  ]);

  await press("Move right");
  expect(tabNames()).toEqual(["Default view", "View b", "View c", "View a"]);
  expect(announcement()).toBe("View “View a” moved to position 4 of 4");
  // At the end the focus stays on the now inactive action.
  expect(document.activeElement).toBe(moveRight);
  expect(moveRight.getAttribute("aria-disabled")).toBe("true");
  await act(() => moveRight.click());
  await settle();
  expect(tabNames()).toEqual(["Default view", "View b", "View c", "View a"]);
  expect(button("Move left").getAttribute("aria-disabled")).toBeNull();

  await first.unmount();
  cleanups.pop();
  await mountManager({ views, initialActiveViewId: "b" });
  expect(tabNames()).toEqual(["Default view", "View b", "View c", "View a"]);
});

it("shares this browser's order between the managers of one table", async () => {
  await mountManager({
    views: [view("a"), view("b")],
    initialActiveViewId: "a",
    twice: true,
  });
  const lists = () =>
    Array.from(document.querySelectorAll('[role="tablist"]'), (list) =>
      Array.from(
        list.querySelectorAll('[role="tab"]'),
        (tab) => tab.textContent
      )
    );
  await openViewMenu();
  await press("Move right");
  expect(lists()).toEqual([
    ["Default view", "View b", "View a"],
    ["Default view", "View b", "View a"],
  ]);
});

it("keeps system views and the default view first, without move actions", async () => {
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(["b", "system", "a"]));
  await mountManager({
    views: [
      view("a"),
      view("system", { isSystem: true }),
      view("b"),
      view("default", { isDefault: true }),
      view("new"),
    ],
    initialActiveViewId: "system",
  });
  expect(tabNames()).toEqual([
    "Default view",
    "View system",
    "View default",
    "View b",
    "View a",
  ]);
  await openViewMenu();
  expect(find("Move left")).toBeNull();
  expect(find("Move right")).toBeNull();
  // Views the order does not name come last, under "…".
  await act(() => button("More views").click());
  await settle();
  expect(
    Array.from(document.querySelectorAll('[role="menuitem"]')).map(
      (item) => item.textContent
    )
  ).toEqual(["View new"]);
});

it("sends the order to the host's setOrder and applies the order its list answers", async () => {
  const writes: SetTableViewOrderInput[] = [];
  await mountManager({
    views: [],
    initialActiveViewId: "a",
    actions: {
      list: async () => ({
        data: [view("a"), view("b"), view("c")],
        order: ["c", "a"],
      }),
      setOrder: (input) => {
        writes.push(input);
        return Promise.resolve({
          success: true,
          data: { viewIds: input.viewIds },
        });
      },
    },
  });
  expect(tabNames()).toEqual(["Default view", "View c", "View a", "View b"]);
  await openViewMenu();
  await press("Move right");
  expect(writes).toEqual([{ ...context, viewIds: ["c", "b", "a"] }]);
  expect(tabNames()).toEqual(["Default view", "View c", "View b", "View a"]);
  expect(window.localStorage.getItem(ORDER_KEY)).toBeNull();
});

it("keeps the order and reports the error when the host refuses it", async () => {
  await mountManager({
    views: [view("a"), view("b")],
    initialActiveViewId: "b",
    actions: {
      setOrder: () =>
        Promise.resolve({ success: false, error: "Order rejected" }),
    },
  });
  await openViewMenu();
  await press("Move left");
  expect(tabNames()).toEqual(["Default view", "View a", "View b"]);
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Order rejected"
  );
  expect(announcement()).toBe("");
});

it("names the icon-only overflow button More views and lists its views in the user's order", async () => {
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(["c", "b", "a"]));
  await mountManager({
    views: [view("a"), view("b"), view("c")],
    tabs: { maxVisible: 1 },
  });
  expect(tabNames()).toEqual(["Default view", "View c"]);
  const more = button("More views");
  expect(more.textContent).toBe("");
  expect(more.querySelector("svg")).not.toBeNull();
  await act(() => more.click());
  await settle();
  expect(
    Array.from(document.querySelectorAll('[role="menuitem"]')).map(
      (item) => item.textContent
    )
  ).toEqual(["View b", "View a"]);
});

it("lists the views in the user's order and moves them up and down without tabs", async () => {
  window.localStorage.setItem(ORDER_KEY, JSON.stringify(["b", "a"]));
  await mountManager({
    views: [view("a"), view("b")],
    initialActiveViewId: "a",
    tabs: false,
  });
  await openViewMenu("Current View");
  // The menu's list of views, without its trigger (named after the current view).
  const listed = () =>
    Array.from(document.querySelectorAll("button"))
      .filter((item) => item.getAttribute("aria-label") !== "Current View")
      .map((item) => item.textContent ?? "")
      .filter((text) => text.startsWith("View ") || text === "Default view");
  expect(listed()).toEqual(["Default view", "View b", "View a"]);
  expect(find("Move right")).toBeNull();
  expect(button("Move down").getAttribute("aria-disabled")).toBe("true");
  await press("Move up");
  expect(listed()).toEqual(["Default view", "View a", "View b"]);
  expect(announcement()).toBe("View “View a” moved to position 2 of 3");
});
