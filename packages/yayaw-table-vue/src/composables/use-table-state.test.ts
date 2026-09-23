import { mount } from "@vue/test-utils";
import { expect, it } from "vitest";
import { defineComponent } from "vue";
import { defineTableConfig } from "../config";
import type { TableViewConfig } from "../types";
import { type TableStateRefs, useTableState } from "./use-table-state";

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
