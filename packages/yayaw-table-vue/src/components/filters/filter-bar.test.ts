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
  expect(wrapper.find('[data-filter-column="category"]').exists()).toBe(false);
  expect(wrapper.find('[data-filter-property="category"]').exists()).toBe(true);
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { category: [0, 2] } })
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
    expect.objectContaining({ filters: { category: [0, 2], active: [false] } })
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
  await wrapper.get("[data-relative-direction]").setValue("past");
  await flushPromises();
  await wrapper.get("[data-rolling-count]").setValue("30");
  await wrapper.get("[data-relative-unit]").setValue("Days");
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
    .get('[data-date-value-editor] [data-date-mode-option="exact"]')
    .setValue(true);
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
    await openViewScreen(wrapper, "Filter");
    await wrapper.get('[data-filter-property="due"]').trigger("click");
    await flushPromises();
    // Picking the column opens its period rather than adding a second rule.
    expect(wrapper.find('[data-filter-chip="due"]').exists()).toBe(false);
    if (!wrapper.find("[data-date-period-editor]").exists()) {
      await button().trigger("click");
      await flushPromises();
    }
    await wrapper.get("[data-relative-direction]").setValue("this");
    await flushPromises();
    await wrapper.get("[data-relative-unit]").setValue("Months");
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

it("searches a quick filter's options on the server and keeps the selected label", async () => {
  const optionsLoader = vi.fn(async (query: string) =>
    [
      { value: 7, label: "Launch call" },
      { value: 8, label: "Lunch" },
    ].filter((option) =>
      option.label.toLowerCase().includes(query.toLowerCase())
    )
  );
  const list = vi.fn(async () => ({ data: [], meta: { totalCount: 0 } }));
  const remote = defineTableConfig({
    ...config,
    columns: {
      ...config.columns,
      definitions: [
        { id: "name", header: "Name" },
        {
          id: "action",
          header: "Action",
          type: "multiSelect",
          options: [],
          optionsLoader,
          optionsSearchMinLength: 2,
          optionsSearchDebounceMs: 0,
        },
      ],
      order: ["name", "action"],
    },
    table: { ...config.table, filterBarColumns: ["action"] },
  });
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: remote.id,
      config: remote,
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
  expect(optionsLoader).not.toHaveBeenCalled();
  await wrapper.get('.yayaw-filter-bar [aria-label="Action"]').trigger("click");
  await flushPromises();
  expect(document.body.textContent).toContain("Type at least 2 characters");
  expect(optionsLoader).not.toHaveBeenCalled();
  const search = document.querySelector<HTMLInputElement>(
    ".yayaw-filter-picker input[type=search]"
  );
  if (!search) {
    throw new Error("Missing search");
  }
  search.value = "lau";
  search.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
  expect(optionsLoader).toHaveBeenLastCalledWith(
    "lau",
    expect.any(AbortSignal)
  );
  checkbox("Launch call").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { action: [7] } })
  );
  search.value = "lu";
  search.dispatchEvent(new Event("input"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
  // The selection keeps its label beside other results.
  expect(checkbox("Launch call").checked).toBe(true);
  expect(checkbox("Lunch").checked).toBe(false);
});

it("picks one value or All in a single-choice quick filter, stored alone and shown on the trigger", async () => {
  const single = defineTableConfig({
    ...config,
    id: "single-filters",
    columns: {
      ...config.columns,
      definitions: [
        { id: "name", header: "Name" },
        {
          id: "sent",
          header: "Sent",
          type: "boolean",
          filterSelection: "single",
        },
        {
          id: "category",
          header: "Category",
          type: "select",
          filterSelection: "single",
          options: [
            { value: 0, label: "Zero" },
            { value: 2, label: "Two" },
          ],
        },
      ],
      order: ["name", "sent", "category"],
    },
    table: { ...config.table, filterBarColumns: ["sent", "category"] },
  });
  const list = vi.fn(async () => ({ data: [], meta: { totalCount: 0 } }));
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: single.id,
      config: single,
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
  const radio = (label: string) => {
    const element = [...document.querySelectorAll("label")]
      .find((item) => item.textContent?.trim() === label)
      ?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!element) {
      throw new Error(`Missing ${label}`);
    }
    return element;
  };
  await flushPromises();
  await wrapper
    .get('.yayaw-filter-bar [aria-label="Category"]')
    .trigger("click");
  await flushPromises();
  // Few choices: no search field, "All" first and checked.
  expect(
    document.querySelector(".yayaw-filter-picker input[type=search]")
  ).toBeNull();
  expect(radio("All").checked).toBe(true);
  radio("Zero").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { category: 0 } })
  );
  expect(
    wrapper.get('.yayaw-filter-bar [aria-label="Category"]').text()
  ).toContain("Category: Zero");
  expect(document.querySelector('input[type="radio"]')).toBeNull();
  await wrapper.get('.yayaw-filter-bar [aria-label="Sent"]').trigger("click");
  await flushPromises();
  radio("False").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { category: 0, sent: false } })
  );
  await wrapper
    .get('.yayaw-filter-bar [aria-label="Category"]')
    .trigger("click");
  await flushPromises();
  expect(radio("Zero").checked).toBe(true);
  radio("All").click();
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ filters: { sent: false } })
  );
  expect(
    wrapper.get('.yayaw-filter-bar [aria-label="Category"]').text()
  ).not.toContain(":");
});

it("draws the first 100 choices of a long quick filter and says how to reach the others", async () => {
  const long = defineTableConfig({
    ...config,
    id: "long-filter",
    columns: {
      ...config.columns,
      definitions: [
        { id: "name", header: "Name" },
        {
          id: "supplier",
          header: "Supplier",
          type: "select",
          options: Array.from({ length: 250 }, (_, index) => ({
            value: index + 1,
            label: `Supplier ${String(index + 1).padStart(3, "0")}`,
          })),
        },
      ],
      order: ["name", "supplier"],
    },
    table: { ...config.table, filterBarColumns: ["supplier"] },
  });
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: long.id,
      config: long,
      getTableActions: () => ({
        list: async () => ({ data: [], meta: { totalCount: 0 } }),
      }),
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
    .get('.yayaw-filter-bar [aria-label="Supplier"]')
    .trigger("click");
  await flushPromises();
  const choices = () => document.querySelectorAll(".yayaw-filter-choice");
  expect(choices()).toHaveLength(100);
  expect(document.body.textContent).toContain(
    "150 more: type to narrow the list"
  );
  const search = document.querySelector<HTMLInputElement>(
    ".yayaw-filter-picker input[type=search]"
  );
  if (!search) {
    throw new Error("Missing search");
  }
  search.value = "240";
  search.dispatchEvent(new Event("input"));
  await flushPromises();
  expect([...choices()].map((choice) => choice.textContent?.trim())).toEqual([
    "Supplier 240",
  ]);
});
