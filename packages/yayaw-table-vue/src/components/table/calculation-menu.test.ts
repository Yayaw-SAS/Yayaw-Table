import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { openViewMenu } from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import YayawDataTable from "../YayawDataTable.vue";

const config = defineTableConfig({
  id: "calculations",
  columns: {
    definitions: [
      {
        id: "amount",
        header: "Amount",
        type: "number",
        defaultCalculation: "sum",
      },
      { id: "name", header: "Name", type: "text" },
      { id: "active", header: "Active", type: "boolean" },
      { id: "date", header: "Date", type: "date" },
    ],
    visible: ["amount", "name", "active", "date"],
    order: ["amount", "name", "active", "date"],
    mandatory: [],
  },
  translations: { namespace: "calculations", keys: {} },
  table: { enableCalculations: true, enableViews: false },
});
const mountTable = (
  locale = "en",
  props: { config?: typeof config; rowSelection?: Record<string, boolean> } = {}
) =>
  mount(YayawDataTable, {
    props: {
      config,
      ...props,
      tableType: "calculations",
      locale,
      syncUrl: false,
      data: [
        {
          id: "1",
          amount: 10,
          name: "Alpha",
          active: true,
          date: "2026-01-01",
        },
        {
          id: "2",
          amount: 30,
          name: "Beta",
          active: false,
          date: "2026-01-02",
        },
      ],
    },
    attachTo: document.body,
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
const CALCULATIONS_SWITCH = /calcul/i;
const body = () => new DOMWrapper(document.body);
/** Turns on "Edit calculations" in the view settings. */
const editCalculations = async (wrapper: ReturnType<typeof mountTable>) => {
  await openViewMenu(wrapper);
  const toggle = body()
    .findAll('.yayaw-options-item[role="switch"]')
    .find((button) => CALCULATIONS_SWITCH.test(button.text()));
  if (!toggle) {
    throw new Error("Missing Edit calculations switch");
  }
  await toggle.trigger("click");
  await settle();
  return toggle;
};
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
};
const item = (label: string) => {
  const match = body()
    .findAll('[role^="menuitem"]')
    .find((element) => element.text() === label);
  if (!match) {
    throw new Error(`Missing calculation menu item: ${label}`);
  }
  return match;
};
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));

it("uses a translated menu to change the result and clear the configured calculation", async () => {
  const wrapper = mountTable("fr");
  await settle();
  await editCalculations(wrapper);
  const trigger = wrapper.get('[aria-label="Calculer: Amount"]');
  expect(wrapper.find("tfoot select").exists()).toBe(false);
  expect(trigger.text()).toContain("Somme");
  expect(trigger.text()).toContain("40");
  await trigger.trigger("keydown", { key: "Enter" });
  await settle();
  await item("Autres options").trigger("keydown", { key: "ArrowRight" });
  await settle();
  expect(item("Somme").attributes("aria-checked")).toBe("true");
  await item("Moyenne").trigger("click");
  await settle();
  expect(trigger.text()).toContain("Moyenne");
  expect(trigger.text()).toContain("20");
  expect(body().find('[role="menu"]').exists()).toBe(false);
  await trigger.trigger("keydown", { key: "Enter" });
  await settle();
  await item("Aucun").trigger("click");
  await settle();
  expect(trigger.text()).toBe("Calculer");
  expect(config.columns.definitions[0]?.defaultCalculation).toBe("sum");
});

