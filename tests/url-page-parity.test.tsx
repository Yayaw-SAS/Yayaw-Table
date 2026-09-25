import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createStore, Provider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { useTableUrlState } from "../src/components/ui/yayaw-table/hooks/use-table-url-state";
import type { AdvancedFiltersState } from "../src/components/ui/yayaw-table/types/filter-types";

// The page a table shows, as in Vue `use-table-state.test.ts`: a link keeps
// its page, a new query starts on the first page, and a page past the last
// one moves to the last page.

type UrlState = ReturnType<typeof useTableUrlState>;
type Keys = Record<string, string>;

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

/**
 * Lets the table render, frame after frame, past its debounced writes (the
 * search box's, then the URL's). One long `act` would hold React Query's
 * notifications.
 */
const settle = async (frames = 10): Promise<void> => {
  if (frames === 0) {
    return;
  }
  await act(() => new Promise((resolve) => setTimeout(resolve, 52)));
  await settle(frames - 1);
};

/** Applies each step once the previous one has settled. */
const inTurn = async ([step, ...rest]: (() => unknown)[]): Promise<void> => {
  if (!step) {
    return;
  }
  await act(() => {
    step();
  });
  await settle();
  await inTurn(rest);
};

/** Renders `tree` at a URL; opening another URL stands for back or forward. */
function urlHarness(tree: () => ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  const store = createStore();
  let params = new URLSearchParams();
  const open = async (keys: Keys) => {
    params = new URLSearchParams(keys);
    await act(() => {
      root.render(
        <Provider store={store}>
          <NuqsTestingAdapter
            hasMemory
            onUrlUpdate={(event) => {
              params = event.searchParams;
            }}
            searchParams={keys}
          >
            {tree()}
          </NuqsTestingAdapter>
        </Provider>
      );
    });
    await settle();
  };
  return {
    container,
    open,
    get params() {
      return params;
    },
  };
}

const rule = (id: string, values: string[]) => ({
  id,
  columnId: "status",
  type: "text",
  operator: "contains",
  values,
  isActive: true,
});
const rules = (...items: ReturnType<typeof rule>[]) =>
  items as unknown as AdvancedFiltersState;

/** URL-synced state of the `paged` table, opened from a link to its third page. */
async function openPagedLink(keys: Keys = {}) {
  let state!: UrlState;
  function Probe() {
    state = useTableUrlState({ tableId: "paged" });
    return null;
  }
  const harness = urlHarness(() => <Probe />);
  await harness.open({
    "paged-page": "2",
    "paged-q": "beta",
    "paged-sort": JSON.stringify([{ id: "name", desc: true }]),
    "paged-advancedFilters": JSON.stringify([rule("open", ["Op"])]),
    ...keys,
  });
  return {
    get params() {
      return harness.params;
    },
    get state() {
      return state;
    },
  };
}

const QUERY_CHANGES: [string, (state: UrlState) => void][] = [
  ["a search", (state) => state.setGlobalSearchFromUI("gamma")],
  [
    "a column filter",
    (state) => state.setColumnFiltersFromUI([{ id: "status", value: "Open" }]),
  ],
  [
    "an advanced filter",
    (state) =>
      state.setAdvancedFiltersFromUI(
        rules(rule("open", ["Op"]), rule("closed", ["Cl"]))
      ),
  ],
  ["a new sort", (state) => state.setSorting([{ id: "status", desc: false }])],
  [
    "a reversed sort",
    (state) => state.setSorting([{ id: "name", desc: false }]),
  ],
  ["clearing the advanced filters", (state) => state.resetAdvancedFilters()],
  ["a saved view", (state) => state.applyViewConfig({ globalSearch: "delta" })],
  ["clearing the filters", (state) => state.resetFilters()],
  ["resetting the view", (state) => state.resetUrlState()],
];

for (const [change, apply] of QUERY_CHANGES) {
  it(`returns to the first page after ${change}`, async () => {
    const link = await openPagedLink();
    expect(link.state.pagination.pageIndex).toBe(2);
    await inTurn([() => apply(link.state)]);
    expect(link.state.pagination.pageIndex).toBe(0);
    expect(link.params.has("paged-page")).toBe(false);
  });
}

it("keeps the page when a write repeats the query", async () => {
  const link = await openPagedLink({ "paged-q": " beta " });
  expect(link.state.pagination.pageIndex).toBe(2);
  // The search box writes its text trimmed; the sort comes in another key order.
  await inTurn([
    () => link.state.setGlobalSearchFromUI("beta"),
    () => link.state.setSorting([{ desc: true, id: "name" }]),
    () => link.state.setAdvancedFiltersFromUI(rules(rule("open", ["Op"]))),
  ]);
  expect(link.params.get("paged-q")).toBe("beta");
  expect(link.state.pagination.pageIndex).toBe(2);
  expect(link.params.get("paged-page")).toBe("2");
});

