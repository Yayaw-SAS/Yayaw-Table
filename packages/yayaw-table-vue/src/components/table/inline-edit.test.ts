import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, reactive } from "vue";
import { z } from "zod";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
import { createTranslations } from "../../translations";
import type {
  ColumnDefinition,
  FormConfig,
  TableActionResult,
  TableRecord,
} from "../../types";
import CellRenderer from "./CellRenderer.vue";

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
  document.body.replaceChildren();
});

const createCell = (
  input: {
    row?: TableRecord;
    column?: ColumnDefinition;
    form?: FormConfig;
    debounceMs?: number;
    update?: (id: string, values: TableRecord) => Promise<TableActionResult>;
  } = {}
) => {
  const row = reactive(input.row ?? { id: "1", amount: 10 });
  const column = input.column ?? {
    id: "amount",
    header: "Amount",
    type: "number",
  };
  const update = vi.fn(input.update ?? (async () => ({ success: true })));
  const context = {
    config: defineTableConfig({
      id: "instance",
      columns: { definitions: [column], mandatory: [], visible: [], order: [] },
      translations: { namespace: "items", keys: {} },
      table: {
        allowInlineEdit: true,
        inlineEdit: { enabled: true, debounceMs: input.debounceMs ?? 700 },
      },
      form: { resolveEditFormType: (record) => String(record.kind ?? "item") },
    }),
    tableType: "items",
    actions: computed(() => ({ update })),
    translations: computed(() => createTranslations("en")),
    getFormConfig: vi.fn(() => input.form),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
  } as unknown as TableContextValue;
  const wrapper = mount(CellRenderer, {
    props: { row, column, value: row[column.accessorKey ?? column.id] },
    attachTo: document.body,
    global: {
      provide: { [tableContextKey as symbol]: context },
      stubs: {
        PopperArrow: true,
        PopperContent: { template: "<div><slot /></div>" },
      },
    },
  });
  mounted.push(wrapper);
  return { wrapper, context, row, update };
};

