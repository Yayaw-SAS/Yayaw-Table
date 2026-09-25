import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  inlineTestPortals,
  menuBody,
  openViewsMenu,
} from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import type {
  SetTableViewOrderInput,
  TableBehaviorConfig,
  TableView,
  TableViewActions,
} from "../../types";
import { getTableViewOrderStorageKey } from "../../view-order";
import YayawDataTable from "../YayawDataTable.vue";

inlineTestPortals();

const config = defineTableConfig({
  id: "orders",
  translations: { namespace: "views", keys: {} },
  columns: {
    definitions: [{ id: "name", header: "Name" }],
    mandatory: [],
    visible: ["name"],
    order: ["name"],
  },
  table: {
    enableViews: true,
    allowViewSave: true,
    syncUrl: false,
  },
});
const ORDER_KEY = getTableViewOrderStorageKey({
  tableId: config.id,
  tableType: "products",
});
const view = (id: string, extra: Partial<TableView> = {}): TableView => ({
  id,
  name: `View ${id}`,
  tableId: config.id,
  config: { density: "small" },
  ...extra,
});

const mountTable = (input: {
  views?: TableView[];
  actions?: TableViewActions;
  active?: string;
  table?: Partial<TableBehaviorConfig>;
}) =>
  mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config: defineTableConfig({
        ...config,
        table: { ...config.table, ...input.table },
      }),
      tableType: "products",
      data: [{ id: "1", name: "Alpha" }],
      initialViews: input.views ?? [],
      initialActiveViewId: input.active,
      getTableActions: () => ({ views: input.actions }),
      syncUrl: false,
    },
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
type Wrapper = ReturnType<typeof mountTable>;

const tabNames = (wrapper: Wrapper) =>
  wrapper.findAll('[role="tab"]').map((tab) => tab.text());
const announcement = (wrapper: Wrapper) =>
  wrapper.get("output[aria-live]").text();
const action = (wrapper: Wrapper, label: string) =>
  wrapper.get<HTMLButtonElement>(`button[aria-label="${label}"]`);
const press = async (wrapper: Wrapper, label: string) => {
  const target = action(wrapper, label);
  target.element.focus();
  await target.trigger("click");
  await flushPromises();
  return target;
};

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    localStorage.clear();
    vi.unstubAllGlobals();
  })
);
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});

it("moves the current view from the view menu, announces it, keeps the focus and the order in this browser", async () => {
  const views = [view("a"), view("b"), view("c")];
  const wrapper = mountTable({ views, active: "a" });
  await flushPromises();
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View a",
    "View b",
    "View c",
  ]);
  await openViewsMenu(wrapper);
  // The first view cannot move left: the action stays, inactive.
  expect(action(wrapper, "Move left").attributes("aria-disabled")).toBe("true");

  const moveRight = await press(wrapper, "Move right");
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View b",
    "View a",
    "View c",
  ]);
  expect(announcement(wrapper)).toBe("View “View a” moved to position 3 of 4");
  expect(JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null")).toEqual([
    "b",
    "a",
    "c",
  ]);

  await press(wrapper, "Move right");
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View b",
    "View c",
    "View a",
  ]);
  expect(announcement(wrapper)).toBe("View “View a” moved to position 4 of 4");
  // At the end the focus stays on the now inactive action.
  expect(document.activeElement).toBe(moveRight.element);
  expect(moveRight.attributes("aria-disabled")).toBe("true");
  await moveRight.trigger("click");
  await flushPromises();
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View b",
    "View c",
    "View a",
  ]);
  expect(action(wrapper, "Move left").attributes("aria-disabled")).toBe(
    "false"
  );

  wrapper.unmount();
  const remounted = mountTable({ views, active: "b" });
  await flushPromises();
  expect(tabNames(remounted)).toEqual([
    "Default view",
    "View b",
    "View c",
    "View a",
  ]);
});

it("shares this browser's order between the tables of one type on a page", async () => {
  const views = [view("a"), view("b")];
  const first = mountTable({ views, active: "a" });
  const second = mountTable({ views });
  await flushPromises();
  await openViewsMenu(first);
  await press(first, "Move right");
  expect(tabNames(first)).toEqual(["Default view", "View b", "View a"]);
  expect(tabNames(second)).toEqual(["Default view", "View b", "View a"]);
});

