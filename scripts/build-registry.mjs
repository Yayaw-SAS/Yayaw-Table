/**
 * Builds the Shadcn registry: copies data-table + ui-custom into registry/default/yayaw-table,
 * fixes imports for registry distribution, and updates registry.json files array.
 *
 * Run from repo root: node scripts/build-registry.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REGISTRY_BLOCK = path.join(ROOT, "registry", "default", "yayaw-table");
const SRC_DATA_TABLE = path.join(ROOT, "src", "data-table");
const SRC_UI_CUSTOM = path.join(ROOT, "src", "components", "ui-custom");
const UI_CUSTOM_FILES = ["loader.tsx", "icon.tsx", "stack-menu.tsx"];

function getAllFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...getAllFiles(full, base));
    } else if (e.isFile() && /\.(tsx?|css)$/.test(e.name)) {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
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
  r = r.replace(/\.(tsx?|ts)$/, "");
  if (!r.startsWith(".")) r = "./" + r;
  return r.replace(/\\/g, "/");
}

function transformContent(content, fileRel) {
  let out = content;

  // @/src/data-table/XXX -> relative path (no extension)
  out = out.replace(
    /from ["']@\/src\/data-table\/([^"']+)["']/g,
    (_, subPath) => {
      const toPath = subPath.replace(/\.(tsx?|ts)$/, "");
      return `from "${relativeImport(fileRel, toPath)}"`;
    }
  );

  // @/src/components/ui-custom/stack-menu -> relative to ui-custom
  out = out.replace(
    /from ["']@\/src\/components\/ui-custom\/stack-menu["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/stack-menu")}"`
  );

  // @/src/components/ui/input -> @/components/ui/input
  out = out.replace(
    /from ["']@\/src\/components\/ui\/input["']/g,
    () => 'from "@/components/ui/input"'
  );

  // @/components/ui-custom/loader -> relative
  out = out.replace(
    /from ["']@\/components\/ui-custom\/loader["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/loader")}"`
  );

  // @/components/ui-custom/icon -> relative
  out = out.replace(
    /from ["']@\/components\/ui-custom\/icon["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/icon")}"`
  );

  // In ui-custom/stack-menu only: ../../lib/utils -> @/lib/utils
  if (fileRel.startsWith("ui-custom/")) {
    out = out.replace(/from ["']\.\.\/\.\.\/lib\/utils["']/g, 'from "@/lib/utils"');
  }

  // Relative path to components/ui/* (e.g. ../../../components/ui/skeleton) -> @/components/ui/*
  out = out.replace(
    /from ["'](\.\.\/)+components\/ui\/([^"']+)["']/g,
    (_, _back, name) => `from "@/components/ui/${name}"`
  );

  return out;
}

function getFileType(fileRel) {
  const rel = fileRel.replace(/\\/g, "/");
  if (rel.endsWith(".css")) return "registry:style";
  if (rel.includes("/hooks/") && rel.endsWith(".ts")) return "registry:hook";
  if (
    (rel.includes("/atoms/") ||
      rel.includes("/config/") ||
      rel.includes("/types/") ||
      rel.includes("/utils/")) &&
    rel.endsWith(".ts")
  )
    return "registry:lib";
  if (rel.endsWith(".tsx") || rel.endsWith(".ts")) return "registry:component";
  return "registry:file";
}

// --- main ---

// 1) Clean and copy data-table
if (fs.existsSync(REGISTRY_BLOCK)) {
  fs.rmSync(REGISTRY_BLOCK, { recursive: true });
}
fs.mkdirSync(path.dirname(REGISTRY_BLOCK), { recursive: true });
copyRecursive(SRC_DATA_TABLE, REGISTRY_BLOCK);

// 2) Copy ui-custom (loader, icon, stack-menu)
const uiCustomDest = path.join(REGISTRY_BLOCK, "ui-custom");
fs.mkdirSync(uiCustomDest, { recursive: true });
for (const name of UI_CUSTOM_FILES) {
  const src = path.join(SRC_UI_CUSTOM, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(uiCustomDest, name));
  }
}

// 3) Transform imports in all files
const allRels = getAllFiles(REGISTRY_BLOCK);
for (const rel of allRels) {
  const full = path.join(REGISTRY_BLOCK, rel);
  let content = fs.readFileSync(full, "utf8");
  content = transformContent(content, rel);
  fs.writeFileSync(full, content, "utf8");
}

// 4) Build files array for registry (paths relative to project root for shadcn build)
const registryPaths = allRels.map((rel) =>
  path.join("registry", "default", "yayaw-table", rel).replace(/\\/g, "/")
);

const files = registryPaths.map((p) => ({
  path: p,
  type: getFileType(
    p.replace(/^registry\/default\/yayaw-table\//, "")
  ),
}));

// 5) Update registry.json
const registryPath = path.join(ROOT, "registry", "registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
registry.items[0].files = files;
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf8");

console.log("Registry built: %d files in registry/default/yayaw-table", allRels.length);
console.log("Run: npx shadcn@latest build --output public/r (or your docs public path)");
