import "./setup-dom";
import { afterAll, afterEach, beforeAll, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  assetColumns,
  assetTableOptions,
  assetVisibleColumns,
  createAssetActions,
} from "../examples/assets";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import {
  tableViewFavoriteQueryKey,
  tableViewsQueryKey,
} from "../src/components/ui/yayaw-table/components/toolbar/table-view-manager";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { fileTreeRenderer } from "../src/components/ui/yayaw-table/filetree/filetree-renderer";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import type { TableActions } from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  TableInstanceProvider,
  TableStateSyncProvider,
  tableUrlKeys,
} from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";
import type {
  TableView,
  TableViewConfig,
} from "../src/components/ui/yayaw-table/types/view-types";
import { fileTreeFolderKey } from "../src/components/ui/yayaw-table/utils/filetree-model";
import viewChange from "./fixtures/view-config-change.json";

const originalGetAnimations = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getAnimations"
);
beforeAll(() => {
  // Happy DOM does not implement the animation API used by Base UI's scroll area.
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
});
afterAll(() => {
  if (originalGetAnimations) {
    Object.defineProperty(
      Element.prototype,
      "getAnimations",
      originalGetAnimations
    );
  } else {
    Reflect.deleteProperty(Element.prototype, "getAnimations");
  }
});

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});
const settle = (ms = 80) =>
  act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const mount = () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return root;
};

it("keeps the shared URL keys without an instance id", () => {
  expect(tableUrlKeys("projects")).toEqual({
    prefix: "projects",
    view: "view",
    historyIndex: "historyIndex",
  });
  expect(tableUrlKeys("projects", "left")).toEqual({
    prefix: "left",
    view: "left-view",
    historyIndex: "left-historyIndex",
  });
});

it("scopes the URL keys and state of two instances of one table", async () => {
  const states: Record<string, ReturnType<typeof useTableUrlState>> = {};
  let url = new URLSearchParams();
  function Probe({ name }: { name: string }) {
    states[name] = useTableUrlState({ tableId: "projects" });
    return null;
  }
  await act(() =>
    mount().render(
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={(event) => {
          url = event.searchParams;
        }}
      >
        <TableStateSyncProvider enabled>
          <Provider store={createStore()}>
            <TableInstanceProvider instanceId="left">
              <Probe name="left" />
            </TableInstanceProvider>
          </Provider>
          <Provider store={createStore()}>
            <TableInstanceProvider instanceId="right">
              <Probe name="right" />
            </TableInstanceProvider>
          </Provider>
        </TableStateSyncProvider>
      </NuqsTestingAdapter>
    )
  );
  await act(() =>
    states.left?.applyViewConfig(
      { sorting: [{ id: "name", desc: true }], globalSearch: "alpha" },
      { viewId: "mine" }
    )
  );
  await settle();
  expect(url.get("left-view")).toBe("mine");
  expect(JSON.parse(url.get("left-sort") ?? "[]")).toEqual([
    { id: "name", desc: true },
  ]);
  expect(url.get("left-q")).toBe("alpha");
  // Nothing leaks into the shared keys or the other instance.
  expect(url.has("view")).toBe(false);
  expect([...url.keys()].some((key) => key.startsWith("projects-"))).toBe(
    false
  );
  expect(states.right?.viewParam).toBeNull();
  expect(states.right?.sortParam).toEqual([]);
  expect(states.right?.globalSearchParam).toBe("");
  expect(states.left?.viewParam).toBe("mine");
});

it("renders two embedded instances of one table from their own views without touching the URL", async () => {
  const config = defineTableConfig({
    id: "projects",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "status", header: "Status", type: "text" },
      ],
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
    },
    table: { syncUrl: false, showToolbar: false },
    translations: { namespace: "projects", keys: {} },
  });
  const requests: Record<string, unknown>[] = [];
  const rows = [
    { id: "1", name: "Alpha", status: "Open" },
    { id: "2", name: "Bravo", status: "Done" },
  ];
  const actions = {
    list: (params: Record<string, unknown>) => {
      requests.push(params);
      const rules = (params.advancedFilters ?? []) as { values: string[] }[];
      const data = rows.filter((row) =>
        rules.every((rule) => rule.values.includes(row.status))
      );
      return Promise.resolve({
        data,
        meta: { pageCount: 1, totalCount: data.length },
      });
    },
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let urlUpdates = 0;
  const view = (
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
      ] as unknown as TableViewConfig["advancedFilters"],
    },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={() => {
          urlUpdates += 1;
        }}
      >
        {(["open", "done"] as const).map((name) => (
          <section data-instance={name} key={name}>
            <DataTable
              getRowId={(row) => String(row.id)}
              getTableActions={() => actions}
              getTableConfig={() => config}
              initialView={view(
                `${name}-view`,
                name === "open" ? "Open" : "Done"
              )}
              instanceId={`widget-${name}`}
              queryClient={client}
              tableType="projects"
            />
          </section>
        ))}
      </NuqsTestingAdapter>
    )
  );
  await settle(200);
  const text = (name: string) =>
    container.querySelector(`[data-instance="${name}"]`)?.textContent ?? "";
  expect(text("open")).toContain("Alpha");
  expect(text("open")).not.toContain("Bravo");
  expect(text("done")).toContain("Bravo");
  expect(text("done")).not.toContain("Alpha");
  // Each first request already carries its own view's filters.
  expect(
    requests.map((request) =>
      (request.advancedFilters as { values: string[] }[])
        .flatMap((rule) => rule.values)
        .join()
    )
  ).toEqual(["Open", "Done"]);
  expect(urlUpdates).toBe(0);
  client.clear();
});

