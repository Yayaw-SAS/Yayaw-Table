import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createAssetActions } from "../../../../examples/assets";
import { aggregateChartRows, type ChartAggregateRequest } from "../chart-model";
import { defineTableConfig } from "../config";
import type { DashboardSetFilterResult } from "../dashboard/dashboard-model";
import type { DashboardBlockRegistry } from "../dashboard/dashboard-types";
import YayawDashboard from "../dashboard/YayawDashboard.vue";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../table-contracts";
import type { TableActions } from "../types";
import YayawDataTable from "./YayawDataTable.vue";

type Row = Record<string, unknown>;

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});
const settle = async (frames = 4) => {
  for (let frame = 0; frame < frames; frame += 1) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  await flushPromises();
};

const ROWS: Row[] = [
  { id: "1", name: "Alpha", category: "software", tags: ["new"] },
  { id: "2", name: "Bravo", category: "hardware", tags: ["new", "sale"] },
  { id: "3", name: "Charlie", category: "software", tags: [] },
  { id: "4", name: "Delta", category: "", tags: ["sale"] },
];
const matches = (row: Row, params: Row) => {
  const query = compatibleListParams(params);
  return (query.advancedFilters as Row[]).every((rule) =>
    matchesContractFilter(row[String(rule.columnId)], rule)
  );
};
const productsConfig = defineTableConfig({
  id: "facet-products",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      {
        id: "category",
        header: "Category",
        type: "select",
        options: [
          { value: "software", label: "Software" },
          { value: "hardware", label: "Hardware" },
        ],
      },
      {
        id: "tags",
        header: "Tags",
        type: "multiSelect",
        options: [
          { value: "new", label: "New" },
          { value: "sale", label: "On sale" },
        ],
      },
    ],
    order: ["name", "category", "tags"],
    visible: ["name", "category", "tags"],
    mandatory: ["name"],
  },
  table: {
    syncUrl: false,
    enableViews: false,
    facets: { columns: ["category", "tags"] },
  },
  translations: { namespace: "facet-products", keys: { title: "Products" } },
});

it("lists each value with its records and filters on click, the counts leaving the facet's own rule out", async () => {
  const lists: Row[] = [];
  const aggregates: Row[] = [];
  const actions = {
    list: (params: Row) => {
      lists.push(params);
      const data = ROWS.filter((row) => matches(row, params));
      return Promise.resolve({
        data,
        meta: { pageCount: 1, totalCount: data.length },
      });
    },
    aggregate: (params: Row) => {
      aggregates.push(params);
      return Promise.resolve(
        aggregateChartRows(
          ROWS.filter((row) => matches(row, params)),
          params as unknown as ChartAggregateRequest
        )
      );
    },
  } as unknown as TableActions;
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      tableType: "facet-products",
      config: productsConfig,
      getTableActions: () => actions,
      getRowId: (row: Row) => String(row.id),
    },
  });
  await settle();
  const panel = wrapper.find("[data-facet-panel]");
  expect(panel.exists()).toBe(true);
  expect(panel.attributes("data-position")).toBe("left");
  const counts = (facet: string) =>
    wrapper
      .findAll(`[data-facet="${facet}"] button[data-facet-value]`)
      .map((button) => [
        button.attributes("data-facet-value"),
        button.find("[data-facet-count]").text(),
        button.attributes("aria-pressed"),
      ]);
  expect(counts("category")).toEqual([
    ["software", "2", "false"],
    ["hardware", "1", "false"],
    ["", "1", "false"],
  ]);
  expect(counts("tags")).toEqual([
    ["new", "2", "false"],
    ["sale", "2", "false"],
    ["", "1", "false"],
  ]);
  expect(aggregates.map((params) => params.groupBy)).toContainEqual([
    { columnId: "category" },
  ]);
  aggregates.length = 0;
  await wrapper
    .find('[data-facet="category"] button[data-facet-value="software"]')
    .trigger("click");
  await settle();
  const rule = ((lists.at(-1)?.advancedFilters ?? []) as Row[]).find(
    (item) => item.columnId === "category"
  );
  expect([rule?.type, rule?.operator, rule?.values]).toEqual([
    "select",
    "isAnyOf",
    ["software"],
  ]);
  expect(wrapper.text()).toContain("Charlie");
  expect(wrapper.text()).not.toContain("Bravo");
  const byColumn = (columnId: string) =>
    aggregates.find(
      (params) =>
        (params.groupBy as { columnId: string }[])[0]?.columnId === columnId
    );
  expect(byColumn("category")?.advancedFilters).toEqual([]);
  expect(
    (byColumn("tags")?.advancedFilters as Row[]).map((item) => item.columnId)
  ).toEqual(["category"]);
  expect(counts("category")[0]).toEqual(["software", "2", "true"]);
  expect(counts("tags")).toEqual([
    ["new", "1", "false"],
    ["", "1", "false"],
  ]);
  await wrapper
    .find('[data-facet="tags"] button[data-facet-value="new"]')
    .trigger("click");
  await settle();
  const tags = ((lists.at(-1)?.advancedFilters ?? []) as Row[]).find(
    (item) => item.columnId === "tags"
  );
  expect([tags?.type, tags?.operator, tags?.values]).toEqual([
    "multiSelect",
    "contains",
    ["new"],
  ]);
  await wrapper.find("[data-facet-clear-all]").trigger("click");
  await settle();
  expect(wrapper.text()).toContain("Bravo");
  expect(
    wrapper.findAll('[data-facet-panel] [aria-pressed="true"]')
  ).toHaveLength(0);
  const toggle = wrapper.find("[data-facets-toggle]");
  expect(toggle.attributes("aria-pressed")).toBe("true");
  await toggle.trigger("click");
  await settle(1);
  expect(wrapper.find("[data-facet-panel]").exists()).toBe(false);
  expect(wrapper.find("[data-facets-toggle]").attributes("aria-pressed")).toBe(
    "false"
  );
});

