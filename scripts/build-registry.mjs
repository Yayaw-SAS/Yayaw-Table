/**
 * Builds the Shadcn registry: copies src/components/ui/yayaw-table + ui-custom into
 * registry/default/ui/yayaw-table, plus selected internal shadcn-compatible
 * helpers. Each file gets a "target" so the CLI installs only under
 * components/ui/yayaw-table/ and does not overwrite app-level shadcn files.
 *
 * Source of truth: src/components/ui/yayaw-table (and listed src/components/ui/custom files).
 * Do not edit registry/default/ by hand — it is overwritten by this script.
 *
 * After writing files, runs the project formatter (ultracite fix) on the
 * registry output so generated code matches project style and you don't need
 * to "fix" manually.
 *
 * Run from repo root: node scripts/build-registry.mjs
 * Or: bun run registry:sync
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REGISTRY_UI_ROOT = path.join(ROOT, "registry", "default", "ui");
const REGISTRY_BLOCK = path.join(REGISTRY_UI_ROOT, "yayaw-table");
const SRC_YAYAW_TABLE = path.join(
  ROOT,
  "src",
  "components",
  "ui",
  "yayaw-table"
);
const SRC_UI = path.join(ROOT, "src", "components", "ui");
const SRC_UI_CUSTOM = path.join(ROOT, "src", "components", "ui", "custom");
const UI_CUSTOM_FILES = [
  "loader.tsx",
  "icon.tsx",
  "stack-menu.tsx",
  "kanban.tsx",
];
const INTERNAL_UI_FILES = [
  {
    source: "calendar.tsx",
    target: "components/filters/calendar.tsx",
  },
];
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const TABLE_REGISTRY_ITEM_NAME = "yayaw-table";

const REGEX_TSX_CSS = /\.(tsx?|css)$/;
const REGEX_TEST_FILE = /\.(test|spec)\.[^.]+$/;
const REGEX_TS_EXT = /\.(tsx?|ts)$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getAllFiles(dir, base = dir) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...getAllFiles(full, base));
    } else if (e.isFile() && REGEX_TSX_CSS.test(e.name)) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

function assertDirectoryExists(dirPath, label) {
  if (fs.existsSync(dirPath)) {
    return;
  }

  throw new Error(
    `${label} source directory not found: ${dirPath}\n` +
      "Ensure source files exist at this exact location."
  );
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src).sort()) {
    if (REGEX_TEST_FILE.test(name)) {
      continue;
    }
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function relativeImport(fromFileRel, toPathRel) {
  const fromDir = path.dirname(fromFileRel);
  let r = path.relative(fromDir, toPathRel);
  r = r.replace(REGEX_TS_EXT, "");
  if (!r.startsWith(".")) {
    r = `./${r}`;
  }
  return r.replace(/\\/g, "/");
}

function transformContent(content, fileRel) {
  let out = content;

  // @/src/components/ui/yayaw-table/XXX -> relative path (no extension)
  out = out.replace(
    /from ["']@\/src\/components\/ui\/yayaw-table\/([^"']+)["']/g,
    (_, subPath) => {
      const toPath = subPath.replace(REGEX_TS_EXT, "");
      return `from "${relativeImport(fileRel, toPath)}"`;
    }
  );

  // @/components/ui/yayaw-table/XXX -> relative path (no extension)
  out = out.replace(
    /from ["']@\/components\/ui\/yayaw-table\/([^"']+)["']/g,
    (_, subPath) => {
      const toPath = subPath.replace(REGEX_TS_EXT, "");
      return `from "${relativeImport(fileRel, toPath)}"`;
    }
  );

  // @/src/components/ui/custom/* or @/components/ui/custom/*
  // -> relative to ui-custom in block
  out = out.replace(
    /from ["']@\/(?:src\/components\/ui\/custom|components\/ui\/custom)\/([^"']+)["']/g,
    (_, name) => `from "${relativeImport(fileRel, `ui-custom/${name}`)}"`
  );

  // The date filter owns its calendar internally so registry updates never
  // overwrite the host app's shadcn calendar component.
  if (fileRel === "components/filters/date-filter.tsx") {
    out = out.replace(
      /from ["']@\/(?:src\/components\/ui|components\/ui)\/calendar["']/g,
      'from "./calendar"'
    );
  }

  // @/src/components/ui/* or @/components/ui/* -> @/components/ui/*
  out = out.replace(
    /from ["']@\/(?:src\/components\/ui|components\/ui)\/([^"']+)["']/g,
    (_, name) => `from "@/components/ui/${name}"`
  );

  // explicit custom aliases -> relative
  out = out.replace(
    /from ["']@\/components\/ui\/custom\/loader["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/loader")}"`
  );

  // explicit custom aliases -> relative
  out = out.replace(
    /from ["']@\/components\/ui\/custom\/icon["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/icon")}"`
  );

  // In ui-custom/stack-menu only: ../../lib/utils -> @/lib/utils
  if (fileRel.startsWith("ui-custom/")) {
    out = out.replace(
      /from ["']\.\.\/\.\.\/lib\/utils["']/g,
      'from "@/lib/utils"'
    );
  }

  // Relative path to components/ui/* -> @/components/ui/*
  out = out.replace(
    /from ["'](\.\.\/)+components\/ui\/([^"']+)["']/g,
    (_, _back, name) => `from "@/components/ui/${name}"`
  );

  return out;
}

function getFileType(fileRel) {
  const rel = fileRel.replace(/\\/g, "/");
  if (rel.endsWith(".css")) {
    return "registry:style";
  }
  if (rel.includes("/hooks/") && rel.endsWith(".ts")) {
    return "registry:hook";
  }
  if (
    (rel.includes("/atoms/") ||
      rel.includes("/config/") ||
      rel.includes("/types/") ||
      rel.includes("/utils/")) &&
    rel.endsWith(".ts")
  ) {
    return "registry:lib";
  }
  if (rel.endsWith(".tsx") || rel.endsWith(".ts")) {
    return "registry:component";
  }
  return "registry:file";
}

function hasExplicitDependencyVersion(specifier) {
  if (specifier.startsWith("@")) {
    const scopeSeparatorIndex = specifier.indexOf("/");
    if (scopeSeparatorIndex === -1) {
      return false;
    }

    return specifier.indexOf("@", scopeSeparatorIndex + 1) !== -1;
  }

  return specifier.includes("@");
}

function assertUnversionedRegistryDependencies(registryItem) {
  const versionedDependencies = [];

  for (const field of ["dependencies", "devDependencies"]) {
    const dependencies = registryItem[field];
    if (!Array.isArray(dependencies)) {
      continue;
    }

    for (const dependency of dependencies) {
      if (hasExplicitDependencyVersion(dependency)) {
        versionedDependencies.push(`${field}: ${dependency}`);
      }
    }
  }

  if (versionedDependencies.length === 0) {
    return;
  }

  throw new Error(
    `${registryItem.name} registry dependencies must stay unversioned so ` +
      "consumer updates do not rewrite package ranges to older registry pins.\n" +
      versionedDependencies.join("\n")
  );
}

function getRegistryItemUrl(homepage, itemName) {
  return `${homepage}/r/${itemName}.json`;
}

// --- main ---

const packageJson = readJson(PACKAGE_JSON_PATH);

// 1) Clean and copy source table block
if (fs.existsSync(REGISTRY_BLOCK)) {
  fs.rmSync(REGISTRY_BLOCK, { recursive: true });
}
fs.mkdirSync(path.dirname(REGISTRY_BLOCK), { recursive: true });
assertDirectoryExists(SRC_YAYAW_TABLE, "yayaw-table");
assertDirectoryExists(SRC_UI, "ui");
assertDirectoryExists(SRC_UI_CUSTOM, "ui/custom");
copyRecursive(SRC_YAYAW_TABLE, REGISTRY_BLOCK);

// 2) Copy ui-custom (loader, icon, stack-menu)
const uiCustomDest = path.join(REGISTRY_BLOCK, "ui-custom");
fs.mkdirSync(uiCustomDest, { recursive: true });
for (const name of UI_CUSTOM_FILES) {
  const src = path.join(SRC_UI_CUSTOM, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(uiCustomDest, name));
  }
}

// 3) Copy internal shadcn-compatible helpers that must not be installed at
// app-level paths.
for (const file of INTERNAL_UI_FILES) {
  const src = path.join(SRC_UI, file.source);
  const dest = path.join(REGISTRY_BLOCK, file.target);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// 4) Transform imports in all files
const allRels = getAllFiles(REGISTRY_BLOCK);
for (const rel of allRels) {
  const full = path.join(REGISTRY_BLOCK, rel);
  let content = fs.readFileSync(full, "utf8");
  content = transformContent(content, rel);
  fs.writeFileSync(full, content, "utf8");
}

// 5) Build files array: path (in registry) + target (in project) so CLI
// installs only under components/ui/yayaw-table/
const registryPathPrefix = ["registry", "default", "ui", "yayaw-table"];
const targetDir = "components/ui/yayaw-table";

const files = allRels.map((rel) => {
  const relNorm = rel.replace(/\\/g, "/");
  const p = path.join(...registryPathPrefix, rel).replace(/\\/g, "/");
  return {
    path: p,
    type: getFileType(relNorm),
    target: `${targetDir}/${relNorm}`,
  };
});

// 6) Update registry.json
const registryPath = path.join(ROOT, "registry", "registry.json");
const registry = readJson(registryPath);
registry.homepage = packageJson.repository.url
  .replace(/^git\+/, "")
  .replace(/\.git$/, "");

const tableRegistryItem = registry.items.find(
  (item) => item.name === TABLE_REGISTRY_ITEM_NAME
);
if (!tableRegistryItem) {
  throw new Error(
    `Registry item "${TABLE_REGISTRY_ITEM_NAME}" not found in ${registryPath}.`
  );
}

tableRegistryItem.files = files;
assertUnversionedRegistryDependencies(tableRegistryItem);

for (const registryItem of registry.items) {
  // Keep dependency specifiers authored in registry.json. Auto-pinning them
  // from this workspace can force consumer projects back to older ranges.
  registryItem.meta = {
    ...(registryItem.meta ?? {}),
    registryUrl: getRegistryItemUrl(packageJson.homepage, registryItem.name),
    version: packageJson.version,
    versionedRegistryUrl: `${packageJson.homepage}/r/v${packageJson.version}/${registryItem.name}.json`,
  };
}
fs.writeFileSync(
  registryPath,
  `${JSON.stringify(registry, null, 2)}\n`,
  "utf8"
);

// 7) Run formatter on registry output so generated files match project style
try {
  execSync("bun x ultracite fix registry/default", {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch {
  console.warn(
    "build-registry: ultracite fix on registry/default failed or not found; run manually: bun x ultracite fix registry/default"
  );
}
