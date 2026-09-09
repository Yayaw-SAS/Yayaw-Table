import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineTableConfig } from "../../config";
import type { RecordDetailsConfig } from "../../record-details";
import YayawDataTable from "../YayawDataTable.vue";
import RecordDetails from "./RecordDetails.vue";

const row = {
  id: "record-1",
  name: "Example",
  value: false,
  updatedAt: "2026-09-09T10:00:00Z",
};
const config: RecordDetailsConfig = {
  presentation: "inline",
  updatedAt: (item) => String(item.updatedAt),
  updatedBy: () => "Camille",
  sections: [
    {
      id: "main",
      title: "Main",
      fields: [{ id: "value", label: "Active", type: "boolean" }],
    },
  ],
  activity: () => [
    {
      id: "change",
      actor: { name: "Camille" },
      at: row.updatedAt,
      action: "updated",
      changes: [{ field: "value", before: true, after: false }],
    },
  ],
};
enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
const button = (scope: Pick<DOMWrapper<Element>, "findAll">, text: string) => {
  const found = scope.findAll("button").find((item) => item.text() === text);
  if (!found) {
    throw new Error(`Missing button: ${text}`);
  }
  return found;
};

describe("RecordDetails", () => {
  it.each([
    false,
    true,
  ])("delegates menu and row consultation to the host (built-in config: %s)", async (withDetails) => {
    const onOpenDetails = vi.fn();
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "host-details",
        config: defineTableConfig({
          id: "host-details",
          columns: {
            definitions: [{ id: "name", header: "Name", type: "text" }],
            visible: ["name"],
            order: ["name"],
            mandatory: [],
          },
          table: {
            rowClickMode: "activate",
            syncUrl: false,
            allowEdit: false,
            allowDelete: false,
            allowDuplicate: false,
            enableRowSelection: false,
          },
          translations: { namespace: "test", keys: {} },
        }),
        details: withDetails ? config : undefined,
        onOpenDetails,
        data: [row],
      },
      attachTo: document.body,
      global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
    });
    const body = new DOMWrapper(document.body);
    await wrapper
      .get('[aria-label="Open actions menu"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    await body.get('[role="menuitem"]').trigger("click");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onOpenDetails).toHaveBeenCalledExactlyOnceWith(row);
    expect(body.find(".yayaw-detail").exists()).toBe(false);
    expect(wrapper.emitted("rowActivate")).toBeUndefined();
    await wrapper.get("tbody td").trigger("click");
    expect(onOpenDetails).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("rowActivate")).toHaveLength(1);
    expect(body.find(".yayaw-detail").exists()).toBe(false);
    await wrapper.setProps({ onOpenDetails: undefined, details: undefined });
    expect(wrapper.find('[aria-label="Open actions menu"]').exists()).toBe(
      false
    );
  });
  it("opens a consultation modal from the row action menu", async () => {
    const tableConfig = defineTableConfig({
      id: "details-menu",
      columns: {
        definitions: [{ id: "name", header: "Name", type: "text" }],
        visible: ["name"],
        order: ["name"],
        mandatory: [],
      },
      table: { rowClickMode: "activate", syncUrl: false },
      translations: { namespace: "test", keys: {} },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "details-menu",
        config: tableConfig,
        details: { ...config, presentation: "modal" },
        data: [row],
      },
      attachTo: document.body,
      global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
    });
    const body = new DOMWrapper(document.body);
    await wrapper
      .get('[aria-label="Open actions menu"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    await body.get('[role="menuitem"]').trigger("click");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(body.get('[role="dialog"]').text()).toContain("Example");
  });
  it("retains the original event after undo and renders the appended inverse event", async () => {
    const originalEvents = config.activity?.(row) ?? [];
    const handler = vi.fn(() => ({ success: true }));
    const wrapper = mount(RecordDetails, {
      props: { row, config, onRevertActivity: handler },
      attachTo: document.body,
    });
    await wrapper
      .get('[role="tab"][data-state="inactive"]')
      .trigger("mousedown", { button: 0 });
    await flushPromises();
    const undo = wrapper.get(".yayaw-detail-undo");
    await undo.trigger("click");
    await flushPromises();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("reverted")).toHaveLength(1);
    expect(wrapper.text()).toContain("Undone");
    await wrapper.setProps({
      config: {
        ...config,
        activity: () => [
          {
            id: "undo",
            at: "2026-09-09T11:00:00Z",
            actor: { name: "Alex" },
            action: "undid Camille’s change",
            reverts: "change",
            changes: [{ field: "value", before: false, after: true }],
          },
          ...originalEvents,
        ],
      },
    });
    expect(wrapper.findAll(".yayaw-detail-timeline > li")).toHaveLength(2);
    expect(wrapper.text()).toContain("Camille updated");
    expect(wrapper.text()).toContain("Alex undid Camille’s change");
    expect(wrapper.find(".yayaw-detail-undo").exists()).toBe(false);
  });
  it("opens from a table without mutation handlers and displays audit values", async () => {
    const tableConfig = defineTableConfig({
      id: "details",
      columns: {
        definitions: [{ id: "name", header: "Name", type: "text" }],
        visible: ["name"],
        order: ["name"],
        mandatory: [],
      },
      table: { rowClickMode: "activate", syncUrl: false },
      translations: { namespace: "test", keys: {} },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "details",
        config: tableConfig,
        details: config,
        data: [row],
      },
      attachTo: document.body,
    });
    await flushPromises();
    await wrapper.get("tbody td").trigger("click");
    await flushPromises();
    const detail = wrapper.get(".yayaw-detail");
    expect(detail.text()).toContain("Camille");
    expect(detail.find("input").exists()).toBe(false);
    expect(
      detail
        .findAll("button")
        .some((item) => item.text() === "Delete" || item.text() === "Edit")
    ).toBe(false);
    await detail
      .get('[role="tab"][data-state="inactive"]')
      .trigger("mousedown", { button: 0 });
    await flushPromises();
    expect(detail.text()).toContain("Before");
    expect(detail.text()).toContain("After");
  });

  it("cancels deletion, retains failed requests, and prevents duplicate submissions", async () => {
    let finish:
      | ((result: { success: boolean; error?: string }) => void)
      | undefined;
    const remove = vi.fn(
      () =>
        new Promise<{ success: boolean; error?: string }>((resolve) => {
          finish = resolve;
        })
    );
    const wrapper = mount(RecordDetails, {
      props: { row, config, canEdit: true, canDelete: true, onDelete: remove },
      attachTo: document.body,
    });
    const body = new DOMWrapper(document.body);
    await button(body, "Delete").trigger("click");
    await flushPromises();
    expect(
      document.querySelector('[role="alertdialog"]')?.textContent
    ).toContain("Example");
    await button(body.get('[role="alertdialog"]'), "Cancel").trigger("click");
    expect(remove).not.toHaveBeenCalled();
    await button(body, "Delete").trigger("click");
    await flushPromises();
    const confirm = body.get('[role="alertdialog"]');
    await button(confirm, "Delete").trigger("click");
    expect(remove).toHaveBeenCalledTimes(1);
    expect(button(confirm, "Deleting…").attributes("disabled")).toBeDefined();
    finish?.({ success: false, error: "Server unavailable" });
    await flushPromises();
    expect(confirm.text()).toContain("Server unavailable");
    expect(wrapper.emitted("deleted")).toBeUndefined();
    await button(confirm, "Delete").trigger("click");
    finish?.({ success: true });
    await flushPromises();
    expect(wrapper.emitted("deleted")).toHaveLength(1);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("rechecks permissions when a delete confirmation is already open", async () => {
    const remove = vi.fn(() => ({ success: true }));
    const wrapper = mount(RecordDetails, {
      props: {
        row,
        config: { ...config, presentation: "modal" },
        canDelete: true,
        onDelete: remove,
      },
      attachTo: document.body,
    });
    const body = new DOMWrapper(document.body);
    await flushPromises();
    await button(body, "Delete").trigger("click");
    await flushPromises();
    await wrapper.setProps({ canDelete: false });
    expect(
      button(body.get('[role="alertdialog"]'), "Delete").attributes("disabled")
    ).toBeDefined();
    expect(remove).not.toHaveBeenCalled();
  });
});
