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
const latestIndexPath = path.join(publicRegistryDir, "registry.json");
const versionedRegistryDir = path.join(publicRegistryDir, expectedTag);
const manifestPath = path.join(publicRegistryDir, expectedTag, "release.json");
const standaloneRegistryItems = ["yayaw-table-vue"];

function fail(message) {
  throw new Error(message);
}

if (providedTag && providedTag !== expectedTag) {
  fail(
    `Release tag mismatch: expected ${expectedTag} from package.json, got ${providedTag}.`
  );
}

if (!fs.existsSync(latestIndexPath)) {
  fail(`Missing latest registry index: ${latestIndexPath}`);
}

if (!fs.existsSync(versionedRegistryDir)) {
  fail(
    `Missing versioned registry snapshot directory: ${versionedRegistryDir}\n` +
      "Run bun run registry:release before tagging this version."
  );
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing release manifest: ${manifestPath}`);
}

const latestRegistry = JSON.parse(fs.readFileSync(latestIndexPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const itemNames = [
  ...latestRegistry.items.map((item) => item.name),
  ...standaloneRegistryItems,
];
const expectedFileNames = [
  "registry.json",
  ...itemNames.map((itemName) => `${itemName}.json`),
];

for (const fileName of expectedFileNames) {
  const latestPath = path.join(publicRegistryDir, fileName);
  const versionedPath = path.join(versionedRegistryDir, fileName);

  if (!fs.existsSync(latestPath)) {
    fail(`Missing latest registry file: ${latestPath}`);
  }

  if (!fs.existsSync(versionedPath)) {
    fail(
      `Missing versioned registry file: ${versionedPath}\n` +
        "Run bun run registry:release after the final version bump."
    );
  }

  const latestContent = fs.readFileSync(latestPath);
  const versionedContent = fs.readFileSync(versionedPath);
  if (!latestContent.equals(versionedContent)) {
    fail(
      `Latest registry file ${fileName} and ${expectedTag} snapshot differ.\n` +
        "Run bun run registry:release after the final version bump."
    );
  }
}

for (const itemName of itemNames) {
  const itemFileName = `${itemName}.json`;
  if (manifest.files?.items?.[itemName] !== itemFileName) {
    fail(`Release manifest is missing item "${itemName}".`);
  }
}

console.log(`Verified registry release ${expectedTag}`);
