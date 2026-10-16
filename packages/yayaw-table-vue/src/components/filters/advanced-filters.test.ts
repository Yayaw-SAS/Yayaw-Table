import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import numericDrafts from "../../../../../tests/fixtures/numeric-filter-drafts.json";
import {
  inlineTestPortals,
  menuBody,
  openViewScreen,
} from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import type {
  AdvancedFilter,
  TableListParams,
  YayawTableProps,
} from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

inlineTestPortals();

const rows = [
  {
    id: "1",
    name: "Alpha",
    amount: 0,
    date: "2026-09-04T12:00:00",
    status: 0,
    tags: ["a", "b"],
  },
  {
    id: "2",
    name: "Beta",
    amount: 5,
    date: "2026-09-05T15:30:00",
    status: false,
    tags: ["b"],
  },
  {
    id: "3",
    name: "Gamma",
    amount: 15,
    date: "2026-09-07T10:00:00",
    status: "0",
    tags: ["c"],
  },
];
const config = defineTableConfig({
  id: "filters",
  translations: { namespace: "filters", keys: {} },
  table: {
    enableAdvancedFilters: true,
    enableViews: false,
    syncUrl: false,
  },
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "amount", header: "Amount", type: "number" },
      { id: "date", header: "Date", type: "date" },
      {
        id: "status",
        header: "Status",
        type: "select",
        options: [
          { value: 0, label: "Zero" },
          { value: false, label: "False" },
          { value: "0", label: "Text zero" },
        ],
      },
      {
        id: "tags",
        header: "Tags",
        type: "multiSelect",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
          { value: "c", label: "C" },
        ],
      },
      { id: "private", header: "Private", enableFiltering: false },
    ],
    mandatory: [],
    visible: ["name", "amount"],
    order: ["name", "amount"],
  },
});
const mountTable = (props: Partial<YayawTableProps> = {}) =>
  mount(YayawDataTable, {
    props: { tableType: config.id, config, data: rows, ...props },
    attachTo: document.body,
    // Preserve tooltip behavior while avoiding jsdom's missing layout measurements.
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
type Wrapper = ReturnType<typeof mountTable>;
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));
const pick = async (wrapper: Wrapper, columnId: string) => {
  await flushPromises();
  const picker = wrapper.find("[data-filter-property-picker]");
  if (!picker.exists()) {
    await openViewScreen(wrapper, "Filter");
  }
  await wrapper.get(`[data-filter-property="${columnId}"]`).trigger("click");
  await flushPromises();
  // jsdom can close the new chip's editor with the picker; a browser keeps it.
  if (!wrapper.find(`[data-filter-rule="${columnId}"]`).exists()) {
    await wrapper.get(`[data-filter-chip="${columnId}"]`).trigger("click");
    await flushPromises();
  }
  return wrapper.get(`[data-filter-rule="${columnId}"]`);
};
const chooseOperator = async (wrapper: Wrapper, operator: string) => {
  await wrapper.get("[data-filter-operator]").trigger("click");
  await flushPromises();
  await menuBody().get(`[data-operator="${operator}"]`).trigger("click");
  await flushPromises();
};
const type = async (
  input: {
    setValue: (value: string) => Promise<void>;
    trigger: (event: string, options?: object) => Promise<void>;
  },
  text: string
) => {
  await input.setValue(text);
  await input.trigger("keydown", { key: "Enter" });
  await flushPromises();
};
// The date editor's calendar is a table too.
const BODY = "table:not([data-date-calendar]) > tbody";
const names = (wrapper: Wrapper) =>
  wrapper.findAll(`${BODY} tr`).map((row) => row.text());
const listing = () =>
  vi.fn(async (_params: TableListParams) => ({
    data: rows,
    meta: { totalCount: rows.length },
  }));

it("offers the filterable properties and filters a number between two values", async () => {
  const wrapper = mountTable();
  // The toolbar has no Filter button of its own: the view settings hold it.
  expect(wrapper.find("[data-filter-button]").exists()).toBe(false);
  await openViewScreen(wrapper, "Filter");
  const properties = wrapper
    .findAll("[data-filter-property]")
    .map((item) => item.text());
  expect(properties).toContain("Amount");
  expect(properties).not.toContain("Private");
  await pick(wrapper, "amount");
  await wrapper.get("[data-filter-operator]").trigger("click");
  await flushPromises();
  expect(
    menuBody()
      .findAll("[data-operator]")
      .map((item) => item.attributes("data-operator"))
  ).not.toContain("contains");
  await menuBody().get('[data-operator="between"]').trigger("click");
  await flushPromises();
  const inputs = wrapper.findAll("[data-filter-input]");
  expect(inputs).toHaveLength(2);
  await type(inputs[0] as never, "0");
  // One end alone does not filter yet.
  expect(names(wrapper)).toHaveLength(3);
  await type(wrapper.findAll("[data-filter-input]")[1] as never, "5");
  expect(names(wrapper)).toHaveLength(2);
  expect(wrapper.get(BODY).text()).not.toContain("Gamma");
  expect(wrapper.get('[data-filter-chip="amount"]').text()).toContain("0");
  expect(wrapper.get(".yayaw-settings-badge").text()).toBe("1");
});

