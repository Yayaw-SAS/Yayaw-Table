import { execFileSync } from "node:child_process";

const ROOTS = [
  "src/components/ui/yayaw-table/",
  "src/components/ui/custom/",
  "packages/yayaw-table-vue/src/",
  "packages/yayaw-table-vue/registry/",
  "shared/",
  "registry/",
  "scripts/",
];
const FILES = new Set([
  "bun.lock",
  "packages/yayaw-table-vue/bun.lock",
  "src/components/ui/calendar.tsx",
  "packages/yayaw-table-vue/scripts/build-registry.mjs",
]);
const TEST_FILE =
  /(?:^|\/)(?:__tests__|tests|fixtures)(?:\/|$)|\.(?:test|spec)\.[^/]+$/;
const DOCUMENT = /\.(?:md|mdx)$/;
const MANIFESTS = ["package.json", "packages/yayaw-table-vue/package.json"];
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
  "resolutions",
];

/** A CSS fix or an unconventional subject must never silently skip versioning. */
export function isReleaseInput(file) {
  return (
    !(TEST_FILE.test(file) || DOCUMENT.test(file)) &&
    (FILES.has(file) || ROOTS.some((prefix) => file.startsWith(prefix)))
  );
}

/** Compare release inputs to this package's tag, never an unrelated newer tag. */
export function changedReleaseInputs(tag, cwd = ".") {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" });
  const files = git("diff", "--name-only", "--no-renames", tag, "HEAD")
    .trim()
    .split("\n")
    .filter(Boolean);
  const changed = files.filter(isReleaseInput);
  for (const file of MANIFESTS.filter((name) => files.includes(name))) {
    const before = JSON.parse(git("show", `${tag}:${file}`));
    const after = JSON.parse(git("show", `HEAD:${file}`));
    if (
      DEPENDENCY_FIELDS.some(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
      )
    ) {
      changed.push(file);
    }
  }
  return changed;
}
