import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { registryPublication } from "./registry-publication.mjs";

const temporaryDirectories = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "table-publication-"));
  temporaryDirectories.push(root);
  const write = (file, value) => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  };
  write("package.json", { version: "3.1.1" });
  write("packages/yayaw-table-vue/package.json", { version: "3.1.1" });
  const items = [
    "yayaw-table",
    "yayaw-table-vue",
    "yayaw-table-base",
    "font-yayaw-sans",
  ];
  write("public/r/v3.1.1/release.json", {
    version: "3.1.1",
    files: {
      registry: "registry.json",
      items: Object.fromEntries(items.map((name) => [name, `${name}.json`])),
    },
  });
  for (const name of ["registry", ...items]) {
    write(`public/r/${name}.json`, { name });
    write(`public/r/v3.1.1/${name}.json`, { name });
  }
  return { root, write };
}

test("only exact React and Vue snapshot bytes are publishable", () => {
  const { root, write } = fixture();
  assert.deepEqual(registryPublication(root), {
    status: "versioned",
    version: "3.1.1",
  });
  for (const name of [
    "yayaw-table",
    "yayaw-table-vue",
    "yayaw-table-base",
    "font-yayaw-sans",
    "registry",
  ]) {
    write(`public/r/${name}.json`, { name, changed: true });
    assert.equal(registryPublication(root).status, "unversioned", name);
    write(`public/r/${name}.json`, { name });
  }
});

test("a new version without a snapshot cannot publish", () => {
  const { root, write } = fixture();
  write("package.json", { version: "3.1.2" });
  write("packages/yayaw-table-vue/package.json", { version: "3.1.2" });
  assert.equal(registryPublication(root).status, "unversioned");
});

test("version drift and corrupt snapshot metadata fail closed", () => {
  const { root, write } = fixture();
  write("packages/yayaw-table-vue/package.json", { version: "3.1.0" });
  assert.throws(() => registryPublication(root), VERSION_DRIFT);
  write("packages/yayaw-table-vue/package.json", { version: "3.1.1" });
  write("public/r/v3.1.1/release.json", { version: "3.1.0" });
  assert.throws(() => registryPublication(root), MANIFEST_DRIFT);
});

test("CI records the publication check in the artifact identity", () => {
  const workflow = readFileSync(
    new URL("../workflows/ci-tests.yml", import.meta.url),
    "utf8"
  );
  assert.match(workflow, PUBLICATION_CHECK);
  assert.match(workflow, ARTIFACT_STATUS);
});

const VERSION_DRIFT = /versions must match/;
const MANIFEST_DRIFT = /inconsistent version/;
const PUBLICATION_CHECK =
  /id: publication\s+run: node \.github\/scripts\/registry-publication\.mjs/;
const ARTIFACT_STATUS =
  /name: registry-pages-.*steps\.publication\.outputs\.status/;
