import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
);
const version = packageJson.version;
const expectedTag = `v${version}`;
const providedTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const publicRegistryDir = path.join(ROOT, "public", "r");
const latestItemPath = path.join(publicRegistryDir, "yayaw-table.json");
const versionedItemPath = path.join(
  publicRegistryDir,
  expectedTag,
  "yayaw-table.json"
);
const manifestPath = path.join(publicRegistryDir, expectedTag, "release.json");

function fail(message) {
  throw new Error(message);
}

if (providedTag && providedTag !== expectedTag) {
  fail(
    `Release tag mismatch: expected ${expectedTag} from package.json, got ${providedTag}.`
  );
}

if (!fs.existsSync(latestItemPath)) {
  fail(`Missing latest registry item: ${latestItemPath}`);
}

if (!fs.existsSync(versionedItemPath)) {
  fail(
    `Missing versioned registry snapshot: ${versionedItemPath}\n` +
      "Run bun run registry:release before tagging this version."
  );
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing release manifest: ${manifestPath}`);
}

const latestContent = fs.readFileSync(latestItemPath);
const versionedContent = fs.readFileSync(versionedItemPath);
if (!latestContent.equals(versionedContent)) {
  fail(
    `Latest registry item and ${expectedTag} snapshot differ.\n` +
      "Run bun run registry:release after the final version bump."
  );
}

console.log(`Verified registry release ${expectedTag}`);
