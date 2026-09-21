import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pendingChangesets, planRelease } from "./release-plan.mjs";

const VERSION = "3.0.0";
const MALFORMED_VERSION = /semantic version/;

test("an undescribed change opens the version pull request", () => {
  assert.deepEqual(
    planRelease({ pending: ["a.md", "b.md"], version: VERSION, tags: [] }),
    {
      action: "version",
      pending: 2,
      reason: "2 changeset(s) describe an unreleased change.",
    }
  );
});

test("pending changesets win even when the current version is untagged", () => {
  const plan = planRelease({
    pending: ["a.md"],
    version: VERSION,
    tags: ["v2.9.0"],
  });
  assert.equal(plan.action, "version");
});

test("a described and untagged version is ready to publish", () => {
  assert.deepEqual(
    planRelease({ pending: [], version: VERSION, tags: ["v2.9.0"] }),
    {
      action: "tag",
      tag: "v3.0.0",
      reason: "v3.0.0 is described and untagged, so it is ready to publish.",
    }
  );
});

test("an existing tag never republishes", () => {
  assert.deepEqual(
    planRelease({ pending: [], version: VERSION, tags: ["v3.0.0"] }),
    { action: "none", reason: "v3.0.0 is already released." }
  );
});

test("prereleases are versioned and tagged like any other release", () => {
  assert.equal(
    planRelease({ pending: [], version: "3.1.0-rc.1", tags: [] }).tag,
    "v3.1.0-rc.1"
  );
});

test("a malformed version stops the release instead of tagging it", () => {
  for (const version of [undefined, "", "latest", "v3.0.0", "3.0"]) {
    assert.throws(
      () => planRelease({ pending: [], version, tags: [] }),
      MALFORMED_VERSION
    );
  }
});

test("only changeset entries count as pending work", () => {
  const directory = join(
    mkdtempSync(join(tmpdir(), "changeset-")),
    ".changeset"
  );
  mkdirSync(directory);
  for (const name of ["README.md", "config.json", "brave-pandas-smile.md"]) {
    writeFileSync(join(directory, name), "");
  }
  assert.deepEqual(pendingChangesets(directory), ["brave-pandas-smile.md"]);
});
