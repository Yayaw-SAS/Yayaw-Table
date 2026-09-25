/**
 * The "Facet list" block, shared by the React and Vue editions (synced to
 * Vue): a column's values with their numbers of records; a click sets a
 * screen filter through the block's `setFilter`, so a tag or category
 * navigation drives a full-page table (and every widget the filter targets).
 * Pure: the block's schema and props, its counts' request, its values.
 */
import {
  type FacetColumn,
  type FacetColumnInput,
  type FacetCounts,
  type FacetEntry,
  facetEntries,
  facetKind,
  loadFacetCounts,
} from "../facets-model";
import type { ScopedRowsRequest } from "../scoped-rows";
import {
  type DashboardTranslate,
  dashboardLabel,
  withDashboardFilters,
} from "./dashboard-model";
import {
  type DashboardBlockSchema,
  type DashboardJsonObject,
  type DashboardText,
  dashboardSelectValues,
} from "./dashboard-schema";

type UnknownRecord = Record<string, unknown>;

/** How the block lays its values out: a list (a side navigation) or chips in a row. */
export type FacetBlockLayout = "chips" | "list";

/** The block's props (JSON, in the document). */
export interface FacetBlockProps {
  /** The screen filter the block sets; the factory's `filterId` by default. */
  filterId?: string;
  layout?: FacetBlockLayout;
  /** Show each value's number of records (default true). */
  showCounts?: boolean;
}

/** The source's actions the block counts with (its `aggregate`, else its `list`). */
export interface FacetBlockActions {
  aggregate?: (params: never) => unknown;
  list?: (params: never) => unknown;
}

/** What `createFacetBlock` takes, in both editions. */
export interface FacetBlockOptions {
  /** The screen filter the block sets: a select filter targeting the column. */
  filterId: string;
  /** The source whose records the block counts. */
  tableId: string;
  /** The column listed: its values' labels (`options`) and type. */
  column: FacetColumnInput;
  /** The source's actions, for the counts; without them, the options show without counts. */
  actions?: FacetBlockActions;
  /** The block's name in the widget dialog ("Facet list"). */
  label?: DashboardText;
  description?: DashboardText;
  group?: DashboardText;
  /** Where the block goes (default any section). */
  placement?: DashboardBlockSchema["placement"];
  defaultSize?: { w: number; h: number };
  /** The layout of new widgets (default "list"). */
  layout?: FacetBlockLayout;
}

const LAYOUTS: readonly FacetBlockLayout[] = ["chips", "list"];
const FILTER_ID = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,63}$/u;

/** The facet the block lists: the column's values (select, list or yes/no). */
export function facetBlockColumn(
  column: FacetColumnInput,
  locale = "en"
): FacetColumn {
  const kind = facetKind(column) ?? "select";
  const options = Array.isArray(column.options)
    ? column.options.flatMap((item) => {
        const option = (item ?? {}) as UnknownRecord;
        return "value" in option
          ? [
              {
                value: String(option.value),
                label: String(option.label ?? option.value ?? ""),
              },
            ]
          : [];
      })
    : [];
  const booleans =
    kind === "boolean"
      ? [
          { value: "true", label: locale.startsWith("fr") ? "Oui" : "Yes" },
          { value: "false", label: locale.startsWith("fr") ? "Non" : "No" },
        ]
      : [];
  return {
    id: column.id,
    label: column.header ?? column.id,
    kind: kind === "folder" ? "select" : kind,
    type: kind === "multiSelect" ? "multiSelect" : "select",
    operator: kind === "multiSelect" ? "contains" : "isAnyOf",
    options: kind === "boolean" ? booleans : options,
    limit: Number.POSITIVE_INFINITY,
    sort: options.length || kind === "boolean" ? "options" : "count",
    showEmpty: false,
  };
}

