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

  it("clears filters, advanced filters, search and page but preserves presentation and other tables", async () => {
    const presentation = {
      "reset-sort": JSON.stringify([{ id: "name", desc: true }]),
      "reset-visibility": JSON.stringify({
        name: true,
        status: false,
        select: true,
        actions: true,
      }),
      "reset-order": JSON.stringify(["select", "status", "name", "actions"]),
      "reset-grouping": JSON.stringify(["status"]),
      "reset-pinning": encodeURIComponent(
        JSON.stringify({ left: ["select", "name"], right: ["actions"] })
      ),
      "reset-pageSize": "20",
      "reset-display": "gallery",
      "reset-gallery": JSON.stringify({ titleColumn: "name" }),
      view: "saved",
      "other-q": "Untouched",
    };
    const params = new URLSearchParams({
      ...presentation,
      "reset-q": "Alpha",
      "reset-page": "2",
      "reset-filters": JSON.stringify([{ id: "status", value: "Open" }]),
      "reset-advancedFilters": JSON.stringify({
        filters: [{ id: "name", operator: "contains", value: "Alpha" }],
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
    // Reset before the pending URL write runs, then ensure it cannot restore input.
    await search.setValue("Pending");
    await wrapper.get('button[aria-label="Clear filters"]').trigger("click");
    await vi.runAllTimersAsync();
    expect((search.element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain("Alpha");
    expect(wrapper.text()).toContain("Beta");
    const result = new URLSearchParams(window.location.search);
    for (const key of [
      "reset-q",
      "reset-page",
      "reset-filters",
      "reset-advancedFilters",
    ]) {
      expect(result.has(key)).toBe(false);
    }
    for (const [key, value] of Object.entries(presentation)) {
      expect(result.get(key)).toBe(value);
    }
    wrapper.unmount();
  });

  it("works without URL synchronization and uses translation overrides", async () => {
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "reset",
        config,
        data,
        syncUrl: false,
        translations: { clearFilters: "Start again" },
      },
    });
    await wrapper.get('input[type="search"]').setValue("Beta");
    expect(wrapper.text()).not.toContain("Alpha");
    await wrapper.get('button[aria-label="Start again"]').trigger("click");
    expect(wrapper.text()).toContain("Alpha");
    expect(window.location.search).toBe("");
    wrapper.unmount();
  });
});
