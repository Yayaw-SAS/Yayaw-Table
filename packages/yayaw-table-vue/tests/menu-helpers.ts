import {
  DOMWrapper,
  flushPromises,
  config as testConfig,
  type VueWrapper,
} from "@vue/test-utils";

// Keep overlays in the mounted tree for existing component assertions. Full portal
// behavior is exercised separately by the responsive-menu tests and browser checks.
export function inlineTestPortals(): void {
  testConfig.global.stubs = {
    ...testConfig.global.stubs,
    PopoverPortal: { template: "<div><slot /></div>" },
    PopperContent: { template: "<div><slot /></div>" },
  };
}

/** Opens the view settings (layout, properties, filter, sort, group, data). */
export async function openViewMenu(wrapper: VueWrapper): Promise<void> {
  await flushPromises();
  const trigger = wrapper.get(".yayaw-settings-trigger");
  if (trigger.attributes("aria-expanded") !== "true") {
    await trigger.trigger("click");
    await flushPromises();
  }
}

export async function openViewScreen(
  wrapper: VueWrapper,
  name: string
): Promise<void> {
  await openViewMenu(wrapper);
  const button = wrapper
    .findAll(".yayaw-options-item")
    .find((item) => item.text().startsWith(name));
  if (!button) {
    throw new Error(`Missing view screen: ${name}`);
  }
  await button.trigger("click");
  await flushPromises();
}

const SAVE_ACTION_PATTERN = /Save (this view|as new view)/;

/** Opens the views menu: the actions chevron next to the tabs, or the named trigger. */
export async function openViewsMenu(wrapper: VueWrapper): Promise<void> {
  await flushPromises();
  const trigger = wrapper.find(".yayaw-view-actions").exists()
    ? wrapper.get(".yayaw-view-actions")
    : wrapper.get(".yayaw-view-trigger");
  if (trigger.attributes("aria-expanded") !== "true") {
    await trigger.trigger("click");
    await flushPromises();
  }
}

export async function openViewSave(wrapper: VueWrapper): Promise<void> {
  await openViewsMenu(wrapper);
  const button = wrapper
    .findAll(".yayaw-view-write-actions button")
    .find((item) => SAVE_ACTION_PATTERN.test(item.text()));
  if (!button) {
    throw new Error("Missing save-view action");
  }
  await button.trigger("click");
  await flushPromises();
}

export const menuBody = () => new DOMWrapper(document.body);

// Like Notion, the menu's display mode row opens a screen of layout tiles
// (one button per mode). `optionLabel` is the translated mode name.
export async function chooseDisplayMode(
  wrapper: VueWrapper,
  optionLabel: string
): Promise<void> {
  await openViewMenu(wrapper);
  await flushPromises();
  const inMenu = (selector: string) => [
    ...wrapper.findAll(selector),
    ...menuBody().findAll(selector),
  ];
  // A menu still open on the layout screen already shows its tiles.
  if (!inMenu(".yayaw-layout-tile").length) {
    const row = inMenu(".yayaw-layout-row")[0];
    if (!row) {
      throw new Error("Missing display mode row");
    }
    await row.trigger("click");
    await flushPromises();
  }
  // Inline menus render in the wrapper, portalled ones in the document body.
  const tile = [
    ...wrapper.findAll(".yayaw-layout-tile"),
    ...menuBody().findAll(".yayaw-layout-tile"),
  ].find((item) => item.text() === optionLabel);
  if (!tile) {
    throw new Error(`Missing display mode tile: ${optionLabel}`);
  }
  await tile.trigger("click");
  await flushPromises();
}
