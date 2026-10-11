import {
  DOMWrapper,
  enableAutoUnmount,
  flushPromises,
  mount,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h, markRaw } from "vue";
import {
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "../../../../examples/assets";
import viewChange from "../../../../tests/fixtures/view-config-change.json";
import {
  inlineTestPortals,
  openViewSave,
  openViewsMenu,
} from "../../tests/menu-helpers";
import { defineTableConfig } from "../config";
import { fileTreeRenderer } from "../filetree/filetree-renderer";
import { fileTreeFolderKey } from "../filetree-model";
import type {
  TableActions,
  TableListParams,
  TableRecord,
  TableView,
  TableViewConfig,
  ToolbarActionContext,
} from "../types";
import type { ViewConfig } from "../view-config";
import YayawDataTable from "./YayawDataTable.vue";

inlineTestPortals();

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

describe("instances of one source on one page", () => {
  it("keeps `<tableId>-folder` without an instance id", () => {
    expect(fileTreeFolderKey("test")).toBe("test-folder");
    expect(fileTreeFolderKey("test", "left")).toBe("left-folder");
  });

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  const viewsConfig = defineTableConfig({
    ...config,
    id: "shared-views",
    table: {
      ...config.table,
      enableViews: true,
      viewTabs: false,
      allowViewSave: true,
      syncUrl: true,
    },
  });
  const statusView = (id: string, status: string): TableView => ({
    ...onlyStatus(id, status),
    tableId: "shared-views",
    name: `${status} rows`,
  });

  it("opens each instance on its own default view and lists the table's saved views in both", async () => {
    const open = statusView("open-view", "Open");
    const closed = statusView("closed-view", "Closed");
    const savedViews = [open, closed];
    const views = {
      list: () => Promise.resolve({ success: true, data: [...savedViews] }),
      getFavorite: () =>
        Promise.resolve({ success: true, data: { viewId: null } }),
      create: (input: { name: string; config: TableViewConfig }) => {
        const view: TableView = {
          id: "late-view",
          tableId: "shared-views",
          name: input.name,
          config: input.config,
        };
        savedViews.push(view);
        return Promise.resolve({ success: true, data: view });
      },
    };
    const mountInstance = (instanceId: string, favorite: string) =>
      mount(YayawDataTable, {
        attachTo: document.body,
        props: {
          tableType: "shared-views",
          config: viewsConfig,
          data: rows,
          getTableActions: () => ({ views }) as never,
          initialViews: [open, closed],
          initialViewsLoaded: true,
          initialFavoriteViewId: favorite,
          instanceId,
          syncUrl: true,
        },
        global: {
          stubs: {
            PopperArrow: true,
            PopperContent: { template: "<div><slot /></div>" },
          },
        },
      });
    const left = mountInstance("left", open.id);
    const right = mountInstance("right", closed.id);
    await settle();
    // Each instance opens on the default view its host gave it.
    const params = new URLSearchParams(window.location.search);
    expect(params.get("left-view")).toBe("open-view");
    expect(params.get("right-view")).toBe("closed-view");
    expect(params.has("view")).toBe(false);
    expect(left.text()).toContain("Alpha");
    expect(left.text()).not.toContain("Beta");
    expect(right.text()).toContain("Beta");
    expect(right.text()).not.toContain("Alpha");

    // A view saved from one instance is listed by the other.
    await openViewSave(left);
    await new DOMWrapper(document.body)
      .get(".yayaw-view-form input:not([type])")
      .setValue("Late rows");
    await new DOMWrapper(document.body)
      .get(".yayaw-view-form")
      .trigger("submit");
    await settle();
    await openViewsMenu(right);
    expect(right.text()).toContain("Late rows");
    // The other instance keeps its own view.
    expect(new URLSearchParams(window.location.search).get("right-view")).toBe(
      "closed-view"
    );
  });

  it("opens each instance of one file tree on its own folder", async () => {
    window.history.replaceState(
      {},
      "",
      "/?left-folder=f-photos&right-folder=f-2026&shared-assets-folder=f-brand"
    );
    const assetsConfig = defineTableConfig({
      id: "shared-assets",
      columns: {
        definitions: assetColumns,
        order: assetColumns.map((column) => column.id),
        visible: assetVisibleColumns,
        mandatory: ["name"],
      },
      table: {
        syncUrl: true,
        enableViews: false,
        defaultDisplayMode: "filetree",
        displayModes: ["filetree", "table"],
        filetree: assetTableOptions.filetree,
      },
      translations: { namespace: "shared-assets", keys: { title: "Assets" } },
    });
    const actions = createAssetActions() as unknown as TableActions;
    const renderers = markRaw({ filetree: fileTreeRenderer });
    const mountInstance = (instanceId?: string) =>
      mount(YayawDataTable, {
        attachTo: document.body,
        props: {
          tableType: "shared-assets",
          config: assetsConfig,
          displayModeRenderers: renderers,
          getTableActions: () => actions,
          getRowId: (row: TableRecord) => String(row.id),
          instanceId,
        },
      });
    const left = mountInstance("left");
    const right = mountInstance("right");
    const unscoped = mountInstance();
    const focusedRow = (wrapper: typeof left) =>
      wrapper
        .find('[data-filetree-id][tabindex="0"]')
        .attributes("data-filetree-id");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (
        left.find('[data-filetree-id][tabindex="0"]').exists() &&
        focusedRow(left) === "f-photos" &&
        focusedRow(right) === "f-2026"
      ) {
        break;
      }
      await settle();
    }
    expect(focusedRow(left)).toBe("f-photos");
    expect(focusedRow(right)).toBe("f-2026");
    // Without an instance id, the table keeps `<tableId>-folder`.
    expect(focusedRow(unscoped)).toBe("f-brand");

    // Opening another folder writes the instance's own key only.
    await left.get('[data-filetree-id="f-documents"]').trigger("click");
    await settle();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("left-folder")).toBe("f-documents");
    expect(params.get("right-folder")).toBe("f-2026");
    expect(params.get("shared-assets-folder")).toBe("f-brand");
  });
});
