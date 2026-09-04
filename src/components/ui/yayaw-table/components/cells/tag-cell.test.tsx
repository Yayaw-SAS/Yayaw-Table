import assert from "node:assert/strict";
import { describe, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TagCell } from "./tag-cell";

const NATIVE_TABLES_PATTERN = /native_tables/;
const RUNTIME_API_PATTERN = /runtime_api/;
const COMBINED_TAG_PATTERN = /native_tables,runtime_api/;
const ALPHA_PATTERN = /alpha/;
const BETA_PATTERN = /beta/;
const EMPTY_FALLBACK_PATTERN = />-</;

describe("TagCell", () => {
  it("renders array values as separate badges", () => {
    const html = renderToStaticMarkup(
      <TagCell value={["native_tables", "runtime_api"]} />
    );

    assert.match(html, NATIVE_TABLES_PATTERN);
    assert.match(html, RUNTIME_API_PATTERN);
    assert.doesNotMatch(html, COMBINED_TAG_PATTERN);
  });

  it("unwraps set payloads and ignores empty tag values", () => {
    const html = renderToStaticMarkup(
      <TagCell value={{ set: ["alpha", "", null, "beta"] }} />
    );

    assert.match(html, ALPHA_PATTERN);
    assert.match(html, BETA_PATTERN);
  });

  it("renders a muted fallback for empty values", () => {
    const html = renderToStaticMarkup(<TagCell value={[]} />);

    assert.match(html, EMPTY_FALLBACK_PATTERN);
  });
});
