import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areTableViewConfigsEqual,
  createTableViewConfigSnapshot,
  normalizeTableViewConfig,
} from "./table-view-state";

describe("createTableViewConfigSnapshot", () => {
  it("captures useful URL state for saved views", () => {
    const filterDate = new Date("2026-01-01T00:00:00.000Z");
    const snapshot = createTableViewConfigSnapshot({
      advancedFiltersParam: [
        {
          columnId: "createdAt",
          createdAt: filterDate,
          id: "filter-1",
          isActive: true,
          operator: "after",
          type: "date",
          updatedAt: filterDate,
          values: filterDate,
        },
      ],
      displayModeParam: "kanban",
      filtersParam: [{ id: "status", value: "available" }],
      galleryParam: {
        aspectRatio: "square",
        cardColumnIds: ["brand", "category", "price", "status"],
        imageColumn: "imageUrl",
        imageFit: "contain",
        titleColumn: "name",
      },
      globalSearchParam: "  laptop  ",
      groupingParam: ["brand"],
      kanbanGroupByParam: "status",
      orderParam: ["name", "status"],
      pageSizeParam: "50",
      pinningParam: { left: ["name"], right: [] },
      sortParam: [{ desc: false, id: "name" }],
      visibilityParam: { website: false },
    });

    assert.deepEqual(snapshot, {
      advancedFilters: [
        {
          columnId: "createdAt",
          createdAt: filterDate,
          id: "filter-1",
          isActive: true,
          operator: "after",
          type: "date",
          updatedAt: filterDate,
          values: filterDate,
        },
      ],
      columnFilters: [{ id: "status", value: "available" }],
      columnOrder: ["name", "status"],
      columnPinning: { left: ["name"], right: [] },
      columnVisibility: { website: false },
      displayMode: "kanban",
      gallery: {
        aspectRatio: "square",
        cardColumnIds: ["brand", "category", "price", "status"],
        imageColumn: "imageUrl",
        imageFit: "contain",
        titleColumn: "name",
      },
      globalSearch: "laptop",
      grouping: ["brand"],
      kanban: { groupBy: "status" },
      pageSize: 50,
      sorting: [{ desc: false, id: "name" }],
    });
  });

  it("drops empty transient values", () => {
    const snapshot = createTableViewConfigSnapshot({
      advancedFiltersParam: [],
      displayModeParam: "table",
      filtersParam: [],
      galleryParam: {},
      globalSearchParam: "",
      groupingParam: [],
      kanbanGroupByParam: "",
      orderParam: [],
      pageSizeParam: "20",
      pinningParam: { left: [], right: [] },
      sortParam: [],
      visibilityParam: {},
    });

    assert.deepEqual(snapshot, { displayMode: "table", pageSize: 20 });
  });
});

describe("normalizeTableViewConfig", () => {
  it("normalizes invalid page size and empty pinning", () => {
    const config = normalizeTableViewConfig({
      columnPinning: { left: [], right: [] },
      pageSize: -1,
    });

    assert.deepEqual(config, {});
  });

  it("preserves table, kanban, and gallery display modes", () => {
    assert.deepEqual(
      normalizeTableViewConfig({
        displayMode: "table",
        kanban: { groupBy: "" },
      }),
      { displayMode: "table" }
    );
    assert.deepEqual(
      normalizeTableViewConfig({
        displayMode: "kanban",
        kanban: { groupBy: "status" },
      }),
      { displayMode: "kanban", kanban: { groupBy: "status" } }
    );
    assert.deepEqual(
      normalizeTableViewConfig({
        displayMode: "gallery",
        gallery: {
          aspectRatio: "portrait",
          cardColumnIds: [" brand ", "", "price"],
          cardSize: "large",
          imageColumn: " imageUrl ",
          imageFit: "cover",
          showCardLabels: true,
          titleColumn: " name ",
        },
      }),
      {
        displayMode: "gallery",
        gallery: {
          aspectRatio: "portrait",
          cardColumnIds: ["brand", "price"],
          cardSize: "large",
          imageColumn: "imageUrl",
          imageFit: "cover",
          showCardLabels: true,
          titleColumn: "name",
        },
      }
    );
  });

  it("preserves an explicit empty gallery property list", () => {
    assert.deepEqual(
      normalizeTableViewConfig({
        gallery: {
          cardColumnIds: [],
          showCardLabels: false,
        },
      }),
      { gallery: { cardColumnIds: [], showCardLabels: false } }
    );
  });
});

describe("areTableViewConfigsEqual", () => {
  it("compares normalized view configs", () => {
    assert.equal(
      areTableViewConfigsEqual(
        { columnFilters: [], columnVisibility: {}, pageSize: 10 },
        { pageSize: 10 }
      ),
      true
    );
    assert.equal(
      areTableViewConfigsEqual(
        { globalSearch: "phone", pageSize: 10 },
        { globalSearch: "tablet", pageSize: 10 }
      ),
      false
    );
  });
});
