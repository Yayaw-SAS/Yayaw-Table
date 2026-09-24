import {
  aggregateChartRows,
  type ChartAggregateRequest,
} from "../src/components/ui/yayaw-table/utils/chart-model";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import type { Dashboard } from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

/**
 * The format matrix: one field per value format. The React and Vue demos
 * (`?example=formats`, `?example=formats-dashboard`, `&locale=fr`) and
 * `e2e/value-formats.spec.ts` share it, so every surface can be checked for
 * the same text in both editions.
 */
export const formatColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: [
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
    ],
  },
  // Currency in the table locale: "€2,499.00" / "2 499,00 €".
  {
    id: "amount",
    header: "Amount",
    type: "number" as const,
    numberFormat: { style: "currency" as const, currency: "EUR" },
    defaultCalculation: "sum" as const,
  },
  // A fraction shown as a percent with a progress bar: "45%" / "45 %".
  {
    id: "progress",
    header: "Progress",
    type: "number" as const,
    numberFormat: { style: "percent" as const, display: "bar" as const },
    defaultCalculation: "average" as const,
  },
  // A unit: "12.5 kg" / "12,5 kg".
  {
    id: "weight",
    header: "Weight",
    type: "number" as const,
    numberFormat: {
      style: "unit" as const,
      unit: "kilogram",
      decimals: 1,
    },
  },
  // Compact notation: "1.3M" / "1,3 M".
  {
    id: "reach",
    header: "Reach",
    type: "number" as const,
    numberFormat: { style: "compact" as const },
  },
  // A pattern read in Paris time, whatever the browser's zone.
  {
    id: "due",
    header: "Due",
    type: "date" as const,
    dateFormat: "dd/MM/yyyy HH:mm",
    timeZone: "Europe/Paris",
    defaultCalculation: "max" as const,
  },
  // A date and time preset on a 24-hour clock, in Paris time.
  {
    id: "updatedAt",
    header: "Updated",
    type: "date" as const,
    dateDisplayPreset: "dateTime" as const,
    timeZone: "Europe/Paris",
    hour12: false,
  },
  // Affixes and separators keep their spaces: "≈ 1 234.5 pts" / "≈ 1 234,5 pts".
  {
    id: "score",
    header: "Score",
    type: "number" as const,
    numberFormat: {
      decimals: 1,
      prefix: "≈ ",
      suffix: " pts",
      thousandsSeparator: " ",
    },
    defaultCalculation: "sum" as const,
  },
];

export const formatRows = [
  {
    id: "f1",
    name: "Alpha",
    status: "active",
    amount: 2499,
    progress: 0.45,
    weight: 12.5,
    reach: 1_250_000,
    // 22:30 UTC is already the next day in Paris: 06/09/2026 00:30.
    due: "2026-09-05T22:30:00Z",
    updatedAt: "2026-09-05T14:30:00Z",
    score: 1234.5,
  },
  {
    id: "f2",
    name: "Bravo",
    status: "draft",
    amount: 1200.5,
    progress: 0.8,
    weight: 3,
    reach: 5400,
    due: "2026-09-10T08:00:00Z",
    updatedAt: "2026-09-10T09:15:00Z",
    score: 86,
  },
  {
    id: "f3",
    name: "Charlie",
    status: "active",
    amount: 350,
    progress: 0.1,
    weight: 40.25,
    reach: 980,
    due: "2026-09-15T12:00:00Z",
    updatedAt: "2026-09-15T07:05:00Z",
    score: 9.25,
  },
];

export const formatVisibleColumns = formatColumns.map((column) => column.id);

export const formatTableOptions = {
  syncUrl: true,
  enableCalculations: true,
  enableGrouping: true,
  enableAdvancedFilters: true,
  defaultDisplayMode: "table" as const,
  displayModes: [
    "table",
    "list",
    "gallery",
    "kanban",
    "calendar",
    "chart",
    "feed",
    "form",
  ] as (
    | "table"
    | "list"
    | "gallery"
    | "kanban"
    | "calendar"
    | "chart"
    | "feed"
    | "form"
  )[],
  kanban: { groupBy: "status", cardColumnIds: ["amount", "due"] },
  gallery: {
    titleColumn: "name",
    cardColumnIds: ["amount", "progress", "due"],
  },
  list: { titleColumn: "name", cardColumnIds: ["amount", "weight", "due"] },
  // Event titles read the Amount column: its currency format applies.
  calendar: { dateColumn: "due", titleColumn: "amount" },
  feed: {
    titleColumn: "name",
    dateColumn: "updatedAt",
    dateDisplay: "absolute" as const,
    propertyColumnIds: ["amount", "reach", "due"],
  },
};

