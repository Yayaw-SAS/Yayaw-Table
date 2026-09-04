import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import {
  createLocalTableViewActions,
  getTableViewsStorageKey,
  type TableViewStorageAdapter,
} from "./table-view-storage";

function createMemoryStorage(): TableViewStorageAdapter & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("createLocalTableViewActions", () => {
  it("creates, lists, updates, and deletes views", async () => {
    const storage = createMemoryStorage();
    let idCounter = 0;
    const actions = createLocalTableViewActions({
      idFactory: () => `view-${++idCounter}`,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      storage,
    });

    const created = await actions.create({
      config: {
        columnFilters: [{ id: "status", value: "available" }],
        pageSize: 50,
      },
      isDefault: true,
      name: "Available products",
      tableId: "products",
      tableType: "products",
    });

    assert.equal(created.success, true);
    assert.equal(created.data?.id, "view-1");

    const listed = await actions.list({
      tableId: "products",
      tableType: "products",
    });

    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].isDefault, true);

    const updated = await actions.update("view-1", {
      config: { globalSearch: "phone", pageSize: 20 },
      name: "Phone products",
      tableId: "products",
      tableType: "products",
    });

    assert.equal(updated.success, true);
    assert.deepEqual(updated.data?.config, {
      globalSearch: "phone",
      pageSize: 20,
    });
    assert.equal(updated.data?.name, "Phone products");

    const deleted = await actions.delete("view-1", {
      tableId: "products",
      tableType: "products",
    });

    assert.deepEqual(deleted, { success: true, data: { id: "view-1" } });

    const emptyList = await actions.list({
      tableId: "products",
      tableType: "products",
    });

    assert.deepEqual(emptyList.data, []);
  });

  it("returns an empty list for corrupted storage", async () => {
    const storage = createMemoryStorage();
    storage.setItem(getTableViewsStorageKey("products"), "{broken");
    const actions = createLocalTableViewActions({ storage });

    const listed = await actions.list({
      tableId: "products",
      tableType: "products",
    });

    assert.deepEqual(listed.data, []);
  });

  it("does not delete system views", async () => {
    const storage = createMemoryStorage();
    storage.setItem(
      getTableViewsStorageKey("products"),
      JSON.stringify([
        {
          config: { pageSize: 20 },
          createdById: "system",
          id: "system-default",
          isSystem: true,
          name: "System default",
          tableId: "products",
        },
      ])
    );
    const actions = createLocalTableViewActions({ storage });

    const deleted = await actions.delete("system-default", {
      tableId: "products",
      tableType: "products",
    });

    assert.equal(deleted.success, false);
    assert.equal(deleted.error, "Cannot delete a system view");
  });
});
