import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { defineTableConfig } from "../../config";
import type { TablePlanningConfig } from "../../planning/types";
import type { TableActions, TableRecord } from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

enableAutoUnmount(() => undefined);

const rows: TableRecord[] = [
  { id: "a", name: "Design", start: "2026-09-14", end: "2026-09-16" },
];
const actions: TableActions = {
  list: () =>
    Promise.resolve({ data: rows, meta: { pageCount: 1, totalCount: 1 } }),
  update: () => Promise.resolve({ success: true }),
};

const renderGrid = async (planning: Partial<TablePlanningConfig>) => {
  const config = defineTableConfig({
    id: "planning-grid",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "start", header: "Start", type: "date" },
        { id: "end", header: "End", type: "date" },
      ],
      mandatory: ["name"],
      order: ["name", "start", "end"],
      visible: ["name", "start", "end"],
    },
    table: {
      displayModes: ["table", "gantt"],
      planning: {
        enabled: true,
        scopeId: "planning-grid",
        sourceId: "tasks",
        ...planning,
      },
      gantt: { titleColumn: "name", startColumn: "start", endColumn: "end" },
    },
    translations: { namespace: "planning-grid", keys: {} },
  });
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "planning-grid",
      getTableConfig: () => config,
      getTableActions: () => actions,
    },
    attachTo: document.body,
  });
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await flushPromises();
  return wrapper;
};

it("opens an editable planning's task dialog from the first cell", async () => {
  const wrapper = await renderGrid({});
  expect(wrapper.find('button[aria-label="Planning"]').exists()).toBe(true);
});

it("gives a read-only planning no task dialog button in the grid", async () => {
  const wrapper = await renderGrid({
    allowDateEdit: false,
    allowHierarchyEdit: false,
    allowDependencyEdit: false,
  });
  expect(wrapper.text()).toContain("Design");
  expect(wrapper.find('button[aria-label="Planning"]').exists()).toBe(false);
});
