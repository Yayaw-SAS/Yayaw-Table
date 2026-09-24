import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pinSnapshotDependencies } from "../../scripts/registry-snapshot-pins.mjs";

const ITEMS = [
  "registry.json",
  "yayaw-table.json",
  "yayaw-table-vue.json",
  "yayaw-table-base.json",
  "font-yayaw-sans.json",
];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

/** Only a complete, synchronized snapshot may replace the public registry. */
export function registryPublication(root) {
  const readJson = (name) =>
    JSON.parse(readFileSync(resolve(root, name), "utf8"));
  const { version } = readJson("package.json");
  if (!SEMVER.test(version ?? "")) {
    throw new Error("Registry publication requires a semantic version.");
  }
  if (readJson("packages/yayaw-table-vue/package.json").version !== version) {
    throw new Error("React and Vue release versions must match.");
  }
  const snapshot = `public/r/v${version}`;
  let manifest;
  try {
    manifest = readJson(`${snapshot}/release.json`);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { status: "unversioned", version };
    }
    throw error;
  }
  if (
    manifest.version !== version ||
    manifest.files?.registry !== "registry.json"
  ) {
    throw new Error(
      "The registry release manifest has an inconsistent version or index."
    );
  }
  // Snapshots pin this registry's dependencies to their own version.
  const { homepage } = readJson("package.json");
  const itemNames = Object.keys(manifest.files?.items ?? {});
  for (const name of ITEMS) {
    if (
      name !== "registry.json" &&
      manifest.files?.items?.[name.slice(0, -5)] !== name
    ) {
      throw new Error(`The release manifest is missing ${name}.`);
    }
    // Missing committed snapshot files are corruption, not pending development.
    const released = readFileSync(resolve(root, snapshot, name), "utf8");
    const latest = pinSnapshotDependencies(
      readFileSync(resolve(root, "public/r", name), "utf8"),
      { homepage, itemNames, version }
    );
    if (latest !== released) {
      return { status: "unversioned", version };
    }
  }
  return { status: "versioned", version };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = registryPublication(resolve(process.argv[2] ?? "."));
  for (const [key, value] of Object.entries(result)) {
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    }
  }
  console.log(
    result.status === "versioned"
      ? `Public registry matches the complete v${result.version} snapshot.`
      : "Unreleased registry changes: CI validates them, but Pages keeps the previous release."
  );
}
