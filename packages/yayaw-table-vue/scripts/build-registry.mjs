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
// Optional views ship as their own items so the table stays free of their dependencies.
const calendarRoot = join(sourceRoot, "calendar");
const isCalendarFile = (path) => path.startsWith(`${calendarRoot}/`);
const allSourceFiles = (await walk(sourceRoot)).filter((path) => {
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
const sourceFiles = allSourceFiles.filter((path) => !isCalendarFile(path));

const toRegistryFiles = async (paths) =>
  await Promise.all(
    paths.sort().map(async (path) => {
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
        type:
          extname(path) === ".css" ? "registry:style" : "registry:component",
        target,
      };
    })
  );
const files = await toRegistryFiles(sourceFiles);

const item = {
  $schema: "https://shadcn-vue.com/schema/registry-item.json",
  name: "yayaw-table-vue",
  type: "registry:block",
  title: "YaYaw Table Vue",
  description:
    "Full-featured Vue 3 data table with filters, URL state, saved views, CRUD forms, bulk actions, inline editing, Kanban, Gallery, and CSV export.",
  dependencies: [
    "@tanstack/vue-query@^5.90.0",
    "@tanstack/vue-table@9.2.4",
    "date-fns@^4.1.0",
    "lucide-vue-next@^1.0.0",
    "reka-ui@^2.10.4",
    "vue@^3.5.0",
    "vue-sonner@^2.0.9",
    "zod@^4.3.0",
  ],
  registryDependencies: [],
  files,
};

const calendarItem = {
  $schema: "https://shadcn-vue.com/schema/registry-item.json",
  name: "yayaw-table-vue-calendar",
  type: "registry:block",
  title: "YaYaw Table Vue Calendar",
  description:
    'Optional calendar display mode for YaYaw Table Vue (month, week and list), rendered with FullCalendar. Pass `calendarRenderer` to `display-mode-renderers` and add "calendar" to `table.displayModes`.',
  dependencies: ["@fullcalendar/vue3@^7.1.0", "temporal-polyfill@^1.0.5"],
  registryDependencies: ["https://table.yayaw.app/r/yayaw-table-vue.json"],
  files: await toRegistryFiles(allSourceFiles.filter(isCalendarFile)),
};

await mkdir(outputRoot, { recursive: true });
for (const registryItem of [item, calendarItem]) {
  await writeFile(
    join(outputRoot, `${registryItem.name}.json`),
    `${JSON.stringify(registryItem, null, 2)}\n`
  );
}
console.log(
  `Built ${files.length} Vue registry files and ${calendarItem.files.length} calendar files.`
);
