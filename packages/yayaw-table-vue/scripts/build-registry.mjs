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
// Connector server modules are framework-agnostic optional items too.
const connectorsRoot = join(sourceRoot, "connectors");
const isConnectorFile = (path) => path.startsWith(`${connectorsRoot}/`);
const sourceFiles = allSourceFiles.filter(
  (path) => !(isCalendarFile(path) || isConnectorFile(path))
);

const toRegistryFiles = async (paths, type = "registry:component") =>
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
        type: extname(path) === ".css" ? "registry:style" : type,
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

const connectorFiles = (name) =>
  toRegistryFiles(
    ["connector-model.ts", name].map((file) => join(connectorsRoot, file)),
    "registry:lib"
  );

const connectorItems = [
  {
    $schema: "https://shadcn-vue.com/schema/registry-item.json",
    name: "yayaw-table-vue-connector-notion",
    type: "registry:lib",
    title: "YaYaw Table Vue Notion Connector",
    description:
      'Optional, framework-agnostic server module that pushes table rows into a Notion database (upsert keyed by a "Yayaw ID" property). Runs in Node 20+, Bun, Deno and edge runtimes; the host stores the token, authorizes the push and calls it from its server.',
    dependencies: [],
    registryDependencies: [],
    files: await connectorFiles("notion.ts"),
  },
  {
    $schema: "https://shadcn-vue.com/schema/registry-item.json",
    name: "yayaw-table-vue-connector-google-sheets",
    type: "registry:lib",
    title: "YaYaw Table Vue Google Sheets Connector",
    description:
      'Optional, framework-agnostic server module that pushes table rows into a Google Sheets tab (upsert or replace, keyed by a "Yayaw ID" column) with a service account signed through Web Crypto. The host stores the key, authorizes the push and calls it from its server.',
    dependencies: [],
    registryDependencies: [],
    files: await connectorFiles("google-sheets.ts"),
  },
];

await mkdir(outputRoot, { recursive: true });
for (const registryItem of [item, calendarItem, ...connectorItems]) {
  await writeFile(
    join(outputRoot, `${registryItem.name}.json`),
    `${JSON.stringify(registryItem, null, 2)}\n`
  );
}
console.log(
  `Built ${files.length} Vue registry files, ${calendarItem.files.length} calendar files and ${connectorItems.length} connector items.`
);