describe("catalogue-backed inline editing", () => {
  it.each([
    "click",
    "Enter",
  ])("keeps an image's URL editable by %s without a nested preview control", async (action) => {
    const source = "https://example.com/image.png";
    const { wrapper } = createCell({
      row: { id: "1", image: source },
      column: { id: "image", header: "Product", type: "image" },
    });
    const trigger = wrapper.get("[data-image-preview-trigger]");
    expect(trigger.element.tagName).toBe("SPAN");
    expect(trigger.attributes("tabindex")).toBeUndefined();
    expect(trigger.find("button").exists()).toBe(false);
    if (action === "click") {
      await trigger.trigger("click");
    } else {
      await wrapper.trigger("keydown", { key: "Enter" });
    }
    await flushPromises();
    expect(
      wrapper.get<HTMLInputElement>('input[type="url"]').element.value
    ).toBe(source);
  });

  it("keeps an invalid location open through blur and Done, then saves the corrected draft", async () => {
    const { wrapper, row, update } = createCell({
      row: { id: "1", site: { lat: 48.8566, lng: 2.3522 } },
      column: { id: "site", header: "Site", type: "location" },
    });
    await wrapper.trigger("click");
    await flushPromises();
    const element = document.querySelector<HTMLElement>(
      "[data-location-editor]"
    );
    expect(element).not.toBeNull();
    if (!element) {
      throw new Error("The location editor did not open");
    }
    const editor = new DOMWrapper(element);
    const latitude = editor.get<HTMLInputElement>('input[id$="-lat"]');
    await latitude.setValue("91");
    await latitude.trigger("focusout", { relatedTarget: document.body });
    await latitude.trigger("keydown", { key: "Enter" });
    await editor
      .findAll("button")
      .find((item) => item.text() === "Done")
      ?.trigger("click");
    await flushPromises();
    expect(update).not.toHaveBeenCalled();
    expect(row.site).toEqual({ lat: 48.8566, lng: 2.3522 });
    expect(document.querySelector("[data-location-editor]")).not.toBeNull();
    await latitude.setValue("49");
    await latitude.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(update).toHaveBeenCalledWith(
      "1",
      { site: { lat: 49, lng: 2.3522 } },
      expect.anything()
    );
  });

  it("uses the mapped field schema, form type and transformed value", async () => {
    const { wrapper, row, update, context } = createCell({
      row: { id: "1", amount: "10", kind: "invoice" },
      column: {
        id: "display",
        accessorKey: "amount",
        header: "Amount",
        type: "text",
        inlineEdit: { formField: "amount" },
      },
      form: {
        id: "invoice",
        fields: [
          {
            name: "amount",
            label: "Amount",
            type: "number",
            schema: z
              .number()
              .min(1)
              .transform((value) => value * 100),
          },
        ],
      },
    });
    await wrapper.trigger("click");
    expect(wrapper.get("input").attributes("type")).toBe("number");
    await wrapper.get("input").setValue("2");
    await wrapper.get("input").trigger("blur");
    await flushPromises();
    expect(update).toHaveBeenCalledWith(
      "1",
      { amount: 200 },
      { row: { id: "1", amount: "10", kind: "invoice" } }
    );
    expect(row.amount).toBe(200);
    expect(context.getFormConfig).toHaveBeenCalledWith(
      "invoice",
      expect.objectContaining({ tableType: "items", tableId: "instance" })
    );
  });

  it("rejects invalid fields without updating the row", async () => {
    const { wrapper, row, update } = createCell({
      form: {
        id: "item",
        fields: [
          {
            name: "amount",
            label: "Amount",
            type: "number",
            schema: z.number().min(1, "Must be positive"),
          },
        ],
      },
    });
    await wrapper.trigger("click");
    await wrapper.get("input").setValue("0");
    await wrapper.get("input").trigger("blur");
    await flushPromises();
    expect(update).not.toHaveBeenCalled();
    expect(row.amount).toBe(10);
    expect(wrapper.text()).toContain("Must be positive");
  });

  it("loads catalogue options and preserves numeric IDs across change and blur", async () => {
    let finish = (_result: TableActionResult): void => undefined;
    const gate = new Promise<TableActionResult>((resolve) => {
      finish = resolve;
    });
    const { wrapper, update } = createCell({
      row: { id: "1", amount: 1 },
      update: () => gate,
      form: {
        id: "item",
        fields: [
          {
            name: "amount",
            label: "Amount",
            type: "select",
            options: async () => [
              { value: 1, label: "One" },
              { value: 2, label: "Two" },
            ],
          },
        ],
      },
    });
    await wrapper.trigger("click");
    await flushPromises();
    const select = new DOMWrapper(document.body);
    const two = select.get('[role="option"]:nth-child(2)');
    await two.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      "1",
      { amount: 2 },
      { row: { id: "1", amount: 1 } }
    );
    finish({ success: true });
    await flushPromises();
  });

  it("rolls back an optimistic value when the action throws and retains the draft", async () => {
    const { wrapper, row } = createCell({
      update: () => Promise.reject(new Error("Offline")),
    });
    await wrapper.trigger("click");
    await wrapper.get("input").setValue("25");
    await wrapper.get("input").trigger("blur");
    await flushPromises();
    expect(row.amount).toBe(10);
    expect(wrapper.get("input").element.value).toBe("25");
    expect(wrapper.text()).toContain("Offline");
  });

  it("does not roll back a persisted value when refreshing fails", async () => {
    const { wrapper, row, context } = createCell();
    context.refresh = vi.fn(() => Promise.reject(new Error("Refresh failed")));
    await wrapper.trigger("click");
    await wrapper.get("input").setValue("25");
    await wrapper.get("input").trigger("blur");
    await flushPromises();
    expect(row.amount).toBe(25);
  });

  it.each([
    "hidden",
    "disabled",
    "missing",
  ])("does not edit a %s catalogue field", async (state) => {
    const { wrapper, update } = createCell({
      form: {
        id: "item",
        fields:
          state === "missing"
            ? []
            : [
                {
                  name: "amount",
                  label: "Amount",
                  type: "number",
                  hidden: state === "hidden",
                  disabled: state === "disabled",
                },
              ],
      },
    });
    await wrapper.trigger("click");
    expect(wrapper.find("input").exists()).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

const themes = [
  { value: 1, label: "Culture" },
  { value: 2, label: "Tech" },
  { value: false, label: "General" },
  { value: 3, label: "Disabled", disabled: true },
];
const themeColumn: ColumnDefinition = {
  id: "tags",
  header: "Theme",
  type: "multiSelect",
  inlineEdit: true,
  options: themes,
};
const popup = () => new DOMWrapper(document.body).get(".yayaw-inline-options");
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 10));
};

