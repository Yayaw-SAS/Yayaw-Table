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

// In a non-compact toolbar the view menu offers display modes through a
// `TableSelect` (Reka UI Select) instead of the segmented `fieldset` buttons;
// compact toolbars still render the buttons. `selectLabel` and `optionLabel`
// are the translated strings shown for the active locale.
export async function chooseDisplayMode(
  wrapper: VueWrapper,
  optionLabel: string,
  selectLabel = "Display mode"
): Promise<void> {
  await openViewMenu(wrapper);
  await flushPromises();
  const trigger = wrapper.get(`[role="combobox"][aria-label="${selectLabel}"]`);
  await trigger.trigger("keydown", { key: "Enter" });
  await flushPromises();
  const option = menuBody()
    .findAll('[role="option"]')
    .find((item) => item.text() === optionLabel);
  if (!option) {
    throw new Error(`Missing display mode option: ${optionLabel}`);
  }
  await option.trigger("keydown", { key: "Enter" });
  await flushPromises();
}
