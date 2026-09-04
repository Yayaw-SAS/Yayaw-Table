import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
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

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);

describe("YayawDataTable", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));

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

  it("supports controlled selection that can survive query changes", async () => {
    const persistentConfig = defineTableConfig({
      ...config,
      table: { ...config.table, preserveSelectionOnQuery: true },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: persistentConfig,
        data,
        rowSelection: { "1": true },
        syncUrl: false,
      },
    });
    expect(
      (
        wrapper.findAll('tbody input[type="checkbox"]')[0]?.element as
          | HTMLInputElement
          | undefined
      )?.checked
    ).toBe(true);

    await wrapper.get('input[type="search"]').setValue("Beta");
    await wrapper.get('input[type="search"]').setValue("");
    expect(
      (
        wrapper.findAll('tbody input[type="checkbox"]')[0]?.element as
          | HTMLInputElement
          | undefined
      )?.checked
    ).toBe(true);

    await wrapper.setProps({ rowSelection: { "2": true } });
    await nextTick();
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    expect(
      (checkboxes[0]?.element as HTMLInputElement | undefined)?.checked
    ).toBe(false);
    expect(
      (checkboxes[1]?.element as HTMLInputElement | undefined)?.checked
    ).toBe(true);
  });

  it("provides the full Options system", async () => {
    const wrapper = mount(YayawDataTable, {
      props: { tableType: "test", config, data, syncUrl: false },
      attachTo: document.body,
    });
    await wrapper.get('[aria-label="Options"]').trigger("click");
    const menu = wrapper.get(".yayaw-options-menu");
    expect(menu.text()).toContain("Properties");
    expect(menu.text()).toContain("Filters");
    expect(menu.text()).toContain("Sort");
    expect(menu.text()).toContain("Group");
    expect(menu.text()).toContain("Footer calculations");

    await menu
      .findAll(".yayaw-options-item")
      .find((button) => button.text().includes("Properties"))
      ?.trigger("click");
    const propertyInputs = wrapper.findAll(
      '.yayaw-options-content input[type="checkbox"]'
    );
    expect(propertyInputs).toHaveLength(4);
    expect(propertyInputs[0]?.attributes("disabled")).toBeDefined();
  });

  it("uses icon actions and resolves function-based toolbar permissions", () => {
    const iconConfig = defineTableConfig({
      ...config,
      table: { ...config.table, actionsAsIcons: true },
    });
    const handler = vi.fn();
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: iconConfig,
        data,
        getTableActions: () => ({
          create: async () => ({ success: true }),
        }),
        syncUrl: false,
        toolbarActions: [
          { id: "refresh", label: "Refresh", variant: "ghost", handler },
          {
            id: "locked",
            label: "Locked",
            disabled: () => true,
            handler,
          },
          {
            id: "hidden",
            label: "Hidden in icon mode",
            showInIconMode: false,
            handler,
          },
        ],
      },
    });
    expect(wrapper.get('[aria-label="Options"]').classes()).toContain(
      "yayaw-icon-only"
    );
    expect(wrapper.get('[aria-label="Export"]').text()).toBe("");
    expect(wrapper.get('[aria-label="Create"]').text()).toBe("");
    expect(wrapper.get('[aria-label="Refresh"]').text()).toBe("R");
    expect(wrapper.get('[aria-label="Refresh"]').classes()).toContain(
      "yayaw-button-ghost"
    );
    expect(
      wrapper.get('[aria-label="Locked"]').attributes("disabled")
    ).toBeDefined();
    expect(wrapper.find('[aria-label="Hidden in icon mode"]').exists()).toBe(
      false
    );
  });

  it("renders one row menu and applies row-level permissions", async () => {
    const rowConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        canDeleteRow: (row) => row.id !== "1",
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: rowConfig,
        data,
        getTableActions: () => ({
          update: async () => ({ success: true }),
          duplicate: async () => ({ success: true }),
          delete: async () => ({ success: true }),
        }),
        syncUrl: false,
      },
      attachTo: document.body,
      global: { stubs: { PopperContent: { template: "<div><slot /></div>" } } },
    });
    const triggers = wrapper.findAll('[aria-label="Open actions menu"]');
    expect(triggers).toHaveLength(3);
    await triggers[0]?.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(
      document.body.querySelector(".yayaw-row-actions-menu")?.textContent
    ).toContain("Edit");
    expect(
      document.body.querySelector(".yayaw-row-actions-menu")?.textContent
    ).toContain("Duplicate");
    const deleteAction = document.body.querySelector<HTMLButtonElement>(
      ".yayaw-row-action-danger"
    );
    expect(deleteAction?.textContent).toContain("Delete");
    expect(deleteAction?.disabled).toBe(true);
  });

  it("enforces global action permissions and avoids an empty action column", async () => {
    const restrictedConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        actionsAsIcons: true,
        allowCreate: false,
        allowEdit: false,
        allowDuplicate: false,
        allowDelete: false,
        allowBulkEdit: false,
        allowBulkDelete: false,
        export: false,
        bulkExport: false,
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: restrictedConfig,
        data,
        getTableActions: () => ({
          create: async () => ({ success: true }),
          update: async () => ({ success: true }),
          duplicate: async () => ({ success: true }),
          delete: async () => ({ success: true }),
          bulkDelete: async () => ({ success: true }),
          bulkUpdate: async () => ({ success: true }),
        }),
        syncUrl: false,
      },
    });
    expect(wrapper.find('[aria-label="Create"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Export"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="Open actions menu"]').exists()).toBe(
      false
    );
    expect(wrapper.find('th[aria-label="Actions"]').exists()).toBe(false);
    await wrapper.get('tbody input[type="checkbox"]').setValue(true);
    const bulkMenu = wrapper.get(".yayaw-bulk-menu-wrapper");
    expect(bulkMenu.find('[aria-label="Bulk edit"]').exists()).toBe(false);
    expect(bulkMenu.find('[aria-label="Delete"]').exists()).toBe(false);
    expect(bulkMenu.find('[aria-label="Export"]').exists()).toBe(false);
  });

  it("renders a floating bulk menu and resolves custom bulk permissions", async () => {
    const handler = vi.fn();
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config,
        data,
        syncUrl: false,
        customBulkActions: [
          {
            id: "archive",
            label: "Archive",
            disabled: ({ count }: { count: number }) => count < 2,
            handler,
          },
        ],
      },
    });
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    await checkboxes[0]?.setValue(true);
    expect(wrapper.find(".yayaw-bulk-menu-wrapper").exists()).toBe(true);
    expect(
      wrapper.get('[aria-label="Archive"]').attributes("disabled")
    ).toBeDefined();
    await checkboxes[1]?.setValue(true);
    expect(
      wrapper.get('[aria-label="Archive"]').attributes("disabled")
    ).toBeUndefined();
  });

  it("disables every structural table feature behind its flag", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      name: `Row ${index + 1}`,
      status: "Open",
      amount: index,
      active: true,
    }));
    const structuralConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        defaultPageSize: 2,
        density: "small",
        emptyState: { show: false },
        enableCalculations: false,
        enableColumnDragDropByDefault: false,
        enableColumnPinning: false,
        enableGrouping: false,
        enablePagination: false,
        enableRowSelection: false,
        enableSorting: false,
        showToolbar: false,
        showToolbarHeader: false,
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: structuralConfig,
        data: rows,
        syncUrl: false,
      },
    });
    await flushPromises();
    expect(wrapper.get(".yayaw-table").attributes("data-density")).toBe(
      "small"
    );
    expect(wrapper.find(".yayaw-header").exists()).toBe(false);
    expect(wrapper.find(".yayaw-toolbar").exists()).toBe(false);
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.find(".yayaw-pagination").exists()).toBe(false);
    expect(wrapper.find("tfoot").exists()).toBe(false);
    expect(wrapper.find("th.sortable").exists()).toBe(false);
    expect(wrapper.find(".yayaw-pin").exists()).toBe(false);
    expect(wrapper.findAll("tbody tr")).toHaveLength(12);
  });

  it("removes disabled features from Options and honors emptyState.show", async () => {
    const featureConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        emptyState: { show: false },
        enableCalculations: false,
        enableColumnFilters: false,
        enableGrouping: false,
        enableSorting: false,
        enableViews: false,
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: featureConfig,
        data: [],
        syncUrl: false,
      },
    });
    expect(wrapper.find('[aria-label="Views"]').exists()).toBe(false);
    expect(wrapper.find(".yayaw-empty").exists()).toBe(false);
    await wrapper.get('[aria-label="Options"]').trigger("click");
    const menuItems = wrapper
      .findAll(".yayaw-options-item")
      .map((item) => item.text());
    expect(menuItems).toHaveLength(1);
    expect(menuItems[0]).toContain("Properties");
  });

  it("enforces canEditRow for row clicks, inline edit, and Kanban drag", async () => {
    const editConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        allowEdit: true,
        allowInlineEdit: true,
        canEditRow: () => false,
        defaultDisplayMode: "table",
        enableRowClickEdit: true,
        inlineEdit: { enabled: true },
        kanban: { ...config.table.kanban, allowDragUpdate: true },
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: editConfig,
        data,
        getFormConfig: () => ({
          id: "test",
          fields: [{ name: "name", label: "Name", type: "text" }],
        }),
        getTableActions: () => ({
          update: async () => ({ success: true }),
        }),
        syncUrl: false,
      },
    });
    await wrapper.get("tbody .yayaw-cell").trigger("dblclick");
    expect(wrapper.find(".yayaw-inline-editor").exists()).toBe(false);
    await wrapper.get("tbody tr").trigger("click");
    expect(wrapper.find(".yayaw-dialog-backdrop").exists()).toBe(false);
    await wrapper
      .findAll(".yayaw-segmented button")
      .find((button) => button.text() === "kanban")
      ?.trigger("click");
    expect(wrapper.get(".yayaw-kanban-card").attributes("draggable")).toBe(
      "false"
    );
  });

  it("honors rowClickMode none and single-row selection", async () => {
    const interactionConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        enableMultiRowSelection: false,
        rowClickMode: "none",
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: interactionConfig,
        data,
        syncUrl: false,
      },
    });
    expect(wrapper.find('thead input[type="checkbox"]').exists()).toBe(false);
    await wrapper.get("tbody tr").trigger("click");
    expect(wrapper.emitted("rowActivate")).toBeUndefined();
    const checkboxes = wrapper.findAll('tbody input[type="checkbox"]');
    await checkboxes[0]?.setValue(true);
    await checkboxes[1]?.setValue(true);
    expect(wrapper.get(".yayaw-bulk-count").text()).toContain("1 selected");
  });

  it("separates view save and sharing permissions", async () => {
    const privateViewsConfig = defineTableConfig({
      ...config,
      table: {
        ...config.table,
        allowViewSave: true,
        allowViewSharing: false,
        enableViews: true,
      },
    });
    const wrapper = mount(YayawDataTable, {
      props: {
        tableType: "test",
        config: privateViewsConfig,
        data,
        syncUrl: false,
      },
    });
    await flushPromises();
    await wrapper.get('[aria-label="Add view"]').trigger("click");
    await flushPromises();
    const dialog = new DOMWrapper(document.body);
    expect(dialog.find(".yayaw-view-form").exists()).toBe(true);
    expect(dialog.get(".yayaw-view-form").text()).not.toContain(
      "Share with team"
    );
    wrapper.unmount();
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
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, pageSize: 1 })
    );
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
      global: { stubs: { DialogPortal: { template: "<div><slot /></div>" } } },
      attachTo: document.body,
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
    expect(
      wrapper.get('[data-field-name="value"] input').attributes("type")
    ).toBe("text");
    expect(
      (
        wrapper.get('[data-field-name="value"] input')
          .element as HTMLInputElement
      ).value
    ).toBe("hello");
    await wrapper.get('[data-field-name="kind"] select').setValue("number");
    await nextTick();
    expect(
      wrapper.get('[data-field-name="value"] input').attributes("type")
    ).toBe("number");
    expect(getFormConfig).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({ tableId: "test", tableType: "test" })
    );
    wrapper.unmount();
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
