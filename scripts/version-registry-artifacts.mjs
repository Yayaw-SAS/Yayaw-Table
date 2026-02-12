import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_R_DIR = path.join(ROOT, "public", "r");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

const BASE_ARTIFACTS = ["registry.json", "yayaw-table.json"];
const VERSIONED_SUFFIX_REGEX = /-v[^/]+\.json$/;
const INVALID_TOKEN_REGEX = /[^a-zA-Z0-9._-]/g;
const JSON_EXTENSION_REGEX = /\.json$/;

function assertFileExists(filePath, label) {
  if (fs.existsSync(filePath)) {
    return;
  }

  throw new Error(`${label} not found: ${filePath}`);
}

function getPackageVersion() {
  assertFileExists(PACKAGE_JSON_PATH, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  const version = packageJson.version;

  if (typeof version === "string" && version.length > 0) {
    return version;
  }

  throw new Error("package.json version is missing or invalid");
}

function sanitizeToken(token) {
  return token.replace(INVALID_TOKEN_REGEX, "-");
}

function getBuildToken() {
  if (typeof process.env.GITHUB_SHA === "string" && process.env.GITHUB_SHA) {
    return sanitizeToken(process.env.GITHUB_SHA.slice(0, 8));
  }

  try {
    const shortSha = execSync("git rev-parse --short HEAD", {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    if (shortSha.length > 0) {
      return sanitizeToken(shortSha);
    }
  } catch {
    // fallback below
  }

  return Date.now().toString(36);
}

function getVersionedName(baseName, versionTag) {
  const normalized = baseName.replace(JSON_EXTENSION_REGEX, "");
  return `${normalized}-v${versionTag}.json`;
}

function removePreviousVersionedArtifacts(baseName, keepName) {
  const normalized = baseName.replace(JSON_EXTENSION_REGEX, "");
  const prefix = `${normalized}-v`;

  const entries = fs.readdirSync(PUBLIC_R_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.startsWith(prefix)) {
      continue;
    }
    if (!VERSIONED_SUFFIX_REGEX.test(entry.name)) {
      continue;
    }
    if (entry.name === keepName) {
      continue;
    }

    fs.rmSync(path.join(PUBLIC_R_DIR, entry.name));
  }
}

function main() {
  const version = getPackageVersion();
  const buildToken = getBuildToken();
  const versionTag = `${version}-${buildToken}`;

  const generated = {};

  for (const baseName of BASE_ARTIFACTS) {
    const sourcePath = path.join(PUBLIC_R_DIR, baseName);
    assertFileExists(sourcePath, `Base registry artifact (${baseName})`);

    const versionedName = getVersionedName(baseName, versionTag);
    const versionedPath = path.join(PUBLIC_R_DIR, versionedName);

    removePreviousVersionedArtifacts(baseName, versionedName);
    fs.copyFileSync(sourcePath, versionedPath);
    generated[baseName] = versionedName;
  }

  const manifest = {
    artifacts: {
      registry: generated["registry.json"],
      yayawTable: generated["yayaw-table.json"],
    },
    build: buildToken,
    generatedAt: new Date().toISOString(),
    version,
  };

  fs.writeFileSync(
    path.join(PUBLIC_R_DIR, "latest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  process.stdout.write(
    `version-registry-artifacts: created ${manifest.artifacts.registry} and ${manifest.artifacts.yayawTable}\n`
  );
}

main();
