/**
 * Builds the Shadcn registry: copies src/ui/yayaw_table + ui-custom (from src/ui/custom)
 * into registry/default/ui/yayaw-table. Paths use the "ui" segment so the CLI installs
 * under the project's ui folder (e.g. ui/yayaw-table/).
 *
 * Run from repo root: node scripts/build-registry.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REGISTRY_BLOCK = path.join(
  ROOT,
  "registry",
  "default",
  "ui",
  "yayaw-table"
);
const SRC_YAYAW_TABLE = path.join(ROOT, "src", "ui", "yayaw_table");
const SRC_UI_CUSTOM = path.join(ROOT, "src", "ui", "custom");
const UI_CUSTOM_FILES = ["loader.tsx", "icon.tsx", "stack-menu.tsx"];

const REGEX_TSX_CSS = /\.(tsx?|css)$/;
const REGEX_TS_EXT = /\.(tsx?|ts)$/;
const REGEX_REGISTRY_PREFIX = /^registry\/default\/ui\/yayaw-table\//;

function getAllFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
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
  r = r.replace(REGEX_TS_EXT, "");
  if (!r.startsWith(".")) {
    r = `./${r}`;
  }
  return r.replace(/\\/g, "/");
}

function transformContent(content, fileRel) {
  let out = content;

  // @/ui/yayaw_table/XXX -> relative path (no extension)
  out = out.replace(
    /from ["']@\/ui\/yayaw_table\/([^"']+)["']/g,
    (_, subPath) => {
      const toPath = subPath.replace(REGEX_TS_EXT, "");
      return `from "${relativeImport(fileRel, toPath)}"`;
    }
  );

  // @/src/data-table/XXX (legacy) -> relative path
  out = out.replace(
    /from ["']@\/src\/data-table\/([^"']+)["']/g,
    (_, subPath) => {
      const toPath = subPath.replace(REGEX_TS_EXT, "");
      return `from "${relativeImport(fileRel, toPath)}"`;
    }
  );

  // @/src/components/ui-custom/* or @/ui/custom/* -> relative to ui-custom in block
  out = out.replace(
    /from ["']@\/(?:src\/components\/ui-custom|ui\/custom)\/([^"']+)["']/g,
    (_, name) => `from "${relativeImport(fileRel, `ui-custom/${name}`)}"`
  );

  // @/src/components/ui/* or @/ui/shadcn/* -> @/ui/shadcn/* (canonical for registry)
  out = out.replace(
    /from ["']@\/(?:src\/components\/ui|ui\/shadcn)\/([^"']+)["']/g,
    (_, name) => `from "@/ui/shadcn/${name}"`
  );

  // @/ui/custom/loader -> relative
  out = out.replace(
    /from ["']@\/components\/ui-custom\/loader["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/loader")}"`
  );

  // @/ui/custom/icon -> relative
  out = out.replace(
    /from ["']@\/components\/ui-custom\/icon["']/g,
    () => `from "${relativeImport(fileRel, "ui-custom/icon")}"`
  );

  // In ui-custom/stack-menu only: ../../lib/utils -> @/lib/utils
  if (fileRel.startsWith("ui-custom/")) {
    out = out.replace(
      /from ["']\.\.\/\.\.\/lib\/utils["']/g,
      'from "@/lib/utils"'
    );
  }

  // Relative path to components/ui/* or ui/shadcn/* -> @/ui/shadcn/*
  out = out.replace(
    /from ["'](\.\.\/)+(?:components\/ui|ui\/shadcn)\/([^"']+)["']/g,
    (_, _back, name) => `from "@/ui/shadcn/${name}"`
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

// --- main ---

// 1) Clean and copy data-table (under ui/ so CLI installs to ui/yayaw-table/)
if (fs.existsSync(REGISTRY_BLOCK)) {
  fs.rmSync(REGISTRY_BLOCK, { recursive: true });
}
fs.mkdirSync(path.dirname(REGISTRY_BLOCK), { recursive: true });
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

// 3) Transform imports in all files
const allRels = getAllFiles(REGISTRY_BLOCK);
for (const rel of allRels) {
  const full = path.join(REGISTRY_BLOCK, rel);
  let content = fs.readFileSync(full, "utf8");
  content = transformContent(content, rel);
  fs.writeFileSync(full, content, "utf8");
}

// 4) Build files array for registry (ui/ prefix → CLI installs to ui/yayaw-table/)
const registryPaths = allRels.map((rel) =>
  path.join("registry", "default", "ui", "yayaw-table", rel).replace(/\\/g, "/")
);

const files = registryPaths.map((p) => ({
  path: p,
  type: getFileType(p.replace(REGEX_REGISTRY_PREFIX, "")),
}));

// 5) Update registry.json
const registryPath = path.join(ROOT, "registry", "registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
registry.items[0].files = files;
fs.writeFileSync(
  registryPath,
  `${JSON.stringify(registry, null, 2)}\n`,
  "utf8"
);
