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
    "2XS",
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "2XL",
  ]);
  expect(items[6]?.attributes("aria-pressed")).toBe("true");
  await items[1]?.trigger("click");
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
  await chooseDisplayMode(wrapper, "Galerie");
  await settle();
  expect(wrapper.find(".yayaw-density-inline").exists()).toBe(false);
  await chooseDisplayMode(wrapper, "Tableau");
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
    expect(table.style.getPropertyValue("--yayaw-density-font")).toBe(
      `${fixture.fontSize}px`
    );
    expect(table.style.getPropertyValue("--yayaw-density-line")).toBe(
      `${fixture.lineHeight}px`
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

it("offers display choices as layout tiles in touch drawers", async () => {
  // Compact toolbars show the same layout tiles at the top of their settings.
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
  const group = body().get("fieldset.yayaw-layout-picker");
  expect(group.get("legend").text()).toBe("Mode d’affichage");
  const tiles = group.findAll("button.yayaw-layout-tile");
  expect(tiles).toHaveLength(2);
  expect(tiles[0]?.attributes("aria-pressed")).toBe("true");
  await tiles[1]?.trigger("click");
  await settle();
  const pressed = body().findAll(
    'fieldset.yayaw-layout-picker button[aria-pressed="true"]'
  );
  expect(pressed).toHaveLength(1);
  expect(pressed[0]?.text()).toBe(tiles[1]?.text());
});
