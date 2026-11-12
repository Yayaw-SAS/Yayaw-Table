import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import YayawDataTable from "./components/YayawDataTable.vue";
import { defineTableConfig } from "./config";
import type { TableActions, TableViewRequest } from "./types";

enableAutoUnmount(afterEach);
const settle = async (ms = 60) => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await flushPromises();
};
const config = (table: Record<string, unknown> = {}) =>
  defineTableConfig({
    id: "pages",
    columns: {
      definitions: [
        { id: "title", header: "Title", type: "text" },
        { id: "status", header: "Status", type: "text" },
      ],
      order: ["title", "status"],
      visible: ["title", "status"],
      mandatory: ["title"],
    },
    table: { displayModes: ["table", "list", "kanban"], ...table } as never,
    translations: { namespace: "pages", keys: { title: "Pages" } },
  });
const actions = () =>
  ({
    list: () => Promise.resolve({ data: [{ id: "1", title: "Home" }] }),
    create: () => Promise.resolve({ id: "2" }),
  }) as unknown as TableActions;
const table = (
  tableConfig: ReturnType<typeof config>,
  more: Record<string, unknown> = {}
) =>
  mount(YayawDataTable, {
    props: {
      tableType: "pages",
      config: tableConfig,
      syncUrl: false,
      getTableActions: actions,
      ...more,
    },
    attachTo: document.body,
  });

it("shows the display modes as a pressed-state segmented control beside the filters", async () => {
  const wrapper = table(config());
  await settle();
  const group = wrapper.get(
    "[data-toolbar-filter-row] fieldset[data-display-mode-switch]"
  );
  const segments = group.findAll("button[data-layout]");
  expect(segments.map((segment) => segment.attributes("data-layout"))).toEqual([
    "table",
    "list",
    "kanban",
  ]);
  expect(segments.map((segment) => segment.text())).toEqual([
    "Table",
    "List",
    "Kanban",
  ]);
  expect(segments.at(0)?.attributes("aria-pressed")).toBe("true");
  await segments.at(2)?.trigger("click");
  await settle();
  expect(
    group.findAll('[aria-pressed="true"]').map((item) => item.text())
  ).toEqual(["Kanban"]);
});

it("hides the switch for a single mode or when the host opts out", async () => {
  const single = table(config({ displayModes: ["table"] }));
  await settle();
  expect(single.find("[data-display-mode-switch]").exists()).toBe(false);
  single.unmount();
  const off = table(config({ displayModeSwitch: false }));
  await settle();
  expect(off.find("[data-display-mode-switch]").exists()).toBe(false);
});

it("keeps the host's create label when the other toolbar actions are icons", async () => {
  const icons = table(config({ actionsAsIcons: true, enableCreate: true }));
  await settle();
  expect(icons.get("[data-toolbar-create]").text()).toBe("");
  icons.unmount();
  const labelled = table(
    config({
      actionsAsIcons: true,
      enableCreate: true,
      createLabel: "New page",
    })
  );
  await settle();
  const create = labelled.get("[data-toolbar-create]");
  expect(create.text()).toBe("New page");
  expect(create.attributes("aria-label")).toBe("New page");
});

it("applies a view request once per key, over the view the table shows", async () => {
  const views: Record<string, unknown>[] = [];
  const wrapper = table(config(), {
    onViewConfigChange: (view: Record<string, unknown>) => views.push(view),
  });
  await settle();
  const request: TableViewRequest = {
    key: 1,
    config: {
      advancedFilters: [
        {
          id: "drafts",
          columnId: "status",
          operator: "contains",
          values: ["draft"],
        },
      ],
    } as never,
  };
  await wrapper.setProps({ viewRequest: request });
  await settle();
  const shown = views.at(-1)?.advancedFilters as { columnId: string }[];
  expect(shown.map((rule) => rule.columnId)).toEqual(["status"]);
  const count = views.length;
  // The same key again changes nothing.
  await wrapper.setProps({ viewRequest: { ...request } });
  await settle();
  expect(views.length).toBe(count);
});
