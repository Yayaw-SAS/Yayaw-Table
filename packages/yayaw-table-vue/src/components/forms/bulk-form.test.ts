import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { z } from "zod";
import { defineTableConfig } from "../../config";
import type {
  FormConfig,
  TableActionResult,
  TableRecord,
  YayawTableProps,
} from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

const rows: TableRecord[] = [
  {
    id: "1",
    name: "Alpha",
    amount: 10,
    active: true,
    tags: [1],
    note: "first",
    kind: "a",
  },
  {
    id: "2",
    name: "Beta",
    amount: 20,
    active: false,
    tags: [2],
    note: "second",
    kind: "b",
  },
  { id: "3", name: "Gamma", amount: 30, active: true, kind: "a" },
];
const config = defineTableConfig({
  id: "catalogue-bulk",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text", inlineEdit: true },
    ],
    mandatory: [],
    visible: ["name"],
    order: ["name"],
  },
  translations: { namespace: "bulk", keys: {} },
});
const form: FormConfig = {
  id: "item",
  submitMode: "patch",
  presentation: "modal",
  fields: [
    {
      name: "name",
      label: "Name",
      type: "text",
      required: true,
      schema: z.string().min(2),
    },
    {
      name: "amount",
      label: "Amount",
      type: "number",
      schema: z.number().min(0),
    },
    { name: "active", label: "Active", type: "switch" },
    {
      name: "tags",
      label: "Tags",
      type: "multiSelect",
      options: [{ value: 1, label: "One" }],
    },
    { name: "note", label: "Note", type: "text" },
  ],
};
const mountTable = (props: Partial<YayawTableProps> = {}) =>
  mount(YayawDataTable, {
    props: {
      tableType: "items",
      config,
      data: structuredClone(rows),
      syncUrl: false,
      getFormConfig: () => form,
      ...props,
    },
    attachTo: document.body,
    global: { stubs: { DialogPortal: { template: "<div><slot /></div>" } } },
  });
type Wrapper = ReturnType<typeof mountTable>;
const open = async (wrapper: Wrapper) => {
  await flushPromises();
  for (const checkbox of wrapper
    .findAll('tbody input[type="checkbox"]')
    .slice(0, 2)) {
    await checkbox.setValue(true);
  }
  const trigger = wrapper.get<HTMLButtonElement>('[aria-label="Bulk edit"]');
  trigger.element.focus();
  await trigger.trigger("click");
  await flushPromises();
};
const apply = async (wrapper: Wrapper, name: string) => {
  await wrapper
    .get(`[data-bulk-field="${name}"] .yayaw-bulk-field-toggle input`)
    .setValue(true);
};
const submit = async (wrapper: Wrapper) => {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
};
const selected = (wrapper: Wrapper) =>
  wrapper
    .findAll<HTMLInputElement>('tbody input[type="checkbox"]')
    .filter((input) => input.element.checked).length;

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => window.history.replaceState({}, "", "/"));