/** The block's props with its defaults. */
export function facetBlockProps(
  props: unknown,
  options: Pick<FacetBlockOptions, "filterId" | "layout">
): { filterId: string; layout: FacetBlockLayout; showCounts: boolean } {
  const source = (props ?? {}) as UnknownRecord;
  const filterId =
    typeof source.filterId === "string" && FILTER_ID.test(source.filterId)
      ? source.filterId
      : options.filterId;
  const layout =
    LAYOUTS.find((item) => item === source.layout) ?? options.layout ?? "list";
  return { filterId, layout, showCounts: source.showCounts !== false };
}

/** The problems of the block's props: `filterId` an id, `layout` list or chips, `showCounts` yes or no. */
export function facetBlockProblems(
  props: DashboardJsonObject
): { message: string; path: string }[] | undefined {
  const problems: { message: string; path: string }[] = [];
  if (
    props.filterId !== undefined &&
    !(typeof props.filterId === "string" && FILTER_ID.test(props.filterId))
  ) {
    problems.push({ message: "filterId is a filter's id.", path: "filterId" });
  }
  if (
    props.layout !== undefined &&
    !LAYOUTS.includes(props.layout as FacetBlockLayout)
  ) {
    problems.push({ message: "layout is list or chips.", path: "layout" });
  }
  if (props.showCounts !== undefined && typeof props.showCounts !== "boolean") {
    problems.push({
      message: "showCounts is true or false.",
      path: "showCounts",
    });
  }
  return problems.length ? problems : undefined;
}

/** The block's schema: what `validateDashboard` and the widget dialog read. */
export function facetBlockSchema(
  options: FacetBlockOptions
): DashboardBlockSchema {
  return {
    label: options.label ?? {
      en: dashboardLabel("facetBlock", "en"),
      fr: dashboardLabel("facetBlock", "fr"),
    },
    description: options.description ?? {
      en: dashboardLabel("facetBlockDescription", "en"),
      fr: dashboardLabel("facetBlockDescription", "fr"),
    },
    ...(options.group ? { group: options.group } : {}),
    placement: options.placement ?? "any",
    defaultSize: options.defaultSize ?? { w: 1, h: 3 },
    defaultProps: { layout: options.layout ?? "list" },
    validateProps: facetBlockProblems,
    propsSchema: {
      type: "object",
      properties: {
        filterId: { type: "string" },
        layout: { enum: [...LAYOUTS] },
        showCounts: { type: "boolean" },
      },
    },
  };
}

/** The values a click leaves in the filter: the value joins or leaves them. */
export function toggleFacetBlockValue(
  current: unknown,
  value: string
): string[] {
  const values = dashboardSelectValues(current);
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

/**
 * The block's counts: the source's `aggregate` grouped by the column (else
 * the rows `list` returns, 2,000 at most), under the screen's other filters
 * (`rules`, joined to every request as the widgets' are).
 */
export async function loadFacetBlockCounts(input: {
  actions?: FacetBlockActions;
  column: FacetColumn;
  rules: readonly UnknownRecord[];
  locale: string;
  signal?: AbortSignal;
}): Promise<FacetCounts | undefined> {
  if (!(input.actions?.aggregate || input.actions?.list)) {
    return;
  }
  const actions = withDashboardFilters(input.actions, input.rules) as {
    aggregate?: (params: UnknownRecord) => unknown;
    list?: ScopedRowsRequest["list"];
  };
  const counts = await loadFacetCounts({
    facets: [input.column],
    params: { search: "", filters: {}, advancedFilters: [] },
    aggregate: actions.aggregate,
    list: actions.list,
    locale: input.locale,
    signal: input.signal,
  });
  return counts[input.column.id];
}

/** The values the block lists: its options and the counted ones, selected ones first kept. */
export const facetBlockEntries = (
  column: FacetColumn,
  input: { counts?: FacetCounts; selected: unknown; locale: string }
): FacetEntry[] =>
  facetEntries(column, {
    counts: input.counts,
    selection: { values: dashboardSelectValues(input.selected), empty: false },
    locale: input.locale,
  });

/** A label of the block, overridable with `dashboard.<key>`. */
export const facetBlockLabel = (
  key: "facetAll" | "facetClear" | "facetEmpty" | "facetError" | "facetLoading",
  locale: string,
  translate?: DashboardTranslate
): string => dashboardLabel(key, locale, translate);
