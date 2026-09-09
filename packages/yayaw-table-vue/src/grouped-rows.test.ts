import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import rows from "../../../tests/fixtures/grouped-rows.json";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";

enableAutoUnmount(afterEach);
beforeEach(() => window.history.replaceState({}, "", "/"));

async function mountGroups(grouping = ["category"], selection = true) {
  window.history.replaceState(
    {},
    "",
    `/?grouped-grouping=${encodeURIComponent(JSON.stringify(grouping))}`
  );
  const config = defineTableConfig({
    id: "grouped",
    columns: {
      mandatory: ["name"],
      definitions: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "category",
          header: "Category",
          type: "select",
          accessorFn: (row) => row.kind,
          options: [
            { value: 0, label: "Web" },
            { value: 1, label: "Print" },
          ],
          inlineEdit: true,
        },
        { id: "active", header: "Active", type: "boolean" },
        {
          id: "country",
          header: "Country",
          type: "select",
          options: [{ value: 1, label: "France" }],
        },
        {
          id: "amount",
          header: "Amount",
          type: "number",
          enableGrouping: false,
        },
      ],
      visible: ["name", "category", "active", "country", "amount"],
      order: ["select", "name", "category", "active", "country", "amount"],
    },
    table: {
      enableGrouping: true,
      enablePagination: false,
      enableRowSelection: selection,
      canSelectRow: (row) => row.id !== "2",
      preserveSelectionOnQuery: true,
    },
    translations: { namespace: "grouped", keys: {} },
  });
  const onRowClick = vi.fn();
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "grouped",
      config,
      data: rows,
      onRowClick,
      rowSelection: { elsewhere: true },
    },
  });
  await flushPromises();
  return { wrapper, onRowClick };
}

it("renders accessor option labels without automatic category sums and preserves expanded cell values", async () => {
  const { wrapper, onRowClick } = await mountGroups();
  const groups = wrapper.findAll("tbody tr.grouped");
  expect(groups).toHaveLength(2);
  expect(groups[0]?.text()).toContain("Category:Web3");
  expect(groups[0]?.findAll("td")).toHaveLength(2);
  expect(groups[0]?.text()).not.toContain("France");
  await groups[0]?.get("button[aria-expanded]").trigger("click");
  expect(wrapper.findAll("tbody tr:not(.grouped)")).toHaveLength(1);
  await groups[0]?.get("button[aria-expanded]").trigger("click");
  expect(wrapper.findAll("tbody tr:not(.grouped)")).toHaveLength(4);
  for (const leaf of wrapper.findAll("tbody tr:not(.grouped)").slice(0, 3)) {
    expect(leaf.text()).toContain("Web");
    expect(leaf.text()).toContain("France");
  }
  expect(onRowClick).not.toHaveBeenCalled();
  expect(wrapper.find("tbody tr.grouped [contenteditable]").exists()).toBe(
    false
  );
});

it("counts and selects permitted leaf records at two levels while retaining off-page selection", async () => {
  const { wrapper } = await mountGroups(["category", "active"]);
  const group = wrapper.get("tbody tr.grouped");
  expect(group.text()).toContain("Web3");
  expect(wrapper.text()).toContain("Active:false2");
  await group.get('input[type="checkbox"]').setValue(true);
  expect(wrapper.emitted("rowSelectionChange")?.at(-1)?.[0]).toEqual({
    elsewhere: true,
    "1": true,
    "3": true,
  });
  await group.get('input[type="checkbox"]').setValue(false);
  expect(wrapper.emitted("rowSelectionChange")?.at(-1)?.[0]).toEqual({
    elsewhere: true,
  });
});

it("spans the visible columns without a phantom checkbox when selection is disabled", async () => {
  const { wrapper } = await mountGroups(["category"], false);
  const group = wrapper.get("tbody tr.grouped");
  expect(group.find('input[type="checkbox"]').exists()).toBe(false);
  expect(group.findAll("td")).toHaveLength(1);
  expect(group.get("td").attributes("colspan")).toBe(
    String(wrapper.findAll("thead th").length)
  );
});
