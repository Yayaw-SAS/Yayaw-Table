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

it("titles bars with the first visible data column by default", async () => {
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "gantt-title",
      getTableActions: () => ({
        list: () =>
          Promise.resolve({
            data: rows.map((row) => ({ ...row, code: `T-${row.id}` })),
            meta: { pageCount: 1, totalCount: rows.length },
          }),
      }),
      getTableConfig: () =>
        defineTableConfig({
          ...config,
          id: "gantt-title",
          columns: {
            ...config.columns,
            definitions: [
              { id: "code", header: "Code", type: "text" },
              ...config.columns.definitions,
            ],
            order: ["select", "code", "name", "start", "end"],
            visible: ["name", "start", "end"],
          },
          table: {
            ...config.table,
            planning: {
              enabled: true,
              scopeId: "gantt-title",
              sourceId: "tasks",
            },
            gantt: {
              startColumn: "start",
              endColumn: "end",
              parentColumn: "parentId",
            },
          },
          translations: { namespace: "gantt-title", keys: {} },
        }),
    },
    attachTo: document.body,
  });
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await flushPromises();
  try {
    const label = wrapper.get(".yayaw-gantt-bar-body").attributes("aria-label");
    expect(label).toContain("Design");
    expect(label).not.toContain("T-a");
  } finally {
    wrapper.unmount();
  }
});

it("groups the timeline by the first grouping level and collapses a group", async () => {
  // A second level is ignored, as in List.
  window.history.replaceState(
    {},
    "",
    `/?gantt-group-grouping=${encodeURIComponent(JSON.stringify(["team", "name"]))}`
  );
  const teams = ["Product", null, "Product"];
  const data = [
    ...rows,
    {
      id: "c",
      name: "Ship",
      start: "2026-09-22",
      end: "2026-09-23",
      parentId: null,
    },
  ].map((row, index) => ({ ...row, team: teams[index] }));
  const wrapper = mount(YayawDataTable, {
    props: {
      tableType: "gantt-group",
      getTableActions: () => ({
        list: () =>
          Promise.resolve({
            data,
            meta: { pageCount: 1, totalCount: data.length },
          }),
      }),
      getTableConfig: () =>
        defineTableConfig({
          ...config,
          id: "gantt-group",
          columns: {
            ...config.columns,
            definitions: [
              ...config.columns.definitions,
              { id: "team", header: "Team", type: "text" },
            ],
          },
          table: {
            ...config.table,
            enableGrouping: true,
            planning: {
              enabled: true,
              scopeId: "gantt-group",
              sourceId: "tasks",
            },
          },
          translations: { namespace: "gantt-group", keys: {} },
        }),
    },
    attachTo: document.body,
  });
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 40));
  await flushPromises();
  const headings = () =>
    wrapper
      .findAll('button[aria-label*="Team: "]')
      .map(
        (button) =>
          `${button.attributes("aria-label")} ${button.attributes("aria-expanded")}`
      );
  try {
    expect(headings()).toEqual([
      "Collapse Team: Product true",
      "Collapse Team: No value true",
    ]);
    expect(wrapper.findAll(".yayaw-gantt-bar")).toHaveLength(3);
    await wrapper
      .get('button[aria-label="Collapse Team: Product"]')
      .trigger("click");
    expect(headings()[0]).toBe("Expand Team: Product false");
    // The heading keeps its count while its tasks are hidden.
    expect(wrapper.get(".yayaw-gantt-row.group .yayaw-count").text()).toBe("2");
    expect(wrapper.findAll(".yayaw-gantt-bar")).toHaveLength(1);
  } finally {
    wrapper.unmount();
    window.history.replaceState({}, "", "/");
  }
});
