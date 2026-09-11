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

export async function openViewMenu(wrapper: VueWrapper): Promise<void> {
  await flushPromises();
  const trigger = wrapper.get(".yayaw-view-trigger");
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

export async function openViewSave(wrapper: VueWrapper): Promise<void> {
  await openViewMenu(wrapper);
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