it("filters a date range and removes the rule from its menu", async () => {
  const wrapper = mountTable();
  const rule = await pick(wrapper, "date");
  await rule.get('[data-date-mode-option="range"]').setValue(true);
  await flushPromises();
  await wrapper.get("[data-date-from]").setValue("2026-09-04");
  await wrapper.get("[data-date-from]").trigger("change");
  await wrapper.get("[data-date-to]").setValue("2026-09-05");
  await wrapper.get("[data-date-to]").trigger("change");
  await flushPromises();
  expect(names(wrapper)).toHaveLength(2);
  await wrapper
    .get('[data-filter-rule="date"] .yayaw-rule-more')
    .trigger("click");
  await flushPromises();
  await menuBody().get("[data-filter-delete]").trigger("click");
  await flushPromises();
  expect(names(wrapper)).toHaveLength(3);
  expect(wrapper.find("[data-filter-chips]").exists()).toBe(false);
});

it("sends date rules as calendar days, in order, and reads an older link's instants as days", async () => {
  const list = listing();
  const wrapper = mountTable({ getTableActions: () => ({ list }) });
  const rule = await pick(wrapper, "date");
  await rule.get('[data-date-mode-option="range"]').setValue(true);
  await flushPromises();
  await wrapper.get("[data-date-from]").setValue("2026-09-07");
  await wrapper.get("[data-date-from]").trigger("change");
  await wrapper.get("[data-date-to]").setValue("2026-09-05");
  await wrapper.get("[data-date-to]").trigger("change");
  await flushPromises();
  expect(list.mock.lastCall?.[0].advancedFilters).toEqual([
    expect.objectContaining({
      columnId: "date",
      type: "date",
      operator: "between",
      values: ["2026-09-05", "2026-09-07"],
    }),
  ]);
  wrapper.unmount();

  // Older links held the instants of the viewer's local midnights.
  const midnight = (day: number) => new Date(2026, 8, day).toISOString();
  const older: AdvancedFilter = {
    id: "older",
    columnId: "date",
    type: "date",
    operator: "between",
    values: [midnight(4), midnight(5)],
    isActive: true,
  };
  window.history.replaceState(
    {},
    "",
    `/?${new URLSearchParams({ "filters-advancedFilters": JSON.stringify([older]) })}`
  );
  const restored = mountTable({
    getTableActions: () => ({ list }),
    syncUrl: true,
  });
  await flushPromises();
  expect(list.mock.lastCall?.[0].advancedFilters).toEqual([
    expect.objectContaining({ values: ["2026-09-04", "2026-09-05"] }),
  ]);
  await restored.get('[data-filter-chip="date"]').trigger("click");
  await flushPromises();
  expect([
    restored.get<HTMLInputElement>("[data-date-from]").element.value,
    restored.get<HTMLInputElement>("[data-date-to]").element.value,
  ]).toEqual(["2026-09-04", "2026-09-05"]);
});

it("preserves multiple primitive options in server requests and combines rules with OR", async () => {
  const list = listing();
  const wrapper = mountTable({ getTableActions: () => ({ list }) });
  const status = await pick(wrapper, "status");
  const options = status.findAll('input[type="checkbox"]');
  await options[0]?.setValue(true);
  await options[1]?.setValue(true);
  await flushPromises();
  expect(list.mock.lastCall?.[0].advancedFilters).toEqual([
    expect.objectContaining({
      columnId: "status",
      type: "select",
      operator: "isAnyOf",
      values: [0, false],
      isActive: true,
    }),
  ]);
  await wrapper.get("[data-filter-chip-add]").trigger("click");
  await flushPromises();
  await pick(wrapper, "tags");
  await chooseOperator(wrapper, "containsAll");
  // jsdom closes the chip with the operator menu; a browser keeps it open.
  if (!wrapper.find('[data-filter-rule="tags"]').exists()) {
    await wrapper.get('[data-filter-chip="tags"]').trigger("click");
    await flushPromises();
  }
  expect(wrapper.get("[data-filter-operator]").text()).toBe("Contains all");
  await wrapper
    .get('[data-filter-rule="tags"]')
    .findAll('input[type="checkbox"]')[0]
    ?.setValue(true);
  await wrapper
    .get('[data-filter-rule="tags"]')
    .findAll('input[type="checkbox"]')[1]
    ?.setValue(true);
  await flushPromises();
  // "Or" is the advanced filter's: the rules move into it.
  await wrapper
    .get('[data-filter-rule="tags"] .yayaw-rule-more')
    .trigger("click");
  await flushPromises();
  const toAdvanced = menuBody()
    .findAll('[role="menuitem"]')
    .find((item) => item.text() === "Add to advanced filter");
  await toAdvanced?.trigger("click");
  await flushPromises();
  expect(wrapper.get("[data-filter-chip-advanced]").text()).toContain(
    "2 rules"
  );
  await wrapper.get("[data-advanced-join]").setValue("or");
  await flushPromises();
  expect(list.mock.lastCall?.[0]).toMatchObject({
    advancedFilterJoin: "or",
    advancedFilters: [
      expect.objectContaining({ values: [0, false] }),
      expect.objectContaining({ values: ["a", "b"] }),
    ],
  });
  await wrapper.get("[data-advanced-delete]").trigger("click");
  await flushPromises();
  expect(list.mock.lastCall?.[0].advancedFilters ?? []).toEqual([]);
});

