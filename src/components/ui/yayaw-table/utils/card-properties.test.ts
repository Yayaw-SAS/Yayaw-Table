import { describe, it } from "bun:test";
import assert from "node:assert/strict";
import {
  getCompactCardPropertiesClassName,
  getCompactCardPropertyClassName,
} from "./card-properties";

const FLEX_CLASS_PATTERN = /\bflex\b/;
const WRAP_CLASS_PATTERN = /\bflex-wrap\b/;
const MIN_WIDTH_CLASS_PATTERN = /\bmin-w-0\b/;

describe("card property layout helpers", () => {
  it("wraps unlabeled card properties without reserving separate rows", () => {
    assert.match(getCompactCardPropertiesClassName(), FLEX_CLASS_PATTERN);
    assert.match(getCompactCardPropertiesClassName(), WRAP_CLASS_PATTERN);
    assert.match(getCompactCardPropertyClassName(), MIN_WIDTH_CLASS_PATTERN);
  });
});
