import {
  aggregateChartRows,
  type ChartAggregateRequest,
} from "../src/components/ui/yayaw-table/utils/chart-model";
import type {
  GeocodeResult,
  LocationValue,
} from "../src/components/ui/yayaw-table/utils/location-model";
import type { MapTableConfig } from "../src/components/ui/yayaw-table/utils/map-model";
import type { ScheduleSettings } from "../src/components/ui/yayaw-table/utils/schedule-model";
import {
  type ListScope,
  rowInScope,
} from "../src/components/ui/yayaw-table/utils/scoped-rows";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import { createDemoFormLinks, demoFormResponses } from "./form-links";
import { createNotionConnector } from "./views-notion";
import { createSpreadsheetConnector } from "./views-spreadsheet";

const HOUR_MS = 3_600_000;
/** Posted some hours before the page loaded, so the feed reads "2 hr. ago". */
const postedHoursAgo = (hours: number) =>
  new Date(Date.now() - hours * HOUR_MS).toISOString();

/** Team updates shown by the "Updates" feed view: author, text and age. */
const viewsUpdates: Record<string, [string, string, number]> = {
  alpha: [
    "Ada Martin",
    "Alpha is live for the first customers. Sign-ups are ahead of plan and support volume is low.\n\nNext: the onboarding emails, the pricing page review and a short survey for the first twenty accounts. We will share the numbers at Friday's review, with the churn signals we are watching and the two support themes that came up most this week.",
    2,
  ],
  bravo: [
    "Léa Dubois",
    "The audit scope is agreed. Interviews start on Monday.",
    5,
  ],
  charlie: [
    "Sam Chen",
    "Display prototypes arrived. Two panels show uneven backlight, so we asked the supplier for a second batch before the pilot.",
    27,
  ],
  delta: ["Ada Martin", "Support contract archived after the renewal.", 76],
  echo: [
    "Léa Dubois",
    "Sensor calibration is done for the first lot; the second lot waits for parts.",
    200,
  ],
  foxtrot: [
    "Sam Chen",
    "Portal beta opened to the partner team. Feedback so far is about search and exports.",
    480,
  ],
};

/**
 * A small gazetteer: the demo's `geocode` action and the projects' sites. A
 * real host calls its geocoding provider (with its own key) on its server.
 */
export const demoPlaces: GeocodeResult[] = [
  {
    lat: 48.8566,
    lng: 2.3522,
    label: "Paris office",
    address: "Place de l’Hôtel de Ville, 75004 Paris",
  },
  {
    lat: 48.8918,
    lng: 2.2361,
    label: "La Défense hub",
    address: "Parvis de la Défense, 92800 Puteaux",
  },
  {
    lat: 45.764,
    lng: 4.8357,
    label: "Lyon workshop",
    address: "Place Bellecour, 69002 Lyon",
  },
  {
    lat: 44.8378,
    lng: -0.5792,
    label: "Bordeaux site",
    address: "Place de la Bourse, 33000 Bordeaux",
  },
  {
    lat: 50.6292,
    lng: 3.0573,
    label: "Lille branch",
    address: "Grand’Place, 59000 Lille",
  },
  {
    lat: 43.2965,
    lng: 5.3698,
    label: "Marseille port",
    address: "Quai du Port, 13002 Marseille",
  },
  {
    lat: 43.6047,
    lng: 1.4442,
    label: "Toulouse lab",
    address: "Place du Capitole, 31000 Toulouse",
  },
  {
    lat: 47.2184,
    lng: -1.5536,
    label: "Nantes studio",
    address: "Place Royale, 44000 Nantes",
  },
];

const place = (label: string): LocationValue | "" => {
  const found = demoPlaces.find((item) => item.label === label);
  return found ? { ...found } : "";
};

const DIACRITICS = /\p{M}/gu;
const fold = (text: string) =>
  text.normalize("NFD").replace(DIACRITICS, "").toLocaleLowerCase();

/** The demo's `actions.geocode`: places whose name or address contains the query. */
export function geocodeDemoPlaces(query: string): Promise<GeocodeResult[]> {
  const needle = fold(query.trim());
  return Promise.resolve(
    needle
      ? demoPlaces.filter((item) =>
          fold(`${item.label} ${item.address ?? ""}`).includes(needle)
        )
      : []
  );
}

/** Where each project happens; Echo has no site yet. */
const SITES: Record<string, string> = {
  alpha: "Paris office",
  bravo: "Lyon workshop",
  charlie: "Bordeaux site",
  delta: "Lille branch",
  foxtrot: "La Défense hub",
};

