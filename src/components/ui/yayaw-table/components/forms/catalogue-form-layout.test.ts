import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { resolveCatalogueFormLayout } from "./catalogue-form-layout";

describe("resolveCatalogueFormLayout", () => {
  it("keeps the drawer presentation by default", () => {
    assert.deepEqual(resolveCatalogueFormLayout(), {
      mode: "drawer",
      width: "28rem",
    });
  });

  it("defaults modal forms to an 80vw surface", () => {
    assert.deepEqual(resolveCatalogueFormLayout({ mode: "modal" }), {
      mode: "modal",
      width: "80vw",
    });
  });

  it("allows a custom form width", () => {
    assert.deepEqual(
      resolveCatalogueFormLayout({ mode: "modal", width: "64rem" }),
      {
        mode: "modal",
        width: "64rem",
      }
    );
  });
});
