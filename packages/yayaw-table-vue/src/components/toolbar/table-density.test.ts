import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import densityScale from "../../../../../tests/fixtures/density-scale.json";
import {
  chooseDisplayMode,
  inlineTestPortals,
  openViewMenu,
} from "../../../tests/menu-helpers";
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
    vi.unstubAllGlobals();
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

  // Non-compact toolbars drive the display mode through a `TableSelect`
  // rather than the segmented `fieldset` buttons (compact toolbars only).
  await chooseDisplayMode(wrapper, "Galerie", "Mode d’affichage");
  await settle();
  expect(wrapper.find(".yayaw-density-inline").exists()).toBe(false);
  await chooseDisplayMode(wrapper, "Tableau", "Mode d’affichage");
  await settle();
  expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
    "extra-small"
  );
  expect(wrapper.find(".yayaw-density-inline").exists()).toBe(true);
});

it("closes on Escape and restores focus without changing density", async () => {
  const wrapper = mountTable();
  const trigger = wrapper.get(".yayaw-settings-trigger");
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
    wrapper.get(".yayaw-settings-trigger").attributes("title")
  ).toBeUndefined();
});

it("offers display choices as a labelled radio list in touch drawers", async () => {
  // Compact toolbars list the layout as a row that opens its choices.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  const wrapper = mountTable();
  await openViewMenu(wrapper);
  // A compact toolbar renders its settings dialog through a `DialogPortal`.
  const row = body()
    .findAll(".yayaw-options-item")
    .find((item) => item.text().startsWith("Mode d’affichage"));
  if (!row) {
    throw new Error("Missing display mode row");
  }
  await row.trigger("click");
  await settle();
  const group = body().get("fieldset.yayaw-choice-list");
  expect(group.get("legend").text()).toBe("Mode d’affichage");
  const radios = group.findAll<HTMLInputElement>('input[type="radio"]');
  expect(radios).toHaveLength(2);
  expect(radios[0]?.element.checked).toBe(true);
  for (const radio of radios) {
    radio.element.focus();
    await settle();
    expect(document.activeElement).toBe(radio.element);
    await radio.setValue(true);
    await settle();
    expect(
      body()
        .findAll<HTMLInputElement>(
          'fieldset.yayaw-choice-list input[type="radio"]'
        )
        .filter((input) => input.element.checked)
    ).toHaveLength(1);
  }
});
