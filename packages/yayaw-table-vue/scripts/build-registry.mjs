import { execSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
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
const chartRoot = join(sourceRoot, "chart");
const isChartFile = (path) => path.startsWith(`${chartRoot}/`);
const dashboardRoot = join(sourceRoot, "dashboard");
const isDashboardFile = (path) => path.startsWith(`${dashboardRoot}/`);
const mapRoot = join(sourceRoot, "map");
const isMapFile = (path) => path.startsWith(`${mapRoot}/`);
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
  (path) =>
    !(
      isCalendarFile(path) ||
      isChartFile(path) ||
      isDashboardFile(path) ||
      isMapFile(path) ||
      isConnectorFile(path)
    )
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
    "@internationalized/date@^3.5.0",
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

const chartItem = {
  $schema: "https://shadcn-vue.com/schema/registry-item.json",
  name: "yayaw-table-vue-chart",
  type: "registry:block",
  title: "YaYaw Table Vue Chart",
  description:
    'Optional chart display mode for YaYaw Table Vue (vertical and horizontal bars, line, area, bars and line, donut, funnel and number), rendered with Unovis as in shadcn-vue charts and an SVG funnel. Pass `chartRenderer` to `display-mode-renderers` and add "chart" to `table.displayModes`.',
  dependencies: ["@unovis/ts@^1.7.0", "@unovis/vue@^1.7.0"],
  registryDependencies: ["https://table.yayaw.app/r/yayaw-table-vue.json"],
  files: await toRegistryFiles(allSourceFiles.filter(isChartFile)),
};

const dashboardItem = {
  $schema: "https://shadcn-vue.com/schema/registry-item.json",
  name: "yayaw-table-vue-dashboard",
  type: "registry:block",
  title: "YaYaw Table Vue Dashboard",
  description:
    'Optional Notion-like dashboards and admin screens for YaYaw Table Vue: sections of 4-column grids (gridstack.js, loaded on demand) and full-width flows, whose widgets show saved or inline views of any source in any display mode, numbers, notes, full-page tables (the list page with its toolbar, saved views and URL) and the host\'s blocks, with dashboard filters sent to each source\'s list and aggregate requests and readers\' values kept in the URL. Sources load on demand from the host\'s catalogue; unavailable ones show a notice and are never removed. Admins edit screens in place (`canEdit` with `actions.dashboards.save`): sections, a widget dialog over the host\'s catalogue and blocks, and a view editor that is the live table, loaded in a chunk of its own. Documents are JSON version 2, validated on servers with the pure `dashboard/dashboard-schema.ts` (`validateDashboard`, `checkDashboardReferences`, `dashboardJsonSchema`). Render `<YayawDashboard :dashboard="…" :sources="…" :blocks="…" />` or `<YayawDashboard :actions="{ dashboards }" :tables="…" />`; the host stores dashboards (`list`, `load`, `save`, `remove`).',
  dependencies: ["gridstack@^14.0.0"],
  registryDependencies: ["https://table.yayaw.app/r/yayaw-table-vue.json"],
  files: await toRegistryFiles(allSourceFiles.filter(isDashboardFile)),
};

const mapItem = {
  $schema: "https://shadcn-vue.com/schema/registry-item.json",
  name: "yayaw-table-vue-map",
  type: "registry:block",
  title: "YaYaw Table Vue Map",
  description:
    'Optional map display mode for YaYaw Table Vue (markers from a location column, clusters, popups, list of records in view, "Search this area"), rendered with MapLibre GL like the React item\'s mapcn. The basemap comes from `table.map.style` or `table.map.styles`. Pass `mapRenderer` to `display-mode-renderers` and add "map" to `table.displayModes`.',
  dependencies: ["maplibre-gl@^6.11.1"],
  registryDependencies: ["https://table.yayaw.app/r/yayaw-table-vue.json"],
  files: await toRegistryFiles(allSourceFiles.filter(isMapFile)),
};

const connectorFiles = (name) =>
  toRegistryFiles(
    ["connector-model.ts", "sync-engine.ts", name].map((file) =>
      join(connectorsRoot, file)
    ),
    "registry:lib"
  );

const connectorItems = [
  {
    $schema: "https://shadcn-vue.com/schema/registry-item.json",
    name: "yayaw-table-vue-connector-notion",
    type: "registry:lib",
    title: "YaYaw Table Vue Notion Connector",
    description:
      'Optional, framework-agnostic server module that pushes table rows into a Notion database (upsert keyed by a "Yayaw ID" property) and syncs both ways with the shared sync engine (read, three-way merge, conflict rules, delete policies). Runs in Node 20+, Bun, Deno and edge runtimes; the host stores the token and the sync state, authorizes the push and calls it from its server.',
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
      'Optional, framework-agnostic server module that pushes table rows into a Google Sheets tab (upsert or replace, keyed by a "Yayaw ID" column) with a service account signed through Web Crypto, and syncs both ways with the shared sync engine. The host stores the key and the sync state, authorizes the push and calls it from its server.',
    dependencies: [],
    registryDependencies: [],
    files: await connectorFiles("google-sheets.ts"),
  },
];

await mkdir(outputRoot, { recursive: true });
for (const registryItem of [
  item,
  calendarItem,
  chartItem,
  dashboardItem,
  mapItem,
  ...connectorItems,
]) {
  await writeFile(
    join(outputRoot, `${registryItem.name}.json`),
    `${JSON.stringify(registryItem, null, 2)}\n`
  );
}
// JSON.stringify is not the project's JSON style: format the items so the
// committed registry (and its copies in the root public/r) pass `bun run check`.
execSync(`bun x ultracite fix ${relative(repositoryRoot, outputRoot)}`, {
  cwd: repositoryRoot,
  stdio: "inherit",
});
console.log(
  `Built ${files.length} Vue registry files, ${calendarItem.files.length} calendar files, ${chartItem.files.length} chart files, ${dashboardItem.files.length} dashboard files, ${mapItem.files.length} map files and ${connectorItems.length} connector items.`
);
