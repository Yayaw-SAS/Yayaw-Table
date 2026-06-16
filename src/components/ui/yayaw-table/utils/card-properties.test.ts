import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCompactCardPropertiesClassName,
  getCompactCardPropertyClassName,
} from "./card-properties";

const GRID_CLASS_PATTERN = /\bgrid\b/;
const TWO_COLUMN_GRID_CLASS_PATTERN = /\bgrid-cols-2\b/;
const MIN_WIDTH_CLASS_PATTERN = /\bmin-w-0\b/;

describe("card property layout helpers", () => {
  it("uses a compact two-column grid for unlabeled card properties", () => {
    assert.match(getCompactCardPropertiesClassName(), GRID_CLASS_PATTERN);
    assert.match(
      getCompactCardPropertiesClassName(),
      TWO_COLUMN_GRID_CLASS_PATTERN
    );
    assert.match(getCompactCardPropertyClassName(), MIN_WIDTH_CLASS_PATTERN);
  });
});