it("reports its view when it starts, after a sort and after a search, as Vue does", async () => {
  const config = defineTableConfig({
    id: "reported",
    columns: {
      definitions: viewChange.columns as never,
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const reported: unknown[] = [];
  const read: unknown[] = [];
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        <DataTable
          getRowId={(row) => String(row.id)}
          getTableActions={() => actions}
          getTableConfig={() => config}
          initialView={{
            id: null,
            config: viewChange.initialView as unknown as TableViewConfig,
          }}
          instanceId="reported-view"
          onViewConfigChange={(view) => reported.push(view)}
          queryClient={client}
          tableType="reported"
          toolbarActions={[
            {
              id: "read-view",
              label: "Read view",
              onClick: (context) => {
                read.push(context.getViewConfig());
              },
            },
          ]}
        />
      </NuqsTestingAdapter>
    )
  );
  await settle(200);
  expect(reported).toEqual([viewChange.reports.started]);

  // Sort by name, descending, from the column's menu.
  const nameMenu = [
    ...container.querySelectorAll<HTMLButtonElement>(
      'th button[aria-label="Toggle columns"]'
    ),
  ].find((button) => button.closest("th")?.textContent?.includes("Name"));
  await act(async () => {
    nameMenu?.click();
    await Promise.resolve();
  });
  const descending = [
    ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].find((entry) => entry.textContent?.toLowerCase() === "sort descending");
  await act(async () => {
    descending?.click();
    await Promise.resolve();
  });
  // Sorts are written after a 150 ms debounce.
  await settle(300);
  expect(reported.at(-1)).toEqual(viewChange.reports.sorted);

  // Search: a filter of the view.
  const search = container.querySelector<HTMLInputElement>(
    "[data-table-toolbar] input"
  );
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(search, viewChange.search);
    search?.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
  await settle(300);
  expect(reported.at(-1)).toEqual(viewChange.reports.searched);
  // Each distinct view once.
  expect(new Set(reported.map((view) => JSON.stringify(view))).size).toBe(
    reported.length
  );

  // A toolbar action reads the live view.
  const readButton = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (button) =>
      button.textContent === "Read view" ||
      button.getAttribute("aria-label") === "Read view"
  );
  await act(async () => {
    readButton?.click();
    await Promise.resolve();
  });
  expect(read).toEqual([viewChange.reports.searched]);
  client.clear();
});

const statusView = (id: string, status: string): TableView => ({
  id,
  name: `${status} projects`,
  tableId: "shared-views",
  createdById: "host",
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
    ] as unknown as TableViewConfig["advancedFilters"],
  },
});

it("keeps the views query keys of a table without an instance id", () => {
  expect(tableViewsQueryKey("projects", "projects")).toEqual([
    "tableViews",
    "projects",
    "projects",
  ]);
  expect(tableViewFavoriteQueryKey("projects", "projects")).toEqual([
    "tableViewFavorite",
    "projects",
    "projects",
  ]);
  expect(tableViewsQueryKey("projects", "projects", "left")).toEqual([
    "tableViews",
    "projects",
    "projects",
    "left",
  ]);
  expect(fileTreeFolderKey("projects")).toBe("projects-folder");
  expect(fileTreeFolderKey("projects", "left")).toBe("left-folder");
});