it.each([
  "click",
  "Enter",
])("opens a themed single select with %s and commits typed values once", async (action) => {
  const { wrapper, update } = createCell({
    row: { id: "1", amount: 1 },
    column: {
      id: "amount",
      header: "Amount",
      type: "select",
      options: [
        { value: 1, label: "One" },
        { value: 2, label: "Two" },
        { value: false, label: "Disabled", disabled: true },
      ],
    },
  });
  await wrapper.trigger(action === "click" ? "click" : "keydown", {
    key: action,
  });
  await settle();
  const body = new DOMWrapper(document.body);
  const popup = body.get('[data-slot="select-content"]');
  expect(popup.attributes("data-state")).toBe("open");
  expect(wrapper.find('select:not([aria-hidden="true"])').exists()).toBe(false);
  expect(popup.get("[data-disabled]").text()).toBe("Disabled");
  await popup
    .get('[role="option"]:nth-child(2)')
    .trigger("keydown", { key: "Enter" });
  await settle();
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(
    "1",
    { amount: 2 },
    { row: { id: "1", amount: 1 } }
  );
});

it.each([
  false,
  0,
  "0",
  "",
])("preserves the local single select value %j", async (value) => {
  const { wrapper, update } = createCell({
    row: { id: "1", amount: 1 },
    column: {
      id: "amount",
      header: "Amount",
      type: "select",
      options: [
        { value: 1, label: "One" },
        { value, label: "Chosen" },
      ],
    },
  });
  await wrapper.trigger("click");
  await settle();
  await new DOMWrapper(document.body)
    .get('[role="option"]:nth-child(2)')
    .trigger("keydown", { key: "Enter" });
  await settle();
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith(
    "1",
    { amount: value },
    { row: { id: "1", amount: 1 } }
  );
});

it("cancels a single select with Escape without persisting a change", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", amount: 1 },
    column: {
      id: "amount",
      header: "Amount",
      type: "select",
      options: [
        { value: 1, label: "One" },
        { value: 2, label: "Two" },
      ],
    },
  });
  await wrapper.trigger("click");
  await settle();
  await new DOMWrapper(document.body)
    .get('[data-slot="select-content"]')
    .trigger("keydown", { key: "Escape" });
  await settle();
  expect(update).not.toHaveBeenCalled();
  expect(wrapper.find('[role="combobox"]').exists()).toBe(false);
});

it("starts editing where the DOM has no HTMLSelectElement global", async () => {
  vi.stubGlobal("HTMLSelectElement", undefined);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  try {
    const { wrapper } = createCell();
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find("input").exists()).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
    vi.unstubAllGlobals();
  }
});

