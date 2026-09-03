import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineTableConfig } from "../config";
import type { TableRecord, YayawTableProps } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

const rows: TableRecord[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
  { id: "3", name: "Gamma" },
];
const config = defineTableConfig({
  id: "bulk-actions",
  columns: {
    definitions: [{ id: "name", header: "Name", type: "text" }],
    mandatory: [],
    order: ["select", "name"],
    visible: ["name"],
  },
  translations: { namespace: "bulk", keys: {} },
});
const mountTable = (props: Partial<YayawTableProps> = {}) =>
  mount(YayawDataTable, {
    props: { tableType: "bulk", config, data: rows, syncUrl: false, ...props },
  });
type TableWrapper = ReturnType<typeof mountTable>;

const selectRows = async (wrapper: TableWrapper, count = 2): Promise<void> => {
  await flushPromises();
  for (const checkbox of wrapper
    .findAll('tbody input[type="checkbox"]')
    .slice(0, count)) {
    await checkbox.setValue(true);
  }
};
const selectedCount = (wrapper: TableWrapper): number =>
  wrapper
    .findAll<HTMLInputElement>('tbody input[type="checkbox"]')
    .filter((checkbox) => checkbox.element.checked).length;
const clickAction = async (
  wrapper: TableWrapper,
  label: string
): Promise<void> => {
  await wrapper.get(`.yayaw-bulk-bar [aria-label="${label}"]`).trigger("click");
  if (label === "Delete") {
    await wrapper
      .get('[role="alertdialog"] .yayaw-button-danger')
      .trigger("click");
  }
  await flushPromises();
};
const applyPatch = async (
  wrapper: TableWrapper,
  input: string
): Promise<void> => {
  await wrapper.get('textarea[aria-label="JSON fields"]').setValue(input);
  await wrapper
    .get(".yayaw-bulk-editor .yayaw-form-footer button:last-child")
    .trigger("click");
  await flushPromises();
};

enableAutoUnmount(afterEach);

