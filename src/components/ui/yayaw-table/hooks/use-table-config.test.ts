import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineTableConfig } from "../config/helpers";
import { resolveTableCatalogueConfig } from "./use-table-config";

describe("resolveTableCatalogueConfig", () => {
  it("preserves nested defineTableConfig table options", () => {
    const nestedConfig = defineTableConfig({
      id: "models",
      columns: {
        definitions: [
          {
            enableColumnFilter: true,
            enableSorting: true,
            header: "Name",
            id: "name",
            type: "text",
          },
        ],
        mandatory: ["name"],
        order: ["name"],
        sort: [{ desc: true, id: "name" }],
        visible: ["name"],
      },
      table: {
        allowEdit: true,
        allowViewSave: false,
        allowViewSharing: true,
        canEditRow: (row) => row.canManage === true,
        defaultDisplayMode: "kanban",
        displayModes: ["table", "kanban"],
        enableCalculations: false,
        enableColumnFilters: true,
        emptyState: {
          description: "Create a model to get started.",
          title: "No models",
        },
        enableRowClickEdit: true,
        enableRowSelection: false,
        enableSorting: true,
        kanban: {
          groupBy: "status",
        },
        layoutPreset: "admin",
        rowClickMode: "edit",
      },
      translations: {
        keys: { title: "models.title" },
        namespace: "models",
      },
    });

    const resolvedConfig = resolveTableCatalogueConfig(nestedConfig);

    assert.equal(resolvedConfig.table.enableCalculations, false);
    assert.equal(resolvedConfig.table.allowViewSave, false);
    assert.equal(resolvedConfig.table.allowViewSharing, true);
    assert.deepEqual(resolvedConfig.table.displayModes, ["table", "kanban"]);
    assert.equal(resolvedConfig.table.defaultDisplayMode, "kanban");
    assert.deepEqual(resolvedConfig.table.kanban, { groupBy: "status" });
    assert.equal(resolvedConfig.table.enableRowClickEdit, true);
    assert.equal(resolvedConfig.table.enableRowSelection, false);
    assert.equal(resolvedConfig.table.layoutPreset, "admin");
    assert.equal(resolvedConfig.table.density, "small");
    assert.equal(resolvedConfig.table.defaultPageSize, 20);
    assert.equal(resolvedConfig.table.rowClickMode, "edit");
    assert.deepEqual(resolvedConfig.table.emptyState, {
      description: "Create a model to get started.",
      show: true,
      title: "No models",
    });
    assert.equal(resolvedConfig.table.canEditRow?.({ canManage: true }), true);
    assert.deepEqual(resolvedConfig.columns.sort, [{ desc: true, id: "name" }]);
    assert.deepEqual(resolvedConfig.translations?.keys, {
      title: "models.title",
    });
  });

  it("still supports the flat provider config shape", () => {
    const resolvedConfig = resolveTableCatalogueConfig({
      allowEdit: false,
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      enableCalculations: false,
      enableRowClickEdit: true,
    });

    assert.equal(resolvedConfig.table.allowEdit, false);
    assert.equal(resolvedConfig.table.enableCalculations, false);
    assert.equal(resolvedConfig.table.enableRowClickEdit, true);
    assert.equal(resolvedConfig.table.enableColumnFilters, true);
    assert.equal(resolvedConfig.table.allowViewSave, true);
    assert.equal(resolvedConfig.table.allowViewSharing, false);
    assert.deepEqual(resolvedConfig.table.displayModes, ["table"]);
    assert.equal(resolvedConfig.table.defaultDisplayMode, "table");
  });

  it("applies preview layout defaults while preserving explicit overrides", () => {
    const resolvedConfig = resolveTableCatalogueConfig({
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      defaultPageSize: 50,
      enableRowSelection: true,
      layoutPreset: "preview",
      showToolbarHeader: true,
    });

    assert.equal(resolvedConfig.table.layoutPreset, "preview");
    assert.equal(resolvedConfig.table.density, "small");
    assert.equal(resolvedConfig.table.actionsAsIcons, true);
    assert.equal(resolvedConfig.table.defaultPageSize, 50);
    assert.equal(resolvedConfig.table.showToolbarHeader, true);
  });
});