/** Gross margin of each project, read by the "Revenus et marge" chart. */
const MARGINS: Record<string, number> = {
  alpha: 0.62,
  bravo: 0.35,
  charlie: 0.18,
  delta: 0.41,
  echo: 0.27,
  foxtrot: 0.55,
};
/** Whether each project was invoiced: yes, no, or not known yet (Foxtrot). */
const INVOICED: Record<string, boolean | null> = {
  alpha: true,
  bravo: false,
  charlie: true,
  delta: true,
  echo: false,
  foxtrot: null,
};

/** Shared records and columns for the React and Vue view-switching examples and end-to-end tests. */
export const viewsRows = [
  ["alpha", "Alpha launch", "Software", "Active", 49, "2026-09-02"],
  ["bravo", "Bravo audit", "Service", "Draft", 120, "2026-09-05"],
  ["charlie", "Charlie display", "Hardware", "Active", 399, "2026-09-09"],
  ["delta", "Delta support", "Service", "Archived", 99, "2026-09-12"],
  ["echo", "Echo sensors", "Hardware", "Draft", 79, "2026-09-15"],
  ["foxtrot", "Foxtrot portal", "Software", "Active", 15, "2026-09-18"],
].map(([id, name, category, status, price, dueDate]) => ({
  id: String(id),
  name: String(name),
  category: String(category),
  status: String(status),
  price: Number(price),
  progress: (Number(price) % 100) / 100,
  dueDate: String(dueDate),
  site: place(SITES[String(id)] ?? ""),
  serialNumber: "",
  details: "",
  update: viewsUpdates[String(id)]?.[1] ?? "",
  author: viewsUpdates[String(id)]?.[0] ?? "",
  postedAt: postedHoursAgo(viewsUpdates[String(id)]?.[2] ?? 0),
  margin: MARGINS[String(id)] ?? 0,
  invoiced: INVOICED[String(id)] ?? null,
}));

const options = (values: string[]) =>
  values.map((value) => ({ value, label: value }));

export const viewsColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "category",
    header: "Category",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Software", "Hardware", "Service", "Other"]),
  },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options(["Active", "Draft", "Archived"]),
  },
  {
    id: "price",
    header: "Price",
    type: "number" as const,
    numberFormat: { currency: "EUR", locale: "en-US" },
  },
  {
    id: "progress",
    header: "Progress",
    type: "number" as const,
    numberFormat: { style: "percent" as const, display: "bar" as const },
  },
  { id: "dueDate", header: "Due", type: "date" as const },
  // Double-click a site to edit it: address suggestions come from `geocode`.
  { id: "site", header: "Site", type: "location" as const, inlineEdit: true },
  // Asked by the Request form's rules; hidden in the table by default.
  { id: "serialNumber", header: "Serial number", type: "text" as const },
  { id: "details", header: "Details", type: "text" as const },
  // Read by the "Updates" feed view; hidden in the table by default.
  { id: "update", header: "Update", type: "text" as const },
  { id: "author", header: "Author", type: "text" as const },
  {
    id: "postedAt",
    header: "Posted at",
    type: "date" as const,
    dateDisplayPreset: "dateTime" as const,
    // Stamped when an update is posted: forms never ask it.
    readonly: true,
  },
  // Read by charts ("Revenus et marge", yes/no groups); hidden in the table by default.
  {
    id: "margin",
    header: "Margin",
    type: "number" as const,
    numberFormat: { style: "percent" as const, maximumFractionDigits: 1 },
  },
  { id: "invoiced", header: "Invoiced", type: "boolean" as const },
];

/** Columns only the feed, forms and charts show. */
const HIDDEN_COLUMNS = new Set([
  "serialNumber",
  "details",
  "update",
  "author",
  "postedAt",
  "margin",
  "invoiced",
]);

/** Columns the examples show at first; the form and feed ones stay hidden. */
export const viewsVisibleColumns = viewsColumns
  .map((column) => column.id)
  .filter((id) => !HIDDEN_COLUMNS.has(id));

/**
 * Basemaps for the demo only: OpenFreeMap needs no key. The library ships no
 * tiles; hosts configure theirs (with their keys) in `table.map`.
 */
export const DEMO_MAP: MapTableConfig = {
  locationColumn: "site",
  titleColumn: "name",
  popupColumns: ["status", "price", "dueDate"],
  style: "positron",
  styles: [
    {
      id: "positron",
      label: "Positron (OpenFreeMap)",
      light: "https://tiles.openfreemap.org/styles/positron",
      dark: "https://tiles.openfreemap.org/styles/dark",
    },
    {
      id: "liberty",
      label: "Liberty (OpenFreeMap)",
      light: "https://tiles.openfreemap.org/styles/liberty",
    },
  ],
};