it("opens each instance of one table on its own default view and lists the table's saved views in both", async () => {
  const config = defineTableConfig({
    id: "shared-views",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "status", header: "Status", type: "text" },
      ],
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
    },
    table: { enableViews: true },
    translations: { namespace: "shared-views", keys: {} },
  });
  const rows = [
    { id: "1", name: "Alpha", status: "Open" },
    { id: "2", name: "Bravo", status: "Done" },
  ];
  const open = statusView("open-view", "Open");
  const done = statusView("done-view", "Done");
  let savedViews = [open, done];
  const actions = {
    list: (params: Record<string, unknown>) => {
      const rules = (params.advancedFilters ?? []) as { values: string[] }[];
      const data = rows.filter((row) =>
        rules.every((rule) => rule.values.includes(row.status))
      );
      return Promise.resolve({
        data,
        meta: { pageCount: 1, totalCount: data.length },
      });
    },
    views: {
      list: () => Promise.resolve({ data: savedViews }),
      getFavorite: () =>
        Promise.resolve({ success: true, data: { viewId: null } }),
    },
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let url = new URLSearchParams();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <NuqsTestingAdapter
        hasMemory
        onUrlUpdate={(event) => {
          url = event.searchParams;
        }}
      >
        {(
          [
            ["left", open.id],
            ["right", done.id],
          ] as const
        ).map(([name, favoriteViewId]) => (
          <section data-instance={name} key={name}>
            <DataTable
              getRowId={(row) => String(row.id)}
              getTableActions={() => actions}
              getTableConfig={() => config}
              initialFavoriteViewId={favoriteViewId}
              initialViews={[open, done]}
              initialViewsLoaded
              instanceId={name}
              queryClient={client}
              tableType="shared-views"
            />
          </section>
        ))}
      </NuqsTestingAdapter>
    )
  );
  await settle(300);
  const text = (name: string) =>
    container.querySelector(`[data-instance="${name}"]`)?.textContent ?? "";
  // Each instance opens on the default view its host gave it.
  expect(url.get("left-view")).toBe("open-view");
  expect(url.get("right-view")).toBe("done-view");
  expect(url.has("view")).toBe(false);
  expect(text("left")).toContain("Alpha");
  expect(text("left")).not.toContain("Bravo");
  expect(text("right")).toContain("Bravo");
  expect(text("right")).not.toContain("Alpha");

  // A saved-view change refreshes the views of every instance of the table.
  savedViews = [open, done, statusView("late-view", "Late")];
  await act(() =>
    client.invalidateQueries({
      queryKey: tableViewsQueryKey("shared-views", "shared-views"),
    })
  );
  await settle(100);
  for (const name of ["left", "right"]) {
    expect(
      client
        .getQueryData<TableView[]>(
          tableViewsQueryKey("shared-views", "shared-views", name)
        )
        ?.map((view) => view.id)
    ).toEqual(["open-view", "done-view", "late-view"]);
  }
  client.clear();
});

it("opens each instance of one file tree on its own folder", async () => {
  window.history.replaceState(
    null,
    "",
    "/?left-folder=f-photos&right-folder=f-2026&shared-assets-folder=f-brand"
  );
  const config = defineTableConfig({
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
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <NuqsTestingAdapter hasMemory>
        {["left", "right", "unscoped"].map((name) => (
          <section data-instance={name} key={name}>
            <DataTable
              displayModeRenderers={{ filetree: fileTreeRenderer }}
              getRowId={(row) => String(row.id)}
              getTableActions={() => actions}
              getTableConfig={() => config}
              instanceId={name === "unscoped" ? undefined : name}
              queryClient={client}
              tableType="shared-assets"
            />
          </section>
        ))}
      </NuqsTestingAdapter>
    )
  );
  const focusedRow = (name: string) =>
    container
      .querySelector(
        `[data-instance="${name}"] [data-filetree-id][tabindex="0"]`
      )
      ?.getAttribute("data-filetree-id");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (focusedRow("left") === "f-photos" && focusedRow("right") === "f-2026") {
      break;
    }
    await settle(20);
  }
  expect(focusedRow("left")).toBe("f-photos");
  expect(focusedRow("right")).toBe("f-2026");
  // Without an instance id, the table keeps `<tableId>-folder`.
  expect(focusedRow("unscoped")).toBe("f-brand");

  // Opening another folder writes the instance's own key only.
  const documents = container.querySelector<HTMLElement>(
    '[data-instance="left"] [data-filetree-id="f-documents"]'
  );
  await act(async () => {
    documents?.click();
    await Promise.resolve();
  });
  await settle(40);
  const params = new URLSearchParams(window.location.search);
  expect(params.get("left-folder")).toBe("f-documents");
  expect(params.get("right-folder")).toBe("f-2026");
  expect(params.get("shared-assets-folder")).toBe("f-brand");
  window.history.replaceState(null, "", "/");
  client.clear();
});
