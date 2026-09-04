import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, reactive, ref } from "vue";
import { z } from "zod";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import { createTranslations } from "../../translations";
import type {
  FormConfig,
  FormFieldContext,
  FormFieldDefinition,
  SelectOption,
  TableRecord,
} from "../../types";
import CatalogueForm from "./CatalogueForm.vue";
import CollectionField from "./CollectionField.vue";
import DynamicField from "./DynamicField.vue";

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
  document.body.replaceChildren();
  vi.useRealTimers();
});
const track = <T extends VueWrapper>(wrapper: T): T => {
  mounted.push(wrapper);
  return wrapper;
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const fieldContext = (values: TableRecord = {}): FormFieldContext => ({
  mode: "edit",
  tableType: "items",
  tableId: "instance",
  values,
});

const mountForm = (
  config: FormConfig,
  row: TableRecord = {},
  update = vi.fn(async (_id: string, _values: TableRecord) => ({
    success: true,
  }))
) => {
  const form = ref({
    open: true,
    mode: "edit" as const,
    row,
    formType: "item-form",
  });
  const context = {
    config: defineTableConfig({
      id: "instance",
      columns: { definitions: [], mandatory: [], order: [], visible: [] },
      translations: { keys: {}, namespace: "table" },
    }),
    tableType: "items",
    form,
    getFormConfig: vi.fn(() => config),
    actions: computed(() => ({ update })),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
    translations: computed(() => ({ create: "Create", edit: "Edit" })),
    status: ref(),
  } as unknown as TableContextValue;
  const wrapper = track(
    mount(CatalogueForm, {
      global: {
        provide: { [tableContextKey as symbol]: context },
        stubs: { DialogPortal: { template: "<div><slot /></div>" } },
      },
      attachTo: document.body,
    })
  );
  return { wrapper, form, update, context };
};

describe("catalogue form", () => {
  it("uses transformed values and blocks duplicate submissions during async validation", async () => {
    const gate = deferred<string>();
    const config: FormConfig = {
      id: "item-form",
      fields: [
        {
          name: "name",
          label: "Name",
          type: "text",
          schema: z.string().transform(() => gate.promise),
        },
      ],
    };
    const { wrapper, update } = mountForm(config, { name: "draft" });
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(update).not.toHaveBeenCalled();
    gate.resolve("normalized");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("1", { name: "normalized" });
  });

  it("preserves failed drafts and exposes server field errors", async () => {
    const config: FormConfig = {
      id: "item-form",
      fields: [{ name: "name", label: "Name", type: "text" }],
    };
    const update = vi.fn(async () => ({
      success: false,
      error: "Not saved",
      fieldErrors: { name: "Already exists" },
    }));
    const { wrapper, form } = mountForm(config, { name: "Alpha" }, update);
    await flushPromises();
    await wrapper.get('[data-field-name="name"] input').setValue("Beta");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Already exists");
    expect(wrapper.get("input").element.value).toBe("Beta");
    expect(form.value.open).toBe(true);
  });

  it("loads complete edit values and does not allow saving after load failure", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce({ name: "Loaded", relations: [1] });
    const { wrapper, update } = mountForm({
      id: "item-form",
      fields: [{ name: "name", label: "Name", type: "text" }],
      loadInitialValues: loader,
    });
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    expect(update).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Unavailable");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Retry")
      ?.trigger("click");
    await flushPromises();
    expect(wrapper.get("input").element.value).toBe("Loaded");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(update).toHaveBeenCalledWith("1", {
      name: "Loaded",
      relations: [1],
    });
  });

  it("resets drafts when switching rows and ignores stale initial data", async () => {
    const first = deferred<TableRecord>();
    const { wrapper, form } = mountForm(
      {
        id: "item-form",
        fields: [{ name: "name", label: "Name", type: "text" }],
        loadInitialValues: (row) =>
          row?.id === "1" ? first.promise : { name: "Second" },
      },
      { id: "1" }
    );
    form.value = { ...form.value, row: { id: "2" } };
    await flushPromises();
    first.resolve({ name: "Stale" });
    await flushPromises();
    expect(wrapper.get("input").element.value).toBe("Second");
  });

  it("keeps instance identity separate from the form and resource types", async () => {
    const { context } = mountForm({ id: "item-form", fields: [] });
    await flushPromises();
    expect(context.getFormConfig).toHaveBeenCalledWith(
      "item-form",
      expect.objectContaining({ tableId: "instance", tableType: "items" })
    );
  });
});

