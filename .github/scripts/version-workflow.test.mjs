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