/** The demo's table in `locale` (`?locale=fr` reads French). */
export const formatsLocale = (search: string): string =>
  new URLSearchParams(search).get("locale") === "fr" ? "fr-FR" : "en-US";

type FormatRow = (typeof formatRows)[number];

/** Like a server: rows matching the search and the view's advanced filters. */
function matching(rows: FormatRow[], input: Record<string, unknown>) {
  const params = compatibleListParams(input);
  const query = String(params.search ?? "")
    .trim()
    .toLocaleLowerCase();
  const rules = params.advancedFilters as Record<string, unknown>[];
  const required = Array.isArray(input.requiredFilters)
    ? (input.requiredFilters as Record<string, unknown>[])
    : [];
  return rows.filter(
    (row) =>
      (!query ||
        Object.values(row).some((value) =>
          String(value).toLocaleLowerCase().includes(query)
        )) &&
      [...rules, ...required].every((rule) =>
        matchesContractFilter(
          row[String(rule.columnId) as keyof FormatRow],
          rule
        )
      )
  );
}

/** In-memory host of the format matrix: list, update, create, chart groups. */
export function createFormatActions() {
  const records = formatRows.map((row) => ({ ...row }));
  return {
    list: (params: Record<string, unknown>) => {
      const rows = matching(records, params);
      return Promise.resolve({
        data: rows.map((row) => ({ ...row })),
        meta: { pageCount: 1, totalCount: rows.length },
      });
    },
    aggregate: (query: object) => {
      const params = query as Record<string, unknown>;
      if (!Array.isArray(params.groupBy)) {
        return Promise.reject(
          new Error("Only chart groups are computed here.")
        );
      }
      return Promise.resolve(
        aggregateChartRows(
          matching(records, params),
          params as unknown as ChartAggregateRequest
        )
      );
    },
    update: (id: string, patch: Record<string, unknown>) => {
      const record = records.find((row) => row.id === String(id));
      if (record) {
        Object.assign(record, patch);
      }
      return Promise.resolve({ success: Boolean(record), data: record });
    },
    create: (values: Record<string, unknown>) => {
      const record = {
        ...records[0],
        ...values,
        id: `f${records.length + 1}`,
      } as FormatRow;
      records.push(record);
      return Promise.resolve({ success: true, data: record });
    },
  };
}

/** A saved view of the matrix: amounts by status, as a bar chart. */
export const formatViews = [
  {
    id: "amount-by-status",
    tableId: "formats",
    name: "Amount by status",
    createdById: "demo",
    isGlobal: true,
    canEdit: false,
    canDelete: false,
    config: {
      displayMode: "chart" as const,
      chart: {
        type: "bar",
        xColumn: "status",
        metric: "sum",
        metricColumn: "amount",
        showDataLabels: true,
      },
    },
  },
];

/** Numbers and a date filter on the matrix, as a dashboard shows them. */
export const formatsDashboard: Dashboard = {
  version: 1,
  id: "formats-overview",
  name: "Formats overview",
  widgets: [
    {
      id: "amount-total",
      type: "kpi",
      tableId: "formats",
      settings: { metric: "sum", metricColumn: "amount", label: "Amount" },
    },
    {
      id: "progress-average",
      type: "kpi",
      tableId: "formats",
      settings: { metric: "avg", metricColumn: "progress", label: "Progress" },
    },
    {
      id: "records",
      type: "kpi",
      tableId: "formats",
      settings: { metric: "count", label: "Records" },
    },
  ],
  layout: [
    { widgetId: "amount-total", x: 0, y: 0, w: 1, h: 1 },
    { widgetId: "progress-average", x: 1, y: 0, w: 1, h: 1 },
    { widgetId: "records", x: 2, y: 0, w: 1, h: 1 },
  ],
  filters: [
    {
      id: "due",
      type: "dateRange",
      label: "Due",
      targets: [{ tableId: "formats", columnId: "due" }],
      // Every record matches, in any browser zone; the days read like Due.
      value: { start: "2026-09-01", end: "2026-09-30" },
    },
  ],
};