describe("generated bulk catalogue", () => {
  it("uses each table's catalogue by default and only validates checked fields", async () => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const update = vi.fn();
    const wrapper = mountTable({
      getTableActions: () => ({ bulkUpdate, update }),
    });
    await open(wrapper);
    expect(wrapper.find('textarea[aria-label="JSON fields"]').exists()).toBe(
      false
    );
    expect(wrapper.findAll("[data-bulk-field]")).toHaveLength(5);
    await submit(wrapper);
    expect(wrapper.text()).toContain("Choose at least one field");
    expect(bulkUpdate).not.toHaveBeenCalled();
    await apply(wrapper, "amount");
    await wrapper.get('[data-field-name="amount"] input').setValue(-1);
    await submit(wrapper);
    expect(bulkUpdate).not.toHaveBeenCalled();
    await wrapper.get('[data-field-name="amount"] input').setValue(0);
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenCalledExactlyOnceWith(["1", "2"], {
      amount: 0,
    });
    expect(update).not.toHaveBeenCalled();
    expect(selected(wrapper)).toBe(0);
    expect(wrapper.find("form").exists()).toBe(false);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(wrapper.element)
    );
  });

  it("allows false and explicit clears without overwriting unchecked fields", async () => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await open(wrapper);
    for (const name of ["active", "tags", "note"]) {
      await apply(wrapper, name);
    }
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenCalledExactlyOnceWith(["1", "2"], {
      active: false,
      tags: [],
      note: "",
    });
  });

  it("reuses transforms on a partial patch and skips single-row initial loaders", async () => {
    const loadInitialValues = vi.fn();
    const transform = vi.fn((values: TableRecord) => ({
      cents: Number(values.amount) * 100,
    }));
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({
      getTableActions: () => ({ bulkUpdate }),
      getFormConfig: () => ({
        ...form,
        loadInitialValues,
        transform,
        schema: z.object({ name: z.string().min(1) }),
      }),
    });
    await open(wrapper);
    await apply(wrapper, "amount");
    await wrapper.get('[data-field-name="amount"] input').setValue(2);
    await submit(wrapper);
    expect(loadInitialValues).not.toHaveBeenCalled();
    expect(transform).toHaveBeenCalledWith(
      { amount: 2 },
      expect.objectContaining({
        bulkEdit: expect.objectContaining({ fields: ["amount"] }),
      })
    );
    expect(bulkUpdate).toHaveBeenCalledWith(["1", "2"], { cents: 200 });
  });

  it("checks hidden, disabled, and excluded fields against every selected row", async () => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const fields: FormConfig["fields"] = [
      { name: "id", label: "ID", type: "text" },
      { name: "secret", label: "Secret", type: "text", bulkEdit: false },
      {
        name: "locked",
        label: "Locked",
        type: "text",
        disabled: (context) => context.row?.id === "2",
      },
      {
        name: "hidden",
        label: "Hidden",
        type: "text",
        hidden: (context) => context.values.kind === "b",
      },
      { name: "kind", label: "Kind", type: "text" },
    ];
    const wrapper = mountTable({
      getTableActions: () => ({ bulkUpdate }),
      getFormConfig: () => ({ ...form, fields }),
    });
    await open(wrapper);
    expect(
      wrapper
        .findAll("[data-bulk-field]")
        .map((field) => field.attributes("data-bulk-field"))
    ).toEqual(["kind"]);
    await apply(wrapper, "kind");
    await wrapper.get('[data-field-name="kind"] input').setValue("a");
    await flushPromises();
    expect(wrapper.find('[data-bulk-field="hidden"]').exists()).toBe(true);
    await apply(wrapper, "hidden");
    await wrapper.get('[data-field-name="hidden"] input').setValue("draft");
    await wrapper.get('[data-field-name="kind"] input').setValue("b");
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenCalledWith(["1", "2"], { kind: "b" });
  });

  it("does not open a catalogue for mixed resolved form types", async () => {
    const wrapper = mountTable({
      config: {
        ...config,
        form: { resolveEditFormType: (row) => String(row.kind) },
      },
      getTableActions: () => ({ bulkUpdate: vi.fn() }),
    });
    await open(wrapper);
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).toContain("Select rows with the same edit form");
  });

  it("keeps the opened target IDs and retains only failed IDs for retry", async () => {
    const bulkUpdate = vi
      .fn<
        (
          ids: string[],
          values: TableRecord
        ) => Promise<TableActionResult<TableRecord[]>>
      >()
      .mockResolvedValueOnce({
        success: false,
        failedIds: ["2"],
        error: "Second row denied",
      })
      .mockResolvedValueOnce({ success: true });
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await open(wrapper);
    await wrapper.findAll('tbody input[type="checkbox"]')[2]?.setValue(true);
    await apply(wrapper, "note");
    await wrapper.get('[data-field-name="note"] input').setValue("draft");
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenNthCalledWith(1, ["1", "2"], {
      note: "draft",
    });
    expect(wrapper.text()).toContain("Second row denied");
    expect(selected(wrapper)).toBe(2);
    expect(
      wrapper.get<HTMLInputElement>('[data-field-name="note"] input').element
        .value
    ).toBe("draft");
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenNthCalledWith(2, ["2"], { note: "draft" });
    expect(selected(wrapper)).toBe(1);
  });

  it("keeps drafts after rejection and blocks duplicate submissions", async () => {
    let reject!: (error: Error) => void;
    const bulkUpdate = vi.fn(
      () =>
        new Promise<TableActionResult<TableRecord[]>>((_resolve, fail) => {
          reject = fail;
        })
    );
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await open(wrapper);
    await apply(wrapper, "note");
    await wrapper.get('[data-field-name="note"] input').setValue("draft");
    await submit(wrapper);
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenCalledTimes(1);
    expect(
      wrapper.get('button[aria-label="Close"]').attributes("disabled")
    ).toBeDefined();
    reject(new Error("Offline"));
    await flushPromises();
    expect(wrapper.text()).toContain("Offline");
    expect(selected(wrapper)).toBe(2);
    expect(
      wrapper.get<HTMLInputElement>('[data-field-name="note"] input').element
        .value
    ).toBe("draft");
  });

  it("preserves callback precedence and allows explicit JSON compatibility", async () => {
    const onBulkEdit = vi.fn();
    const wrapper = mountTable({ onBulkEdit });
    await open(wrapper);
    expect(onBulkEdit).toHaveBeenCalledOnce();
    expect(wrapper.find("form").exists()).toBe(false);
    wrapper.unmount();
    const legacy = mountTable({
      config: { ...config, form: { bulkEditMode: "json" } },
      getTableActions: () => ({ bulkUpdate: vi.fn() }),
    });
    await open(legacy);
    expect(legacy.find('textarea[aria-label="JSON fields"]').exists()).toBe(
      true
    );
  });

  it("keeps catalogues isolated between two table instances", async () => {
    const first = mountTable({
      getTableActions: () => ({ bulkUpdate: vi.fn() }),
    });
    const second = mountTable({
      config: { ...config, id: "second" },
      getTableActions: () => ({ bulkUpdate: vi.fn() }),
      getFormConfig: () => ({
        id: "second-form",
        fields: [{ name: "address", label: "Address", type: "text" }],
      }),
    });
    await open(first);
    expect(first.findAll("[data-bulk-field]")).toHaveLength(5);
    await first.get('button[aria-label="Close"]').trigger("click");
    await open(second);
    expect(
      second
        .findAll("[data-bulk-field]")
        .map((field) => field.attributes("data-bulk-field"))
    ).toEqual(["address"]);
  });

  it("blocks rows without edit permission and rechecks permission before saving", async () => {
    const permission = reactive({ allowed: false });
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({
      config: {
        ...config,
        table: { ...config.table, canEditRow: () => permission.allowed },
      },
      getTableActions: () => ({ bulkUpdate }),
    });
    await flushPromises();
    for (const checkbox of wrapper
      .findAll('tbody input[type="checkbox"]')
      .slice(0, 2)) {
      await checkbox.setValue(true);
    }
    expect(wrapper.find('[aria-label="Bulk edit"]').exists()).toBe(false);
    permission.allowed = true;
    await flushPromises();
    await wrapper.get('[aria-label="Bulk edit"]').trigger("click");
    await flushPromises();
    await apply(wrapper, "note");
    permission.allowed = false;
    await submit(wrapper);
    expect(bulkUpdate).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("can no longer be edited");
  });

  it("supports an explicit generated-column catalogue without a form provider", async () => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({
      getFormConfig: undefined,
      config: { ...config, form: { bulkEditMode: "catalogue" } },
      getTableActions: () => ({ bulkUpdate }),
    });
    await open(wrapper);
    expect(wrapper.findAll("[data-bulk-field]")).toHaveLength(1);
    await apply(wrapper, "name");
    await wrapper.get('[data-field-name="name"] input').setValue("Updated");
    await submit(wrapper);
    expect(bulkUpdate).toHaveBeenCalledWith(["1", "2"], { name: "Updated" });
  });

  it("restores focus to the bulk trigger on cancellation without clearing selection", async () => {
    const bulkUpdate = vi.fn();
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await open(wrapper);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Cancel")
      ?.trigger("click");
    await flushPromises();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        wrapper.get('[aria-label="Bulk edit"]').element
      )
    );
    expect(selected(wrapper)).toBe(2);
    expect(bulkUpdate).not.toHaveBeenCalled();
  });
});
