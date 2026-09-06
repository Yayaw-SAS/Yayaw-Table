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
