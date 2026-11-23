import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import { tagAppearance } from "./tag-colors";
import {
  isTagTone,
  TAG_TONES,
  tagActionMenuZIndex,
  tagItemAppearance,
} from "./tag-items";

it("keeps the tag menu above a hosting dialog's final layer during a z-index transition", () => {
  const surface = document.createElement("div");
  const tag = document.createElement("button");
  surface.append(tag);
  surface.style.zIndex = "50";
  Object.defineProperty(surface, "getAnimations", {
    value: () => [
      {
        effect: { getKeyframes: () => [{ zIndex: "50" }, { zIndex: "4700" }] },
      },
    ],
  });
  assert.equal(tagActionMenuZIndex(tag, 50), 4701);
  surface.style.zIndex = "6000";
  assert.equal(tagActionMenuZIndex(tag, 50), 6001);
});

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
      "var(--yayaw-danger, var(--destructive, #dc2626))"
    );
    assert.equal(
      tagItemAppearance("42", "info").style?.["--yayaw-tag-color"],
      "var(--yayaw-info, var(--primary, #2563eb))"
    );
  });

  it("draws a neutral tone muted, over the option's color", () => {
    assert.deepEqual(
      tagItemAppearance("42", "neutral", true, undefined, "red"),
      {
        colored: false,
      }
    );
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

  it("lists the five tones", () => {
    assert.deepEqual(
      [...TAG_TONES],
      ["neutral", "success", "warning", "danger", "info"]
    );
    assert.equal(isTagTone("info"), true);
    assert.equal(isTagTone("warning"), true);
    assert.equal(isTagTone("green"), false);
  });
});
