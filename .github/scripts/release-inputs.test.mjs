import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { changedReleaseInputs, isReleaseInput } from "./release-inputs.mjs";

const temporaryDirectories = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("both frameworks, shared contracts, styles and distribution tooling require versions", () => {
  for (const file of [
    "src/components/ui/yayaw-table/table.tsx",
    "src/components/ui/custom/icon.tsx",
    "packages/yayaw-table-vue/src/Table.vue",
    "shared/types.ts",
    "registry/registry.json",
    "scripts/build-registry.mjs",
  ]) {
    assert.equal(isReleaseInput(file), true, file);
  }
  for (const file of [
    ".github/workflows/ci-tests.yml",
    "docs/RELEASES.md",
    "src/components/ui/yayaw-table/a.test.ts",
    "shared/fixtures/data.json",
    "packages/yayaw-table-vue/demo/App.vue",
  ]) {
    assert.equal(isReleaseInput(file), false, file);
  }
});

test("git comparison catches deletions and dependency edits without releasing script-only manifest changes", () => {
  const root = mkdtempSync(join(tmpdir(), "release-inputs-"));
  temporaryDirectories.push(root);
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const write = (file, value) => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  };
  git("init");
  git("config", "user.name", "Release tests");
  git("config", "user.email", "release@example.test");
  write("package.json", { dependencies: { react: "19" } });
  write("packages/yayaw-table-vue/package.json", {
    dependencies: { vue: "3" },
  });
  write("src/components/ui/yayaw-table/old.ts", {});
  git("add", ".");
  git("commit", "-m", "initial");
  git("tag", "v3.1.1");
  write("package.json", {
    dependencies: { react: "19" },
    scripts: { check: "lint" },
  });
  git("add", ".");
  git("commit", "-m", "ci: tooling");
  assert.deepEqual(changedReleaseInputs("v3.1.1", root), []);
  rmSync(join(root, "src/components/ui/yayaw-table/old.ts"));
  write("packages/yayaw-table-vue/package.json", {
    dependencies: { vue: "4" },
  });
  git("add", ".");
  git("commit", "-m", "Update table");
  assert.deepEqual(changedReleaseInputs("v3.1.1", root), [
    "src/components/ui/yayaw-table/old.ts",
    "packages/yayaw-table-vue/package.json",
  ]);
});
