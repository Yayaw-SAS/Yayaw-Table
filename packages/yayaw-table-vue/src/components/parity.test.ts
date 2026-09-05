import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { h } from "vue";
import { defineTableConfig } from "../config";
import type { TableActions, TableView } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) {
    wrapper.unmount();
  }
  vi.useRealTimers();
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});
const data = [
  { id: "one", name: "Alpha", status: "Open", amount: 10 },
  { id: "two", name: "Beta", status: "Closed", amount: 20 },
  { id: "three", name: "Gamma", status: "Open", amount: 30 },
];
const config = defineTableConfig({
  id: "parity",
  translations: { namespace: "parity", keys: {} },
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text", inlineEdit: true },
      { id: "status", header: "Status", type: "text" },
      {
        id: "amount",
        header: "Amount",
        type: "number",
        defaultCalculation: "sum",
        cellRenderer: (value) => h("em", `Custom ${value}`),
      },
    ],
    mandatory: [],
    visible: ["name", "status", "amount"],
    order: ["name", "status", "amount"],
  },
  table: {
    displayModes: ["table", "kanban", "gallery"],
    defaultPageSize: 2,
    pageSizeOptions: [2, 10],
    gallery: { titleColumn: "name" },
    kanban: { groupBy: "status", titleColumn: "name", allowDragUpdate: true },
    enableCalculations: true,
    allowInlineEdit: true,
    inlineEdit: { enabled: true, debounceMs: 50 },
    showClearFilters: true,
  },
});
function create(
  input: {
    mode?: "table" | "gallery" | "kanban";
    actions?: TableActions;
    views?: TableView[];
    active?: string;
    config?: typeof config;
    data?: typeof data;
  } = {}
) {
  const resolvedConfig = input.config ?? config;
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      config: defineTableConfig({
        ...resolvedConfig,
        table: {
          ...resolvedConfig.table,
          defaultDisplayMode: input.mode ?? "table",
        },
      }),
      tableType: "parity",
      data: (input.data ?? data).map((row) => ({ ...row })),
      getTableActions: () => input.actions,
      initialViews: input.views,
      initialActiveViewId: input.active,
      syncUrl: false,
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

it.each([
  "gallery",
  "kanban",
] as const)("paginates local %s cards and uses custom property renderers", async (mode) => {
  const wrapper = create({ mode });
  await flushPromises();
  expect(wrapper.findAll("article")).toHaveLength(2);
  expect(wrapper.text()).not.toContain("Gamma");
  expect(wrapper.find("article em").text()).toContain("Custom");
  await wrapper.findAll(".yayaw-pagination button").at(-1)?.trigger("click");
  expect(wrapper.findAll("article")).toHaveLength(1);
  expect(wrapper.find("article").text()).toContain("Gamma");
});

it.each([
  "table",
  "gallery",
] as const)("hides %s pagination when all rows fit on one page", async (mode) => {
  const wrapper = create({ mode });
  await flushPromises();
  await wrapper.get(".yayaw-pagination select").setValue("10");
  expect(wrapper.find(".yayaw-pagination").exists()).toBe(false);
});

it("loads the next server card page using both list parameter contracts", async () => {
  const list = vi.fn(
    async (params: Parameters<NonNullable<TableActions["list"]>>[0]) => ({
      data: data.slice(
        (params.page - 1) * params.pageSize,
        params.page * params.pageSize
      ),
      meta: { totalCount: 3, pageCount: 2 },
    })
  );
  const wrapper = create({ mode: "gallery", actions: { list } });
  await flushPromises();
  await wrapper.findAll(".yayaw-pagination button").at(-1)?.trigger("click");
  await flushPromises();
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2, limit: 2, pageSize: 2 })
  );
  expect(wrapper.findAll("article")).toHaveLength(1);
  expect(wrapper.find("article").text()).toContain("Gamma");
});