it("closes on Escape and returns focus without changing the result", async () => {
  const wrapper = mountTable();
  await settle();
  await editCalculations(wrapper);
  const trigger = wrapper.get('[aria-label="Calculate: Amount"]');
  (trigger.element as HTMLElement).focus();
  await trigger.trigger("keydown", { key: "Enter" });
  await settle();
  await new DOMWrapper(document.activeElement ?? document.body).trigger(
    "keydown",
    { key: "Escape" }
  );
  await settle();
  expect(body().find('[role="menu"]').exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  expect(trigger.text()).toContain("Sum");
  expect(trigger.text()).toContain("40");
});

it("keeps numeric, boolean and date choices limited to compatible columns", async () => {
  const wrapper = mountTable();
  await settle();
  await editCalculations(wrapper);
  await wrapper
    .get('[aria-label="Calculate: Name"]')
    .trigger("keydown", { key: "Enter" });
  await settle();
  expect(body().text()).not.toContain("More options");
  await item("None").trigger("click");
  await settle();
  await wrapper
    .get('[aria-label="Calculate: Active"]')
    .trigger("keydown", { key: "Enter" });
  await settle();
  await item("Count").trigger("keydown", { key: "ArrowRight" });
  await settle();
  expect(item("Count checked").exists()).toBe(true);
  expect(body().text()).not.toContain("More options");
  await item("Count checked").trigger("click");
  await settle();
  expect(wrapper.get('[aria-label="Calculate: Active"]').text()).toContain("1");
  await wrapper
    .get('[aria-label="Calculate: Date"]')
    .trigger("keydown", { key: "Enter" });
  await settle();
  await item("More options").trigger("keydown", { key: "ArrowRight" });
  await settle();
  expect(
    body()
      .findAll('[role="menuitemradio"]')
      .map((option) => option.text())
  ).toEqual(["None", "Min", "Max", "Range"]);
});

it("totals the selected rows, with every matching row in the tooltip", async () => {
  const wrapper = mountTable("en", { rowSelection: { "1": true } });
  await settle();
  await editCalculations(wrapper);
  const trigger = wrapper.get('[aria-label="Calculate: Amount"]');
  expect(trigger.text()).toContain("Sum · Selection (1)");
  expect(trigger.text()).toContain("10");
  expect(trigger.attributes("title")).toBe("All rows: 40");
});

it("gives the page's result in the tooltip when the rows span several pages", async () => {
  const paged = defineTableConfig({
    ...config,
    table: { ...config.table, defaultPageSize: 1, pageSizeOptions: [1] },
  });
  const wrapper = mountTable("fr", { config: paged });
  await settle();
  await editCalculations(wrapper);
  const trigger = wrapper.get('[aria-label="Calculer: Amount"]');
  expect(trigger.text()).toContain("40");
  expect(trigger.attributes("title")).toBe("Cette page: 10");
});

it("freezes calculations: no menu, and no Calculate button where none is declared", async () => {
  const locked = defineTableConfig({
    ...config,
    columns: {
      ...config.columns,
      definitions: config.columns.definitions.map((column) =>
        column.id === "date" ? { ...column, lockCalculation: false } : column
      ),
    },
    table: { ...config.table, lockCalculations: true },
  });
  const wrapper = mountTable("en", { config: locked });
  await settle();
  await editCalculations(wrapper);
  expect(wrapper.find('[aria-label="Calculate: Amount"]').exists()).toBe(false);
  const frozen = wrapper.get("tfoot [data-calculation-locked]");
  expect(frozen.text()).toContain("Sum");
  expect(frozen.text()).toContain("40");
  expect(wrapper.find('[aria-label="Calculate: Name"]').exists()).toBe(false);
  expect(wrapper.find('[aria-label="Calculate: Active"]').exists()).toBe(false);
  expect(wrapper.find('[aria-label="Calculate: Date"]').exists()).toBe(true);
  expect(wrapper.findAll("tfoot button")).toHaveLength(1);
});

it("freezes one column with lockCalculation and hides the footer when nothing is left", async () => {
  const single = defineTableConfig({
    ...config,
    columns: {
      ...config.columns,
      definitions: config.columns.definitions.map((column) => ({
        ...column,
        lockCalculation: true,
      })),
    },
  });
  const wrapper = mountTable("en", { config: single });
  await settle();
  expect(wrapper.get("tfoot [data-calculation-locked]").text()).toContain("40");
  expect(wrapper.findAll("tfoot button")).toHaveLength(0);
  const empty = defineTableConfig({
    ...single,
    columns: {
      ...single.columns,
      definitions: single.columns.definitions.map(
        ({ defaultCalculation: _ignored, ...column }) => column
      ),
    },
  });
  wrapper.unmount();
  const bare = mountTable("en", { config: empty });
  await settle();
  expect(bare.find("tfoot").exists()).toBe(false);
});

it("shows calculations as plain text until Edit calculations is on", async () => {
  const wrapper = mountTable("fr");
  await settle();
  expect(wrapper.findAll("tfoot button")).toHaveLength(0);
  const total = wrapper.get("tfoot [data-calculation-locked]");
  expect(total.text()).toContain("Somme");
  expect(total.text()).toContain("40");
  const toggle = await editCalculations(wrapper);
  expect(toggle.text()).toContain("Éditer les calculs");
  expect(toggle.attributes("aria-checked")).toBe("true");
  expect(wrapper.find('[aria-label="Calculer: Amount"]').exists()).toBe(true);
  expect(wrapper.find('[aria-label="Calculer: Name"]').exists()).toBe(true);
  await toggle.trigger("click");
  await settle();
  expect(wrapper.findAll("tfoot button")).toHaveLength(0);
});

it("hides the footer and the switch when nothing can be edited", async () => {
  const bare = defineTableConfig({
    ...config,
    columns: {
      ...config.columns,
      definitions: config.columns.definitions.map(
        ({ defaultCalculation: _ignored, ...column }) => column
      ),
    },
  });
  const wrapper = mountTable("en", { config: bare });
  await settle();
  expect(wrapper.find("tfoot").exists()).toBe(false);
  await editCalculations(wrapper);
  expect(wrapper.find('[aria-label="Calculate: Amount"]').exists()).toBe(true);
  wrapper.unmount();
  const frozen = mountTable("en", {
    config: defineTableConfig({
      ...config,
      table: { ...config.table, lockCalculations: true },
    }),
  });
  await openViewMenu(frozen);
  await settle();
  expect(
    body()
      .findAll('.yayaw-options-item[role="switch"]')
      .some((button) => CALCULATIONS_SWITCH.test(button.text()))
  ).toBe(false);
});
