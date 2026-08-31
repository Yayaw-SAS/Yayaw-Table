import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(packageRoot, "src");
const outputRoot = join(packageRoot, "public", "r");

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    })
  );
  return nested.flat();
};

const includedExtensions = new Set([".css", ".ts", ".vue"]);
const sourceFiles = (await walk(sourceRoot)).filter((path) => {
  if (!includedExtensions.has(extname(path))) {
    return false;
  }
  if (
    path.endsWith(".test.ts") ||
    path.endsWith("env.d.ts") ||
    path.endsWith("public-types.ts")
  ) {
    return false;
  }
  return true;
});

const files = await Promise.all(
  sourceFiles.sort().map(async (path) => {
    const sourcePath = relative(packageRoot, path);
    const target = join(
      "components",
      "ui",
      "yayaw-table-vue",
      relative(sourceRoot, path)
    );
    return {
      path: sourcePath,
      content: await readFile(path, "utf8"),
      type: extname(path) === ".css" ? "registry:style" : "registry:component",
      target,
    };
  })
);

const item = {
  $schema: "https://shadcn-vue.com/schema/registry-item.json",
  name: "yayaw-table-vue",
  title: "YaYaw Table Vue",
  description:
    "Full-featured Vue 3 data table with filters, URL state, saved views, CRUD forms, bulk actions, inline editing, Kanban, Gallery, and CSV export.",
  dependencies: [
    "@tanstack/vue-query@^5.90.0",
    "@tanstack/vue-table@8.21.3",
    "date-fns@^4.1.0",
    "vue@^3.5.0",
    "zod@^4.3.0",
  ],
  registryDependencies: [],
  files,
};

await mkdir(outputRoot, { recursive: true });
await writeFile(
  join(outputRoot, "yayaw-table-vue.json"),
  `${JSON.stringify(item, null, 2)}\n`
);
console.log(`Built ${files.length} Vue registry files.`);