it("restores React multi-select operators and values from a saved URL", async () => {
  const filter: AdvancedFilter = {
    id: "saved",
    columnId: "tags",
    type: "multiSelect",
    operator: "containsAll",
    values: ["a", "b"],
    isActive: true,
  };
  const params = new URLSearchParams({
    "filters-advancedFilters": JSON.stringify([filter]),
  });
  window.history.replaceState({}, "", `/?${params}`);
  const wrapper = mountTable({ syncUrl: true });
  await flushPromises();
  expect(wrapper.get('[data-filter-chip="tags"]').text()).toContain("A, B");
  await wrapper.get('[data-filter-chip="tags"]').trigger("click");
  await flushPromises();
  expect(
    wrapper
      .get('[data-filter-rule="tags"]')
      .findAll<HTMLInputElement>('input[type="checkbox"]')
      .filter((input) => input.element.checked)
  ).toHaveLength(2);
  expect(names(wrapper)).toHaveLength(1);
  expect(wrapper.get(BODY).text()).toContain("Alpha");
});

it("uses French defaults and the filter menu's translation keys", async () => {
  const wrapper = mountTable({
    locale: "fr",
    translations: {
      "filters.menu.addFilter": "Nouveau filtre",
      "filters.menu.operators.between": "Intervalle",
    },
  });
  await openViewScreen(wrapper, "Filtrer");
  expect(
    wrapper.get<HTMLInputElement>("[data-filter-property-picker] input").element
      .placeholder
  ).toBe("Filtrer par…");
  await pick(wrapper, "amount");
  await wrapper.get("[data-filter-operator]").trigger("click");
  await flushPromises();
  expect(menuBody().get('[data-operator="between"]').text()).toBe("Intervalle");
  expect(wrapper.get("[data-filter-chip-add]").text()).toBe("Nouveau filtre");
});

for (const fixture of numericDrafts) {
  it(`keeps ${fixture.text} on screen and filters by it once typed`, async () => {
    vi.useFakeTimers();
    try {
      const list = listing();
      const wrapper = mountTable({ getTableActions: () => ({ list }) });
      await flushPromises();
      const initialRequests = list.mock.calls.length;
      await pick(wrapper, "amount");
      // An empty rule is a chip, not a filter.
      expect(list).toHaveBeenCalledTimes(initialRequests);
      const field = wrapper.get<HTMLInputElement>("[data-filter-input]");
      for (let index = 1; index <= fixture.text.length; index += 1) {
        await field.setValue(fixture.text.slice(0, index));
      }
      await flushPromises();
      expect(field.element.value).toBe(fixture.text);
      expect(list).toHaveBeenCalledTimes(initialRequests);
      await vi.advanceTimersByTimeAsync(600);
      await flushPromises();
      expect(list).toHaveBeenCalledTimes(initialRequests + 1);
      expect(list.mock.lastCall?.[0].advancedFilters).toEqual([
        expect.objectContaining({
          columnId: "amount",
          values: fixture.value,
          isActive: true,
        }),
      ]);
      // Escape puts back the value that filters.
      await field.setValue("9");
      await field.trigger("keydown", { key: "Escape" });
      expect(field.element.value).toBe(fixture.text);
      await vi.advanceTimersByTimeAsync(600);
      expect(list).toHaveBeenCalledTimes(initialRequests + 1);
    } finally {
      vi.useRealTimers();
    }
  });
}

it("opens the requested column's filter from its header without filtering", async () => {
  const list = listing();
  const wrapper = mountTable({ getTableActions: () => ({ list }) });
  await flushPromises();
  const requests = list.mock.calls.length;
  await wrapper.get('[aria-label="Column options: Amount"]').trigger("click");
  const filterAction = menuBody()
    .findAll('[role="menuitem"]')
    .find((item) => item.text() === "Filter column");
  if (!filterAction) {
    throw new Error("Missing column filter action");
  }
  await filterAction.trigger("click");
  await new Promise((resolve) => setTimeout(resolve, 10));
  await flushPromises();
  expect(
    wrapper.get('[data-filter-chip="amount"]').attributes("data-complete")
  ).toBe("false");
  expect(
    wrapper.find('[data-filter-rule="amount"] [data-filter-input]').exists()
  ).toBe(true);
  expect(list).toHaveBeenCalledTimes(requests);
});
