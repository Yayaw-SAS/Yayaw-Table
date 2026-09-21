import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  conventionalBump,
  derivedChangeset,
  pendingChangesets,
  planRelease,
} from "./release-plan.mjs";

const VERSION = "3.0.0";
const MALFORMED_VERSION = /semantic version/;
const WORKSPACE_FRONTMATTER = /^---\n"yayaw-table-workspace": minor\n---\n/;
const FEAT_ENTRY = /- feat\(gantt\): timeline/;
const BREAKING_ENTRY = /- fix\(core\)!: rename/;
const SILENT_ENTRIES = [/ci: workflow/, /docs: guide/, /Not conventional/];

test("an undescribed change opens the version pull request", () => {
  assert.deepEqual(
    planRelease({ pending: ["a.md", "b.md"], version: VERSION, tags: [] }),
    {
      action: "version",
      source: "changesets",
      pending: 2,
      unconventional: [],
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
      unconventional: [],
      reason: "v3.0.0 is described and untagged, so it is ready to publish.",
    }
  );
});

test("an existing tag never republishes", () => {
  assert.deepEqual(
    planRelease({ pending: [], version: VERSION, tags: ["v3.0.0"] }),
    {
      action: "none",
      unconventional: [],
      reason: "v3.0.0 is already released.",
    }
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

test("conventional commits name the bump they deserve", () => {
  assert.equal(conventionalBump(["feat(gantt): x", "docs: y"]).bump, "minor");
  assert.equal(conventionalBump(["fix: a", "feat: b"]).bump, "minor");
  assert.equal(conventionalBump(["fix: a", "perf: b"]).bump, "patch");
  assert.equal(conventionalBump(["feat!: drop it"]).bump, "major");
  assert.equal(conventionalBump(["refactor(core)!: rename"]).bump, "major");
});

test("commits that ship nothing to a consumer never move the version", () => {
  const derived = conventionalBump([
    "docs: guide",
    "ci: workflow",
    "chore: deps",
  ]);
  assert.equal(derived.bump, undefined);
  assert.deepEqual(derived.unconventional, []);
});

test("a subject outside the convention is reported, never guessed", () => {
  const derived = conventionalBump([
    "Align the Gantt with Kanban and Gallery (#152)",
    "wip(thing): unknown type",
    "feat: real work",
  ]);
  assert.equal(derived.bump, "minor");
  assert.deepEqual(derived.unconventional, [
    "Align the Gantt with Kanban and Gallery (#152)",
    "wip(thing): unknown type",
  ]);
});

test("commits alone describe a release when no changeset does", () => {
  const plan = planRelease({
    pending: [],
    version: VERSION,
    tags: ["v3.0.0"],
    commits: ["feat(gantt): timeline", "docs: guide"],
  });
  assert.equal(plan.action, "version");
  assert.equal(plan.source, "commits");
  assert.equal(plan.bump, "minor");
});

test("a hand-written changeset wins over the derived bump", () => {
  const plan = planRelease({
    pending: ["a.md"],
    version: VERSION,
    tags: [],
    commits: ["feat: something"],
  });
  assert.equal(plan.source, "changesets");
  assert.equal(plan.bump, undefined);
});

test("silent commits leave an untagged version ready to publish", () => {
  const plan = planRelease({
    pending: [],
    version: VERSION,
    tags: ["v2.9.0"],
    commits: ["docs: guide", "ci: workflow"],
  });
  assert.equal(plan.action, "tag");
  assert.equal(plan.tag, "v3.0.0");
});

test("silent commits after a published version release nothing", () => {
  const plan = planRelease({
    pending: [],
    version: VERSION,
    tags: ["v3.0.0"],
    commits: ["docs: guide"],
  });
  assert.equal(plan.action, "none");
});

test("the derived changeset lists only what shipped to a consumer", () => {
  const file = derivedChangeset("minor", [
    "feat(gantt): timeline",
    "fix(core)!: rename",
    "ci: workflow",
    "docs: guide",
    "Not conventional",
  ]);
  assert.match(file, WORKSPACE_FRONTMATTER);
  assert.match(file, FEAT_ENTRY);
  assert.match(file, BREAKING_ENTRY);
  for (const excluded of SILENT_ENTRIES) {
    assert.doesNotMatch(file, excluded);
  }
});

test("a merged release is tagged, never bumped a second time by its own commits", () => {
  // Exactly what main carries after a release pull request merges: the new
  // version, no tag for it yet, and every commit it just shipped still sitting
  // behind the previous tag.
  const plan = planRelease({
    pending: [],
    version: "3.1.0",
    tags: ["v3.0.0"],
    commits: ["feat(gantt): rows planning", "fix(core): a bug", "ci: workflow"],
  });
  assert.equal(plan.action, "tag");
  assert.equal(plan.tag, "v3.1.0");
});

test("the next release is derived only once the current one is tagged", () => {
  const commits = ["feat(gantt): rows planning"];
  assert.equal(
    planRelease({ pending: [], version: "3.1.0", tags: ["v3.0.0"], commits })
      .action,
    "tag"
  );
  const next = planRelease({
    pending: [],
    version: "3.1.0",
    tags: ["v3.0.0", "v3.1.0"],
    commits,
  });
  assert.equal(next.action, "version");
  assert.equal(next.bump, "minor");
});
