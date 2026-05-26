import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultTableConfig } from "./defaults";
import { defineTableConfig } from "./helpers";

describe("defaultTableConfig", () => {
  it("disables footer calculations by default", () => {
    assert.equal(defaultTableConfig.enableCalculations, false);
  });

  it("uses the default layout and empty-state behavior by default", () => {
    assert.equal(defaultTableConfig.layoutPreset, "default");
    assert.equal(defaultTableConfig.emptyState.show, true);
  });
});

describe("defineTableConfig", () => {
  it("keeps footer calculations disabled when no override is provided", () => {
    const config = defineTableConfig({
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      id: "products",
      translations: {
        keys: {},
        namespace: "common",
      },
    });

    assert.equal(config.table.enableCalculations, false);
  });

  it("merges nested empty-state overrides", () => {
    const config = defineTableConfig({
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      id: "products",
      table: {
        emptyState: {
          title: "No products",
        },
      },
      translations: {
        keys: {},
        namespace: "common",
      },
    });

    assert.equal(config.table.emptyState?.show, true);
    assert.equal(config.table.emptyState?.title, "No products");
  });
});