export const viewsTableOptions = {
  syncUrl: true,
  enableAdvancedFilters: true,
  manualOrder: true,
  coloredTags: false,
  defaultDisplayMode: "table" as const,
  displayModes: [
    "table",
    "list",
    "gallery",
    "kanban",
    "calendar",
    "chart",
    "feed",
    "map",
    "form",
  ] as (
    | "table"
    | "list"
    | "gallery"
    | "kanban"
    | "calendar"
    | "chart"
    | "feed"
    | "map"
    | "form"
  )[],
  // Three saved views as tabs keep the toolbar on one line; the rest are under "More".
  viewTabs: { maxVisible: 3 },
  // A bilingual site: forms are written in English and French.
  form: { locales: ["en", "fr"] },
  kanban: { groupBy: "status" },
  gallery: { titleColumn: "name", cardColumnIds: ["category", "status"] },
  list: { titleColumn: "name", cardColumnIds: ["status", "price", "dueDate"] },
  calendar: {
    dateColumn: "dueDate",
    titleColumn: "name",
    colorColumn: "status",
  },
  map: DEMO_MAP,
};

type ViewRow = (typeof viewsRows)[number];

/** Records sent from public or standalone forms, as the demo host stores them. */
const formResponseRows = (): ViewRow[] =>
  demoFormResponses().map(
    (response) => ({ ...viewsRows[0], ...response }) as ViewRow
  );

/** First-page rows for server rendering: the records plus form responses. */
export const initialViewsRows = (): ViewRow[] => [
  ...viewsRows,
  ...formResponseRows(),
];

/** Like a server: match the search in any value. */
function searchRows(rows: ViewRow[], params: Record<string, unknown>) {
  const query = String(params.search ?? params.q ?? "")
    .trim()
    .toLocaleLowerCase();
  const text = (value: unknown) =>
    value && typeof value === "object" ? JSON.stringify(value) : String(value);
  return query
    ? rows.filter((row) =>
        Object.values(row).some((value) =>
          text(value).toLocaleLowerCase().includes(query)
        )
      )
    : rows;
}

/**
 * Like a server: keep the rows matching the view's advanced filters and the
 * `requiredFilters` a dashboard joins to them (always AND).
 */
function filterRows(rows: ViewRow[], input: Record<string, unknown>) {
  const params = compatibleListParams(input);
  const rules = params.advancedFilters as Record<string, unknown>[];
  const required = Array.isArray(input.requiredFilters)
    ? (input.requiredFilters as Record<string, unknown>[])
    : [];
  if (!(rules.length || required.length)) {
    return rows;
  }
  const matches = (row: ViewRow) => (rule: Record<string, unknown>) =>
    matchesContractFilter(row[String(rule.columnId) as keyof ViewRow], rule);
  const matchesView = (row: ViewRow) =>
    params.advancedFilterJoin === "or" && rules.length
      ? rules.some(matches(row))
      : rules.every(matches(row));
  return rows.filter((row) => matchesView(row) && required.every(matches(row)));
}

/** Like a server: apply the first column sort (the manual order is kept). */
function sortRows(rows: ViewRow[], sorting: unknown[]) {
  const sort = sorting.find(
    (item): item is { id: keyof ViewRow; desc?: boolean } =>
      Boolean(item) &&
      typeof (item as { id?: unknown }).id === "string" &&
      (item as { id: string }).id !== "__manual"
  );
  if (!sort) {
    return rows;
  }
  const direction = sort.desc ? -1 : 1;
  return [...rows].sort((left, right) => {
    const a = left[sort.id];
    const b = right[sort.id];
    if (typeof a === "number" && typeof b === "number") {
      return (a - b) * direction;
    }
    return String(a).localeCompare(String(b)) * direction;
  });
}

/** The scopes the demo host received, for the end-to-end tests. */
function recordDemoScope(scope: ListScope | undefined) {
  const holder = globalThis as { yayawDemoScopes?: unknown[] };
  holder.yayawDemoScopes ??= [];
  holder.yayawDemoScopes.push(scope ?? null);
}

/**
 * In-memory host for the examples: `list` pages through the rows and applies
 * each view's own manual order; `reorder` stores it without touching records.
 */