it("renders searchable choices outside the cell and preserves primitive selections", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", tags: [1] },
    column: themeColumn,
  });
  await wrapper.trigger("click");
  await settle();
  expect(document.activeElement).toBe(
    wrapper.get('input[role="combobox"]').element
  );
  expect(
    wrapper.get('input[role="combobox"]').attributes("aria-controls")
  ).toBe(popup().attributes("id"));
  expect(wrapper.find("select[multiple]").exists()).toBe(false);
  expect(wrapper.find(".yayaw-inline-options").exists()).toBe(false);
  expect(
    popup().findAll('[role="option"]')[3]?.attributes("data-disabled")
  ).toBeDefined();
  await wrapper.get('button[aria-label="Remove Culture"]').trigger("click");
  await popup().findAll('[role="option"]')[2]?.trigger("click");
  await wrapper.get('input[role="combobox"]').setValue("tech");
  await settle();
  expect(popup().findAll('[role="option"]')).toHaveLength(1);
  await popup().get('[role="option"]').trigger("click");
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { tags: [false, 2] },
    { row: { id: "1", tags: [1] } }
  );
  expect(wrapper.find(".yayaw-inline-selection").exists()).toBe(false);
});

it("spans the cell with the multi-select field and its list", async () => {
  const { wrapper } = createCell({
    row: { id: "1", tags: [1] },
    column: themeColumn,
  });
  await wrapper.trigger("click");
  await settle();
  // The editable cell is a flex row: the wrapper must grow, or the field and
  // the list sized to it shrink to their content.
  expect(
    wrapper
      .get(".yayaw-inline-selection")
      .element.closest(".yayaw-cell > .yayaw-inline-multiselect")
  ).not.toBeNull();
  expect(popup().classes()).toContain("yayaw-inline-options");
  await wrapper
    .get('input[role="combobox"]')
    .trigger("keydown", { key: "Escape" });
});

const mediaForm = (
  type: "select" | "multiSelect",
  searchOptions: (query: string) => Promise<{ value: number; label: string }[]>,
  createOption?: (label: string) => Promise<{ value: number; label: string }>
): FormConfig => ({
  id: "media",
  fields: [
    {
      name: "media",
      label: "Media",
      type,
      options: [{ value: 1, label: "Gaming Mag" }],
      searchOptions,
      ...(createOption && { createOption }),
      searchMinLength: 2,
      searchDebounceMs: 0,
    },
  ],
});
const mediaColumn = (type: "select" | "multiSelect"): ColumnDefinition => ({
  id: "media",
  header: "Media",
  type,
  inlineEdit: true,
});

it("searches the server from an inline select and saves the typed choice", async () => {
  const searchOptions = vi.fn(async (query: string) =>
    query === "news" ? [{ value: 42, label: "Strategies Newsletter" }] : []
  );
  const { wrapper, update } = createCell({
    row: { id: "1", media: 1 },
    column: mediaColumn("select"),
    form: mediaForm("select", searchOptions),
  });
  await wrapper.trigger("click");
  await settle();
  expect(wrapper.find("select").exists()).toBe(false);
  const input = wrapper.get('input[role="combobox"]');
  expect(document.activeElement).toBe(input.element);
  expect(wrapper.get(".yayaw-inline-chip").text()).toContain("Gaming Mag");
  await input.setValue("n");
  await settle();
  expect(searchOptions).not.toHaveBeenCalled();
  await input.setValue("news");
  await settle();
  expect(searchOptions).toHaveBeenCalledWith(
    "news",
    expect.objectContaining({ mode: "edit" }),
    expect.any(AbortSignal)
  );
  // The server's match shows even though its label lacks the typed text.
  await popup().get('[role="option"]').trigger("click");
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { media: 42 },
    { row: { id: "1", media: 1 } }
  );
});

it("adds server results to an inline multi-select and keeps their labels", async () => {
  const searchOptions = vi.fn(async () => [
    { value: 42, label: "Strategies Newsletter" },
  ]);
  const { wrapper, update } = createCell({
    row: { id: "1", media: [1] },
    column: mediaColumn("multiSelect"),
    form: mediaForm("multiSelect", searchOptions),
  });
  await wrapper.trigger("click");
  await settle();
  const input = wrapper.get('input[role="combobox"]');
  await input.setValue("strat");
  await settle();
  await popup().get('[role="option"]').trigger("click");
  await settle();
  expect(wrapper.text()).toContain("Strategies Newsletter");
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { media: [1, 42] },
    { row: { id: "1", media: [1] } }
  );
});

