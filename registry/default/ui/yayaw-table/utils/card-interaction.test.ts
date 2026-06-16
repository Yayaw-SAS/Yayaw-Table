import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldActivateCardFromKeyboard } from "./card-interaction";

describe("card keyboard interaction", () => {
  it("activates cards with Enter or Space when the card itself has focus", () => {
    const currentTarget = {};

    assert.equal(
      shouldActivateCardFromKeyboard({
        currentTarget: currentTarget as EventTarget,
        key: "Enter",
        target: currentTarget as EventTarget,
      }),
      true
    );
    assert.equal(
      shouldActivateCardFromKeyboard({
        currentTarget: currentTarget as EventTarget,
        key: " ",
        target: currentTarget as EventTarget,
      }),
      true
    );
  });

  it("does not activate the card when a nested control has focus", () => {
    assert.equal(
      shouldActivateCardFromKeyboard({
        currentTarget: {} as EventTarget,
        key: "Enter",
        target: {} as EventTarget,
      }),
      false
    );
  });
});