describe("bulk action execution", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));

  it("invokes a consumer-owned edit callback directly without the JSON editor", async () => {
    const onBulkEdit = vi.fn();
    const bulkUpdate = vi.fn();
    const wrapper = mountTable({
      onBulkEdit,
      getTableActions: () => ({ bulkUpdate }),
    });
    await selectRows(wrapper);
    await clickAction(wrapper, "Bulk edit");
    expect(onBulkEdit).toHaveBeenCalledExactlyOnceWith(rows.slice(0, 2));
    expect(bulkUpdate).not.toHaveBeenCalled();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it.each([
    "null",
    "[]",
    "42",
    '"text"',
    "true",
    "{",
  ])("rejects the invalid object patch %s before invoking the backend", async (input) => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await selectRows(wrapper);
    await clickAction(wrapper, "Bulk edit");
    await applyPatch(wrapper, input);
    expect(bulkUpdate).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("valid JSON object");
    expect(selectedCount(wrapper)).toBe(2);
  });

  it("sends a valid object patch to bulkUpdate", async () => {
    const bulkUpdate = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await selectRows(wrapper);
    await clickAction(wrapper, "Bulk edit");
    await applyPatch(
      wrapper,
      '{"active":false,"amount":0,"tags":[],"note":null}'
    );
    expect(bulkUpdate).toHaveBeenCalledExactlyOnceWith(["1", "2"], {
      active: false,
      amount: 0,
      tags: [],
      note: null,
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it("keeps the patch and selection available when a bulk update fails", async () => {
    const bulkUpdate = vi.fn(async () => ({
      success: false,
      error: "Update denied",
    }));
    const wrapper = mountTable({ getTableActions: () => ({ bulkUpdate }) });
    await selectRows(wrapper);
    await clickAction(wrapper, "Bulk edit");
    await applyPatch(wrapper, '{"name":"Updated"}');
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      '{"name":"Updated"}'
    );
    expect(wrapper.get('[role="alert"]').text()).toContain("Update denied");
    expect(selectedCount(wrapper)).toBe(2);
  });

  it.each([
    ["onBulkEdit", "Bulk edit"],
    ["onBulkCopy", "Copy"],
    ["onBulkExport", "Export"],
    ["onBulkDelete", "Delete"],
  ] as const)("honors explicit result flags from %s", async (prop, label) => {
    const handler = vi.fn(async () => ({
      success: true,
      clearSelection: true,
      closeMenu: false,
      message: "Done",
    }));
    const wrapper = mountTable({ [prop]: handler });
    await selectRows(wrapper);
    await clickAction(wrapper, label);
    expect(handler).toHaveBeenCalledExactlyOnceWith(rows.slice(0, 2));
    expect(selectedCount(wrapper)).toBe(0);
    expect(wrapper.get('[role="status"]').text()).toContain("Done");
  });

  it("clears selection when a custom action requests it", async () => {
    const handler = vi.fn(async () => ({
      success: true,
      clearSelection: true,
      closeMenu: true,
    }));
    const wrapper = mountTable({
      customBulkActions: [{ id: "archive", label: "Archive", handler }],
    });
    await selectRows(wrapper);
    await clickAction(wrapper, "Archive");
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ selectedIds: ["1", "2"], count: 2 })
    );
    expect(selectedCount(wrapper)).toBe(0);
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(false);
  });

  it("dismisses the menu independently and reopens it when the selection changes", async () => {
    const handler = vi.fn(async () => ({
      success: true,
      clearSelection: false,
      closeMenu: true,
    }));
    const wrapper = mountTable({
      customBulkActions: [{ id: "archive", label: "Archive", handler }],
    });
    await selectRows(wrapper, 1);
    await clickAction(wrapper, "Archive");
    expect(selectedCount(wrapper)).toBe(1);
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(false);
    await wrapper.findAll('tbody input[type="checkbox"]')[1]?.setValue(true);
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("2 selected");
  });

  it("reports a failed action message without clearing or dismissing its selection", async () => {
    const handler = vi.fn(async () => ({
      success: false,
      message: "Archive denied",
    }));
    const wrapper = mountTable({
      customBulkActions: [{ id: "archive", label: "Archive", handler }],
    });
    await selectRows(wrapper);
    await clickAction(wrapper, "Archive");
    expect(wrapper.get('[role="status"]').text()).toContain("Archive denied");
    expect(wrapper.get('[role="status"]').attributes("data-type")).toBe(
      "error"
    );
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("2 selected");
  });

  it("lets a void delete callback own selection and follow-up behavior", async () => {
    const onBulkDelete = vi.fn();
    const list = vi.fn(async () => ({
      data: rows,
      meta: { totalCount: rows.length },
    }));
    const wrapper = mountTable({
      onBulkDelete,
      getTableActions: () => ({ list }),
    });
    await selectRows(wrapper);
    list.mockClear();
    await clickAction(wrapper, "Delete");
    expect(onBulkDelete).toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(selectedCount(wrapper)).toBe(2);
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(true);
  });

  it.each([
    "result",
    "rejection",
  ])("refreshes partial deletions after a %s failure and retains only failed IDs", async (failure) => {
    let serverRows = [...rows];
    const list = vi.fn(async () => ({
      data: [...serverRows],
      meta: { totalCount: serverRows.length },
    }));
    const deleteRow = vi.fn((id: string) => {
      if (id === "2") {
        if (failure === "rejection") {
          return Promise.reject(new Error("Access denied"));
        }
        return { success: false, error: "Access denied" };
      }
      serverRows = serverRows.filter((row) => row.id !== id);
      return { success: true };
    });
    const wrapper = mountTable({
      getTableActions: () => ({ list, delete: deleteRow }),
    });
    await selectRows(wrapper);
    list.mockClear();
    await clickAction(wrapper, "Delete");
    expect(deleteRow).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(1);
    expect(wrapper.get("tbody").text()).not.toContain("Alpha");
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("1 selected");
    expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([
      { "2": true },
    ]);
    expect(wrapper.get('[role="status"]').attributes("data-type")).toBe(
      "error"
    );
  });

  it("refreshes even when a bulk endpoint reports failure", async () => {
    const list = vi.fn(async () => ({
      data: rows,
      meta: { totalCount: rows.length },
    }));
    const bulkDelete = vi.fn(async () => ({
      success: false,
      error: "Partial backend failure",
    }));
    const wrapper = mountTable({
      getTableActions: () => ({ list, bulkDelete }),
    });
    await selectRows(wrapper);
    list.mockClear();
    await clickAction(wrapper, "Delete");
    expect(bulkDelete).toHaveBeenCalledExactlyOnceWith(["1", "2"]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(selectedCount(wrapper)).toBe(2);
    expect(wrapper.get('[role="status"]').text()).toContain(
      "Partial backend failure"
    );
  });

  it("waits for slow deletions to settle before refreshing after a fast rejection", async () => {
    let finishSlowDelete: () => void = () => undefined;
    const slowDelete = new Promise<void>((resolve) => {
      finishSlowDelete = resolve;
    });
    let serverRows = [...rows];
    const list = vi.fn(async () => ({
      data: [...serverRows],
      meta: { totalCount: serverRows.length },
    }));
    const deleteRow = vi.fn(async (id: string) => {
      if (id === "2") {
        throw new Error("Access denied");
      }
      await slowDelete;
      serverRows = serverRows.filter((row) => row.id !== id);
      return { success: true };
    });
    const wrapper = mountTable({
      getTableActions: () => ({ list, delete: deleteRow }),
    });
    await selectRows(wrapper);
    list.mockClear();
    await clickAction(wrapper, "Delete");
    expect(list).not.toHaveBeenCalled();
    expect(
      wrapper
        .get('.yayaw-bulk-bar [aria-label="Delete"]')
        .attributes("disabled")
    ).toBeDefined();
    finishSlowDelete();
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(1);
    expect(wrapper.get("tbody").text()).not.toContain("Alpha");
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("1 selected");
  });

  it("locks pending actions and does not clear rows selected after they started", async () => {
    let finishAction: () => void = () => undefined;
    const completion = new Promise<void>((resolve) => {
      finishAction = resolve;
    });
    const handler = vi.fn(async () => {
      await completion;
      return { success: true, clearSelection: true, closeMenu: true };
    });
    const wrapper = mountTable({
      customBulkActions: [{ id: "archive", label: "Archive", handler }],
    });
    await selectRows(wrapper, 1);
    await clickAction(wrapper, "Archive");
    const button = wrapper.get('.yayaw-bulk-bar [aria-label="Archive"]');
    expect(button.attributes("disabled")).toBeDefined();
    expect(
      wrapper
        .get('.yayaw-bulk-bar [aria-label="Cancel"]')
        .attributes("disabled")
    ).toBeDefined();
    await button.trigger("click");
    await wrapper.findAll('tbody input[type="checkbox"]')[1]?.setValue(true);
    finishAction();
    await flushPromises();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([
      { "2": true },
    ]);
    expect(wrapper.get(".yayaw-bulk-bar").text()).toContain("1 selected");
  });

  it("deletes only the IDs displayed when confirmation was requested", async () => {
    const bulkDelete = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({ getTableActions: () => ({ bulkDelete }) });
    await selectRows(wrapper, 1);
    await wrapper.get('.yayaw-bulk-bar [aria-label="Delete"]').trigger("click");
    expect(wrapper.get('[role="alertdialog"]').attributes("aria-label")).toBe(
      "Delete 1 rows?"
    );
    await wrapper.findAll('tbody input[type="checkbox"]')[1]?.setValue(true);
    await wrapper
      .get('[role="alertdialog"] .yayaw-button-danger')
      .trigger("click");
    await flushPromises();
    expect(bulkDelete).toHaveBeenCalledExactlyOnceWith(["1"]);
    expect(wrapper.emitted("rowSelectionChange")?.at(-1)).toEqual([
      { "2": true },
    ]);
  });

  it("executes a confirmed custom action once and honors its result", async () => {
    const handler = vi.fn(async () => ({
      success: true,
      clearSelection: true,
      message: "Archived",
    }));
    const wrapper = mountTable({
      customBulkActions: [
        {
          id: "archive",
          label: "Archive",
          confirm: { title: "Archive selected rows?" },
          handler,
        },
      ],
    });
    await selectRows(wrapper);
    await clickAction(wrapper, "Archive");
    expect(handler).not.toHaveBeenCalled();
    const confirm = wrapper.get('[role="alertdialog"] .yayaw-button-danger');
    await Promise.all([confirm.trigger("click"), confirm.trigger("click")]);
    await flushPromises();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(selectedCount(wrapper)).toBe(0);
    expect(wrapper.get('[role="status"]').text()).toContain("Archived");
  });

  it("clears all successfully deleted rows", async () => {
    const deleteRow = vi.fn(async () => ({ success: true }));
    const wrapper = mountTable({
      getTableActions: () => ({ delete: deleteRow }),
    });
    await selectRows(wrapper);
    await clickAction(wrapper, "Delete");
    expect(deleteRow).toHaveBeenCalledTimes(2);
    expect(selectedCount(wrapper)).toBe(0);
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
});
