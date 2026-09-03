import { describe, expect, it } from "vitest";
import { parseBulkEditPatch, resolveBulkActionResult } from "./bulk-actions";

describe("bulk action results", () => {
  it("defaults successful callbacks to dismissing without clearing selection", () => {
    expect(resolveBulkActionResult(undefined, "Failed")).toEqual({
      success: true,
      clearSelection: false,
      closeMenu: true,
      message: undefined,
    });
  });

  it("preserves explicit selection and menu flags independently", () => {
    expect(
      resolveBulkActionResult(
        { success: true, closeMenu: true, clearSelection: false },
        "Failed"
      )
    ).toMatchObject({
      closeMenu: true,
      clearSelection: false,
    });
    expect(
      resolveBulkActionResult(
        { success: true, closeMenu: false, clearSelection: true },
        "Failed"
      )
    ).toMatchObject({
      closeMenu: false,
      clearSelection: true,
    });
  });

  it("uses an explicit closeMenu flag as the selection fallback, matching React", () => {
    expect(
      resolveBulkActionResult({ success: true, closeMenu: true }, "Failed")
    ).toMatchObject({
      closeMenu: true,
      clearSelection: true,
    });
  });

  it("does not apply successful deletion defaults to failed results", () => {
    expect(
      resolveBulkActionResult({ success: false, error: "Denied" }, "Failed", {
        clearSelection: true,
        closeMenu: true,
      })
    ).toEqual({
      success: false,
      clearSelection: false,
      closeMenu: false,
      message: "Denied",
    });
  });

  it("uses message, error, and fallback text in order", () => {
    expect(
      resolveBulkActionResult(
        { success: false, message: " Details ", error: "Denied" },
        "Failed"
      ).message
    ).toBe("Details");
    expect(
      resolveBulkActionResult(
        { success: false, message: " ", error: "Denied" },
        "Failed"
      ).message
    ).toBe("Denied");
    expect(resolveBulkActionResult({ success: false }, "Failed").message).toBe(
      "Failed"
    );
  });

  it("accepts object patches without discarding falsy or nested values", () => {
    expect(
      parseBulkEditPatch(
        '{"active":false,"amount":0,"note":null,"tags":[],"metadata":{"key":"value"}}'
      )
    ).toEqual({
      active: false,
      amount: 0,
      note: null,
      tags: [],
      metadata: { key: "value" },
    });
  });
});
