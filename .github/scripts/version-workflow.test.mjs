import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const WORKFLOW = readFileSync(
  new URL("../workflows/version.yml", import.meta.url),
  "utf8"
);

const EDIT_BY_BRANCH = /gh pr edit "\$VERSION_BRANCH"/;
const OPEN_PULL_REQUEST_LOOKUP =
  /gh pr list --head "\$VERSION_BRANCH" --base main --state open/;
const EDIT_BY_NUMBER = /gh pr edit "\$open_pr"/;
const DISPATCHES_RELEASE = /gh workflow run release\.yml/;
const ACTIONS_WRITE =
  /^permissions:(?:\n(?:\s+#.*|\s+\S+: \S+))*\n\s+actions: write$/m;

/**
 * `gh pr edit <branch>` resolves a branch to any pull request whose head it is,
 * merged ones included. The version branch is reused for every release, so
 * editing it by name retitles the release that already shipped and returns
 * before `gh pr create` ever runs — the shape that gave v3.1.0's pull request
 * v3.1.1's title and left v3.1.1 with none.
 */
test("the version pull request is only ever edited by number", () => {
  assert.doesNotMatch(WORKFLOW, EDIT_BY_BRANCH);
  assert.match(WORKFLOW, OPEN_PULL_REQUEST_LOOKUP);
  assert.match(WORKFLOW, EDIT_BY_NUMBER);
});

/**
 * A tag pushed with `GITHUB_TOKEN` starts no workflow run, so this workflow asks
 * for the Release run itself. `workflow_dispatch` is the documented exception to
 * that suppression, but creating one still needs `actions: write`: without it
 * GitHub answers "Resource not accessible by integration" and the version is
 * tagged and never published, which is how v3.1.1 first landed.
 */
test("dispatching the release run comes with permission to do it", () => {
  assert.match(WORKFLOW, DISPATCHES_RELEASE);
  assert.match(WORKFLOW, ACTIONS_WRITE);
});
