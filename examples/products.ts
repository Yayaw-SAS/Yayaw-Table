import {
  aggregateChartRows,
  type ChartAggregateRequest,
} from "../src/components/ui/yayaw-table/utils/chart-model";
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";

/**
 * The "Products" example shared by the React and Vue demos
 * (`?example=products`) and the end-to-end tests: a catalogue browsed with
 * the facet panel (category and tags), whose in-memory host answers `list`
 * and the facets' `aggregate` requests (grouped and counted, as charts ask).
 */
export interface ProductRow {
  id: string;
  name: string;
  category: string;
  tags: string[];
  status: string;
  price: number;
  available: boolean;
  image: string;
}

type Seed = [
  name: string,
  category: string,
  tags: string[],
  status: string,
  price: number,
  available: boolean,
];

const SEEDS: Seed[] = [
  ["Workspace Pro", "software", ["new", "popular"], "active", 49, true],
  ["Studio Display", "hardware", ["popular"], "draft", 399, false],
  ["Team Support", "service", [], "active", 99, true],
  ["Cloud Backup", "software", ["eco"], "active", 12, true],
  ["Desk Lamp", "hardware", ["eco", "sale"], "active", 35, true],
  ["Onboarding Pack", "service", ["new"], "archived", 250, false],
  ["Analytics Suite", "software", ["popular", "sale"], "active", 79, true],
  ["Ergonomic Chair", "hardware", ["new"], "draft", 289, true],
  ["Security Audit", "service", ["popular"], "active", 1200, true],
  ["Photo Editor", "software", [], "archived", 25, false],
  ["USB Hub", "hardware", ["sale"], "active", 19, true],
  ["Data Migration", "", ["new"], "draft", 480, false],
  ["Password Vault", "software", ["eco", "new"], "active", 8, true],
  ["Noise Headset", "hardware", ["popular"], "active", 149, true],
];

const picture = (seed: string) =>
  `https://picsum.photos/seed/yayaw-product-${seed}/640/480`;

/** Fresh records. */
export const productRows = (): ProductRow[] =>
  SEEDS.map(([name, category, tags, status, price, available], index) => ({
    id: `product-${index + 1}`,
    name,
    category,
    tags,
    status,
    price,
    available,
    image: picture(String(index + 1)),
  }));

const options = (values: [string, string][]) =>
  values.map(([value, label]) => ({ value, label }));

export const productColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "category",
    header: "Category",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options([
      ["software", "Software"],
      ["hardware", "Hardware"],
      ["service", "Service"],
    ]),
  },
  {
    id: "tags",
    header: "Tags",
    type: "multiSelect" as const,
    options: options([
      ["new", "New"],
      ["popular", "Popular"],
      ["sale", "On sale"],
      ["eco", "Eco"],
    ]),
  },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options([
      ["active", "Active"],
      ["draft", "Draft"],
      ["archived", "Archived"],
    ]),
  },
  {
    id: "price",
    header: "Price",
    type: "number" as const,
    numberFormat: { currency: "EUR", locale: "en-US" },
  },
  { id: "available", header: "Available", type: "boolean" as const },
  { id: "image", header: "Image", type: "image" as const },
];

export const productVisibleColumns = [
  "name",
  "category",
  "tags",
  "status",
  "price",
  "available",
];

export const productTableOptions = {
  syncUrl: true,
  enableAdvancedFilters: true,
  coloredTags: false,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "list", "gallery", "kanban"] as (
    | "table"
    | "list"
    | "gallery"
    | "kanban"
  )[],
  defaultPageSize: 10,
  // The facet panel: a category and the tags, counted by `aggregate`.
  facets: { columns: ["category", "tags"] },
  kanban: { groupBy: "status" },
  list: { titleColumn: "name", cardColumnIds: ["category", "tags", "price"] },
  gallery: {
    titleColumn: "name",
    imageColumn: "image",
    cardColumnIds: ["category", "price"],
  },
};

type Params = Record<string, unknown>;

/** What the demo host received, for the end-to-end tests (`window.yayawProductRequests`). */
function logRequest(action: "aggregate" | "list", params: Params) {
  const scope = globalThis as {
    yayawProductRequests?: { action: string; params: unknown }[];
  };
  scope.yayawProductRequests ??= [];
  scope.yayawProductRequests.push({
    action,
    params: JSON.parse(JSON.stringify(params)),
  });
}

/** Like a server: the search in the name, then the advanced rules. */
export function filterProducts(
  rows: readonly ProductRow[],
  input: Params
): ProductRow[] {
  const params = compatibleListParams(input);
  const query = String(params.search ?? "")
    .trim()
    .toLocaleLowerCase();
  const rules = params.advancedFilters as Params[];
  const required = Array.isArray(input.requiredFilters)
    ? (input.requiredFilters as Params[])
    : [];
  const matches = (row: ProductRow) => (rule: Params) =>
    matchesContractFilter(row[String(rule.columnId) as keyof ProductRow], rule);
  return rows.filter((row) => {
    if (query && !row.name.toLocaleLowerCase().includes(query)) {
      return false;
    }
    const view =
      params.advancedFilterJoin === "or" && rules.length
        ? rules.some(matches(row))
        : rules.every(matches(row));
    return view && required.every(matches(row));
  });
}

function sortProducts(rows: ProductRow[], sorting: unknown): ProductRow[] {
  const sort = (Array.isArray(sorting) ? sorting : []).find(
    (item): item is { id: keyof ProductRow; desc?: boolean } =>
      typeof (item as { id?: unknown })?.id === "string"
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

/** In-memory host: `list` pages, `aggregate` answers grouped counts (facets, charts). */
export function createProductActions() {
  const records = productRows();
  return {
    list: (input: Params) => {
      logRequest("list", input);
      const params = compatibleListParams(input);
      const rows = sortProducts(filterProducts(records, input), params.sorting);
      const size = Number(params.pageSize) || rows.length || 1;
      const page = Number(params.page) || 1;
      return Promise.resolve({
        data: rows
          .slice((page - 1) * size, page * size)
          .map((row) => ({ ...row, tags: [...row.tags] })),
        meta: {
          pageCount: Math.max(1, Math.ceil(rows.length / size)),
          totalCount: rows.length,
        },
      });
    },
    aggregate: (input: object) => {
      const params = input as Params;
      logRequest("aggregate", params);
      if (!Array.isArray(params.groupBy)) {
        return Promise.reject(
          new Error("This demo host only answers grouped counts.")
        );
      }
      return Promise.resolve(
        aggregateChartRows(
          filterProducts(records, params),
          params as unknown as ChartAggregateRequest
        )
      );
    },
    update: (id: string, patch: Params) => {
      const record = records.find((row) => row.id === String(id));
      if (record) {
        Object.assign(record, patch);
      }
      return Promise.resolve({ success: Boolean(record), data: record });
    },
  };
}
