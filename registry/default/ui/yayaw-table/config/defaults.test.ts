import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultTableConfig } from "./defaults";
import { defineTableConfig } from "./helpers";

describe("defaultTableConfig", () => {
  it("disables footer calculations by default", () => {
    assert.equal(defaultTableConfig.enableCalculations, false);
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
});