describe("field controls", () => {
  it("has unique IDs and a real custom blur/sibling binding", async () => {
    const touchField = vi.fn();
    const setFieldValue = vi.fn();
    const context = {
      ...fieldContext({ other: "old" }),
      touchField,
      setFieldValue,
    };
    const field: FormFieldDefinition = {
      name: "name",
      label: "Name",
      type: "custom",
      renderField: ({ field, form }) =>
        h(
          "button",
          {
            onClick: () => {
              field.handleBlur();
              form.setFieldValue("other", "new");
            },
          },
          "Change"
        ),
    };
    const host = track(
      mount(
        defineComponent({
          setup: () => () =>
            h("div", [
              h(DynamicField, { field, context, modelValue: "" }),
              h(DynamicField, {
                field: { ...field, type: "text" },
                context,
                modelValue: "",
              }),
            ]),
        })
      )
    );
    const [first, second] = host.findAllComponents(DynamicField);
    if (!(first && second)) {
      throw new Error("Missing field instances");
    }
    expect(first.get("label").attributes("for")).not.toBe(
      second.get("label").attributes("for")
    );
    await first.get("button").trigger("click");
    expect(touchField).toHaveBeenCalledWith("name");
    expect(setFieldValue).toHaveBeenCalledWith("other", "new");
    expect(context.values.other).toBe("old");
  });

  it("reloads options only for declared dependencies and preserves numeric IDs", async () => {
    const loader = vi.fn(async () => [
      { label: "One", value: 1 },
      { label: "Two", value: 2 },
    ]);
    const field: FormFieldDefinition = {
      name: "relation",
      label: "Relation",
      type: "select",
      options: loader,
      optionDependencies: ["parent"],
    };
    const wrapper = track(
      mount(DynamicField, {
        props: {
          field,
          context: fieldContext({ parent: 1, name: "before" }),
          modelValue: 1,
        },
      })
    );
    await flushPromises();
    await wrapper.setProps({
      context: fieldContext({ parent: 1, name: "after" }),
    });
    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(1);
    await wrapper.get("select").setValue("2");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([2]);
    await wrapper.setProps({ context: fieldContext({ parent: 2 }) });
    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("debounces searched options, preserves selected labels and ignores stale results", async () => {
    vi.useFakeTimers();
    const first = deferred<SelectOption[]>();
    const searchOptions = vi.fn((query: string) =>
      query === "first"
        ? first.promise
        : Promise.resolve([{ value: 2, label: "Second" }])
    );
    const wrapper = track(
      mount(DynamicField, {
        props: {
          field: {
            name: "relation",
            label: "Relation",
            type: "select",
            searchOptions,
            resolveOptions: async () => [{ value: 42, label: "Selected" }],
            searchDebounceMs: 10,
          },
          context: fieldContext(),
          modelValue: 42,
        },
      })
    );
    await flushPromises();
    expect(searchOptions).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Selected");
    await wrapper.get('input[type="search"]').setValue("first");
    await vi.advanceTimersByTimeAsync(10);
    await wrapper.get('input[type="search"]').setValue("second");
    await vi.advanceTimersByTimeAsync(10);
    first.resolve([{ value: 1, label: "Stale" }]);
    await flushPromises();
    expect(wrapper.text()).toContain("Second");
    expect(wrapper.text()).not.toContain("Stale");
    expect(wrapper.text()).toContain("Selected");
  });

  it("retains a selected search result after clearing the query", async () => {
    vi.useFakeTimers();
    const wrapper = track(
      mount(DynamicField, {
        props: {
          field: {
            name: "relation",
            label: "Relation",
            type: "select",
            searchDebounceMs: 10,
            searchOptions: async () => [{ value: 7, label: "Selected result" }],
          },
          context: fieldContext(),
          modelValue: "",
        },
      })
    );
    await flushPromises();
    await wrapper.get('input[type="search"]').setValue("selected");
    await vi.advanceTimersByTimeAsync(10);
    await wrapper.setProps({ modelValue: 7 });
    await wrapper.get('input[type="search"]').setValue("");
    expect(wrapper.get("select").element.value).toBe("7");
    expect(wrapper.text()).toContain("Selected result");
  });

  it("does not fetch hidden options and reports loader errors", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("Options unavailable"));
    const field: FormFieldDefinition = {
      name: "relation",
      label: "Relation",
      type: "select",
      hidden: true,
      options: loader,
    };
    const wrapper = track(
      mount(DynamicField, {
        props: { field, context: fieldContext(), modelValue: "" },
      })
    );
    await flushPromises();
    expect(loader).not.toHaveBeenCalled();
    await wrapper.setProps({ field: { ...field, hidden: false } });
    await flushPromises();
    expect(wrapper.text()).toContain("Options unavailable");
  });

  it("does not create a fake relation ID when persistence fails", async () => {
    const createOption = vi
      .fn()
      .mockRejectedValueOnce(new Error("Create failed"))
      .mockResolvedValueOnce({ value: 7, label: "New" });
    const wrapper = track(
      mount(DynamicField, {
        props: {
          field: {
            name: "relation",
            label: "Relation",
            type: "select-with-add-new",
            createOption,
          },
          context: fieldContext(),
          modelValue: "",
        },
      })
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Add"))
      ?.trigger("click");
    await wrapper.get("input").setValue("New");
    await wrapper.get('[aria-label="Create option"]').trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    expect(wrapper.text()).toContain("Create failed");
    await wrapper.get('[aria-label="Create option"]').trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([7]);
  });

  it("renders a declarative table picker and preserves typed selections", async () => {
    const pickerConfig = defineTableConfig({
      id: "media-picker",
      columns: {
        definitions: [{ id: "name", header: "Name", type: "text" }],
        mandatory: ["name"],
        order: ["select", "name"],
        visible: ["name"],
      },
      table: {
        enableViews: false,
        showToolbarHeader: false,
      },
      translations: { keys: { title: "Media" }, namespace: "media" },
    });
    const wrapper = track(
      mount(DynamicField, {
        props: {
          field: {
            name: "mediaIds",
            label: "Media",
            type: "tablePicker",
            tablePicker: {
              tableType: "media-picker",
              config: pickerConfig,
              data: [
                { id: 1, name: "Alpha" },
                { id: 2, name: "Beta" },
              ],
              parseValue: Number,
            },
          },
          context: fieldContext(),
          modelValue: [1],
        },
      })
    );
    await vi.dynamicImportSettled();
    await flushPromises();

    expect(wrapper.find(".yayaw-table-picker").exists()).toBe(true);
    expect(wrapper.find('input[type="search"]').exists()).toBe(true);
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    expect(
      (checkboxes[0]?.element as HTMLInputElement | undefined)?.checked
    ).toBe(true);
    await checkboxes[1]?.setValue(true);
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([[1, 2]]);

    await wrapper.setProps({ modelValue: [1, 2] });
    await wrapper.get('input[type="search"]').setValue("Beta");
    await wrapper.get('input[type="search"]').setValue("");
    expect(
      (
        wrapper.findAll('tbody input[type="checkbox"]')[0]?.element as
          | HTMLInputElement
          | undefined
      )?.checked
    ).toBe(true);
  });

  it("disables selection in a disabled table picker", async () => {
    const wrapper = track(
      mount(DynamicField, {
        props: {
          field: {
            name: "itemIds",
            label: "Items",
            type: "tablePicker",
            disabled: true,
            tablePicker: {
              tableType: "item-picker",
              config: defineTableConfig({
                id: "item-picker",
                columns: {
                  definitions: [{ id: "name", header: "Name" }],
                  mandatory: ["name"],
                  order: ["select", "name"],
                  visible: ["name"],
                },
                translations: { keys: {}, namespace: "items" },
              }),
              data: [{ id: "1", name: "Alpha" }],
            },
          },
          context: fieldContext(),
          modelValue: [],
        },
      })
    );
    await vi.dynamicImportSettled();
    await flushPromises();
    expect(
      wrapper.get('tbody input[type="checkbox"]').attributes("disabled")
    ).toBeDefined();
  });
});

describe("collection editor", () => {
  const field: FormFieldDefinition = {
    name: "entries",
    label: "Entries",
    type: "collection",
    columns: [{ id: "name", header: "Name" }],
    itemFields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        schema: z.string().trim().min(1),
      },
    ],
  };
  it("renders summary columns and isolates a cancelable item draft", async () => {
    const items = reactive([{ name: "Alpha" }]);
    const wrapper = track(
      mount(CollectionField, {
        props: {
          field,
          modelValue: items,
          context: fieldContext(),
          path: "entries",
        },
        global: {
          stubs: { DialogPortal: { template: "<div><slot /></div>" } },
        },
        attachTo: document.body,
      })
    );
    expect(wrapper.get("th").text()).toBe("Name");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Edit")
      ?.trigger("click");
    await flushPromises();
    await wrapper.get("input").setValue("Changed");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Cancel")
      ?.trigger("click");
    expect(items[0]?.name).toBe("Alpha");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("validates and normalizes the item before replacing it", async () => {
    const wrapper = track(
      mount(CollectionField, {
        props: {
          field,
          modelValue: [{ name: "Alpha" }],
          context: fieldContext(),
          path: "entries",
        },
        global: {
          stubs: { DialogPortal: { template: "<div><slot /></div>" } },
        },
        attachTo: document.body,
      })
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Edit")
      ?.trigger("click");
    await flushPromises();
    await wrapper.get("input").setValue("");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save item")
      ?.trigger("click");
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    await wrapper.get("input").setValue(" Beta ");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save item")
      ?.trigger("click");
    await flushPromises();
    expect(
      wrapper.emitted("update:modelValue")?.at(-1),
      wrapper.html()
    ).toEqual([[{ name: "Beta" }]]);
  });

  it("disables every structural action in a disabled collection", () => {
    const wrapper = track(
      mount(CollectionField, {
        props: {
          field,
          modelValue: [{ name: "Alpha" }],
          context: fieldContext(),
          path: "entries",
          disabled: true,
        },
      })
    );
    expect(
      wrapper
        .findAll("button")
        .every((button) => button.attributes("disabled") !== undefined)
    ).toBe(true);
  });
});

it("inherits translated collection controls from the enclosing table", async () => {
  const wrapper = track(
    mount(CollectionField, {
      props: {
        field: {
          name: "items",
          label: "Éléments",
          type: "collection",
          collectionMode: "dialog",
          itemFields: [{ name: "name", label: "Nom", type: "text" }],
        },
        modelValue: [{ name: "Alpha" }],
        context: fieldContext(),
        path: "items",
      },
      global: {
        provide: {
          [tableContextKey as symbol]: {
            translations: computed(() => createTranslations("fr")),
          },
        },
        stubs: { DialogPortal: { template: "<div><slot /></div>" } },
      },
      attachTo: document.body,
    })
  );
  expect(wrapper.find('[aria-label="Supprimer l’élément"]').exists()).toBe(
    true
  );
  const addButton = wrapper
    .findAll("button")
    .find((button) => button.text().includes("Ajouter un élément"));
  expect(addButton).toBeDefined();
  await addButton?.trigger("click");
  await flushPromises();
  expect(wrapper.get('[role="dialog"]').text()).toContain("Ajouter Éléments");
  expect(wrapper.find('[aria-label="Fermer"]').exists()).toBe(true);
  expect(wrapper.text()).toContain("Enregistrer l’élément");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "Annuler")
    ?.trigger("click");
  await flushPromises();
  expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  expect(wrapper.emitted("update:modelValue")).toBeUndefined();
});
