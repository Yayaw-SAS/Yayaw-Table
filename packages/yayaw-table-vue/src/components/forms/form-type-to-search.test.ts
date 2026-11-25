import { flushPromises, mount } from "@vue/test-utils";
import { injectComboboxRootContext } from "reka-ui";
import { afterEach, expect, it, vi } from "vitest";
import { computed, defineComponent, ref } from "vue";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import type { FormConfig, TableRecord } from "../../types";
import CatalogueForm from "./CatalogueForm.vue";
import FieldCombobox from "./FieldCombobox.vue";

afterEach(() => {
  document.body.replaceChildren();
});

// Reka's list needs layout jsdom lacks; this one is drawn, at the end of the page, only while the list is open,
// so the search appears (and Reka resets it) when the list opens, as in a browser.
const OpenContent = defineComponent({
  setup: () => ({ root: injectComboboxRootContext() }),
  template: '<div v-if="root.open.value" role="listbox"><slot /></div>',
});

const options = [
  { value: "ada", label: "Ada" },
  { value: "grace", label: "Grace" },
  { value: "linus", label: "Linus" },
];

function mountForm(fields: FormConfig["fields"], row: TableRecord) {
  Element.prototype.scrollIntoView = vi.fn();
  const context = {
    config: defineTableConfig({
      id: "instance",
      columns: { definitions: [], mandatory: [], order: [], visible: [] },
      translations: { keys: {}, namespace: "table" },
    }),
    tableType: "items",
    form: ref({
      open: true,
      mode: "edit" as const,
      row,
      formType: "item-form",
    }),
    getFormConfig: vi.fn(() => ({ id: "item-form", fields })),
    actions: computed(() => ({
      update: vi.fn(async () => ({ success: true })),
    })),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
    translations: computed(() => ({ create: "Create", edit: "Edit" })),
    locale: "en",
    status: ref(),
  } as unknown as TableContextValue;
  return mount(CatalogueForm, {
    global: {
      provide: { [tableContextKey as symbol]: context },
      stubs: {
        DialogPortal: { template: "<div><slot /></div>" },
        ComboboxContent: OpenContent,
        ComboboxPortal: { template: '<Teleport to="body"><slot /></Teleport>' },
      },
    },
    attachTo: document.body,
  });
}

const press = async (target: HTMLElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  await flushPromises();
  return event;
};
const searchOf = () =>
  document.body.querySelector<HTMLInputElement>(".yayaw-field-combobox-search");
const shownOptions = () =>
  [...document.body.querySelectorAll('[role="option"]')].map((option) =>
    option.textContent?.trim()
  );

function mountField(multiple: boolean) {
  Element.prototype.scrollIntoView = vi.fn();
  return mount(FieldCombobox, {
    props: {
      id: "owner",
      modelValue: multiple ? [] : null,
      options,
      multiple,
      label: "Owner",
      placeholder: "Choose",
      locale: "en",
    },
    global: {
      stubs: {
        ComboboxContent: OpenContent,
        ComboboxPortal: { template: '<Teleport to="body"><slot /></Teleport>' },
      },
    },
    attachTo: document.body,
  });
}

it.each([
  false,
  true,
])("a letter typed on the closed button opens the list and starts the search with it (multiple: %s)", async (multiple) => {
  const wrapper = mountField(multiple);
  const trigger = wrapper.get<HTMLElement>("[data-searchable-field]").element;
  trigger.focus();
  const event = await press(trigger, { key: "g" });
  expect(event.defaultPrevented).toBe(true);
  const search = searchOf();
  expect(search?.value).toBe("g");
  // The search has the focus, the caret after the letter: typing goes on there.
  expect(document.activeElement).toBe(search);
  expect(search?.selectionStart).toBe(1);
  expect(search?.selectionEnd).toBe(1);
  expect(shownOptions()).toEqual(["Grace"]);
  if (!search) {
    throw new Error("Missing the search");
  }
  search.value = "gr";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
  expect(searchOf()?.value).toBe("gr");
  expect(shownOptions()).toEqual(["Grace"]);
  wrapper.unmount();
});

it("in a form, Tab reaches the select's button and a letter typed there starts the search", async () => {
  const wrapper = mountForm(
    [
      {
        name: "owner",
        label: "Owner",
        type: "select",
        searchable: true,
        options,
      },
      { name: "name", label: "Name", type: "text" },
    ],
    { owner: null, name: "Ada" }
  );
  await flushPromises();
  const trigger = wrapper.get<HTMLElement>("[data-searchable-field]").element;
  // Reka draws the button with tabindex="-1"; the field's button stays in the Tab order.
  expect(trigger.tabIndex).toBe(0);
  trigger.focus();
  expect((await press(trigger, { key: "L" })).defaultPrevented).toBe(true);
  expect(searchOf()?.value).toBe("L");
  expect(shownOptions()).toEqual(["Linus"]);
  wrapper.unmount();
});

it("leaves Space, Enter, arrows, shortcuts, IME composition and a disabled field alone", async () => {
  const wrapper = mountForm(
    [
      {
        name: "owner",
        label: "Owner",
        type: "select",
        searchable: true,
        options,
      },
      {
        name: "locked",
        label: "Locked",
        type: "select",
        searchable: true,
        options,
        disabled: true,
      },
    ],
    { owner: null, locked: null }
  );
  await flushPromises();
  const [trigger, locked] = wrapper
    .findAll<HTMLElement>("[data-searchable-field]")
    .map((item) => item.element);
  if (!(trigger && locked)) {
    throw new Error("Missing the selects");
  }
  for (const init of [
    { key: " " },
    { key: "Enter" },
    { key: "ArrowDown" },
    { key: "Tab" },
    { key: "a", ctrlKey: true },
    { key: "a", metaKey: true },
    { key: "a", altKey: true },
    { key: "a", isComposing: true },
  ]) {
    const event = await press(trigger, init);
    expect(event.defaultPrevented).toBe(false);
    expect(searchOf()).toBeNull();
  }
  expect((await press(locked, { key: "a" })).defaultPrevented).toBe(false);
  expect(searchOf()).toBeNull();
  // Opened, the button types nothing more into the search.
  await wrapper.get("[data-searchable-field]").trigger("click");
  await flushPromises();
  expect(searchOf()?.value).toBe("");
  expect((await press(trigger, { key: "x" })).defaultPrevented).toBe(false);
  expect(searchOf()?.value).toBe("");
  wrapper.unmount();
});
