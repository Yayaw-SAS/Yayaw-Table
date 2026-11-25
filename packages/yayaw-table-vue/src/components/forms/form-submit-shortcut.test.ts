import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import type { FormConfig, TableRecord } from "../../types";
import CatalogueForm from "./CatalogueForm.vue";

afterEach(() => {
  document.body.replaceChildren();
});

it("saves with Cmd+Enter or Ctrl+Enter from a field, not with Enter or other modifiers", async () => {
  const update = vi.fn(async (_id: string, _values: TableRecord) => ({
    success: true,
  }));
  const config: FormConfig = {
    id: "item-form",
    fields: [{ name: "name", label: "Name", type: "text" }],
  };
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
      row: { name: "Ada" },
      formType: "item-form",
    }),
    getFormConfig: vi.fn(() => config),
    actions: computed(() => ({ update })),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
    translations: computed(() => ({ create: "Create", edit: "Edit" })),
    locale: "fr",
    status: ref(),
  } as unknown as TableContextValue;
  const wrapper = mount(CatalogueForm, {
    global: {
      provide: { [tableContextKey as symbol]: context },
      stubs: { DialogPortal: { template: "<div><slot /></div>" } },
    },
    attachTo: document.body,
  });
  await flushPromises();
  const input = wrapper.get<HTMLInputElement>("input");
  await input.setValue("Grace");
  await input.trigger("keydown", { key: "Enter" });
  await input.trigger("keydown", {
    key: "Enter",
    metaKey: true,
    shiftKey: true,
  });
  await flushPromises();
  expect(update).not.toHaveBeenCalled();
  await input.trigger("keydown", { key: "Enter", metaKey: true });
  await flushPromises();
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(
    "1",
    { name: "Grace" },
    expect.anything()
  );
  await input.setValue("Linus");
  await input.trigger("keydown", { key: "Enter", ctrlKey: true });
  await flushPromises();
  expect(update).toHaveBeenCalledTimes(2);
  wrapper.unmount();
});

it("leaves a select's search for the next field with Tab, and saves from it with Cmd+Enter or Ctrl+Enter", async () => {
  Element.prototype.scrollIntoView = vi.fn();
  const update = vi.fn(async (_id: string, _values: TableRecord) => ({
    success: true,
  }));
  const config: FormConfig = {
    id: "item-form",
    fields: [
      {
        name: "owner",
        label: "Owner",
        type: "select",
        options: [{ value: "ada", label: "Ada" }],
        searchOptions: async () => [{ value: "grace", label: "Grace" }],
      },
      { name: "name", label: "Name", type: "text" },
    ],
  };
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
      row: { owner: "ada", name: "Ada" },
      formType: "item-form",
    }),
    getFormConfig: vi.fn(() => config),
    actions: computed(() => ({ update })),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
    translations: computed(() => ({ create: "Create", edit: "Edit" })),
    locale: "fr",
    status: ref(),
  } as unknown as TableContextValue;
  const wrapper = mount(CatalogueForm, {
    global: {
      provide: { [tableContextKey as symbol]: context },
      stubs: {
        DialogPortal: { template: "<div><slot /></div>" },
        // The list is still drawn outside the form, at the end of the page, as Reka's portal does.
        ComboboxContent: { template: '<div role="listbox"><slot /></div>' },
        ComboboxPortal: { template: '<Teleport to="body"><slot /></Teleport>' },
      },
    },
    attachTo: document.body,
  });
  await flushPromises();
  const open = async () => {
    const trigger = wrapper.get<HTMLElement>("[data-searchable-field]");
    await trigger.trigger("click");
    await flushPromises();
    const search = document.body.querySelector<HTMLInputElement>(
      ".yayaw-field-combobox-search"
    );
    if (!search) {
      throw new Error("Missing the select's search");
    }
    expect(wrapper.element.contains(search)).toBe(false);
    return search;
  };
  let search = await open();
  search.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    })
  );
  await flushPromises();
  expect(document.activeElement).toBe(
    wrapper.get<HTMLInputElement>("input[type='text'], input:not([type])")
      .element
  );
  expect(update).not.toHaveBeenCalled();
  search = await open();
  search.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  await flushPromises();
  expect(update).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});
