import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { products as seedProducts } from "../data";
import {
  createProductsLocalActions,
  EXAMPLE_PRODUCTS_STORAGE_KEY,
} from "./products-local-actions";

interface MemoryStorage {
  getItem: (key: string) => null | string;
  setItem: (key: string, value: string) => void;
}

function createMemoryStorage(): MemoryStorage {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  };
}

describe("products-local-actions", () => {
  it("loads seed data and persists it in storage when cache is empty", async () => {
    const storage = createMemoryStorage();
    const actions = createProductsLocalActions({ latencyMs: 0, storage });

    const response = await actions.list({ limit: 10, page: 1 });

    assert.equal(response.meta.totalCount, seedProducts.length);
    assert.equal(response.meta.pageCount, Math.ceil(seedProducts.length / 10));
    assert.equal(response.data.length, 10);
    assert.ok(storage.getItem(EXAMPLE_PRODUCTS_STORAGE_KEY));
  });

  it("keeps updates persistent across action instances", async () => {
    const storage = createMemoryStorage();
    const firstActions = createProductsLocalActions({ latencyMs: 0, storage });

    const updateResult = await firstActions.update("1", {
      name: "Updated Local Name",
    });
    assert.equal(updateResult.success, true);

    const secondActions = createProductsLocalActions({ latencyMs: 0, storage });
    const response = await secondActions.list({ limit: 100, page: 1 });
    const updatedProduct = response.data.find((product) => product.id === "1");

    assert.equal(updatedProduct?.name, "Updated Local Name");
  });

  it("deletes selected rows in bulk", async () => {
    const storage = createMemoryStorage();
    const actions = createProductsLocalActions({ latencyMs: 0, storage });

    const beforeDelete = await actions.list({ limit: 200, page: 1 });
    const deleteResult = await actions.bulkDelete(["1", "2", "3"]);
    const afterDelete = await actions.list({ limit: 200, page: 1 });

    assert.equal(deleteResult.success, true);
    assert.equal(afterDelete.meta.totalCount, beforeDelete.meta.totalCount - 3);
    assert.equal(
      afterDelete.data.some((product) => ["1", "2", "3"].includes(product.id)),
      false
    );
  });

  it("updates selected rows in bulk", async () => {
    const storage = createMemoryStorage();
    const actions = createProductsLocalActions({ latencyMs: 0, storage });

    const updateResult = await actions.bulkUpdate(["1", "2"], {
      status: "Out of Stock",
    });
    const response = await actions.list({ limit: 200, page: 1 });
    const product1 = response.data.find((product) => product.id === "1");
    const product2 = response.data.find((product) => product.id === "2");

    assert.equal(updateResult.success, true);
    assert.equal(product1?.status, "Out of Stock");
    assert.equal(product2?.status, "Out of Stock");
  });

  it("resets data back to seed values", async () => {
    const storage = createMemoryStorage();
    const actions = createProductsLocalActions({ latencyMs: 0, storage });

    const originalName = seedProducts.find(
      (product) => product.id === "1"
    )?.name;
    await actions.update("1", { name: "Custom Name Before Reset" });
    const resetResult = await actions.resetData();
    const response = await actions.list({ limit: 200, page: 1 });
    const product1 = response.data.find((product) => product.id === "1");

    assert.equal(resetResult.success, true);
    assert.equal(product1?.name, originalName);
  });

  it("falls back to seed data when persisted payload is corrupted", async () => {
    const storage = createMemoryStorage();
    storage.setItem(EXAMPLE_PRODUCTS_STORAGE_KEY, "{bad-json");
    const actions = createProductsLocalActions({ latencyMs: 0, storage });

    const response = await actions.list({ limit: 10, page: 1 });
    const repairedRawPayload = storage.getItem(EXAMPLE_PRODUCTS_STORAGE_KEY);

    assert.equal(response.meta.totalCount, seedProducts.length);
    assert.ok(repairedRawPayload);
    assert.doesNotThrow(() => JSON.parse(repairedRawPayload as string));
  });

  it("migrates legacy .example websites to .com on read", async () => {
    const storage = createMemoryStorage();
    const persistedProducts = seedProducts.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      website:
        product.id === "1"
          ? "https://www.apple.example/products/macbook-pro-16/"
          : product.website,
    }));
    storage.setItem(
      EXAMPLE_PRODUCTS_STORAGE_KEY,
      JSON.stringify(persistedProducts)
    );

    const actions = createProductsLocalActions({ latencyMs: 0, storage });
    const response = await actions.list({ limit: 10, page: 1 });
    const migratedProduct = response.data.find((product) => product.id === "1");
    const migratedRawPayload = storage.getItem(EXAMPLE_PRODUCTS_STORAGE_KEY);

    assert.equal(
      migratedProduct?.website,
      "https://www.apple.com/products/macbook-pro-16/"
    );
    assert.ok(migratedRawPayload);
    assert.equal(migratedRawPayload?.includes(".example"), false);
  });
});
