import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";
import type { RecordDetailsConfig } from "../../record-details";
import YayawDataTable from "../YayawDataTable.vue";

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);

const row = { id: "record-1", name: "After" };
const details: RecordDetailsConfig = {
  activity: () => [
    {
      id: "change",
      actor: { name: "Camille" },
      at: "2026-10-03T10:00:00Z",
      action: "updated",
      changes: [{ field: "name", before: "Before", after: "After" }],
    },
  ],
};
const mountTable = (props: Record<string, unknown>) =>
  mount(YayawDataTable, {
    props: {
      tableType: "form-activity",
      config: defineTableConfig({
        id: "form-activity",
        presentation: "inline",
        columns: {
          definitions: [{ id: "name", header: "Name", type: "text" }],
          visible: ["name"],
          order: ["name"],
          mandatory: [],
        },
        table: { allowEdit: true, enableRowClickEdit: true, rowClickMode: "edit", syncUrl: false },
        translations: { namespace: "test", keys: {} },
      }),
      data: [row],
      getFormConfig: () => ({ id: "form-activity", fields: [{ name: "name", label: "Name", type: "text" }] }),
      getTableActions: () => ({ update: async () => ({ success: true }) }),
      ...props,
    },
    attachTo: document.body,
  });

describe("edit form activity", () => {
  it("shows the record's activity next to the fields and reloads them after an undo", async () => {
    const wrapper = mountTable({ details });
    const handler = vi.fn(async () => {
      await wrapper.setProps({ data: [{ ...row, name: "Before" }] });
      return { success: true };
    });
    await wrapper.setProps({ onRevertActivity: handler });
    await wrapper.get("tbody tr").trigger("click");
    await flushPromises();
    const form = () => wrapper.get("form.yayaw-form");
    expect((form().get("input").element as HTMLInputElement).value).toBe("After");
    await wrapper.get('.yayaw-detail-tablist [role="tab"][data-state="inactive"]').trigger("mousedown", { button: 0 });
    await flushPromises();
    expect(wrapper.text()).toContain("Camille updated");
    // The fields stay mounted (hidden) while the activity tab shows.
    expect(form().exists()).toBe(true);
    await wrapper.get(".yayaw-detail-undo").trigger("click");
    await flushPromises();
    expect(handler).toHaveBeenCalledTimes(1);
    expect((form().get("input").element as HTMLInputElement).value).toBe("Before");
  });

  it("keeps the plain form without an activity log", async () => {
    const wrapper = mountTable({ details: {} });
    await wrapper.get("tbody tr").trigger("click");
    await flushPromises();
    expect(wrapper.find("form.yayaw-form").exists()).toBe(true);
    expect(wrapper.find(".yayaw-detail-tablist").exists()).toBe(false);
  });
});
