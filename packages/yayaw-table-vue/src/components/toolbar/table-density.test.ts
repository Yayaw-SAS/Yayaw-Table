import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import densityScale from "../../../../../tests/fixtures/density-scale.json";
import { inlineTestPortals, openViewMenu } from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import { isTableDensity } from "../../table-contracts";
import YayawDataTable from "../YayawDataTable.vue";

inlineTestPortals();

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
    global: {
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
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
  await openViewMenu(wrapper);
  await settle();
  const items = body().findAll(".yayaw-density-inline button");
  expect(items.map((item) => item.text())).toEqual([
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "2XL",
  ]);
  expect(items[5]?.attributes("aria-pressed")).toBe("true");
  await items[0]?.trigger("click");
  await settle();
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-small"
  );
  expect(other.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-extra-large"
  );
  expect(config.table.density).toBe("extra-extra-large");

  const modes = wrapper.get('.yayaw-segmented[role="group"]').findAll("button");
  await modes[1]?.trigger("click");
  expect(wrapper.find(".yayaw-density-inline").exists()).toBe(false);
  await modes[0]?.trigger("click");
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-small"
  );
  expect(wrapper.find(".yayaw-density-inline").exists()).toBe(true);
});

it("closes on Escape and restores focus without changing density", async () => {
  const wrapper = mountTable();
  const trigger = wrapper.get(".yayaw-view-trigger");
  (trigger.element as HTMLElement).focus();
  await trigger.trigger("click");
  await settle();
  await new DOMWrapper(document.activeElement ?? document.body).trigger(
    "keydown",
    {
      key: "Escape",
    }
  );
  await settle();
  expect(body().find('[role="dialog"]').exists()).toBe(false);
  expect(document.activeElement).toBe(trigger.element);
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-extra-large"
  );
});

for (const fixture of densityScale) {
  it(`applies the shared ${fixture.label} spacing without changing the default`, async () => {
    const wrapper = mountTable();
    await openViewMenu(wrapper);
    await settle();
    const item = body()
      .findAll(".yayaw-density-inline button")
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

it("names the density choices directly in the view menu without requiring a tooltip", async () => {
  const wrapper = mountTable();
  await openViewMenu(wrapper);
  expect(wrapper.get(".yayaw-density-inline legend").text()).toBe(
    "Densité du tableau"
  );
  expect(
    wrapper.get(".yayaw-view-trigger").attributes("title")
  ).toBeUndefined();
});

it("keeps display-mode tooltips outside the group and preserves pressed state on selection", async () => {
  const wrapper = mountTable();
  await openViewMenu(wrapper);
  const group = wrapper.get('.yayaw-segmented[role="group"]');
  const buttons = group.findAll("button");
  expect(buttons).toHaveLength(2);
  expect(buttons[0]?.attributes("aria-pressed")).toBe("true");
  for (const button of buttons) {
    (button.element as HTMLButtonElement).focus();
    await settle();
    expect(document.activeElement).toBe(button.element);
    expect(body().get('[role="tooltip"]').text()).toBe(button.text());
    expect(group.find('[role="tooltip"]').exists()).toBe(false);
    expect(group.findAll("button")).toHaveLength(2);
    await button.trigger("click");
    await settle();
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(group.findAll('[aria-pressed="true"]')).toHaveLength(1);
  }
});