it("rolls a failed Kanban move back and shares the toolbar grouping", async () => {
  const wrapper = create({
    mode: "kanban",
    actions: {
      update: () => Promise.reject(new Error("Move rejected")),
    },
  });
  await flushPromises();
  await wrapper.get("article").trigger("dragstart");
  const closed = wrapper
    .findAll(".yayaw-kanban-lane")
    .find((lane) => lane.text().includes("Closed"));
  await closed?.trigger("drop");
  await flushPromises();
  expect(wrapper.get('.yayaw-status[data-type="error"]').text()).toContain(
    "Move rejected"
  );
  expect(
    wrapper
      .findAll(".yayaw-kanban-lane")
      .find((lane) => lane.text().includes("Open"))
      ?.text()
  ).toContain("Alpha");
  await wrapper.get(".yayaw-card-controls select").setValue("name");
  expect(
    wrapper
      .findAll(".yayaw-kanban-lane")
      .map((lane) => lane.find("header strong").text())
  ).toEqual(["Alpha", "Beta"]);
});

it("moves Kanban cards without a pointer", async () => {
  const update = vi.fn(async () => ({ success: true }));
  const wrapper = create({
    mode: "kanban",
    actions: { update },
  });
  await flushPromises();
  await wrapper
    .get('button[aria-label="Move Alpha to Closed"]')
    .trigger("click");
  await flushPromises();
  expect(update).toHaveBeenCalledWith("one", { status: "Closed" });
});

it.each([
  "kanban",
  "gallery",
] as const)("renders the configured empty state in %s mode", async (mode) => {
  const wrapper = create({
    mode,
    data: [],
    config: defineTableConfig({
      ...config,
      table: {
        ...config.table,
        emptyState: {
          description: "Create the first row",
          title: "Nothing here",
        },
      },
    }),
  });
  await flushPromises();
  expect(wrapper.get(".yayaw-card-empty").text()).toContain("Nothing here");
  expect(wrapper.get(".yayaw-card-empty").text()).toContain(
    "Create the first row"
  );
});

it("renders structured server aggregate labels", async () => {
  const wrapper = create({
    actions: {
      list: async () => ({ data, meta: { totalCount: 3, pageCount: 1 } }),
      aggregate: async () => ({
        results: { amount: { raw: 60, label: "60 euros" } },
      }),
    },
  });
  await flushPromises();
  expect(wrapper.text()).toContain("60 euros");
  expect(wrapper.text()).not.toContain("[object Object]");
});

it("honors default and system views, and reports failed saves without closing the form", async () => {
  const wrapper = create({
    views: [
      {
        id: "system",
        tableId: "parity",
        name: "Only Beta",
        isDefault: true,
        isSystem: true,
        config: { globalSearch: "Beta" },
      },
    ],
    actions: {
      views: {
        list: async () => [],
        create: () => Promise.reject(new Error("View rejected")),
      },
    },
  });
  await flushPromises();
  expect(wrapper.get('input[type="search"]').element).toHaveProperty(
    "value",
    "Beta"
  );
  expect(wrapper.find('button[title="Delete view"]').exists()).toBe(false);
  await wrapper.get('[aria-label="Add view"]').trigger("click");
  await flushPromises();
  const dialog = new DOMWrapper(document.body);
  await dialog.get('input[placeholder="Enter a view name"]').setValue("Mine");
  await dialog.get(".yayaw-view-form").trigger("submit");
  await flushPromises();
  expect(dialog.get('.yayaw-view-form [role="alert"]').text()).toContain(
    "View rejected"
  );
  expect(dialog.find(".yayaw-view-form").exists()).toBe(true);
  expect(
    dialog.get('.yayaw-view-form button[type="submit"]').attributes("disabled")
  ).toBeUndefined();
});

it("autosaves inline drafts after the configured delay and cancels on Escape", async () => {
  vi.useFakeTimers();
  const update = vi.fn(async () => ({ success: true }));
  const wrapper = create({ actions: { update } });
  await flushPromises();
  const cell = wrapper
    .findAll("tbody .yayaw-cell")
    .find((item) => item.text() === "Alpha");
  if (!cell) {
    throw new Error("Missing editable cell");
  }
  await cell.trigger("dblclick");
  await cell.get("input").setValue("Changed");
  await vi.advanceTimersByTimeAsync(49);
  expect(update).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await flushPromises();
  expect(update).toHaveBeenCalledWith("one", { name: "Changed" });
  await cell.get("input").setValue("Discarded");
  await cell.trigger("keydown", { key: "Escape" });
  await vi.advanceTimersByTimeAsync(100);
  expect(update).toHaveBeenCalledTimes(1);
});
