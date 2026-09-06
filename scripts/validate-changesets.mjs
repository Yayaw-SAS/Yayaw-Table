import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changesetDirectory = path.join(root, ".changeset");
const releaseTarget = "yayaw-table-workspace";
const frontmatterBoundary = "---";
const packageReleasePattern =
  /^(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9@/_.-]+))\s*:\s*(patch|minor|major)\s*$/;

const changesetFiles = fs
  .readdirSync(changesetDirectory)
  .filter((fileName) => fileName.endsWith(".md") && fileName !== "README.md")
  .sort();

for (const fileName of changesetFiles) {
  const filePath = path.join(changesetDirectory, fileName);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  if (lines[0] !== frontmatterBoundary) {
    throw new Error(
      `Changeset ${fileName} is missing its opening frontmatter.`
    );
  }

  const closingBoundary = lines.indexOf(frontmatterBoundary, 1);
  if (closingBoundary < 2) {
    throw new Error(`Changeset ${fileName} has empty or invalid frontmatter.`);
  }

  for (const line of lines.slice(1, closingBoundary)) {
    if (!line.trim()) {
      continue;
    }
    const match = line.match(packageReleasePattern);
    if (!match) {
      throw new Error(
        `Changeset ${fileName} has an invalid release entry: ${line}`
      );
    }
    const packageName = match[1] ?? match[2] ?? match[3];
    if (packageName !== releaseTarget) {
      throw new Error(
        `Changeset ${fileName} targets ${packageName}. Use ${releaseTarget}; the Vue version is synchronized from the root release.`
      );
    }
  }
}

console.log(`Validated ${changesetFiles.length} pending changeset(s).`);
