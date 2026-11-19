import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inlineTestPortals } from "../../../tests/menu-helpers";
import { defineTableConfig } from "../../config";
import YayawDataTable from "../YayawDataTable.vue";

inlineTestPortals();

const config = (allowCreate: boolean) =>
  defineTableConfig({
    id: "host-create",
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      order: ["select", "name", "actions"],
      visible: ["name"],
      mandatory: ["name"],
    },
    table: { allowCreate },
    translations: { namespace: "host-create", keys: {} },
  });
const mountTable = (props: Record<string, unknown>) =>
  mount(YayawDataTable, {
    props: {
      tableType: "host-create",
      data: [{ id: "1", name: "Alpha" }],
      syncUrl: false,
      config: config(true),
      ...props,
    },
    attachTo: document.body,
  });

describe("host create flow (onCreate)", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows the create button without actions.create and calls the host instead of the form", async () => {
    const onCreate = vi.fn();
    const wrapper = mountTable({ onCreate });
    await flushPromises();
    const button = wrapper.find("[data-toolbar-create]");
    expect(button.exists()).toBe(true);
    await button.trigger("click");
    expect(onCreate).toHaveBeenCalledOnce();
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
    wrapper.unmount();
  });

  it("stays hidden with allowCreate: false, and without onCreate or actions.create", async () => {
    const hidden = mountTable({ onCreate: vi.fn(), config: config(false) });
    const none = mountTable({});
    await flushPromises();
    expect(hidden.find("[data-toolbar-create]").exists()).toBe(false);
    expect(none.find("[data-toolbar-create]").exists()).toBe(false);
    hidden.unmount();
    none.unmount();
  });
});
