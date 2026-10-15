import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { tagAppearance } from "./tag-colors";
import { isTagTone, TAG_TONES, tagItemAppearance } from "./tag-items";

describe("tagItemAppearance", () => {
  it("tints a tag with its tone's theme color, even with coloredTags off", () => {
    for (const coloredTags of [true, false]) {
      assert.deepEqual(tagItemAppearance("42", "success", coloredTags), {
        colored: true,
        className: "yayaw-tag-tinted",
        style: { "--yayaw-tag-color": "var(--yayaw-success, #16a34a)" },
      });
    }
    assert.equal(
      tagItemAppearance("42", "danger").style?.["--yayaw-tag-color"],
      "var(--yayaw-danger, #dc2626)"
    );
  });

  it("draws a neutral tone muted, over the option's color", () => {
    assert.deepEqual(tagItemAppearance("42", "neutral", true, undefined, "red"), {
      colored: false,
    });
  });

  it("keeps the option color, the map and the hue without a known tone", () => {
    for (const tone of [undefined, "purple", 3]) {
      assert.deepEqual(
        tagItemAppearance("Ops", tone, true, { ops: "is-ops" }),
        tagAppearance("Ops", true, { ops: "is-ops" })
      );
      assert.deepEqual(
        tagItemAppearance("Ops", tone, true, undefined, "blue"),
        tagAppearance("Ops", true, undefined, "blue")
      );
    }
  });

  it("lists the four tones", () => {
    assert.deepEqual([...TAG_TONES], ["neutral", "success", "warning", "danger"]);
    assert.equal(isTagTone("warning"), true);
    assert.equal(isTagTone("green"), false);
  });
});