it("shows a failed server search in the list and keeps the editor open", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", media: 1 },
    column: mediaColumn("select"),
    form: mediaForm("select", () =>
      Promise.reject(new Error("Search unavailable"))
    ),
  });
  await wrapper.trigger("click");
  await settle();
  await wrapper.get('input[role="combobox"]').setValue("news");
  await settle();
  expect(popup().get('[role="alert"]').text()).toBe("Search unavailable");
  expect(wrapper.find('input[role="combobox"]').exists()).toBe(true);
  expect(update).not.toHaveBeenCalled();
});

it("creates an option from an inline multi-select search and adds it to the selection", async () => {
  const createOption = vi.fn(async (label: string) => ({
    value: 77,
    label: `${label} Weekly`,
  }));
  const { wrapper, update } = createCell({
    row: { id: "1", media: [1] },
    column: mediaColumn("multiSelect"),
    form: mediaForm("multiSelect", async () => [], createOption),
  });
  await wrapper.trigger("click");
  await settle();
  await wrapper.get('input[role="combobox"]').setValue("Rumble");
  await settle();
  const create = popup().get('[role="option"]');
  expect(create.text()).toBe('Create "Rumble"');
  expect(popup().text()).not.toContain("No results");
  await create.trigger("click");
  await settle();
  expect(createOption).toHaveBeenCalledWith(
    "Rumble",
    expect.objectContaining({ mode: "edit" }),
    expect.any(AbortSignal)
  );
  expect(wrapper.text()).toContain("Rumble Weekly");
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { media: [1, 77] },
    { row: { id: "1", media: [1] } }
  );
});

it("keeps the multi-select editor while an option is created outside it", async () => {
  let finish: (option: { value: number; label: string }) => void = () =>
    undefined;
  const createOption = vi.fn(
    () =>
      new Promise<{ value: number; label: string }>((resolve) => {
        finish = resolve;
      })
  );
  const { wrapper, update } = createCell({
    row: { id: "1", media: [1] },
    column: mediaColumn("multiSelect"),
    form: mediaForm("multiSelect", async () => [], createOption),
  });
  await wrapper.trigger("click");
  await settle();
  await wrapper.get('input[role="combobox"]').setValue("Rumble");
  await settle();
  await popup().get('[role="option"]').trigger("click");
  await settle();
  // The app's own form takes the focus while the option is created.
  const form = document.createElement("button");
  document.body.append(form);
  form.focus();
  await settle();
  expect(update).not.toHaveBeenCalled();
  expect(wrapper.find('input[role="combobox"]').exists()).toBe(true);
  finish({ value: 77, label: "Rumble Weekly" });
  await settle();
  expect(wrapper.text()).toContain("Rumble Weekly");
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { media: [1, 77] },
    { row: { id: "1", media: [1] } }
  );
});

it("saves an option created from an inline select as the whole edit", async () => {
  const createOption = vi.fn(async (label: string) => ({ value: 77, label }));
  const { wrapper, update } = createCell({
    row: { id: "1", media: 1 },
    column: mediaColumn("select"),
    form: mediaForm("select", async () => [], createOption),
  });
  await wrapper.trigger("click");
  await settle();
  await wrapper.get('input[role="combobox"]').setValue("Rumble");
  await settle();
  await popup().get('[role="option"]').trigger("click");
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { media: 77 },
    { row: { id: "1", media: 1 } }
  );
});

