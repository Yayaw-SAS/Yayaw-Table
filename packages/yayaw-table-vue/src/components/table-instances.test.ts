import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import viewChange from "../../../../tests/fixtures/view-config-change.json";
import { defineTableConfig } from "../config";
import type {
  TableListParams,
  TableRecord,
  TableViewConfig,
  ToolbarActionContext,
} from "../types";
import type { ViewConfig } from "../view-config";
import YayawDataTable from "./YayawDataTable.vue";

const rows: TableRecord[] = [
  { id: "1", name: "Alpha", status: "Open" },
  { id: "2", name: "Beta", status: "Closed" },
  { id: "3", name: "Gamma", status: "Open" },
];
const config = defineTableConfig({
  id: "test",
  columns: {
    definitions: [
      { id: "name", header: "Name", type: "text" },
      { id: "status", header: "Status", type: "text" },
    ],
    mandatory: ["name"],
    order: ["name", "status"],
    visible: ["name", "status"],
  },
  translations: { namespace: "test", keys: { title: "Test rows" } },
});
const onlyStatus = (
  id: string,
  status: string
): { id: string; config: TableViewConfig } => ({
  id,
  config: {
    advancedFilters: [
      {
        id: `only-${status}`,
        columnId: "status",
        type: "text",
        operator: "isAnyOf",
        values: [status],
        isActive: true,
      },
    ] as TableViewConfig["advancedFilters"],
  },
});
const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 80));
  await flushPromises();
};

enableAutoUnmount((unmount) =>
  afterEach(() => {
    unmount();
    document.body.replaceChildren();
  })
);

describe("table instances on one page", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("scopes the URL keys of each instance, the shared ones included", async () => {
    window.history.replaceState({}, "", "/?right-q=Beta&test-q=Gamma");
    const Page = defineComponent(() => () => [
      h("section", { "data-instance": "left" }, [
        h(YayawDataTable, {
          tableType: "test",
          config,
          data: rows,
          instanceId: "left",
          syncUrl: true,
        }),
      ]),
      h("section", { "data-instance": "right" }, [
        h(YayawDataTable, {
          tableType: "test",
          config,
          data: rows,
          instanceId: "right",
          syncUrl: true,
        }),
      ]),
    ]);
    const wrapper = mount(Page, { attachTo: document.body });
    await settle();
    const right = wrapper.get('[data-instance="right"]');
    const left = wrapper.get('[data-instance="left"]');
    // Each instance reads its own keys; `test-q` belongs to an unscoped table.
    expect(right.text()).toContain("Beta");
    expect(right.text()).not.toContain("Alpha");
    expect(left.text()).toContain("Alpha");
    expect(left.text()).toContain("Gamma");
    await left.get('input[type="search"]').setValue("Alpha");
    await settle();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("left-q")).toBe("Alpha");
    expect(params.get("right-q")).toBe("Beta");
    expect(params.get("test-q")).toBe("Gamma");
    expect(right.text()).not.toContain("Alpha");
  });

  it("renders two embedded instances of one table from their own views without touching the URL", async () => {
    const requests: TableListParams[] = [];
    const actions = {
      list: (params: TableListParams) => {
        requests.push(params);
        const rules = (params.advancedFilters ?? []) as unknown as {
          values: string[];
        }[];
        const data = rows.filter((row) =>
          rules.every((rule) => rule.values.includes(String(row.status)))
        );
        return Promise.resolve({
          data,
          meta: { pageCount: 1, totalCount: data.length },
        });
      },
    };
    const embedded = {
      ...config,
      table: { ...config.table, syncUrl: false, showToolbar: false },
    };
    const Page = defineComponent(
      () => () =>
        (["open", "closed"] as const).map((name) =>
          h("section", { "data-instance": name, key: name }, [
            h(YayawDataTable, {
              tableType: "test",
              config: embedded,
              getTableActions: () => actions,
              initialView: onlyStatus(
                `${name}-view`,
                name === "open" ? "Open" : "Closed"
              ),
              instanceId: `widget-${name}`,
              syncUrl: false,
            }),
          ])
        )
    );
    const wrapper = mount(Page, { attachTo: document.body });
    await settle();
    const open = wrapper.get('[data-instance="open"]').text();
    const closed = wrapper.get('[data-instance="closed"]').text();
    expect(open).toContain("Alpha");
    expect(open).toContain("Gamma");
    expect(open).not.toContain("Beta");
    expect(closed).toContain("Beta");
    expect(closed).not.toContain("Alpha");
    // Each first request already carries its own view's filters.
    expect(
      requests.map((request) =>
        (request.advancedFilters as unknown as { values: string[] }[])
          .flatMap((rule) => rule.values)
          .join()
      )
    ).toEqual(["Open", "Closed"]);
    expect(window.location.search).toBe("");
  });

  it("reports its view when it starts, after a sort and after a search, as React does", async () => {
    const reportedConfig = defineTableConfig({
      id: "reported",
      columns: {
        definitions: viewChange.columns as never,
        mandatory: ["name"],
        order: ["name", "status"],
        visible: ["name", "status"],
      },
      table: {
        syncUrl: false,
        enableViews: false,
        enableRowSelection: false,
        searchDebounceMs: 0,
      },
      translations: { namespace: "reported", keys: {} },
    });
    const actions = {
      list: () =>
        Promise.resolve({
          data: viewChange.rows,
          meta: { pageCount: 1, totalCount: viewChange.rows.length },
        }),
    };
    const reported: unknown[] = [];
    const read: unknown[] = [];
    const Page = defineComponent(
      () => () =>
        h(YayawDataTable, {
          tableType: "reported",
          config: reportedConfig,
          getTableActions: () => actions,
          getRowId: (row: TableRecord) => String(row.id),
          initialView: {
            id: null,
            config: viewChange.initialView as unknown as TableViewConfig,
          },
          instanceId: "reported-view",
          syncUrl: false,
          onViewConfigChange: (view: ViewConfig) => reported.push(view),
          toolbarActions: [
            {
              id: "read-view",
              label: "Read view",
              onClick: (context: ToolbarActionContext) => {
                read.push(context.getViewConfig());
              },
            },
          ],
        })
    );
    const wrapper = mount(Page, {
      attachTo: document.body,
      global: {
        stubs: {
          PopperArrow: true,
          PopperContent: { template: "<div><slot /></div>" },
        },
      },
    });
    await settle();
    expect(reported).toEqual([viewChange.reports.started]);

    // Sort by name, descending, from the column's menu.
    await wrapper
      .get('[aria-label="Column options: Name"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
      .find((element) => element.textContent?.trim() === "Descending")
      ?.click();
    await settle();
    expect(reported.at(-1)).toEqual(viewChange.reports.sorted);

    // Search: a filter of the view.
    await wrapper.get('input[type="search"]').setValue(viewChange.search);
    await settle();
    expect(reported.at(-1)).toEqual(viewChange.reports.searched);
    // Each distinct view once.
    expect(new Set(reported.map((view) => JSON.stringify(view))).size).toBe(
      reported.length
    );

    // A toolbar action reads the live view.
    await wrapper.get('[aria-label="Read view"]').trigger("click");
    await flushPromises();
    expect(read).toEqual([viewChange.reports.searched]);
  });
});
