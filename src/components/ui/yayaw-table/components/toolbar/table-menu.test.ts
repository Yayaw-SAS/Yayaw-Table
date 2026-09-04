import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { buildMenuSectionState } from "./table-menu";

describe("buildMenuSectionState", () => {
  it("shows calculations section when enabled", () => {
    const sectionState = buildMenuSectionState({
      activeFiltersCount: 0,
      activeGroupingCount: 0,
      activeSortCount: 0,
      enableColumnFilters: false,
      enableCalculations: true,
      enableGrouping: false,
      enableSorting: false,
      filterableColumnsCount: 0,
      groupableColumnsCount: 0,
      hasHiddenColumns: false,
      hideableColumnsCount: 0,
      sortableColumnsCount: 0,
      useAdvancedFilters: false,
    });

    assert.equal(sectionState.canShowCalculationsSection, true);
    assert.equal(sectionState.hasAnyMenuSection, true);
  });

  it("hides calculations section when feature is disabled", () => {
    const sectionState = buildMenuSectionState({
      activeFiltersCount: 0,
      activeGroupingCount: 0,
      activeSortCount: 0,
      enableColumnFilters: false,
      enableCalculations: false,
      enableGrouping: false,
      enableSorting: false,
      filterableColumnsCount: 0,
      groupableColumnsCount: 0,
      hasHiddenColumns: false,
      hideableColumnsCount: 0,
      sortableColumnsCount: 0,
      useAdvancedFilters: false,
    });

    assert.equal(sectionState.canShowCalculationsSection, false);
    assert.equal(sectionState.hasAnyMenuSection, false);
  });
});