it("offers no creation for an existing label and shows a failed creation", async () => {
  const createOption = vi.fn(() =>
    Promise.reject(new Error("Creation refused"))
  );
  const { wrapper, update } = createCell({
    row: { id: "1", media: [] },
    column: mediaColumn("multiSelect"),
    form: mediaForm("multiSelect", async () => [], createOption),
  });
  await wrapper.trigger("click");
  await settle();
  const input = wrapper.get('input[role="combobox"]');
  await input.setValue("gaming mag");
  await settle();
  expect(popup().text()).not.toContain("Create");
  await input.setValue("Rumble");
  await settle();
  await popup().get('[role="option"]').trigger("click");
  await settle();
  expect(popup().get('[role="alert"]').text()).toBe("Creation refused");
  expect(wrapper.find('input[role="combobox"]').exists()).toBe(true);
  expect(update).not.toHaveBeenCalled();
});

it("flushes an empty multi-selection when focus leaves the popup", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", tags: [1] },
    column: themeColumn,
  });
  await wrapper.trigger("click");
  await settle();
  await wrapper.get('button[aria-label="Remove Culture"]').trigger("click");
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith(
    "1",
    { tags: [] },
    { row: { id: "1", tags: [1] } }
  );
  expect(wrapper.find(".yayaw-inline-selection").exists()).toBe(false);
});

it.each([
  true,
  false,
])("retains dismissal during autosave and handles success=%s", async (success) => {
  let finish!: (result: TableActionResult) => void;
  const gate = new Promise<TableActionResult>((resolve) => {
    finish = resolve;
  });
  const { wrapper, update } = createCell({ debounceMs: 1, update: () => gate });
  await wrapper.trigger("click");
  await wrapper.get("input").setValue("25");
  await settle();
  expect(update).toHaveBeenCalledTimes(1);
  wrapper.get("input").element.dispatchEvent(new FocusEvent("blur"));
  finish({ success, error: success ? undefined : "Offline" });
  await settle();
  expect(wrapper.find("input").exists()).toBe(!success);
  expect(update).toHaveBeenCalledTimes(1);
  if (!success) {
    expect(wrapper.get("input").element.value).toBe("25");
    expect(wrapper.text()).toContain("Offline");
    update.mockResolvedValue({ success: true });
    await wrapper.get("input").trigger("blur");
    await settle();
    expect(wrapper.find("input").exists()).toBe(false);
  }
});

it("cancels unsaved choices with Escape and focuses text editors on entry", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", tags: [1] },
    column: themeColumn,
  });
  await wrapper.trigger("click");
  await settle();
  await wrapper.get('button[aria-label="Remove Culture"]').trigger("click");
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  await settle();
  expect(wrapper.find(".yayaw-inline-selection").exists()).toBe(false);
  expect(update).not.toHaveBeenCalled();
  const text = createCell();
  await text.wrapper.trigger("click");
  expect(document.activeElement).toBe(text.wrapper.get("input").element);
  await text.wrapper.get("input").setValue("25");
  await text.wrapper.get("input").trigger("click");
  expect(text.wrapper.get("input").element.value).toBe("25");
});

it("shows the delay and pending save bar, then clears it after acknowledgement", async () => {
  let finish!: (result: TableActionResult) => void;
  const gate = new Promise<TableActionResult>((resolve) => {
    finish = resolve;
  });
  const { wrapper } = createCell({ debounceMs: 200, update: () => gate });
  await wrapper.trigger("click");
  await wrapper.get("input").setValue("25");
  await new Promise((resolve) => setTimeout(resolve, 110));
  expect(
    wrapper.get(".yayaw-inline-progress-bar").attributes("style")
  ).not.toContain("width: 0%");
  expect(wrapper.get(".yayaw-inline-progress").classes()).not.toContain(
    "is-saving"
  );
  await wrapper.get("input").trigger("blur");
  expect(wrapper.get(".yayaw-inline-progress").classes()).toContain(
    "is-saving"
  );
  expect(
    wrapper.get(".yayaw-inline-progress-bar").attributes("style")
  ).toContain("100%");
  finish({ success: true });
  await settle();
  expect(wrapper.find(".yayaw-inline-progress").exists()).toBe(false);
});

