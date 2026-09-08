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
      stubs: { PopperContent: { template: "<div><slot /></div>" } },
    },
  });
  mounted.push(wrapper);
  return { wrapper, context, row, update };
};

describe("catalogue-backed inline editing", () => {
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
    await wrapper.trigger("dblclick");
    expect(wrapper.get("input").attributes("type")).toBe("number");
    await wrapper.get("input").setValue("2");
    await wrapper.get("input").trigger("blur");
    await flushPromises();
    expect(update).toHaveBeenCalledWith("1", { amount: 200 });
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
    await wrapper.trigger("dblclick");
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
    await wrapper.trigger("dblclick");
    await flushPromises();
    expect(wrapper.text()).toContain("Two");
    await wrapper.get("select").setValue("2");
    await wrapper.get("select").trigger("blur");
    await flushPromises();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("1", { amount: 2 });
    finish({ success: true });
    await flushPromises();
  });

  it("rolls back an optimistic value when the action throws and retains the draft", async () => {
    const { wrapper, row } = createCell({
      update: () => Promise.reject(new Error("Offline")),
    });
    await wrapper.trigger("dblclick");
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
    await wrapper.trigger("dblclick");
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
    await wrapper.trigger("dblclick");
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

it("renders searchable choices outside the cell and preserves primitive selections", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", tags: [1] },
    column: themeColumn,
  });
  await wrapper.trigger("dblclick");
  await settle();
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
  expect(update).toHaveBeenCalledExactlyOnceWith("1", { tags: [false, 2] });
  expect(wrapper.find(".yayaw-inline-selection").exists()).toBe(false);
});

it("flushes an empty multi-selection when focus leaves the popup", async () => {
  const { wrapper, update } = createCell({
    row: { id: "1", tags: [1] },
    column: themeColumn,
  });
  await wrapper.trigger("dblclick");
  await settle();
  await wrapper.get('button[aria-label="Remove Culture"]').trigger("click");
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  await settle();
  expect(update).toHaveBeenCalledExactlyOnceWith("1", { tags: [] });
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
  await wrapper.trigger("dblclick");
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
  await wrapper.trigger("dblclick");
  await settle();
  await wrapper.get('button[aria-label="Remove Culture"]').trigger("click");
  document.activeElement?.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
  );
  await settle();
  expect(wrapper.find(".yayaw-inline-selection").exists()).toBe(false);
  expect(update).not.toHaveBeenCalled();
  const text = createCell();
  await text.wrapper.trigger("dblclick");
  expect(document.activeElement).toBe(text.wrapper.get("input").element);
  await text.wrapper.get("input").setValue("25");
  await text.wrapper.get("input").trigger("dblclick");
  expect(text.wrapper.get("input").element.value).toBe("25");
});

it("shows the delay and pending save bar, then clears it after acknowledgement", async () => {
  let finish!: (result: TableActionResult) => void;
  const gate = new Promise<TableActionResult>((resolve) => {
    finish = resolve;
  });
  const { wrapper } = createCell({ debounceMs: 200, update: () => gate });
  await wrapper.trigger("dblclick");
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
  await wrapper.trigger("dblclick");
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
