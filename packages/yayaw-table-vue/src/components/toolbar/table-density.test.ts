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
  id: "density",
  columns: {
    definitions: [{ id: "name", header: "Name" }],
    visible: ["name"],
    order: ["name"],
    mandatory: [],
  },
  translations: { namespace: "density", keys: {} },
  table: {
    density: "extra-large",
    displayModes: ["table", "gallery"],
    enableViews: false,
  },
});
const mountTable = () =>
  mount(YayawDataTable, {
    props: {
      config,
      tableType: "density",
      locale: "fr",
      data: [{ id: "1", name: "Alpha" }],
      syncUrl: false,
    },
    attachTo: document.body,
    global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
  });
const body = () => new DOMWrapper(document.body);
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
};
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));

it("uses the configured density, updates only its instance and retains it across display modes", async () => {
  const wrapper = mountTable();
  const other = mountTable();
  const trigger = wrapper.get('[aria-label="Densité du tableau: XL"]');
  expect(trigger.classes()).toContain("yayaw-icon-only");
  expect(trigger.text()).toBe("");
  expect(
    wrapper.get(".yayaw-toolbar-right").findAll("button")[0]?.element
  ).toBe(trigger.element);
  await trigger.trigger("keydown", { key: "Enter" });
  await settle();
  const items = body().findAll('[role="menuitemradio"]');
  expect(items.map((item) => item.text())).toEqual(["S", "M", "L", "XL"]);
  expect(items[3]?.attributes("aria-checked")).toBe("true");
  await items[0]?.trigger("click");
  await settle();
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe("small");
  expect(other.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-large"
  );
  expect(config.table.density).toBe("extra-large");

  const modes = wrapper.get('[role="group"]').findAll("button");
  await modes[1]?.trigger("click");
  expect(wrapper.find('[aria-label="Densité du tableau: S"]').exists()).toBe(
    false
  );
  await modes[0]?.trigger("click");
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe("small");
  expect(wrapper.find('[aria-label="Densité du tableau: S"]').exists()).toBe(
    true
  );
});

it("closes on Escape and restores focus without changing density", async () => {
  const wrapper = mountTable();
  const trigger = wrapper.get('[aria-label="Densité du tableau: XL"]');
  (trigger.element as HTMLElement).focus();
  await trigger.trigger("keydown", { key: "Enter" });
  await settle();
  await new DOMWrapper(document.activeElement ?? document.body).trigger(
    "keydown",
    {
      key: "Escape",
    }
  );
  await settle();
  expect(body().find('[role="menu"]').exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-large"
  );
});
