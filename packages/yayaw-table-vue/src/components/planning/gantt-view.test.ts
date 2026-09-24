import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { defineTableConfig } from "../../config";
import type { TableActions, TableRecord } from "../../types";
import YayawDataTable from "../YayawDataTable.vue";

enableAutoUnmount(() => undefined);

const rows: TableRecord[] = [
  {
    id: "a",
    name: "Design",
    start: "2026-09-14",
    end: "2026-09-16",
    parentId: null,
  },
  {
    id: "b",
    name: "Build",
    start: "2026-09-17",
    end: "2026-09-21",
    parentId: null,
  },
];

const config = defineTableConfig({
  id: "gantt-vue",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "start", header: "Start", type: "date" },
      { id: "end", header: "End", type: "date" },
    ],
    mandatory: ["name"],
    order: ["select", "name", "start", "end"],
    visible: ["name", "start", "end"],
  },
  table: {
    defaultDisplayMode: "gantt",
    displayModes: ["table", "gantt"],
    enableRowSelection: true,
    planning: { enabled: true, scopeId: "gantt-vue", sourceId: "tasks" },
    gantt: {
      titleColumn: "name",
      startColumn: "start",
      endColumn: "end",
      parentColumn: "parentId",
    },
  },
  translations: { namespace: "gantt-vue", keys: { title: "Gantt" } },
});

/** Only the list/update actions any table already has — no planning adapter. */
const actions: TableActions = {
  list: () =>
    Promise.resolve({
      data: rows,
      meta: { pageCount: 1, totalCount: rows.length },
    }),
  update: () => Promise.resolve({ success: true }),
};

const renderGantt = async () => {
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "gantt-vue",
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

it("derives a timeline from the table's own rows", async () => {
  const wrapper = await renderGantt();
  try {
    expect(wrapper.find("section.yayaw-gantt").exists()).toBe(true);
    expect(wrapper.findAll(".yayaw-gantt-bar")).toHaveLength(2);
    expect(wrapper.text()).toContain("Design");
  } finally {
    wrapper.unmount();
  }
});

it("puts the table's selection cells in the timeline's own column", async () => {
  const wrapper = await renderGantt();
  try {
    expect(wrapper.findAll(".yayaw-gantt-select").length).toBeGreaterThan(0);
  } finally {
    wrapper.unmount();
  }
});

it("labels every bar with its interval so a move is announced", async () => {
  const wrapper = await renderGantt();
  try {
    const bars = wrapper.findAll(".yayaw-gantt-bar-body");
    expect(bars).toHaveLength(2);
    // Days read as the table shows the start and end columns.
    expect(bars[0]?.attributes("aria-label")).toContain("9/14/26 – 9/16/26");
  } finally {
    wrapper.unmount();
  }
});
