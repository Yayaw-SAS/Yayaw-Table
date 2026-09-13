import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inlineTestPortals,
  openViewMenu,
  openViewScreen,
} from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import YayawDataTable from "../YayawDataTable.vue";

inlineTestPortals();

const config = defineTableConfig({
  id: "reset",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "status", header: "Status", type: "text" },
    ],
    order: ["select", "name", "status", "actions"],
    visible: ["name", "status"],
    mandatory: ["name"],
    sort: [{ id: "name", desc: false }],
  },
  table: {
    actionsAsIcons: true,
    showResetFilters: true,
    displayModes: ["table", "gallery"],
    gallery: { titleColumn: "name" },
  },
  translations: { namespace: "reset", keys: {} },
});
const data = [
  { id: "1", name: "Alpha", status: "Open" },
  { id: "2", name: "Beta", status: "Closed" },
];

describe("toolbar filter reset", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("keeps the legacy filter reset opt-in with a readable label inside Filters", async () => {
    const hidden = mount(YayawDataTable, {
      props: {
        tableType: "reset",
        config: defineTableConfig({
          ...config,
          table: { showResetFilters: false },
        }),
        data,
        syncUrl: false,
      },
    });
    expect(hidden.find('button[aria-label="Clear filters"]').exists()).toBe(
      false
    );
    expect(
      defineTableConfig({ ...config, table: {} }).table.showResetFilters
    ).toBe(false);
    hidden.unmount();
    const visible = mount(YayawDataTable, {
      props: {
        tableType: "reset",
        config: defineTableConfig({
          ...config,
          table: { showResetFilters: true, actionsAsIcons: false },
        }),
        data,
        syncUrl: false,
        locale: "fr",
      },
    });
    await openViewScreen(visible, "Filtres");
    const button = visible.get('button[aria-label="Effacer les filtres"]');
    expect(button.classes()).not.toContain("yayaw-icon-only");
    expect(button.attributes("title")).toBeUndefined();
    expect(button.find("svg").exists()).toBe(true);
    expect(button.text()).toBe("Effacer les filtres");
    visible.unmount();
  });

  it("the view reset restores application defaults, including search and presentation", async () => {
    const presentation = {
      "reset-order": JSON.stringify(["select", "status", "name", "actions"]),
      "reset-pinning": encodeURIComponent(
        JSON.stringify({ left: ["select", "name"], right: ["actions"] })
      ),
      "reset-pageSize": "20",
      "reset-display": "gallery",
      "reset-gallery": JSON.stringify({ titleColumn: "name" }),
      view: "saved",
      "other-q": "Untouched",
      "other-sort": JSON.stringify([{ id: "status", desc: true }]),
      "reset-q": "Alpha",
    };
    const params = new URLSearchParams({
      ...presentation,
      "reset-sort": JSON.stringify([{ id: "status", desc: true }]),
      "reset-visibility": JSON.stringify({ name: true, status: false }),
      "reset-grouping": JSON.stringify(["status"]),
      "reset-page": "2",
      "reset-filters": JSON.stringify([{ id: "status", value: "Open" }]),
      "reset-advancedFilters": JSON.stringify({
        filters: [
          {
            id: "test",
            columnId: "name",
            operator: "contains",
            type: "text",
            values: "Alpha",
          },
        ],
        joinOperator: "and",
      }),
    });
    window.history.replaceState({}, "", `/?${params}`);
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "reset", config, data },
    });
    await flushPromises();
    const search = wrapper.get('input[type="search"]');
    expect(search.attributes("aria-label")).toBe("Search…");
    expect((search.element as HTMLInputElement).value).toBe("Alpha");
    await openViewMenu(wrapper);
    await wrapper
      .get('.yayaw-toolbar-menu button[aria-label="Reset view"]')
      .trigger("click");
    await vi.advanceTimersByTimeAsync(100);
    expect((search.element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain("Alpha");

    const result = new URLSearchParams(window.location.search);
    for (const key of [
      "reset-grouping",
      "reset-page",
      "reset-filters",
      "reset-advancedFilters",
    ]) {
      expect(result.has(key)).toBe(false);
    }
    expect(JSON.parse(result.get("reset-sort") ?? "[]")).toEqual(
      config.columns.sort
    );
    expect(JSON.parse(result.get("reset-visibility") ?? "{}")).toEqual({
      name: true,
      status: true,
      select: true,
      actions: true,
    });
    expect(result.get("reset-q")).toBeNull();
    expect(result.get("reset-display")).toBeNull();
    expect(result.get("view")).toBeNull();
    expect(result.get("other-q")).toBe("Untouched");
    expect(result.get("other-sort")).toBe(presentation["other-sort"]);
    wrapper.unmount();
  });

  it("the legacy reset shortcut clears the same query state as React", async () => {
    const params = new URLSearchParams({
      "reset-q": "Alpha",
      "reset-sort": JSON.stringify([{ id: "status", desc: true }]),
      "reset-visibility": JSON.stringify({ name: true, status: false }),
      "reset-grouping": JSON.stringify(["status"]),
      "reset-page": "2",
      "reset-pageSize": "20",
      "reset-filters": JSON.stringify([{ id: "status", value: "Open" }]),
      "reset-advancedFilters": JSON.stringify({
        filters: [
          {
            id: "test",
            columnId: "name",
            operator: "contains",
            type: "text",
            values: "Alpha",
          },
        ],
        joinOperator: "and",
      }),
    });
    window.history.replaceState({}, "", `/?${params}`);
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "reset", config, data },
    });
    await flushPromises();
    await openViewScreen(wrapper, "Filters");
    await wrapper.get('button[aria-label="Clear filters"]').trigger("click");
    await vi.advanceTimersByTimeAsync(100);

    const result = new URLSearchParams(window.location.search);
    for (const key of [
      "reset-q",
      "reset-page",
      "reset-filters",
      "reset-advancedFilters",
    ]) {
      expect(result.has(key)).toBe(false);
    }
    expect(JSON.parse(result.get("reset-sort") ?? "[]")).toEqual([
      { id: "status", desc: true },
    ]);
    expect(JSON.parse(result.get("reset-visibility") ?? "{}")).toEqual({
      actions: true,
      name: true,
      select: true,
      status: false,
    });
    expect(JSON.parse(result.get("reset-grouping") ?? "[]")).toEqual([
      "status",
    ]);
    expect(result.get("reset-pageSize")).toBe("20");
    wrapper.unmount();
  });

  it("restores default sorting without URL synchronization and uses the menu translation", async () => {
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "reset",
        config,
        data,
        syncUrl: false,
        translations: { "views.reset": "Start again" },
      },
    });
    await wrapper.get("th.sortable").trigger("click");
    expect(wrapper.findAll("tbody tr")[0]?.text()).toContain("Beta");
    await openViewMenu(wrapper);
    await wrapper
      .get('.yayaw-toolbar-menu button[aria-label="Start again"]')
      .trigger("click");
    expect(wrapper.findAll("tbody tr")[0]?.text()).toContain("Alpha");
    expect(window.location.search).toBe("");
    wrapper.unmount();
  });
});
