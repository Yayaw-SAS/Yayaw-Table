import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import type { Row } from "@/components/ui/yayaw-table/tanstack";
import {
  createConfiguredGroups,
  createKanbanGroups,
  getCardPropertyCells,
  shouldShowKanbanCardLabels,
  shouldUseConfiguredKanbanGroups,
} from "./kanban-view";

describe("Kanban group resolution", () => {
  it("uses configured lanes only for the configured grouping field", () => {
    assert.equal(
      shouldUseConfiguredKanbanGroups({
        configuredGroupBy: "status",
        groupBy: "status",
      }),
      true
    );

    assert.equal(
      shouldUseConfiguredKanbanGroups({
        configuredGroupBy: "status",
        groupBy: "category",
      }),
      false
    );
  });

  it("does not keep status lane presets after switching to category grouping", () => {
    const rows = [
      { original: { category: "Laptops", status: "In Stock" } },
      { original: { category: "Phones", status: "Low Stock" } },
    ] as unknown as Row<Record<string, unknown>>[];
    const configuredGroups = createConfiguredGroups(undefined);

    const groups = createKanbanGroups({
      configuredGroups,
      groupBy: "category",
      rows,
    });

    assert.deepEqual(
      groups.map((group) => group.label),
      ["Laptops", "Phones"]
    );
  });
});

describe("Kanban card labels", () => {
  it("hides property labels by default and keeps an opt-in", () => {
    assert.equal(shouldShowKanbanCardLabels(undefined), false);
    assert.equal(shouldShowKanbanCardLabels({}), false);
    assert.equal(shouldShowKanbanCardLabels({ showCardLabels: false }), false);
    assert.equal(shouldShowKanbanCardLabels({ showCardLabels: true }), true);
  });
});

describe("Kanban card properties", () => {
  it("preserves an explicit empty property list", () => {
    const row = {
      getVisibleCells: () => [
        { column: { id: "select" }, id: "select" },
        { column: { id: "name" }, id: "name" },
        { column: { id: "brand" }, id: "brand" },
        { column: { id: "price" }, id: "price" },
        { column: { id: "status" }, id: "status" },
        { column: { id: "actions" }, id: "actions" },
      ],
    } as unknown as Row<Record<string, unknown>>;

    assert.deepEqual(
      getCardPropertyCells({
        cardColumnIds: [],
        groupBy: "status",
        row,
        titleColumnId: "name",
      }),
      []
    );
    assert.deepEqual(
      getCardPropertyCells({
        cardColumnIds: ["price"],
        groupBy: "status",
        row,
        titleColumnId: "name",
      }).map((cell) => cell.column.id),
      ["price"]
    );
  });
});
