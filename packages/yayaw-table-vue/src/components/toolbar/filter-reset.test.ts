import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";
import YayawDataTable from "../YayawDataTable.vue";

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

  it("is opt-in and remains an icon when other actions have labels", () => {
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
    const button = visible.get('button[aria-label="Effacer les filtres"]');
    expect(button.classes()).toContain("yayaw-icon-only");
    expect(button.attributes("title")).toBe("Effacer les filtres");
    expect(button.find("svg").exists()).toBe(true);
    expect(button.text()).toBe("");
    visible.unmount();
  });

  it("the Options reset restores option defaults and preserves search", async () => {
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
    await wrapper.get('button[aria-label="Options"]').trigger("click");
    await wrapper
      .get('.yayaw-options-menu button[aria-label="Reset"]')
      .trigger("click");
    await vi.runAllTimersAsync();
    expect((search.element as HTMLInputElement).value).toBe("Alpha");
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
    for (const [key, value] of Object.entries(presentation)) {
      expect(result.get(key)).toBe(value);
    }
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
    await wrapper
      .get('.yayaw-toolbar-right > button[aria-label="Clear filters"]')
      .trigger("click");
    await vi.runAllTimersAsync();

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
        translations: { reset: "Start again" },
      },
    });
    await wrapper.get("th.sortable").trigger("click");
    expect(wrapper.findAll("tbody tr")[0]?.text()).toContain("Beta");
    await wrapper.get('button[aria-label="Options"]').trigger("click");
    await wrapper
      .get('.yayaw-options-menu button[aria-label="Start again"]')
      .trigger("click");
    expect(wrapper.findAll("tbody tr")[0]?.text()).toContain("Alpha");
    expect(window.location.search).toBe("");
    wrapper.unmount();
  });
});