it("writes search, filters and sort to their own keys, whatever the table id", async () => {
  let state!: UrlState;
  function Probe() {
    state = useTableUrlState({ tableId: "sort-filters" });
    return null;
  }
  const harness = urlHarness(() => <Probe />);
  await harness.open({});
  await inTurn([
    () => state.setGlobalSearchFromUI("alpha"),
    () => state.setSorting([{ id: "name", desc: true }]),
    () => state.setColumnFiltersFromUI([{ id: "status", value: "Open" }]),
  ]);
  expect(harness.params.get("sort-filters-q")).toBe("alpha");
  expect(JSON.parse(harness.params.get("sort-filters-sort") ?? "[]")).toEqual([
    { id: "name", desc: true },
  ]);
  expect(
    JSON.parse(harness.params.get("sort-filters-filters") ?? "[]")
  ).toEqual([{ id: "status", value: "Open" }]);
});

const PROJECTS = [
  "Alpha launch",
  "Bravo audit",
  "Charlie display",
  "Delta support",
  "Echo sensors",
  "Foxtrot portal",
].map((name) => ({ id: name.toLowerCase().replace(" ", "-"), name }));
const PROJECT_NAME = new RegExp(PROJECTS.map((row) => row.name).join("|"), "g");

/** A server-like list: search, sort by name, one page at a time. */
function projectsList() {
  const pages: number[] = [];
  const list = (params: Record<string, unknown>) => {
    const search = String(params.search ?? "").toLowerCase();
    const direction =
      (params.orderBy as Record<string, string>).name === "desc" ? -1 : 1;
    const rows = PROJECTS.filter((row) =>
      row.name.toLowerCase().includes(search)
    ).sort((left, right) => left.name.localeCompare(right.name) * direction);
    const pageSize = Number(params.pageSize);
    const page = Number(params.page);
    pages.push(page);
    return Promise.resolve({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
        totalCount: rows.length,
      },
    });
  };
  return { list, pages };
}

const projectsConfig = defineTableConfig({
  id: "projects",
  columns: {
    definitions: [{ id: "name", header: "Name", type: "text" }],
    order: ["name"],
    visible: ["name"],
    mandatory: ["name"],
  },
  table: { displayModes: ["table"], syncUrl: true },
  translations: { namespace: "projects", keys: { title: "Projects" } },
});

/** The projects table; opening another URL stands for back or forward. */
function projectsTable() {
  const { list, pages } = projectsList();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const harness = urlHarness(() => (
    <DataTable
      getRowId={(row) => String(row.id)}
      getTableActions={() => ({ list })}
      getTableConfig={() => projectsConfig}
      queryClient={client}
      tableType={projectsConfig.id}
    />
  ));
  return {
    open: harness.open,
    pages,
    get params() {
      return harness.params;
    },
    /** Project names shown, in order. */
    shown: () => [
      ...new Set(harness.container.textContent?.match(PROJECT_NAME)),
    ],
  };
}

it("keeps the page a link opens on, with its search and sort", async () => {
  const table = projectsTable();
  // Foxtrot, Echo, Delta and Bravo match "o": two per page, by name descending.
  await table.open({
    "projects-page": "1",
    "projects-pageSize": "2",
    "projects-q": "o",
    "projects-sort": JSON.stringify([{ id: "name", desc: true }]),
  });
  expect(table.shown()).toEqual(["Delta support", "Bravo audit"]);
  expect(table.pages).toEqual([2]);
  expect(table.params.get("projects-page")).toBe("1");
});

it("restores the page of the URL that back or forward returns to", async () => {
  const table = projectsTable();
  await table.open({ "projects-page": "1", "projects-pageSize": "2" });
  expect(table.shown()).toEqual(["Charlie display", "Delta support"]);
  // Another query read from the URL keeps the URL's page.
  await table.open({
    "projects-page": "1",
    "projects-pageSize": "2",
    "projects-q": "o",
  });
  expect(table.shown()).toEqual(["Echo sensors", "Foxtrot portal"]);
  await table.open({ "projects-page": "2", "projects-pageSize": "2" });
  expect(table.shown()).toEqual(["Echo sensors", "Foxtrot portal"]);
  expect(table.params.get("projects-page")).toBe("2");
  expect(table.params.has("projects-q")).toBe(false);
});

it("moves a page past the last one to the last page", async () => {
  const table = projectsTable();
  await table.open({ "projects-page": "5", "projects-pageSize": "4" });
  expect(table.shown()).toEqual(["Echo sensors", "Foxtrot portal"]);
  expect(table.pages).toEqual([6, 2]);
  expect(table.params.get("projects-page")).toBe("1");
});

it("opens a link past the only page on that page", async () => {
  const table = projectsTable();
  await table.open({ "projects-page": "1" });
  expect(table.shown()).toHaveLength(PROJECTS.length);
  expect(table.params.has("projects-page")).toBe(false);
});
