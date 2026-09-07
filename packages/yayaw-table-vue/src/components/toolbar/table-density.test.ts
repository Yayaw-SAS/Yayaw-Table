import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import densityScale from "../../../../../tests/fixtures/density-scale.json";
import { defineTableConfig } from "../../config";
import { isTableDensity } from "../../table-contracts";
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
    density: "extra-extra-large",
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
  const trigger = wrapper.get('[aria-label="Densité du tableau: 2XL"]');
  expect(trigger.classes()).toContain("yayaw-icon-only");
  expect(trigger.text()).toBe("");
  expect(
    wrapper.get(".yayaw-toolbar-right").findAll("button")[0]?.element
  ).toBe(trigger.element);
  await trigger.trigger("keydown", { key: "Enter" });
  await settle();
  const items = body().findAll('[role="menuitemradio"]');
  expect(items.map((item) => item.text())).toEqual([
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "2XL",
  ]);
  expect(items[5]?.attributes("aria-checked")).toBe("true");
  await items[0]?.trigger("click");
  await settle();
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-small"
  );
  expect(other.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-extra-large"
  );
  expect(config.table.density).toBe("extra-extra-large");

  const modes = wrapper.get('[role="group"]').findAll("button");
  await modes[1]?.trigger("click");
  expect(wrapper.find('[aria-label="Densité du tableau: XS"]').exists()).toBe(
    false
  );
  await modes[0]?.trigger("click");
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-small"
  );
  expect(wrapper.find('[aria-label="Densité du tableau: XS"]').exists()).toBe(
    true
  );
});

it("closes on Escape and restores focus without changing density", async () => {
  const wrapper = mountTable();
  const trigger = wrapper.get('[aria-label="Densité du tableau: 2XL"]');
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
    "extra-extra-large"
  );
});

for (const fixture of densityScale) {
  it(`applies the shared ${fixture.label} spacing without changing the default`, async () => {
    const wrapper = mountTable();
    await wrapper
      .get('[aria-label="Densité du tableau: 2XL"]')
      .trigger("click");
    await settle();
    const item = body()
      .findAll('[role="menuitemradio"]')
      .find((option) => option.text() === fixture.label);
    expect(item).toBeDefined();
    await item?.trigger("click");
    await settle();
    expect(isTableDensity(fixture.value)).toBe(true);
    const table = wrapper.get(".yayaw-table").element as HTMLElement;
    expect(table.dataset.density).toBe(fixture.value);
    expect(table.style.getPropertyValue("--yayaw-density-height")).toBe(
      `calc(var(--spacing, 0.25rem) * ${fixture.height / 4})`
    );
    expect(table.style.getPropertyValue("--yayaw-density-control")).toBe(
      `calc(var(--spacing, 0.25rem) * ${fixture.control / 4})`
    );
    expect(config.table.density).toBe("extra-extra-large");
  });
}

it("shows the localized density tooltip on keyboard focus without a native duplicate", async () => {
  const wrapper = mountTable();
  const trigger = wrapper.get('[aria-label="Densité du tableau: 2XL"]');
  expect(trigger.attributes("title")).toBeUndefined();
  (trigger.element as HTMLButtonElement).focus();
  await settle();
  expect(body().get('[role="tooltip"]').text()).toBe("Densité du tableau: 2XL");
});
