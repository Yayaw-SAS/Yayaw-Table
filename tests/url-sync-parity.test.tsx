import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { autoPageState } from "../src/components/ui/yayaw-table/hooks/use-auto-page-size";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import { TableStateSyncProvider } from "../src/components/ui/yayaw-table/providers/table-state-sync-provider";
import type { DisplayModeRenderContext } from "../src/components/ui/yayaw-table/types/display-mode-renderer";

const roots: Root[] = [];
const LOCKED_COLUMN = /select|actions/;

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

it("shares table state in memory without writing URL parameters", async () => {
  let primary!: ReturnType<typeof useTableUrlState>;
  let secondary!: ReturnType<typeof useTableUrlState>;
  let urlUpdates = 0;

  function Probe() {
    primary = useTableUrlState({ tableId: "local" });
    secondary = useTableUrlState({ tableId: "local" });
    return <span>{secondary.globalSearchParam}</span>;
  }

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={createStore()}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={() => {
            urlUpdates += 1;
          }}
          searchParams="local-q=from-url"
        >
          <TableStateSyncProvider enabled={false}>
            <Probe />
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );

  expect(primary.globalSearchParam).toBe("");
  await act(async () => {
    primary.setGlobalSearchFromUI("Alpha");
    primary.setPinningFromUI({ left: ["name"], right: [] });
    primary.setSizingFromUI({ name: 240 });
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
  expect(secondary.globalSearchParam).toBe("Alpha");
  expect(secondary.pinningParam).toEqual({ left: ["name"], right: [] });
  expect(secondary.sizingParam).toEqual({ name: 240 });
  expect(container.textContent).toBe("Alpha");
  expect(urlUpdates).toBe(0);
});

it("captures and restores saved density, including legacy defaults and isolated tables", async () => {
  const store = createStore();
  const { tableDensityAtom } = await import(
    "../src/components/ui/yayaw-table/atoms/table-atoms"
  );
  let state!: ReturnType<typeof useTableUrlState>;
  function Probe() {
    state = useTableUrlState({
      tableId: "density-view",
      defaultDensity: "large",
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={store}>
        <NuqsTestingAdapter hasMemory>
          <TableStateSyncProvider enabled={false}>
            <Probe />
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  expect(state.getCurrentViewConfig().density).toBe("large");
  for (const density of [
    "extra-small",
    "small",
    "medium",
    "large",
    "extra-large",
    "extra-extra-large",
  ] as const) {
    await act(() => store.set(tableDensityAtom("density-view"), density));
    const snapshot = state.getCurrentViewConfig();
    expect(snapshot.density).toBe(density);
    await act(() => state.applyViewConfig({ density: "medium" }));
    await act(() => state.applyViewConfig(snapshot));
    expect(store.get(tableDensityAtom("density-view"))).toBe(density);
  }
  await act(() => state.applyViewConfig({ globalSearch: "legacy" }));
  expect(state.getCurrentViewConfig().density).toBe("large");
  expect(store.get(tableDensityAtom("other"))).toBeUndefined();
  await act(() => state.resetUrlState());
  expect(state.getCurrentViewConfig().density).toBe("large");
});

for (const syncUrl of [false, true]) {
  it(`keeps equivalent column-order writes idle with syncUrl=${syncUrl}`, async () => {
    let state!: ReturnType<typeof useTableUrlState>;
    let renders = 0;
    let urlUpdates = 0;
    function Probe() {
      state = useTableUrlState({ tableId: "stable-order" });
      renders++;
      return <span>{state.orderParam.join(",")}</span>;
    }
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    await act(() =>
      root.render(
        <Provider store={createStore()}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={() => {
              urlUpdates++;
            }}
          >
            <TableStateSyncProvider enabled={syncUrl}>
              <Probe />
            </TableStateSyncProvider>
          </NuqsTestingAdapter>
        </Provider>
      )
    );
    await act(async () => {
      state.setOrderFromUI(["select", "name", "status", "actions"]);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    const settledRenders = renders;
    const settledUpdates = urlUpdates;
    await act(async () => {
      state.setOrderFromUI(["select", "name", "status", "actions"]);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    // The table places the locked columns: the state keeps the data columns.
    expect(container.textContent).toBe("name,status");
    expect(renders).toBe(settledRenders);
    expect(urlUpdates).toBe(settledUpdates);
    await act(async () => {
      state.setOrderFromUI(["select", "status", "name", "actions"]);
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe("status,name");
  });
}

/** A table whose URL carries what differs from these columns. */
async function openColumnLink(link: Record<string, string>) {
  const store = createStore();
  let state!: ReturnType<typeof useTableUrlState>;
  let params = new URLSearchParams(link);
  function Probe() {
    state = useTableUrlState({ tableId: "paged" });
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <Provider store={store}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={(event) => {
            params = event.searchParams;
          }}
          // Keeps the writes the table makes as it mounts.
          resetUrlUpdateQueueOnMount={false}
          searchParams={link}
        >
          <TableStateSyncProvider
            columns={{
              definitions: [{ id: "name" }, { id: "status" }],
              order: ["select", "name", "status", "actions"],
              visible: ["name", "status"],
            }}
            enabled
          >
            <Probe />
          </TableStateSyncProvider>
        </NuqsTestingAdapter>
      </Provider>
    )
  );
  const settled = () =>
    act(() => new Promise((resolve) => setTimeout(resolve, 220)));
  await settled();
  return {
    settled,
    store,
    get params() {
      return params;
    },
    get state() {
      return state;
    },
  };
}

it("writes only what differs from the defaults, without the locked columns, as Vue does", async () => {
  const table = await openColumnLink({
    "paged-visibility": JSON.stringify({ status: false }),
  });
  // A link that hides one column keeps the other defaults.
  expect(table.state.visibilityParam).toMatchObject({
    name: true,
    status: false,
  });
  await act(() => {
    table.state.setOrderFromUI(["select", "status", "name", "actions"]);
    table.state.setPinningFromUI({
      left: ["select", "status"],
      right: ["actions"],
    });
    table.store.set(autoPageState("paged"), {
      automatic: true,
      resetKey: "",
      expectedSize: 42,
      fitKey: "",
    });
    table.state.setPaginationFromUI({ pageIndex: 0, pageSize: 42 });
  });
  await table.settled();
  expect(JSON.parse(table.params.get("paged-visibility") ?? "null")).toEqual({
    status: false,
  });
  expect(JSON.parse(table.params.get("paged-order") ?? "null")).toEqual([
    "status",
    "name",
  ]);
  expect(
    JSON.parse(decodeURIComponent(table.params.get("paged-pinning") ?? "null"))
  ).toEqual({ left: ["status"], right: [] });
  // The page size follows the screen: another one fits another number of rows.
  expect(table.params.has("paged-pageSize")).toBe(false);
  expect(table.state.pagination.pageSize).toBe(42);
  // No internal id reaches the URL (nor the Referer of the page's requests).
  expect(table.params.toString()).not.toMatch(LOCKED_COLUMN);
  await act(() => {
    table.state.setOrderFromUI(["select", "name", "status", "actions"]);
    table.state.setPinningFromUI({ left: ["select"], right: ["actions"] });
    table.state.setVisibilityFromUI({
      ...table.state.visibilityParam,
      status: true,
    });
  });
  await table.settled();
  for (const key of ["paged-visibility", "paged-order", "paged-pinning"]) {
    expect(table.params.has(key)).toBe(false);
  }
});

it("reads links that carry every column, then leaves the defaults out", async () => {
  const table = await openColumnLink({
    "paged-visibility": JSON.stringify({
      select: true,
      name: true,
      status: false,
      actions: true,
    }),
    "paged-order": JSON.stringify(["select", "status", "name", "actions"]),
    "paged-pinning": encodeURIComponent(
      JSON.stringify({ left: ["select"], right: ["actions"] })
    ),
  });
  expect(table.state.visibilityParam).toMatchObject({
    name: true,
    status: false,
  });
  expect(JSON.parse(table.params.get("paged-visibility") ?? "null")).toEqual({
    status: false,
  });
  expect(JSON.parse(table.params.get("paged-order") ?? "null")).toEqual([
    "status",
    "name",
  ]);
  expect(table.params.has("paged-pinning")).toBe(false);
});

/** Lets the table load and write its URL, one frame per `act`. */
const settle = async (frames = 8): Promise<void> => {
  if (frames === 0) {
    return;
  }
  await act(() => new Promise((resolve) => setTimeout(resolve, 52)));
  await settle(frames - 1);
};

it("keeps a display mode's rows when back or forward keeps the query, as Vue does", async () => {
  const listed: unknown[] = [];
  const revisions: number[] = [];
  const list = (params: Record<string, unknown>) => {
    listed.push(params);
    return Promise.resolve({
      data: [
        { id: "alpha", name: "Alpha", status: "Open" },
        { id: "beta", name: "Beta", status: "Closed" },
      ],
      meta: { pageCount: 1, totalCount: 2 },
    });
  };
  function Calendar({ context }: { context: DisplayModeRenderContext }) {
    revisions.push(context.revision);
    return <span>{context.rows.length} rows</span>;
  }
  const config = defineTableConfig({
    id: "history",
    columns: {
      definitions: [
        { id: "name", header: "Name", type: "text" },
        { id: "status", header: "Status", type: "text" },
      ],
      order: ["name", "status"],
      visible: ["name", "status"],
      mandatory: ["name"],
    },
    table: {
      defaultDisplayMode: "calendar",
      displayModes: ["calendar", "table"],
      syncUrl: true,
    },
    translations: { namespace: "history", keys: { title: "History" } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const store = createStore();
  // Opening another URL stands for back or forward.
  const open = async (keys: Record<string, string>) => {
    await act(() => {
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter hasMemory searchParams={keys}>
            <DataTable
              displayModeRenderers={{ calendar: { View: Calendar } }}
              getRowId={(row) => String(row.id)}
              getTableActions={() => ({ list })}
              getTableConfig={() => config}
              queryClient={client}
              tableType={config.id}
            />
          </NuqsTestingAdapter>
        </Provider>
      );
    });
    await settle();
  };
  const link = { "history-q": "a" };
  await open(link);
  expect(container.textContent).toContain("2 rows");
  const loaded = { listed: listed.length, revision: revisions.at(-1) };

  // The same state, then another column order: nothing loads again.
  await open(link);
  await open({
    ...link,
    "history-order": JSON.stringify(["select", "status", "name", "actions"]),
  });
  expect(listed).toHaveLength(loaded.listed);
  expect(revisions.at(-1)).toBe(loaded.revision);
});