it("offers New folder outside the File tree and creates the folder under the chosen parent", async () => {
  const actions = createAssetActions();
  const created: Row[] = [];
  const createFolder = actions.tree.createFolder;
  actions.tree.createFolder = (input) => {
    created.push(input);
    return createFolder(input);
  };
  const config = defineTableConfig({
    id: "facet-assets",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "kind",
          header: "Kind",
          type: "select",
          options: [
            { value: "folder", label: "Folder" },
            { value: "file", label: "File" },
          ],
        },
        { id: "parentId", header: "Folder", type: "text" },
      ],
      order: ["name", "kind", "parentId"],
      visible: ["name", "kind"],
      mandatory: ["name"],
    },
    table: {
      syncUrl: false,
      enableViews: false,
      defaultDisplayMode: "gallery",
      displayModes: ["filetree", "gallery", "table"],
      filetree: { parentColumn: "parentId", kindColumn: "kind" },
    },
    translations: { namespace: "facet-assets", keys: { title: "Assets" } },
  });
  const wrapper = mount(YayawDataTable, {
    attachTo: document.body,
    props: {
      tableType: "facet-assets",
      config,
      getTableActions: () => actions as unknown as TableActions,
      getRowId: (row: Row) => String(row.id),
    },
  });
  await settle();
  const button = wrapper.find("[data-new-folder]");
  expect(button.text()).toContain("New folder");
  await button.trigger("click");
  await settle();
  const dialog = document.querySelector("[data-new-folder-dialog]");
  expect(dialog).not.toBeNull();
  expect(
    dialog?.querySelector("[data-folder-root]")?.getAttribute("aria-pressed")
  ).toBe("true");
  const spring = dialog?.querySelector<HTMLButtonElement>(
    '[data-folder-option="f-spring"]'
  );
  expect(spring?.textContent).toContain("Campaigns › 2026");
  spring?.click();
  await settle(1);
  const name = dialog?.querySelector<HTMLInputElement>(
    "[data-new-folder-name]"
  );
  if (name) {
    name.value = "  Summer  ";
    name.dispatchEvent(new Event("input", { bubbles: true }));
  }
  await settle(1);
  dialog?.querySelector<HTMLButtonElement>("[data-new-folder-create]")?.click();
  await settle();
  expect(created).toEqual([{ parentId: "f-spring", name: "Summer" }]);
  expect(document.querySelector("[data-new-folder-dialog]")).toBeNull();
});

it("lets blocks set a screen filter as the filter bar does, and refuses values it cannot take", async () => {
  const results: DashboardSetFilterResult[] = [];
  const rules: unknown[] = [];
  const TagBlock = defineComponent({
    props: {
      setFilter: { type: Function, required: true },
      filterRules: { type: Function, required: true },
    },
    setup(props) {
      return () => {
        rules.push(props.filterRules("pages", { exclude: ["tag"] }));
        const set =
          (value: unknown, filterId = "tag") =>
          () =>
            results.push(
              props.setFilter(filterId, value) as DashboardSetFilterResult
            );
        return h("div", [
          h(
            "button",
            { type: "button", "data-set": "news", onClick: set(["news"]) },
            "News"
          ),
          h(
            "button",
            { type: "button", "data-set": "wrong", onClick: set({ a: 1 }) },
            "Wrong"
          ),
          h(
            "button",
            {
              type: "button",
              "data-set": "missing",
              onClick: set(["x"], "nope"),
            },
            "Missing"
          ),
        ]);
      };
    },
  });
  const blocks: DashboardBlockRegistry = { tags: { component: TagBlock } };
  const screen = {
    version: 2,
    id: "screen",
    name: "Screen",
    sections: [{ id: "page", type: "flow", widgetIds: ["tags"] }],
    widgets: [{ id: "tags", type: "block", block: "tags", settings: {} }],
    filters: [
      {
        id: "tag",
        type: "select",
        label: "Tag",
        targets: [{ tableId: "pages", columnId: "tags" }],
      },
      {
        id: "author",
        type: "select",
        label: "Author",
        targets: [{ tableId: "pages", columnId: "author" }],
        value: ["Ada"],
      },
    ],
  };
  const wrapper = mount(YayawDashboard, {
    attachTo: document.body,
    props: { blocks, dashboard: screen },
  });
  await settle(2);
  expect(
    (rules.at(-1) as Row[]).map((rule) => [rule.columnId, rule.values])
  ).toEqual([["author", ["Ada"]]]);
  await wrapper.find('[data-set="news"]').trigger("click");
  await settle(2);
  expect(results.at(-1)).toEqual({ ok: true, value: ["news"] });
  expect(
    new URL(window.location.href).searchParams.getAll("screen.tag")
  ).toEqual(["news"]);
  await wrapper.find('[data-set="wrong"]').trigger("click");
  expect(results.at(-1)).toMatchObject({ ok: false, code: "invalidValue" });
  await wrapper.find('[data-set="missing"]').trigger("click");
  expect(results.at(-1)).toMatchObject({ ok: false, code: "unknownFilter" });
  expect(
    new URL(window.location.href).searchParams.getAll("screen.tag")
  ).toEqual(["news"]);
});