export function createViewsActions(host: { aggregate?: boolean } = {}) {
  const records = viewsRows.map((row) => ({ ...row }));
  const orders = new Map<string, string[]>();
  const keyOf = (viewId: unknown) => String(viewId ?? "default");
  // The n8n schedule of each view; a real host stores it and runs it on a server.
  const schedules = new Map<string, ScheduleSettings>();
  const lastRuns = new Map<string, string>();
  // The table side of the Spreadsheet connector's syncs: the host's own records.
  let created = 0;
  const sheetTable = {
    columns: viewsColumns,
    rows: () => records,
    create: (values: Record<string, unknown>) => {
      created += 1;
      const id = `sheet-${created}`;
      records.push({
        id,
        name: "",
        category: "",
        status: "",
        price: 0,
        progress: 0,
        dueDate: "",
        site: "",
        serialNumber: "",
        details: "",
        update: "",
        author: "",
        postedAt: "",
        margin: 0,
        invoiced: null,
        ...values,
      } as ViewRow);
      return id;
    },
    update: (id: string, values: Record<string, unknown>) => {
      const record = records.find((row) => row.id === id);
      if (record) {
        Object.assign(record, values);
      }
      return Boolean(record);
    },
    remove: (id: string) => {
      const index = records.findIndex((row) => row.id === id);
      if (index >= 0) {
        records.splice(index, 1);
      }
      return index >= 0;
    },
  };
  const ordered = (viewId: unknown) => {
    const order = orders.get(keyOf(viewId));
    if (!order) {
      return records;
    }
    const position = new Map(order.map((id, index) => [id, index]));
    return [...records].sort(
      (left, right) =>
        (position.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (position.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  };
  // Responses sent from public or standalone forms join the records.
  const absorbFormResponses = () => {
    for (const response of formResponseRows()) {
      if (!records.some((row) => row.id === response.id)) {
        records.push(response);
      }
    }
  };
  return {
    list: (params: Record<string, unknown>) => {
      absorbFormResponses();
      const sorting = Array.isArray(params.sorting) ? params.sorting : [];
      const manual = sorting.some(
        (sort: { id?: string }) => sort?.id === "__manual"
      );
      const scope = params.scope as ListScope | undefined;
      recordDemoScope(scope);
      const rows = sortRows(
        filterRows(
          searchRows(manual ? ordered(params.viewId) : records, params),
          params
        ),
        sorting
      ).filter((row) => scope?.kind !== "bbox" || rowInScope(row, scope));
      // Like a server: one page of `pageSize` rows (the feed loads more).
      const pageSize = Number(params.pageSize);
      const size =
        Number.isInteger(pageSize) && pageSize > 0 ? pageSize : rows.length;
      const page = Math.max(1, Number(params.page) || 1);
      const pageRows = rows.slice((page - 1) * size, page * size);
      return Promise.resolve({
        // Like a server response: copies, so edits made since show up.
        data: pageRows.map((row) => ({ ...row })),
        meta: {
          pageCount: Math.max(1, Math.ceil(rows.length / Math.max(1, size))),
          totalCount: rows.length,
          // The map's area (`scope.kind: "bbox"`) is applied here.
          ...(scope?.kind === "bbox" ? { scope: "applied" } : {}),
        },
      });
    },
    // Chart groups computed "on the server" with the shared contract helper.
    // Column calculations are left to the table's list fallback.
    ...(host.aggregate === false
      ? {}
      : {
          aggregate: (query: object) => {
            const params = query as Record<string, unknown>;
            absorbFormResponses();
            if (!Array.isArray(params.groupBy)) {
              return Promise.reject(
                new Error("This demo host only answers chart groups.")
              );
            }
            return Promise.resolve(
              aggregateChartRows(
                filterRows(searchRows(records, params), params),
                params as unknown as ChartAggregateRequest
              )
            );
          },
        }),
    reorder: (move: {
      viewId: string | null;
      id: string;
      previousId?: string;
      nextId?: string;
    }) => {
      const ids = ordered(move.viewId)
        .map((row) => row.id)
        .filter((id) => id !== move.id);
      const index = move.previousId ? ids.indexOf(move.previousId) + 1 : 0;
      ids.splice(index, 0, move.id);
      orders.set(keyOf(move.viewId), ids);
      return Promise.resolve({ success: true });
    },
    update: (id: string, patch: Record<string, unknown>) => {
      const record = records.find((row) => row.id === String(id));
      if (record) {
        Object.assign(record, patch);
      }
      return Promise.resolve({ success: Boolean(record), data: record });
    },
    // Custom destinations: a real host would call a webhook or a connector.
    destinations: [
      {
        id: "n8n",
        label: "n8n",
        kind: "connect" as const,
        schedule: {
          load: (context: { viewId: string | null }) =>
            Promise.resolve(schedules.get(keyOf(context.viewId)) ?? null),
          save: (
            settings: ScheduleSettings,
            context: { viewId: string | null }
          ) => {
            schedules.set(keyOf(context.viewId), settings);
            return Promise.resolve();
          },
          status: (context: { viewId: string | null }) => {
            const lastRunAt = lastRuns.get(keyOf(context.viewId));
            return Promise.resolve(
              lastRunAt ? { lastRunAt, lastResult: "ok" as const } : null
            );
          },
        },
        run: async (context: {
          viewId: string | null;
          query: { search: string };
          loadRows: () => Promise<unknown[]>;
        }) => {
          const rows = await context.loadRows();
          lastRuns.set(keyOf(context.viewId), new Date().toISOString());
          return {
            message: `Sent ${rows.length} records to the n8n workflow`,
          };
        },
      },
      // A connector: the row opens the table's send screens instead of `run`.
      createSpreadsheetConnector(sheetTable),
      // A Notion connector whose database drifted: see the target check.
      createNotionConnector(),
      {
        id: "slack",
        label: "Slack",
        kind: "share" as const,
        run: (context: { url: string }) => ({
          message: `Posted ${new URL(context.url).search ? "this view" : "the table"} to #projects`,
        }),
      },
    ],
    // Public links for Form views; see examples/form-links.ts.
    formLinks: createDemoFormLinks(viewsColumns),
    // Address suggestions of location editors, from a small gazetteer.
    geocode: geocodeDemoPlaces,
    create: (values: Record<string, unknown>) => {
      const record = {
        ...records[0],
        ...values,
        id: `new-${records.length + 1}`,
      } as (typeof records)[number];
      records.push(record);
      return Promise.resolve({ success: true, data: record });
    },
  };
}

const chartView = (
  id: string,
  name: string,
  chart: Record<string, unknown>
) => ({
  id,
  tableId: "views",
  name,
  createdById: "demo",
  isGlobal: true,
  canEdit: false,
  canDelete: false,
  config: { displayMode: "chart" as const, chart },
});

/**
 * Saved chart views of the examples: revenue by category, projects by due
 * month, revenue with the average margin, the status pipeline and deliveries
 * adding up week after week.
 */
export const chartViews = [
  chartView("revenue-by-category", "Revenue by category", {
    type: "bar",
    xColumn: "category",
    metric: "sum",
    metricColumn: "price",
    showDataLabels: true,
  }),
  chartView("projects-over-time", "Projects over time", {
    type: "line",
    xColumn: "dueDate",
    bucket: "month",
    showDataLabels: true,
  }),
  // Bars in euros on the left, the margin in percent on the right.
  chartView("revenue-and-margin", "Revenus et marge", {
    type: "combo",
    xColumn: "category",
    metric: "sum",
    metricColumn: "price",
    lineMetric: "avg",
    lineMetricColumn: "margin",
    hideEmpty: true,
  }),
  chartView("pipeline", "Pipeline", {
    type: "funnel",
    xColumn: "status",
  }),
  chartView("cumulative-deliveries", "Livraisons cumulées", {
    type: "area",
    xColumn: "dueDate",
    bucket: "week",
    seriesColumn: "category",
    cumulative: true,
  }),
];

/**
 * The "Updates" feed view: team updates, newest first, three per page. It
 * turns loading on scroll off: "Load more" loads the next page.
 */
export const updatesFeedView = {
  id: "updates",
  tableId: "views",
  name: "Updates",
  createdById: "demo",
  isGlobal: true,
  canEdit: false,
  canDelete: false,
  config: {
    displayMode: "feed" as const,
    feed: {
      titleColumn: "name",
      authorColumn: "author",
      dateColumn: "postedAt",
      bodyColumn: "update",
      propertyColumnIds: ["status", "category", "dueDate"],
      pageSize: 3,
      infiniteScroll: false,
    },
  },
};
/** The "Sites" map view: projects on a map, colored by status. */
export const mapViews = [
  {
    id: "sites",
    tableId: "views",
    name: "Sites",
    createdById: "demo",
    isGlobal: true,
    canEdit: false,
    canDelete: false,
    config: {
      displayMode: "map" as const,
      map: { colorColumn: "status", popupColumns: ["status", "price"] },
    },
  },
];
