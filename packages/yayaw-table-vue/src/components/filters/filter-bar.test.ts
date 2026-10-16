import {
  inlineTestPortals,
  openViewMenu,
  openViewScreen,
} from "../../../tests/menu-helpers";

inlineTestPortals();

const CONTROL_HEIGHT_PATTERN =
  /\.yayaw-views \.yayaw-button,\s*\.yayaw-filter-bar \.yayaw-button\s*\{[^}]*height: 32px/;

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
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
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
  await openViewMenu(wrapper);
  await flushPromises();
  const filterMenu = wrapper
    .findAll("button")
    .find((button) => button.text().startsWith("Filter"));
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
  await openViewScreen(wrapper, "Filter");
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

it("filters a date column by a period from the bar, as one advanced rule every display mode reads", async () => {
  const list = vi.fn(async () => ({
    data: [{ id: "1", name: "Deal" }],
    meta: { totalCount: 1 },
  }));
  const dated = defineTableConfig({
    id: "quick-dates",
    columns: {
      definitions: [
        { id: "name", header: "Name" },
        { id: "due", header: "Due", type: "date" },
      ],
      visible: ["name", "due"],
      mandatory: ["name"],
      order: ["name", "due"],
    },
    table: {
      syncUrl: false,
      enableAdvancedFilters: true,
      filterBarColumns: ["due"],
      showFilterBar: true,
    },
    translations: { namespace: "test", keys: {} },
  });
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: dated.id,
      config: dated,
      getTableActions: () => ({ list }),
    },
    attachTo: document.body,
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
  await flushPromises();
  await wrapper
    .get('.yayaw-filter-bar [data-date-filter="due"]')
    .trigger("click");
  await flushPromises();
  await wrapper.get('[data-relative-date="$last30Days"]').trigger("click");
  await flushPromises();
  const rules = () =>
    (
      (list.mock.lastCall as unknown[] | undefined)?.[0] as {
        advancedFilters: {
          columnId: string;
          operator: string;
          values: unknown;
        }[];
      }
    ).advancedFilters;
  expect(rules()).toEqual([expect.objectContaining({ columnId: "due" })]);
  expect(
    wrapper.get('[data-date-filter="due"] .yayaw-date-period-label').text()
  ).toBe("Last 30 days");
  // The period is the bar's: no chip repeats it.
  expect(wrapper.find('[data-filter-chip="due"]').exists()).toBe(false);
  await wrapper
    .findAll("[data-date-value-editor] .yayaw-segmented button")
    .find((button) => button.text() === "Exact date")
    ?.trigger("click");
  await flushPromises();
  expect(rules()).toEqual([
    expect.objectContaining({ columnId: "due", operator: "equals" }),
  ]);
  await wrapper.get("[data-date-period-clear]").trigger("click");
  await flushPromises();
  expect(rules() ?? []).toEqual([]);
});

it("keeps a date period in the toolbar with its days, and the Filter button opens it", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
  try {
    const list = vi.fn(async () => ({
      data: [{ id: "1", name: "Deal" }],
      meta: { totalCount: 1 },
    }));
    const dated = defineTableConfig({
      id: "toolbar-dates",
      columns: {
        definitions: [
          { id: "name", header: "Name" },
          { id: "due", header: "Due", type: "date" },
        ],
        visible: ["name", "due"],
        mandatory: ["name"],
        order: ["name", "due"],
      },
      table: {
        syncUrl: false,
        enableAdvancedFilters: true,
        toolbarDateFilter: "due",
        timeZone: "Europe/Paris",
      },
      translations: { namespace: "test", keys: {} },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: dated.id,
        config: dated,
        getTableActions: () => ({ list }),
      },
      attachTo: document.body,
      global: {
        stubs: {
          PopperArrow: true,
          PopperContent: { template: "<div><slot /></div>" },
        },
      },
    });
    await flushPromises();
    const button = () =>
      wrapper.get('[data-table-toolbar] [data-date-filter="due"]');
    expect(button().text()).toBe("All dates");
    await wrapper.get("[data-filter-button]").trigger("click");
    await flushPromises();
    await wrapper.get('[data-filter-property="due"]').trigger("click");
    await flushPromises();
    // Picking the column opens its period rather than adding a second rule.
    expect(wrapper.find('[data-filter-chip="due"]').exists()).toBe(false);
    if (!wrapper.find("[data-date-period-editor]").exists()) {
      await button().trigger("click");
      await flushPromises();
    }
    await wrapper.get('[data-relative-date="$thisMonth"]').trigger("click");
    await flushPromises();
    expect(button().text()).toContain("This month");
    expect(button().get(".yayaw-date-period-days").text()).toBe(
      "Oct 1 – Oct 31"
    );
    expect(
      (list.mock.lastCall as unknown as [{ advancedFilters: unknown[] }])[0]
        .advancedFilters
    ).toEqual([
      expect.objectContaining({
        columnId: "due",
        operator: "between",
        values: ["2026-10-01", "2026-10-31"],
      }),
    ]);
  } finally {
    vi.useRealTimers();
  }
});
