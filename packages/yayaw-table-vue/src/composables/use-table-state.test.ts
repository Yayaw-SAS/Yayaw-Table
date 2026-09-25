import { mount } from "@vue/test-utils";
import { expect, it, onTestFinished, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { defineTableConfig } from "../config";
import type { TableViewConfig } from "../types";
import { type TableStateRefs, useTableState } from "./use-table-state";

const pagedConfig = defineTableConfig({
  id: "paged",
  translations: { namespace: "paged", keys: {} },
  columns: {
    definitions: [
      { id: "name", header: "Name" },
      { id: "status", header: "Status" },
    ],
    visible: ["name", "status"],
    order: ["name", "status"],
    mandatory: ["name"],
  },
});

/** URL-synced state of a table opened from a link with these keys. */
const openLink = (keys: Record<string, string>): TableStateRefs => {
  window.history.replaceState({}, "", `/?${new URLSearchParams(keys)}`);
  let state!: TableStateRefs;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useTableState({ config: pagedConfig, syncUrl: true });
        return () => null;
      },
    })
  );
  onTestFinished(() => {
    wrapper.unmount();
    window.history.replaceState({}, "", "/");
  });
  return state;
};
const urlKey = (key: string): string | null =>
  new URL(window.location.href).searchParams.get(key);

it("keeps the page a link opens on, with the link's search and sort", async () => {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const state = openLink({
    "paged-page": "1",
    "paged-q": "beta",
    "paged-sort": JSON.stringify([{ id: "name", desc: true }]),
  });
  await nextTick();
  expect(state.search.value).toBe("beta");
  expect(state.sorting.value).toEqual([{ id: "name", desc: true }]);
  expect(state.pagination.value.pageIndex).toBe(1);
  // The table's own first URL write keeps the link's page.
  await vi.runOnlyPendingTimersAsync();
  expect(urlKey("paged-order")).not.toBeNull();
  expect(urlKey("paged-page")).toBe("1");
  expect(urlKey("paged-q")).toBe("beta");
});

it.each([
  [
    "a search",
    (state: TableStateRefs) => {
      state.search.value = "gamma";
    },
  ],
  [
    "a column filter",
    (state: TableStateRefs) => {
      state.filters.value = [{ id: "status", value: ["Open"] }];
    },
  ],
  [
    "an advanced filter",
    (state: TableStateRefs) => {
      state.advancedFilters.value = {
        filters: [
          {
            id: "rule",
            columnId: "status",
            type: "text",
            operator: "contains",
            values: ["Op"],
            isActive: true,
          },
        ],
        joinOperator: "and",
      };
    },
  ],
  [
    "a new sort",
    (state: TableStateRefs) => {
      state.sorting.value = [{ id: "status", desc: false }];
    },
  ],
  [
    "a reversed sort",
    (state: TableStateRefs) => {
      const [sort] = state.sorting.value;
      if (sort) {
        sort.desc = false;
      }
    },
  ],
  [
    "a saved view",
    (state: TableStateRefs) => {
      state.applyView({ globalSearch: "delta" }, "saved");
    },
  ],
  ["clearing the filters", (state: TableStateRefs) => state.resetFilters()],
  ["resetting the view", (state: TableStateRefs) => state.reset()],
])("returns to the first page after %s", async (_change, change) => {
  const state = openLink({
    "paged-page": "2",
    "paged-sort": JSON.stringify([{ id: "name", desc: true }]),
  });
  await nextTick();
  expect(state.pagination.value.pageIndex).toBe(2);
  change(state);
  await nextTick();
  expect(state.pagination.value.pageIndex).toBe(0);
});

it("keeps the page when a write repeats the query, as in React", async () => {
  const rule = {
    id: "rule",
    columnId: "status",
    type: "text",
    operator: "contains",
    values: ["Op"],
    isActive: true,
  } as const;
  const state = openLink({
    "paged-page": "2",
    "paged-q": "beta",
    "paged-sort": JSON.stringify([{ id: "name", desc: true }]),
    "paged-filters": JSON.stringify([{ id: "status", value: ["Open"] }]),
    "paged-advancedFilters": JSON.stringify({
      filters: [rule],
      joinOperator: "and",
    }),
  });
  await nextTick();
  // New objects of the same query, a search with spaces, keys in another order.
  state.search.value = " beta ";
  state.filters.value = [{ id: "status", value: ["Open"] }];
  state.advancedFilters.value = { filters: [{ ...rule }], joinOperator: "and" };
  state.sorting.value = [{ desc: true, id: "name" }];
  await nextTick();
  expect(state.pagination.value.pageIndex).toBe(2);
});

