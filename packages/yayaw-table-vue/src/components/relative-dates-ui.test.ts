import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { computed, reactive } from "vue";
import { inlineTestPortals } from "../../tests/menu-helpers";
import { defineTableConfig } from "../config";
import { type TableContextValue, tableContextKey } from "../context";
import { createTranslations } from "../translations";
import type {
  ColumnDefinition,
  TableListParams,
  TableRecord,
  YayawTableProps,
} from "../types";
import DynamicField from "./forms/DynamicField.vue";
import CellRenderer from "./table/CellRenderer.vue";
import YayawDataTable from "./YayawDataTable.vue";

inlineTestPortals();

const PARIS = "Europe/Paris";
const rows = [
  { id: "1", name: "Monday task", due: "2026-10-12" },
  { id: "2", name: "Sunday task", due: "2026-10-18" },
  { id: "3", name: "Next week task", due: "2026-10-19" },
];
const config = defineTableConfig({
  id: "relative",
  translations: { namespace: "relative", keys: {} },
  table: {
    enableAdvancedFilters: true,
    enableViews: false,
    syncUrl: false,
    timeZone: PARIS,
    weekStartsOn: 1,
  },
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "due", header: "Due", type: "date" },
    ],
    mandatory: [],
    visible: ["name", "due"],
    order: ["name", "due"],
  },
});
const mountTable = (props: Partial<YayawTableProps> = {}) =>
  mount(YayawDataTable, {
    props: { tableType: config.id, config, data: rows, ...props },
    attachTo: document.body,
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
type Wrapper = ReturnType<typeof mountTable>;

const mounted: VueWrapper[] = [];
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    for (const wrapper of mounted.splice(0)) {
      wrapper.unmount();
    }
    document.body.replaceChildren();
    vi.useRealTimers();
  })
);
// A Wednesday in Paris.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T10:00:00.000Z"));
  window.history.replaceState({}, "", "/");
});

const addDateRule = async (wrapper: Wrapper) => {
  await flushPromises();
  await wrapper.get("[data-filter-button]").trigger("click");
  await flushPromises();
  await wrapper.get('[data-filter-property="due"]').trigger("click");
  await flushPromises();
  if (!wrapper.find('[data-filter-rule="due"]').exists()) {
    await wrapper.get('[data-filter-chip="due"]').trigger("click");
    await flushPromises();
  }
  return wrapper.get('[data-filter-rule="due"]');
};
const names = (wrapper: Wrapper) =>
  wrapper.findAll("tbody tr").map((row) => row.text());

it("filters on a relative date picked by its label, with the table's first weekday", async () => {
  const wrapper = mountTable();
  const rule = await addDateRule(wrapper);
  // Relative dates come first, by name.
  expect(rule.get('[data-relative-date="$thisWeek"]').text()).toBe("This week");
  await rule.get('[data-relative-date="$thisWeek"]').trigger("click");
  await flushPromises();
  expect(names(wrapper)).toHaveLength(2);
  expect(wrapper.get("tbody").text()).not.toContain("Next week task");
  expect(wrapper.get('[data-filter-chip="due"]').text()).toContain("This week");
  // Back to a specific date: today.
  await wrapper
    .findAll('[data-filter-rule="due"] .yayaw-segmented button')
    .find((button) => button.text() === "Exact date")
    ?.trigger("click");
  await flushPromises();
  expect(wrapper.get<HTMLInputElement>("[data-date-exact]").element.value).toBe(
    "2026-10-14"
  );
});

it("filters on a rolling period of any length and unit", async () => {
  const wrapper = mountTable();
  await addDateRule(wrapper);
  await wrapper.get("[data-rolling-direction]").setValue("next");
  await wrapper.get("[data-rolling-count]").setValue("1");
  await wrapper.get("[data-rolling-unit]").setValue("Weeks");
  await wrapper.get("[data-rolling-unit]").trigger("change");
  await flushPromises();
  // Today through next Tuesday: Sunday's task, not the one after.
  expect(names(wrapper)).toHaveLength(2);
  expect(wrapper.get("tbody").text()).toContain("Next week task");
  expect(wrapper.get("tbody").text()).not.toContain("Monday task");
  expect(wrapper.get('[data-filter-chip="due"]').text()).toContain(
    "Next 1 week"
  );
});

it("sends list requests the days a relative rule names", async () => {
  const list = vi.fn(async (_params: TableListParams) => ({
    data: rows,
    meta: { totalCount: 3 },
  }));
  const wrapper = mountTable({ getTableActions: () => ({ list }) });
  const rule = await addDateRule(wrapper);
  await rule.get('[data-relative-date="$last7Days"]').trigger("click");
  await flushPromises();
  expect(list.mock.lastCall?.[0].advancedFilters).toEqual([
    expect.objectContaining({
      columnId: "due",
      operator: "between",
      values: ["2026-10-08", "2026-10-14"],
    }),
  ]);
});

it("edits a date and time field in its zone and stores an ISO instant", async () => {
  const wrapper = mount(DynamicField, {
    props: {
      field: {
        name: "starts",
        label: "Starts",
        type: "date",
        withTime: true,
        timeZone: PARIS,
      },
      modelValue: "2026-10-14T07:30:00.000Z",
      context: { mode: "edit", values: {} },
    },
  });
  mounted.push(wrapper);
  const input = wrapper.get<HTMLInputElement>('input[type="datetime-local"]');
  expect(input.element.value).toBe("2026-10-14T09:30");
  await input.setValue("2026-10-15T18:45");
  expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
    "2026-10-15T16:45:00.000Z",
  ]);
});

it("edits a date and time cell inline and saves an ISO instant", async () => {
  const row = reactive<TableRecord>({
    id: "1",
    starts: "2026-10-14T07:30:00.000Z",
  });
  const column: ColumnDefinition = {
    id: "starts",
    header: "Starts",
    type: "date",
    withTime: true,
    timeZone: PARIS,
  };
  const update = vi.fn(async () => ({ success: true }));
  const context = {
    config: defineTableConfig({
      id: "instance",
      columns: { definitions: [column], mandatory: [], visible: [], order: [] },
      translations: { namespace: "items", keys: {} },
      table: { inlineEdit: { enabled: true, debounceMs: 0 } },
    }),
    tableType: "items",
    actions: computed(() => ({ update })),
    translations: computed(() => createTranslations("en")),
    getFormConfig: vi.fn(() => undefined),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
  } as unknown as TableContextValue;
  const wrapper = mount(CellRenderer, {
    props: { row, column, value: row.starts },
    attachTo: document.body,
    global: { provide: { [tableContextKey as symbol]: context } },
  });
  mounted.push(wrapper);
  await wrapper.trigger("click");
  await flushPromises();
  const input = wrapper.get<HTMLInputElement>('input[type="datetime-local"]');
  expect(input.element.value).toBe("2026-10-14T09:30");
  await input.setValue("2026-10-14T11:00");
  await input.trigger("blur");
  await flushPromises();
  expect(update).toHaveBeenCalledWith(
    "1",
    { starts: "2026-10-14T09:00:00.000Z" },
    expect.anything()
  );
});
