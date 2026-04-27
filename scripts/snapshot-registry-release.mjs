import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_REGISTRY_DIR = path.join(ROOT, "public", "r");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
const version = packageJson.version;
const allowOverwrite = process.env.ALLOW_VERSION_SNAPSHOT_OVERWRITE === "1";

if (!SEMVER_PATTERN.test(version)) {
  throw new Error(
    `package.json version must be valid SemVer, got "${version}".`
  );
}

const versionedRegistryDir = path.join(PUBLIC_REGISTRY_DIR, `v${version}`);
const releaseManifestPath = path.join(versionedRegistryDir, "release.json");

function assertFileExists(filePath, label) {
  if (fs.existsSync(filePath)) {
    return;
  }

  throw new Error(`${label} does not exist: ${filePath}`);
}

function writeImmutableFile(sourcePath, targetPath) {
  const sourceContent = fs.readFileSync(sourcePath);
  if (fs.existsSync(targetPath)) {
    const targetContent = fs.readFileSync(targetPath);
    if (!(sourceContent.equals(targetContent) || allowOverwrite)) {
      throw new Error(
        `Versioned registry snapshot already exists with different content: ${targetPath}\n` +
          "Bump package.json version before changing a published snapshot, or set ALLOW_VERSION_SNAPSHOT_OVERWRITE=1 for an intentional repair."
      );
    }
  }

  fs.writeFileSync(targetPath, sourceContent);
}

const latestIndexPath = path.join(PUBLIC_REGISTRY_DIR, "registry.json");
const versionedIndexPath = path.join(versionedRegistryDir, "registry.json");

assertFileExists(latestIndexPath, "Latest registry index");
fs.mkdirSync(versionedRegistryDir, { recursive: true });

const latestRegistry = JSON.parse(fs.readFileSync(latestIndexPath, "utf8"));
const itemFileNames = latestRegistry.items.map((item) => `${item.name}.json`);

for (const itemFileName of itemFileNames) {
  assertFileExists(
    path.join(PUBLIC_REGISTRY_DIR, itemFileName),
    `Latest registry item ${itemFileName}`
  );
}

writeImmutableFile(latestIndexPath, versionedIndexPath);

for (const itemFileName of itemFileNames) {
  writeImmutableFile(
    path.join(PUBLIC_REGISTRY_DIR, itemFileName),
    path.join(versionedRegistryDir, itemFileName)
  );
}

fs.writeFileSync(
  releaseManifestPath,
  `${JSON.stringify(
    {
      name: "yayaw-table",
      version,
      files: {
        registry: "registry.json",
        items: Object.fromEntries(
          latestRegistry.items.map((item) => [item.name, `${item.name}.json`])
        ),
      },
      latest: {
        registry: "../registry.json",
        items: Object.fromEntries(
          latestRegistry.items.map((item) => [
            item.name,
            `../${item.name}.json`,
          ])
        ),
      },
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(
  `Created registry snapshot public/r/v${version}/ for ${itemFileNames.length} item(s)`
);
