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
        canEditRow: (row) => row.canManage === true,
        enableCalculations: false,
        enableColumnFilters: true,
        enableRowClickEdit: true,
        enableRowSelection: false,
        enableSorting: true,
      },
      translations: {
        keys: { title: "models.title" },
        namespace: "models",
      },
    });

    const resolvedConfig = resolveTableCatalogueConfig(nestedConfig);

    assert.equal(resolvedConfig.table.enableCalculations, false);
    assert.equal(resolvedConfig.table.enableRowClickEdit, true);
    assert.equal(resolvedConfig.table.enableRowSelection, false);
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
  });
});
