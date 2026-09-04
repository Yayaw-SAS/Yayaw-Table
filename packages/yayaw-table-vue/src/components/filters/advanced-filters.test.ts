import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";
import type {
  AdvancedFilter,
  TableListParams,
  YayawTableProps,
} from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

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
  table: { enableViews: false, syncUrl: false },
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
  });
type Wrapper = ReturnType<typeof mountTable>;
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));
const button = (wrapper: Wrapper, text: string) =>
  wrapper.findAll("button").find((item) => item.text() === text);
const add = async (wrapper: Wrapper) => {
  await wrapper.get('[aria-label="Options"]').trigger("click");
  await wrapper
    .findAll(".yayaw-options-item")
    .find((item) => item.text().startsWith("Filters"))
    ?.trigger("click");
  await wrapper.get('[aria-label="Add filter"]').trigger("click");
  await flushPromises();
  return wrapper.get(".yayaw-filter-rule:last-child");
};
const names = (wrapper: Wrapper) =>
  wrapper.findAll("tbody tr").map((row) => row.text());

it("edits numeric ranges as a draft, applies zero and resets type/operator on column change", async () => {
  const wrapper = mountTable();
  const rule = await add(wrapper);
  const column = rule.get("label:nth-child(1) select");
  expect(document.activeElement).toBe(column.element);
  expect(column.findAll("option").map((option) => option.text())).not.toContain(
    "Private"
  );
  await column.setValue("amount");
  const operator = rule.get("label:nth-child(2) select");
  expect(
    operator.findAll("option").map((option) => option.attributes("value"))
  ).not.toContain("contains");
  await operator.setValue("between");
  const values = rule.findAll('input[type="number"]');
  expect(values).toHaveLength(2);
  await values[0]?.setValue("0");
  expect(
    rule.get('button[type="submit"]').attributes("disabled")
  ).toBeDefined();
  await values[1]?.setValue("5");
  expect(names(wrapper)).toHaveLength(3);
  await rule.trigger("submit");
  await flushPromises();
  expect(names(wrapper)).toHaveLength(2);
  expect(wrapper.get("tbody").text()).not.toContain("Gamma");
  await column.setValue("date");
  expect(rule.findAll('input[type="date"]')).toHaveLength(1);
  expect(rule.findAll<HTMLSelectElement>("select")[1]?.element.value).toBe(
    "equals"
  );
  await rule.get('input[type="date"]').setValue("2026-09-07");
  await rule.trigger("submit");
  await flushPromises();
  expect(wrapper.get("tbody").text()).toContain("Gamma");
  expect(names(wrapper)).toHaveLength(1);
});

it("supports date ranges and lets Escape discard edits without changing the active filter", async () => {
  const wrapper = mountTable();
  const rule = await add(wrapper);
  await rule.findAll("select")[0]?.setValue("date");
  await rule.findAll("select")[1]?.setValue("between");
  const inputs = rule.findAll('input[type="date"]');
  await inputs[0]?.setValue("2026-09-04");
  await inputs[1]?.setValue("2026-09-05");
  await rule.trigger("submit");
  await flushPromises();
  expect(names(wrapper)).toHaveLength(2);
  await inputs[1]?.setValue("2026-09-07");
  await inputs[1]?.trigger("keydown", { key: "Escape" });
  expect(
    rule.findAll<HTMLInputElement>('input[type="date"]')[1]?.element.value
  ).toBe("2026-09-05");
  expect(document.activeElement).toBe(rule.findAll("select")[0]?.element);
  await rule.get('[aria-label="Disable filter"]').trigger("click");
  expect(names(wrapper)).toHaveLength(3);
  await rule.get('[aria-label="Enable filter"]').trigger("click");
  expect(names(wrapper)).toHaveLength(2);
});

it("preserves multiple primitive options in server requests and combines rules with OR", async () => {
  const list = vi.fn(async (_params: TableListParams) => ({
    data: rows,
    meta: { totalCount: 3 },
  }));
  const wrapper = mountTable({ getTableActions: () => ({ list }) });
  const rule = await add(wrapper);
  await rule.findAll("select")[0]?.setValue("status");
  await rule.findAll("select")[1]?.setValue("isAnyOf");
  const options = rule.findAll('input[type="checkbox"]');
  await options[0]?.setValue(true);
  await options[1]?.setValue(true);
  await rule.trigger("submit");
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
  const nextRule = await add(wrapper);
  await nextRule.findAll("select")[0]?.setValue("tags");
  await nextRule.findAll("select")[1]?.setValue("containsAll");
  await nextRule.findAll('input[type="checkbox"]')[0]?.setValue(true);
  await nextRule.findAll('input[type="checkbox"]')[1]?.setValue(true);
  await nextRule.trigger("submit");
  await wrapper.get('[aria-label="Filter combination"]').setValue("or");
  await flushPromises();
  expect(list.mock.lastCall?.[0]).toMatchObject({
    advancedFilterJoin: "or",
    advancedFilters: [
      expect.objectContaining({ values: [0, false] }),
      expect.objectContaining({ values: ["a", "b"] }),
    ],
  });
  await nextRule.get('[aria-label="Remove filter"]').trigger("click");
  expect(document.activeElement).toBe(rule.findAll("select")[0]?.element);
  await rule.get('[aria-label="Remove filter"]').trigger("click");
  expect(document.activeElement).toBe(
    wrapper.get('[aria-label="Options"]').element
  );
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
  const rule = wrapper.get(".yayaw-filter-rule");
  expect(
    rule
      .findAll<HTMLInputElement>('input[type="checkbox"]')
      .filter((input) => input.element.checked)
  ).toHaveLength(2);
  expect(names(wrapper)).toHaveLength(1);
  expect(wrapper.get("tbody").text()).toContain("Alpha");
});

it("uses French defaults and React translation keys in the filter controls", async () => {
  const wrapper = mountTable({
    locale: "fr",
    translations: {
      "filters.apply": "Valider",
      "filters.operators.between": "Intervalle",
    },
  });
  await wrapper.get('[aria-label="Options"]').trigger("click");
  await button(wrapper, "Filtres")?.trigger("click");
  await wrapper.get('[aria-label="Ajouter un filtre"]').trigger("click");
  const rule = wrapper.get(".yayaw-filter-rule");
  await rule.findAll("select")[0]?.setValue("amount");
  expect(rule.text()).toContain("Colonne du filtre");
  expect(rule.text()).toContain("Intervalle");
  expect(rule.get('button[type="submit"]').text()).toBe("Valider");
  expect(
    wrapper.get('[aria-label="Combinaison des filtres"]').text()
  ).toContain("toutes les conditions");
});
