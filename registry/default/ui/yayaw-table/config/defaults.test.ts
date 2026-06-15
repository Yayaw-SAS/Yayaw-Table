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

  it("allows saving views but not sharing them by default", () => {
    assert.equal(defaultTableConfig.allowViewSave, true);
    assert.equal(defaultTableConfig.allowViewSharing, false);
  });

  it("uses the table display mode by default", () => {
    assert.deepEqual(defaultTableConfig.displayModes, ["table"]);
    assert.equal(defaultTableConfig.defaultDisplayMode, "table");
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

  it("applies layout preset defaults before explicit overrides", () => {
    const adminConfig = defineTableConfig({
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      id: "admin-products",
      table: {
        layoutPreset: "admin",
      },
      translations: {
        keys: {},
        namespace: "common",
      },
    });

    const explicitDensityConfig = defineTableConfig({
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      id: "wide-products",
      table: {
        density: "large",
        layoutPreset: "admin",
      },
      translations: {
        keys: {},
        namespace: "common",
      },
    });

    assert.equal(adminConfig.table.density, "small");
    assert.equal(adminConfig.table.defaultPageSize, 20);
    assert.equal(explicitDensityConfig.table.density, "large");
  });

  it("normalizes display modes and default display mode", () => {
    const config = defineTableConfig({
      columns: {
        definitions: [],
        mandatory: [],
        order: [],
        visible: [],
      },
      id: "products",
      table: {
        defaultDisplayMode: "gallery",
        displayModes: ["table", "kanban", "gallery"],
        gallery: {
          aspectRatio: "square",
          cardColumnIds: ["brand", "category"],
          imageColumn: "imageUrl",
          titleColumn: "name",
        },
        kanban: {
          groupBy: "status",
        },
      },
      translations: {
        keys: {},
        namespace: "common",
      },
    });

    assert.deepEqual(config.table.displayModes, ["table", "kanban", "gallery"]);
    assert.equal(config.table.defaultDisplayMode, "gallery");
    assert.deepEqual(config.table.gallery, {
      aspectRatio: "square",
      cardColumnIds: ["brand", "category"],
      imageColumn: "imageUrl",
      titleColumn: "name",
    });
    assert.deepEqual(config.table.kanban, { groupBy: "status" });
  });
});
