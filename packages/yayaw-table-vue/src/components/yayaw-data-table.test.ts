import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { defineTableConfig } from "../config";
import type { TableActions, TableRecord } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

const data: TableRecord[] = [
  { id: "1", name: "Alpha", status: "Open", amount: 10, active: true },
  { id: "2", name: "Beta", status: "Closed", amount: 20, active: false },
  { id: "3", name: "Gamma", status: "Open", amount: 30, active: true },
];
const config = defineTableConfig({
  id: "test",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text", inlineEdit: true },
      {
        id: "status",
        header: "Status",
        type: "select",
        options: ["Open", "Closed"].map((value) => ({ label: value, value })),
      },
      {
        id: "amount",
        header: "Amount",
        type: "number",
        defaultCalculation: "sum",
      },
      { id: "active", header: "Active", type: "boolean" },
    ],
    mandatory: ["name"],
    order: ["select", "name", "status", "amount", "active", "actions"],
    visible: ["name", "status", "amount", "active"],
  },
  table: {
    displayModes: ["table", "kanban", "gallery"],
    kanban: { groupBy: "status", titleColumn: "name" },
    gallery: { titleColumn: "name" },
    enableCalculations: true,
  },
  translations: { namespace: "test", keys: { title: "Test rows" } },
});

describe("YayawDataTable", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));
  afterEach(() => document.body.replaceChildren());

  it("renders columns, values and calculations", async () => {
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "test", config, data, syncUrl: false },
      attachTo: document.body,
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Test rows");
    expect(wrapper.text()).toContain("Alpha");
    expect(wrapper.text()).toContain("sum");
    expect(wrapper.text()).toContain("60");
  });

  it("filters static rows using global search", async () => {
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "test", config, data, syncUrl: false },
    });
    await wrapper.get('input[type="search"]').setValue("Beta");
    await nextTick();
    expect(wrapper.text()).toContain("Beta");
    expect(wrapper.text()).not.toContain("Alpha");
  });

  it("switches between table, kanban and gallery", async () => {
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "test", config, data, syncUrl: false },
    });
    const buttons = wrapper.findAll(".yayaw-segmented button");
    await buttons
      .find((button) => button.text() === "kanban")
      ?.trigger("click");
    expect(wrapper.find(".yayaw-kanban").exists()).toBe(true);
    await buttons
      .find((button) => button.text() === "gallery")
      ?.trigger("click");
    expect(wrapper.find(".yayaw-gallery").exists()).toBe(true);
  });

  it("selects rows and exposes bulk actions", async () => {
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "test", config, data, syncUrl: false },
    });
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    await checkboxes[0]?.setValue(true);
    expect(wrapper.find(".yayaw-bulk-bar").exists()).toBe(true);
    expect(wrapper.find(".yayaw-bulk-bar").text()).toContain("1 selected");
  });

  it("loads data through the server action contract", async () => {
    const list = vi.fn(async () => ({
      data: data.slice(1, 2),
      meta: { totalCount: 100, pageCount: 10 },
    }));
    const actions: TableActions = { list };
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config,
        getTableActions: () => actions,
        syncUrl: false,
      },
    });
    await flushPromises();
    expect(list).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Beta");
    expect(wrapper.text()).toContain("100 rows");
  });

  it("uses the aggregate action for calculations across server pages", async () => {
    const list = vi.fn(async () => ({
      data: data.slice(0, 1),
      meta: { totalCount: 300, pageCount: 30 },
    }));
    const aggregate = vi.fn(async () => ({ results: { amount: 12_345 } }));
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config,
        getTableActions: () => ({ list, aggregate }),
        syncUrl: false,
      },
    });
    await flushPromises();
    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ calculations: { amount: "sum" } })
    );
    expect(wrapper.text()).toContain("12,345");
  });

  it("selects every matching server row across pages", async () => {
    const serverConfig = defineTableConfig({
      ...config,
      table: { ...config.table, defaultPageSize: 1, pageSizeOptions: [1, 3] },
    });
    const list = vi.fn(
      async ({ page, pageSize }: { page: number; pageSize: number }) => ({
        data: pageSize === 1 ? data.slice(page - 1, page) : data,
        meta: { totalCount: 3, pageCount: pageSize === 1 ? 3 : 1 },
      })
    );
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: serverConfig,
        getTableActions: () => ({ list }),
        syncUrl: false,
      },
    });
    await flushPromises();
    await wrapper.get('tbody input[type="checkbox"]').setValue(true);
    const selectAll = wrapper
      .findAll(".yayaw-bulk-bar button")
      .find((button) => button.text().includes("Select all"));
    await selectAll?.trigger("click");
    await flushPromises();
    expect(wrapper.find(".yayaw-bulk-bar").text()).toContain("3 selected");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 3 }));
  });

  it("renders catalogue defaults and changes dynamic field input types", async () => {
    const getFormConfig = vi.fn(() => ({
      id: "test",
      defaultValues: { kind: "string", value: "hello" },
      fields: [
        {
          name: "kind",
          label: "Kind",
          type: "select" as const,
          options: ["string", "number"].map((value) => ({
            label: value,
            value,
          })),
        },
        {
          name: "value",
          label: "Value",
          type: "dynamic-value" as const,
          dependsOn: { field: "kind", transform: String },
        },
      ],
    }));
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config,
        data,
        getFormConfig,
        getTableActions: () => ({ create: async () => ({ success: true }) }),
        syncUrl: false,
      },
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Create")
      ?.trigger("click");
    await flushPromises();
    expect(wrapper.get("#yayaw-field-value").attributes("type")).toBe("text");
    expect(
      (wrapper.get("#yayaw-field-value").element as HTMLInputElement).value
    ).toBe("hello");
    await wrapper.get("#yayaw-field-kind").setValue("number");
    await nextTick();
    expect(wrapper.get("#yayaw-field-value").attributes("type")).toBe("number");
    expect(getFormConfig).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ tableId: "test", tableType: "test" })
    );
  });

  it("syncs meaningful state to compatible URL keys", async () => {
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "test", config, data, syncUrl: true },
    });
    await wrapper.get('input[type="search"]').setValue("Alpha");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(window.location.search).toContain("test-q=Alpha");
  });
});
