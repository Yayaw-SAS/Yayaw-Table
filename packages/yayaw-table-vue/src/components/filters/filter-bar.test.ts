const CONTROL_HEIGHT_PATTERN =
  /\.yayaw-views \.yayaw-button,\s*\.yayaw-filter-bar \.yayaw-button\s*\{[^}]*height: var\(--yayaw-density-control, 32px\)/;

import { readFileSync } from "node:fs";
import { URL as NodeURL } from "node:url";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";

const styles = readFileSync(
  new NodeURL("../../styles.css", import.meta.url),
  "utf8"
);

import YayawDataTable from "../YayawDataTable.vue";

const config = defineTableConfig({
  id: "quick-filters",
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      {
        id: "category",
        header: "Category",
        type: "select",
        options: [
          { value: 0, label: "Zero" },
          { value: 2, label: "Two" },
          { value: 3, label: "Disabled", disabled: true },
        ],
      },
      { id: "active", header: "Active", type: "boolean" },
    ],
    visible: ["name"],
    mandatory: ["name"],
    order: ["name", "category", "active"],
  },
  table: {
    syncUrl: false,
    filterBarColumns: ["category", "missing", "active", "category"],
    showFilterBar: true,
    showClearFilters: true,
  },
  translations: { namespace: "test", keys: {} },
});
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  })
);
beforeEach(() => {
  window.localStorage.clear();
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

const checkbox = (label: string) => {
  const element = [...document.querySelectorAll("label")]
    .find((item) => item.textContent?.trim() === label)
    ?.querySelector<HTMLInputElement>("input");
  if (!element) {
    throw new Error(`Missing ${label}`);
  }
  return element;
};

it("shares typed multi-selection with Options, retains hidden-column filters when hiding the bar, and clears them natively", async () => {
  const list = vi.fn(async () => ({
    data: [{ id: "1", name: "Media" }],
    meta: { totalCount: 1 },
  }));
  const wrapper = mount(YayawDataTable, {
    props: { tableType: config.id, config, getTableActions: () => ({ list }) },
    attachTo: document.body,
    global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
  });
  await flushPromises();
  expect(wrapper.findAll(".yayaw-filter-bar button")).toHaveLength(2);
  await wrapper
    .get('.yayaw-filter-bar [aria-label="Category"]')
    .trigger("click");
  await flushPromises();
  expect(checkbox("Disabled").disabled).toBe(true);
  checkbox("Zero").click();
  await flushPromises();
  checkbox("Two").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { category: [0, 2] } })
  );
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  await flushPromises();
  await wrapper.setProps({ showFilterBar: false });
  expect(wrapper.find(".yayaw-filter-bar").exists()).toBe(false);
  await wrapper.get('[aria-label="Options"]').trigger("click");
  await flushPromises();
  const filterMenu = wrapper
    .findAll("button")
    .find((button) => button.text().startsWith("Filters"));
  if (!filterMenu) {
    throw new Error("Missing Filters menu");
  }
  await filterMenu.trigger("click");
  await wrapper.get('[data-filter-column="category"] button').trigger("click");
  await flushPromises();
  expect(checkbox("Zero").checked).toBe(true);
  expect(checkbox("Two").checked).toBe(true);
  checkbox("Two").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { category: [0] } })
  );
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  await flushPromises();
  await wrapper.setProps({ showFilterBar: true });
  await wrapper.get('.yayaw-filter-bar [aria-label="Active"]').trigger("click");
  await flushPromises();
  checkbox("False").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { category: [0], active: [false] } })
  );
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  await flushPromises();
  await wrapper.get('[aria-label="Clear filters"]').trigger("click");
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: {} })
  );
  expect(wrapper.findAll(".yayaw-filter-count")).toHaveLength(0);
});

it("applies the saved-view control sizing rule to every filter-bar button", () => {
  expect(styles).toMatch(CONTROL_HEIGHT_PATTERN);
});
