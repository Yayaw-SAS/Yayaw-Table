import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Row } from "@tanstack/react-table";
import {
  createConfiguredGroups,
  createKanbanGroups,
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
