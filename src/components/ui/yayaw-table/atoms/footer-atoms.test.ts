import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStore } from "jotai";
import {
  columnCalculationsAtom,
  footerVisibleAtom,
  getColumnCalculationsStorageKey,
  getFooterVisibilityStorageKey,
} from "./footer-atoms";

describe("footer atoms", () => {
  it("builds deterministic storage keys per table", () => {
    assert.equal(
      getColumnCalculationsStorageKey("products"),
      "products-column-calculations"
    );
    assert.equal(getFooterVisibilityStorageKey("products"), "products-footer-visible");
    assert.notEqual(
      getFooterVisibilityStorageKey("orders"),
      getFooterVisibilityStorageKey("products")
    );
  });

  it("keeps footer visibility state isolated by tableId", () => {
    const store = createStore();

    assert.equal(store.get(footerVisibleAtom("products")), true);
    assert.equal(store.get(footerVisibleAtom("orders")), true);

    store.set(footerVisibleAtom("products"), false);

    assert.equal(store.get(footerVisibleAtom("products")), false);
    assert.equal(store.get(footerVisibleAtom("orders")), true);
  });

  it("keeps column calculations selections isolated by tableId", () => {
    const store = createStore();

    store.set(columnCalculationsAtom("products"), {
      amount: "sum",
    });

    assert.deepEqual(store.get(columnCalculationsAtom("products")), {
      amount: "sum",
    });
    assert.deepEqual(store.get(columnCalculationsAtom("orders")), {});
  });
});
