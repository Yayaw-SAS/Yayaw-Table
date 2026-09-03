import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, reactive } from "vue";
import { z } from "zod";
import { defineTableConfig } from "../../config";
import { type TableContextValue, tableContextKey } from "../../context";
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
});

const createCell = (
  input: {
    row?: TableRecord;
    column?: ColumnDefinition;
    form?: FormConfig;
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
      table: { allowInlineEdit: true, inlineEdit: { enabled: true } },
      form: { resolveEditFormType: (record) => String(record.kind ?? "item") },
    }),
    tableType: "items",
    actions: computed(() => ({ update })),
    getFormConfig: vi.fn(() => input.form),
    getRowId: () => "1",
    refresh: vi.fn(async () => undefined),
  } as unknown as TableContextValue;
  const wrapper = mount(CellRenderer, {
    props: { row, column, value: row[column.accessorKey ?? column.id] },
    global: { provide: { [tableContextKey as symbol]: context } },
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