it("keeps system views and the default view first, without move actions", async () => {
  localStorage.setItem(ORDER_KEY, JSON.stringify(["b", "system", "a"]));
  const wrapper = mountTable({
    views: [
      view("a"),
      view("system", { isSystem: true }),
      view("b"),
      view("default", { isDefault: true }),
      view("new"),
    ],
    active: "system",
  });
  await flushPromises();
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View system",
    "View default",
    "View b",
    "View a",
  ]);
  await openViewsMenu(wrapper);
  expect(wrapper.find('[aria-label="Move left"]').exists()).toBe(false);
  expect(wrapper.find('[aria-label="Move right"]').exists()).toBe(false);
  // Views the order does not name come last, under "…".
  await action(wrapper, "More views").trigger("click");
  await flushPromises();
  expect(
    menuBody()
      .findAll('[role="menuitem"]')
      .map((item) => item.text())
  ).toEqual(["View new"]);
});

it("sends the order to the host's setOrder and applies the order its list answers", async () => {
  const writes: SetTableViewOrderInput[] = [];
  const wrapper = mountTable({
    active: "a",
    actions: {
      list: () => ({
        success: true,
        data: [view("a"), view("b"), view("c")],
        order: ["c", "a"],
      }),
      setOrder: (input) => {
        writes.push(input);
        return { success: true, data: { viewIds: input.viewIds } };
      },
    },
  });
  await flushPromises();
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View c",
    "View a",
    "View b",
  ]);
  await openViewsMenu(wrapper);
  await press(wrapper, "Move right");
  expect(writes).toEqual([
    { tableId: config.id, tableType: "products", viewIds: ["c", "b", "a"] },
  ]);
  expect(tabNames(wrapper)).toEqual([
    "Default view",
    "View c",
    "View b",
    "View a",
  ]);
  expect(localStorage.getItem(ORDER_KEY)).toBeNull();
});

it("keeps the order and reports the error when the host refuses it", async () => {
  const wrapper = mountTable({
    views: [view("a"), view("b")],
    active: "b",
    actions: {
      setOrder: () => ({ success: false, error: "Order rejected" }),
    },
  });
  await flushPromises();
  await openViewsMenu(wrapper);
  await press(wrapper, "Move left");
  expect(tabNames(wrapper)).toEqual(["Default view", "View a", "View b"]);
  expect(wrapper.get('[role="alert"]').text()).toBe("Order rejected");
  expect(announcement(wrapper)).toBe("");
});

it("names the icon-only overflow button More views and lists its views in the user's order", async () => {
  localStorage.setItem(ORDER_KEY, JSON.stringify(["c", "b", "a"]));
  const wrapper = mountTable({
    views: [view("a"), view("b"), view("c")],
    table: { viewTabs: { maxVisible: 1 } },
  });
  await flushPromises();
  expect(tabNames(wrapper)).toEqual(["Default view", "View c"]);
  const more = action(wrapper, "More views");
  expect(more.text()).toBe("");
  expect(more.find("svg").exists()).toBe(true);
  await more.trigger("click");
  await flushPromises();
  expect(
    menuBody()
      .findAll('[role="menuitem"]')
      .map((item) => item.text())
  ).toEqual(["View b", "View a"]);
});

it("lists the views in the user's order and moves them up and down without tabs", async () => {
  localStorage.setItem(ORDER_KEY, JSON.stringify(["b", "a"]));
  const wrapper = mountTable({
    views: [view("a"), view("b")],
    active: "a",
    table: { viewTabs: false },
  });
  await flushPromises();
  await openViewsMenu(wrapper);
  const listed = () =>
    wrapper
      .findAll(".yayaw-view-selection .yayaw-view-name")
      .map((item) => item.text());
  expect(listed()).toEqual(["Default view", "View b", "View a"]);
  expect(wrapper.find('[aria-label="Move right"]').exists()).toBe(false);
  expect(action(wrapper, "Move down").attributes("aria-disabled")).toBe("true");
  await press(wrapper, "Move up");
  expect(listed()).toEqual(["Default view", "View a", "View b"]);
  expect(announcement(wrapper)).toBe("View “View a” moved to position 2 of 3");
});