it("restores the page of the URL that back or forward returns to", async () => {
  const state = openLink({ "paged-page": "1" });
  await nextTick();
  window.history.replaceState(
    {},
    "",
    `/?${new URLSearchParams({ "paged-page": "2", "paged-q": "echo" })}`
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
  await nextTick();
  expect(state.search.value).toBe("echo");
  expect(state.pagination.value.pageIndex).toBe(2);
});

it("restores partial views from catalogue defaults and isolates saved configuration from edits", () => {
  const config = defineTableConfig({
    id: "defaults",
    translations: { namespace: "defaults", keys: {} },
    columns: {
      definitions: [
        { id: "name", header: "Name" },
        { id: "status", header: "Status" },
      ],
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
    },
    table: {
      enableColumnResizing: true,
      gallery: { titleColumn: "name", cardSize: "small" },
      kanban: { groupBy: "status", titleColumn: "name" },
    },
  });
  let state!: TableStateRefs;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useTableState({ config, syncUrl: false });
        return () => null;
      },
    })
  );
  try {
    const saved: TableViewConfig = {
      columnSizing: { name: 260, unknown: 500, status: -10 },
      columnVisibility: { status: false },
      sorting: [{ id: "name", desc: true }],
      gallery: { cardSize: "large" },
    };
    state.applyView(saved, "first");
    const firstSort = state.sorting.value[0];
    if (!firstSort) {
      throw new Error("Missing applied sort");
    }
    firstSort.desc = false;
    state.gallery.value.cardSize = "medium";
    expect(saved.sorting).toEqual([{ id: "name", desc: true }]);
    expect(saved.gallery).toEqual({ cardSize: "large" });
    expect(state.sizing.value).toEqual({ name: 260 });
    expect(state.snapshot.value.columnSizing).toEqual({ name: 260 });
    state.applyView({ globalSearch: "Beta" }, "second");
    expect(state.visibility.value.status).toBe(true);
    expect(state.gallery.value.cardSize).toBe("small");
    expect(state.sizing.value).toEqual({});
    expect(state.kanban.value.groupBy).toBe("status");
    state.reset();
    expect(state.search.value).toBe("");
    expect(state.activeViewId.value).toBeUndefined();
    expect(state.gallery.value.cardSize).toBe("small");
  } finally {
    wrapper.unmount();
  }
});

it("captures every saved density and restores the catalogue default for legacy views", () => {
  const config = defineTableConfig({
    id: "density-views",
    table: { density: "large" },
    columns: { definitions: [], visible: [], order: [], mandatory: [] },
    translations: { namespace: "table", keys: {} },
  });
  let state!: TableStateRefs;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useTableState({ config, syncUrl: false });
        return () => null;
      },
    })
  );
  try {
    expect(state.snapshot.value.density).toBe("large");
    for (const density of [
      "extra-small",
      "small",
      "medium",
      "large",
      "extra-large",
      "extra-extra-large",
    ] as const) {
      state.applyView({ density }, density);
      expect(state.density.value).toBe(density);
      expect(state.snapshot.value.density).toBe(density);
    }
    state.applyView({ globalSearch: "legacy" }, "legacy");
    expect(state.density.value).toBe("large");
    state.reset();
    expect(state.snapshot.value.density).toBe("large");
  } finally {
    wrapper.unmount();
  }
});

it("falls back from a Gantt view when no planning session can render it", () => {
  const config = defineTableConfig({
    id: "planning-guard",
    translations: { namespace: "planning-guard", keys: {} },
    columns: {
      definitions: [{ id: "name", header: "Name" }],
      visible: ["name"],
      order: ["name"],
      mandatory: ["name"],
    },
    table: { displayModes: ["table", "gantt"], defaultDisplayMode: "gantt" },
  });
  const mountState = (planning: boolean): TableStateRefs => {
    let state!: TableStateRefs;
    mount(
      defineComponent({
        setup() {
          state = useTableState({ config, syncUrl: false, planning });
          return () => null;
        },
      })
    );
    return state;
  };

  const withoutPlanning = mountState(false);
  withoutPlanning.applyView({ displayMode: "gantt" }, "saved");
  expect(withoutPlanning.displayMode.value).toBe("table");

  const withPlanning = mountState(true);
  withPlanning.applyView({ displayMode: "gantt" }, "saved");
  expect(withPlanning.displayMode.value).toBe("gantt");
});

it("restores list settings from saved views and resets them to the table defaults", () => {
  const config = defineTableConfig({
    id: "list-settings",
    translations: { namespace: "list-settings", keys: {} },
    columns: {
      definitions: [
        { id: "name", header: "Name" },
        { id: "status", header: "Status" },
      ],
      visible: ["name", "status"],
      order: ["name", "status"],
      mandatory: ["name"],
    },
    table: {
      displayModes: ["table", "list"],
      list: { titleColumn: "name" },
    },
  });
  let state!: TableStateRefs;
  mount(
    defineComponent({
      setup() {
        state = useTableState({ config, syncUrl: false });
        return () => null;
      },
    })
  );
  state.applyView(
    { displayMode: "list", list: { cardColumnIds: ["status"] } },
    "saved"
  );
  expect(state.displayMode.value).toBe("list");
  expect(state.list.value).toEqual({ cardColumnIds: ["status"] });
  expect(state.snapshot.value.list).toEqual({ cardColumnIds: ["status"] });
  state.applyView({}, "empty");
  expect(state.list.value).toEqual({ titleColumn: "name" });
});
