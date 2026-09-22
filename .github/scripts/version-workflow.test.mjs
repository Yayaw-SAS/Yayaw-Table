import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const RUN_INDENT = /^ {10}/gm;
const RELEASE_RECOVERY = /if: steps\.plan\.outputs\.action != 'version'/;

test("a retry dispatches a missing GitHub release even when its tag already exists", () => {
  const step = WORKFLOW.split("      - name: Publish the GitHub release\n")[1];
  assert.match(step, RELEASE_RECOVERY);
  const script = step.split("        run: |\n")[1].replace(RUN_INDENT, "");
  const directory = mkdtempSync(join(tmpdir(), "release-recovery-"));
  try {
    const log = join(directory, "requests.jsonl");
    const gh = join(directory, "gh");
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ version: "3.1.1" })
    );
    writeFileSync(
      gh,
      `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.REQUEST_LOG, JSON.stringify(args) + "\\n");
if (args[0] === "release") process.exit(process.env.RELEASE_EXISTS === "true" ? 0 : 1);
if (args[0] === "run") console.log("123");
`
    );
    chmodSync(gh, 0o755);
    for (const exists of ["true", "false"]) {
      writeFileSync(log, "");
      execFileSync("bash", ["-c", script], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          REQUEST_LOG: log,
          RELEASE_EXISTS: exists,
        },
      });
      const requests = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.deepEqual(requests[0], [
        "release",
        "view",
        "v3.1.1",
        "--json",
        "tagName",
      ]);
      const dispatches = requests.filter((args) => args[0] === "workflow");
      assert.deepEqual(
        dispatches,
        exists === "true"
          ? []
          : [["workflow", "run", "release.yml", "--ref", "v3.1.1"]]
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
