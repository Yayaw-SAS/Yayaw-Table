import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineTableConfig } from "../config";
import YayawDataTable from "./YayawDataTable.vue";

const catalogue = defineTableConfig({
  id: "catalogue-controls",
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      {
        id: "status",
        header: "Status",
        enablePinning: false,
        enableSorting: false,
      },
    ],
    mandatory: ["name"],
    visible: ["name", "status"],
    order: ["name", "status"],
  },
  table: {
    syncUrl: false,
    enableColumnDragDropByDefault: true,
    enableAdvancedFilters: false,
    searchDebounceMs: 250,
    actionsAsIcons: true,
  },
  translations: {
    namespace: "controls",
    keys: { search: "Find products", columnOptions: "Manage column" },
  },
});
const data = [
  { id: "1", name: "Alpha", status: "Open" },
  { id: "2", name: "Beta", status: "Closed" },
];
const mountTable = (config = catalogue, overrides = {}) =>
  mount(YayawDataTable, {
    props: { tableType: config.id, config, data, ...overrides },
    attachTo: document.body,
    // jsdom has no layout; exercise real menu semantics without Floating UI measurement.
    global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
  });
type Wrapper = ReturnType<typeof mountTable>;
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  })
);
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  window.localStorage.clear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
});
const openMenu = async (wrapper: Wrapper, label = "Name") => {
  // Allow the previous menu's deferred focus restoration to finish first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await wrapper
    .get(`[aria-label="Manage column: ${label}"]`)
    .trigger("keydown", { key: "Enter" });
  await flushPromises();
};
const item = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (element) => element.textContent?.trim() === label
  );
const selectItem = (label: string) => {
  const element = item(label);
  if (!element) {
    throw new Error(`Missing menu item: ${label}`);
  }
  element.click();
};
const placeholderGlyphs = /[◇◆]/;

describe("catalogue-owned controls", () => {
  it("uses configured toolbar actions and translations, including explicit prop overrides", async () => {
    const handler = vi.fn();
    const config = {
      ...catalogue,
      toolbarActions: [{ id: "sync", label: "Sync catalogue", handler }],
    };
    const wrapper = mountTable(config);
    await wrapper.get('[aria-label="Sync catalogue"]').trigger("click");
    expect(handler).toHaveBeenCalledOnce();
    expect(wrapper.find('[aria-label="Find products"]').exists()).toBe(true);
    await wrapper.get('[aria-label="Options"]').trigger("click");
    expect(wrapper.find('[aria-label="Advanced filters"]').exists()).toBe(
      false
    );
    await wrapper.get("th.sortable").trigger("click");
    expect(window.location.search).toBe("");
    await wrapper.setProps({
      toolbarActions: [],
      translations: { search: "Override" },
    });
    expect(wrapper.find('[aria-label="Sync catalogue"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Override"]').exists()).toBe(true);
  });

  it("derives accessible menus from column capabilities and preserves utility locks", async () => {
    const wrapper = mountTable(catalogue, {
      getTableActions: () => ({ update: () => ({ success: true }) }),
    });
    await flushPromises();
    expect(wrapper.text()).not.toMatch(placeholderGlyphs);
    expect(wrapper.findAll(".yayaw-column-menu-trigger")).toHaveLength(2);
    expect(wrapper.findAll("th").at(-1)?.attributes("style")).toContain(
      "right: 0px"
    );
    await openMenu(wrapper);
    expect(item("Hide column")).toBeUndefined();
    selectItem("Pin right");
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Manage column: Name"]').element.closest("th")
        ?.style.right
    ).toBe("48px");
    await openMenu(wrapper);
    expect(item("Pin right")?.hasAttribute("data-disabled")).toBe(true);
    selectItem("Unpin");
    await flushPromises();
    await openMenu(wrapper);
    selectItem("Descending");
    await flushPromises();
    expect(wrapper.findAll("tbody tr")[0]?.text()).toContain("Beta");
    expect(wrapper.get('[aria-sort="descending"]').text()).toContain("Name");
    await openMenu(wrapper, "Status");
    expect(item("Pin left")).toBeUndefined();
    expect(item("Ascending")).toBeUndefined();
    selectItem("Hide column");
    await flushPromises();
    expect(wrapper.find('[aria-label="Manage column: Status"]').exists()).toBe(
      false
    );
  });

  it("toggles column reordering from a native column menu", async () => {
    const wrapper = mountTable();
    await flushPromises();
    expect(wrapper.findAll("th")[1]?.attributes("draggable")).toBe("true");

    await openMenu(wrapper);
    selectItem("Drag to reorder✓");
    await flushPromises();

    expect(wrapper.findAll("th")[1]?.attributes("draggable")).toBe("false");
    expect(localStorage.getItem("catalogue-controls-column-drag-enabled")).toBe(
      "false"
    );
  });

  it("opens and focuses the current column filter from its menu", async () => {
    const wrapper = mountTable();
    await flushPromises();
    await openMenu(wrapper);
    selectItem("Filter column");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const filter = wrapper.get('[data-filter-column="name"] input');
    expect(wrapper.get(".yayaw-options-menu").text()).toContain("Filters");
    expect(document.activeElement).toBe(filter.element);
  });

  it("omits menus when all data-column capabilities are disabled", () => {
    const wrapper = mountTable(
      defineTableConfig({
        ...catalogue,
        columns: { ...catalogue.columns, mandatory: ["name", "status"] },
        table: {
          ...catalogue.table,
          enableColumnDnd: false,
          enableColumnFilters: false,
          enableColumnPinning: false,
          enableSorting: false,
        },
      })
    );
    expect(wrapper.find(".yayaw-column-menu-trigger").exists()).toBe(false);
  });

  it("debounces server search from config, refreshes sort immediately and cancels on unmount", async () => {
    vi.useFakeTimers();
    const list = vi.fn(async () => ({ data, meta: { totalCount: 2 } }));
    const wrapper = mountTable(catalogue, {
      getTableActions: () => ({ list }),
    });
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(1);
    const search = wrapper.get('input[type="search"]');
    await search.setValue("A");
    await vi.advanceTimersByTimeAsync(100);
    await search.setValue("Al");
    await vi.advanceTimersByTimeAsync(249);
    expect(list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "Al" })
    );
    await search.setValue("Beta");
    await wrapper.get("th.sortable").trigger("click");
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(300);
    expect(list).toHaveBeenCalledTimes(3);
    await search.setValue("Cancelled");
    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(300);
    expect(list).toHaveBeenCalledTimes(3);
  });
});
