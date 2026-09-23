/**
 * Custom export and share destinations (webhooks, n8n, connectors), shared by
 * the React and Vue editions. The host declares them in its table actions;
 * the table lists them in the settings "Data" section.
 */
import type {
  ConnectorPushScope,
  DataDestinationConnector,
} from "./connector-flow";
import type { DataDestinationSchedule } from "./schedule-model";
import { normalizeFilterEnvelope } from "./table-contracts";

/**
 * "connect" sends to a tool (n8n, a sheet, a connector); "sync" and "export"
 * are kept as its aliases. "share" lists it under Share.
 */
export type DataDestinationKind = "connect" | "share" | "sync" | "export";

/** The current view's query, in the shape `list` receives. */
export interface DataDestinationQuery {
  search: string;
  filters: Record<string, unknown>;
  advancedFilters: Record<string, unknown>[];
  advancedFilterJoin: "and" | "or";
  sorting: { id: string; desc: boolean }[];
}

export interface DataDestinationColumn {
  id: string;
  header: string;
  /** The table column type (text, number, date, select…). */
  type?: string;
}

export interface DataDestinationContext {
  tableId: string;
  tableType?: string;
  /** Saved view shown, or `null` for the default view. */
  viewId: string | null;
  /**
   * Server first: a connector can fetch every matching record itself with
   * this query instead of receiving rows from the browser.
   */
  query: DataDestinationQuery;
  /** Visible columns, in their displayed order. */
  columns: DataDestinationColumn[];
  selectedRowIds: string[];
  /** Link that reopens this view with its query. */
  url: string;
  /** Every record matching the query, when the destination needs them. */
  loadRows: () => Promise<Record<string, unknown>[]>;
}

/**
 * What a connector's `push` receives: `columns` are the columns sent, and
 * with the "selection" scope `selectedRowIds` and `loadRows` cover the
 * selected records only.
 */
export interface ConnectorPushContext
  extends DataDestinationContext,
    ConnectorPushScope {}

export interface DataDestinationResult {
  /** Shown once the destination succeeded. */
  message?: string;
}

export interface DataDestination<TIcon = unknown> {
  id: string;
  label: string;
  /** "connect" lists it under Connect, "share" under Share after the link. */
  kind: DataDestinationKind;
  icon?: TIcon;
  hidden?: boolean;
  /** Only offered while rows are selected. */
  requiresSelection?: boolean;
  /**
   * Connect destinations only: scheduling settings saved per view (`viewId`);
   * the host runs the schedule. Rows without it show no schedule control.
   */
  schedule?: DataDestinationSchedule<DataDestinationContext>;
  /**
   * Connect destinations only: the row opens the table's connector screen
   * (target, column mapping, records, send and result) instead of `run`.
   */
  connector?: DataDestinationConnector<
    DataDestinationContext,
    ConnectorPushContext
  >;
  /** Runs the destination; optional when `connector` is declared. */
  run?: (
    context: DataDestinationContext
  ) =>
    | DataDestinationResult
    | undefined
    | Promise<DataDestinationResult | undefined>;
}

/** Destinations to offer, by kind, in their declared order (first id wins). */
export function groupDataDestinations<TIcon>(
  destinations: readonly DataDestination<TIcon>[] | undefined,
  selectedCount: number
): Record<"connect" | "share", DataDestination<TIcon>[]> {
  const seen = new Set<string>();
  const groups: Record<"connect" | "share", DataDestination<TIcon>[]> = {
    connect: [],
    share: [],
  };
  for (const destination of destinations ?? []) {
    if (
      seen.has(destination.id) ||
      destination.hidden ||
      (destination.requiresSelection && selectedCount === 0)
    ) {
      continue;
    }
    seen.add(destination.id);
    groups[destination.kind === "share" ? "share" : "connect"].push(
      destination
    );
  }
  return groups;
}

/** Normalize the table state into the query a destination receives. */
export function dataDestinationQuery({
  search,
  filters,
  advancedFilters,
  sorting,
}: {
  search?: string | null;
  filters?: Record<string, unknown>;
  advancedFilters?: unknown;
  sorting?: readonly { id: string; desc?: boolean }[] | null;
}): DataDestinationQuery {
  const envelope = normalizeFilterEnvelope(advancedFilters);
  return {
    search: search?.trim() ?? "",
    filters: { ...filters },
    advancedFilters: envelope.filters.filter(
      (filter) => filter.isActive !== false
    ),
    advancedFilterJoin: envelope.joinOperator,
    sorting: (sorting ?? [])
      .filter((sort) => sort.id !== "__manual")
      .map((sort) => ({ id: sort.id, desc: Boolean(sort.desc) })),
  };
}

/**
 * The push context for a scope: with "selection", only the selected records
 * (already loaded in the browser) are sent.
 */
export function connectorPushContext(
  context: DataDestinationContext,
  scope: "view" | "selection",
  columns: DataDestinationColumn[],
  selectedRows: readonly Record<string, unknown>[]
): ConnectorPushContext {
  if (scope === "selection") {
    return {
      ...context,
      scope,
      columns,
      loadRows: () => Promise.resolve([...selectedRows]),
    };
  }
  return { ...context, scope, columns, selectedRowIds: [] };
}

/** Run a destination; failures become a message instead of an exception. */
export async function runDataDestination(
  destination: Pick<DataDestination, "run">,
  context: DataDestinationContext
): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  try {
    const result = await destination.run?.(context);
    return { ok: true, message: result?.message };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