it("serializes newer selections behind a pending save without dropping the draft", async () => {
  let finish!: (result: TableActionResult) => void;
  const gate = new Promise<TableActionResult>((resolve) => {
    finish = resolve;
  });
  const { wrapper, update } = createCell({ debounceMs: 1, update: () => gate });
  await wrapper.trigger("click");
  await wrapper.get("input").setValue("25");
  await settle();
  await wrapper.get("input").setValue("30");
  await wrapper.get("input").trigger("blur");
  update.mockResolvedValue({ success: true });
  finish({ success: true });
  await settle();
  expect(update.mock.calls.map((call) => call[1])).toEqual([
    { amount: 25 },
    { amount: 30 },
  ]);
  expect(wrapper.find("input").exists()).toBe(false);
});

for (const [type, value, selector] of [
  ["string", "Alpha", 'input[type="text"]'],
  ["text", "Alpha", 'input[type="text"]'],
  ["code", "const a = 1;", "textarea"],
  ["number", -12.5, 'input[type="number"]'],
  ["date", new Date(2026, 8, 8), 'input[type="date"]'],
  ["url", "https://example.com", 'input[type="url"]'],
  ["image", "https://example.com/image.png", 'input[type="url"]'],
  ["json", { active: false }, "textarea"],
  ["select", 1, '[role="combobox"]'],
  ["tag", 1, '[role="combobox"]'],
] as const) {
  it(`derives the Vue ${type} inline control without a form catalogue`, async () => {
    const { wrapper } = createCell({
      row: { id: "1", value },
      column: {
        id: "value",
        header: "Value",
        type,
        options: [{ label: "One", value: 1 }],
      },
    });
    await wrapper.trigger("click");
    await flushPromises();
    expect(wrapper.find(selector).exists()).toBe(true);
    if (type === "date") {
      expect((wrapper.get(selector).element as HTMLInputElement).value).toBe(
        "2026-09-08"
      );
    }
  });
}
it("toggles and saves a boolean cell on its first click", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", active: false },
    column: { id: "active", header: "Active", type: "boolean" },
  });
  await wrapper.trigger("click");
  await flushPromises();
  expect(update).toHaveBeenCalledWith("1", { active: true }, expect.anything());
});
it("keeps an editing click from reaching the row", async () => {
  const { wrapper } = createCell({
    row: { id: "1", active: false },
    column: { id: "active", header: "Active", type: "boolean" },
  });
  const rowClick = vi.fn();
  document.body.addEventListener("click", rowClick);
  await wrapper.get(".yayaw-boolean").trigger("click");
  await flushPromises();
  document.body.removeEventListener("click", rowClick);
  expect(rowClick).not.toHaveBeenCalled();
});
it("draws a switch boolean column as a switch, toggled without a checkbox", async () => {
  let finish: (result: { success: boolean }) => void = () => undefined;
  const { wrapper, update } = createCell({
    row: { id: "1", active: false },
    column: {
      id: "active",
      header: "Active",
      type: "boolean",
      displayVariant: "switch",
    },
    update: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  expect(wrapper.get(".yayaw-cell-switch").attributes("data-state")).toBe(
    "unchecked"
  );
  expect(wrapper.find(".yayaw-boolean").exists()).toBe(false);
  await wrapper.get(".yayaw-cell-switch").trigger("click");
  await flushPromises();
  // While the value saves, the cell shows the switch already on, never a checkbox.
  expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
  expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
    "true"
  );
  expect(update).toHaveBeenCalledWith("1", { active: true }, expect.anything());
  finish({ success: true });
  await flushPromises();
});
it("resolves the dynamic row type for both display and editing", async () => {
  const { wrapper } = createCell({
    row: { id: "1", kind: "url", value: "https://example.com" },
    column: {
      id: "value",
      header: "Value",
      type: "dynamicType",
      typeKey: "kind",
    },
  });
  expect(wrapper.get("a").attributes("href")).toBe("https://example.com/");
  await wrapper.trigger("click");
  await flushPromises();
  expect(wrapper.find('input[type="url"]').exists()).toBe(true);
});

it("shows the image fallback after failure and recovers when the source changes", async () => {
  const { wrapper } = createCell({
    row: { id: "1", value: "https://example.com/missing.png" },
    column: { id: "value", header: "Image", type: "image" },
  });
  await wrapper.get("img").trigger("error");
  expect(wrapper.find('[role="img"][aria-label="Image"]').exists()).toBe(true);
  await wrapper.setProps({ value: "https://example.com/new.png" });
  expect(wrapper.get("img").attributes("src")).toBe(
    "https://example.com/new.png"
  );
});

it("supplies the original row version for an inline conflict without adding it to the patch", async () => {
  const { wrapper, row, update } = createCell({
    row: { id: "1", amount: 10, dataVersion: 7 },
    update: async () => ({ success: false, error: "Version conflict" }),
  });
  await wrapper.trigger("click");
  await wrapper.get("input").setValue("20");
  await wrapper.get("input").trigger("blur");
  await flushPromises();
  expect(update).toHaveBeenCalledWith(
    "1",
    { amount: 20 },
    { row: { id: "1", amount: 10, dataVersion: 7 } }
  );
  expect(row.amount).toBe(10);
  expect(wrapper.text()).toContain("Version conflict");
});

describe("editable cell affordance", () => {
  it("marks editable cells with their editor and the edit hint, as in React", () => {
    const { wrapper } = createCell({
      row: { id: "1", name: "Ada" },
      column: { id: "name", header: "Name", type: "text", inlineEdit: true },
    });
    const cell = wrapper.get(".yayaw-cell");
    expect(cell.attributes("data-inline-editor")).toBe("text");
    expect(cell.attributes("title")).toBe("Click or press Enter to edit");
    // Typed text shows a pencil, floating over the cell's end.
    expect(cell.get("[data-inline-icon]").attributes("data-inline-icon")).toBe(
      "pencil"
    );
  });

  it("picks the hover icon from the cell's editor, as in React", () => {
    const iconFor = (
      type: ColumnDefinition["type"],
      value: unknown,
      extra: Record<string, unknown> = {}
    ) => {
      const icon = createCell({
        row: { id: "1", field: value },
        column: {
          id: "field",
          header: "Field",
          type,
          inlineEdit: true,
          ...extra,
        },
      }).wrapper.find("[data-inline-icon]");
      return icon.exists() ? icon.attributes("data-inline-icon") : undefined;
    };
    expect(
      iconFor("select", "draft", {
        options: [{ value: "draft", label: "Draft" }],
      })
    ).toBe("chevron");
    expect(
      iconFor("multiSelect", ["a"], { options: [{ value: "a", label: "A" }] })
    ).toBe("list");
    expect(iconFor("number", 3)).toBe("hash");
    expect(iconFor("date", "2026-10-10")).toBe("calendar");
    expect(iconFor("url", "https://yayaw.app")).toBe("link");
    // A switch needs no icon.
    expect(iconFor("boolean", true)).toBeUndefined();
  });

  it("starts editing on a single click anywhere in the cell", async () => {
    const { wrapper } = createCell({
      row: { id: "1", name: "Ada" },
      column: { id: "name", header: "Name", type: "text", inlineEdit: true },
    });
    await wrapper.get(".yayaw-cell").trigger("click");
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("leaves read-only cells unmarked", () => {
    const { wrapper } = createCell({
      row: { id: "1", total: 3 },
      column: {
        id: "total",
        header: "Total",
        type: "number",
        inlineEdit: false,
      },
    });
    const cell = wrapper.get(".yayaw-cell");
    expect(cell.attributes("data-inline-editor")).toBeUndefined();
    expect(cell.attributes("title")).toBeUndefined();
  });
});
