import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
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
const mountTable = (locale = "en") =>
  mount(YayawDataTable, {
    props: {
      config,
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
    global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
  });
const body = () => new DOMWrapper(document.body);
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
