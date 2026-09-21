import { compatibleListParams } from "../utils/table-contracts";
import { planningDefaults } from "./engine";
import { planningTasksFromRows } from "./rows";
import {
  assertPlanningContext,
  createPlanningTransactions,
} from "./transactions";
import {
  type PlanningCalendar,
  type PlanningChange,
  type PlanningDependency,
  PlanningError,
  type PlanningFields,
  type PlanningSnapshot,
  type PlanningSource,
  type TableGanttConfig,
  type TablePlanningConfig,
} from "./types";

type MaybePromise<T> = Promise<T> | T;

/** Matches the table's own list contract, so a Gantt reads the rows the table already reads. */
export interface RowsPlanningListResult {
  data: unknown[];
  meta?: { pageCount?: number; totalCount?: number };
}
export interface RowsPlanningUpdateResult {
  success: boolean;
  error?: string;
}
/**
 * `TListParams` is inferred from the supplied `list`, so each edition's own list
 * contract fits without adapting it.
 */
export interface RowsPlanningAdapterOptions<
  TListParams = Record<string, unknown>,
> {
  config: TablePlanningConfig;
  /** Column mappings. `startColumn` and `endColumn` are required. */
  gantt?: TableGanttConfig;
  list: (params: TListParams) => MaybePromise<RowsPlanningListResult>;
  /** Omit to expose a read-only timeline. */
  update?: (
    id: string,
    data: Record<string, unknown>,
    context?: { row: Readonly<Record<string, unknown>> }
  ) => MaybePromise<RowsPlanningUpdateResult>;
  sourceLabel?: string;
  getId?: (row: Record<string, unknown>) => string;
  calendars?: PlanningCalendar[];
  defaultCalendarId?: string;
  /** Rows carry no relationships; supply them when the application stores them. */
  dependencies?: () => PlanningDependency[];
  pageSize?: number;
  /** Extra list parameters, for instance a scope the rows belong to. */
  listParams?: Record<string, unknown>;
  toDate?: (value: unknown) => string | null;
}

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGES = 1000;
const DEFAULT_CALENDAR_ID = "default";
const WORKING_WEEK = [1, 2, 3, 4, 5];
const REVISION_MODULUS = 2_147_483_647;
const REVISION_FACTOR = 31;
const ISO_DATE_LENGTH = 10;

/** A stable digest keeps an open preview valid while the rows are unchanged. */
function digest(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash =
      (hash * REVISION_FACTOR + (character.codePointAt(0) ?? 0)) %
      REVISION_MODULUS;
  }
  return `rows-${hash}`;
}

/** Accepts civil dates, ISO timestamps and Date values, all read as UTC. */
function defaultToDate(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, ISO_DATE_LENGTH);
  }
  if (typeof value === "string") {
    return value.slice(0, ISO_DATE_LENGTH);
  }
  throw new PlanningError(
    "invalid-date",
    "Map a date column or provide an explicit toDate adapter."
  );
}

function planningFields(gantt: TableGanttConfig | undefined): PlanningFields {
  if (!(gantt?.startColumn && gantt.endColumn)) {
    throw new PlanningError(
      "missing-fields",
      "Map gantt.startColumn and gantt.endColumn to build a planning from rows."
    );
  }
  return {
    title: gantt.titleColumn,
    start: gantt.startColumn,
    end: gantt.endColumn,
    parent: gantt.parentColumn,
    calendar: gantt.calendarColumn,
  };
}

/** True when the table configuration alone is enough to derive a planning graph. */
export function canDeriveRowsPlanning(gantt?: TableGanttConfig): boolean {
  return Boolean(gantt?.startColumn && gantt.endColumn);
}

function snapshotRevision(
  tasks: PlanningSnapshot["tasks"],
  dependencies: PlanningDependency[]
): string {
  return digest(
    JSON.stringify([
      tasks.map((task) => [
        task.ref.id,
        task.start,
        task.end,
        task.parent?.id ?? null,
        task.label,
        task.calendarId ?? null,
      ]),
      dependencies.map((edge) => [
        edge.id,
        edge.from.id,
        edge.to.id,
        edge.type,
        edge.lag ?? 0,
        edge.lagUnit ?? null,
      ]),
    ])
  );
}

function changedRecordPatch(
  change: PlanningChange,
  fields: PlanningFields,
  sourceId: string
): Record<string, unknown> | undefined {
  const patch: Record<string, unknown> = {};
  if (change.before.start !== change.after.start) {
    patch[fields.start] = change.after.start;
  }
  if (change.before.end !== change.after.end) {
    patch[fields.end] = change.after.end;
  }
  const beforeParent = change.before.parent?.id ?? null;
  const afterParent = change.after.parent?.id ?? null;
  if (fields.parent && beforeParent !== afterParent) {
    // Scalar columns can only represent parents from the same source.
    patch[fields.parent] =
      change.after.parent?.source === sourceId ? afterParent : null;
  }
  return Object.keys(patch).length ? patch : undefined;
}

/**
 * Builds a planning adapter from the table's own `list`/`update` actions, so a Gantt
 * needs no bespoke planning backend: mapping `gantt.startColumn` and `gantt.endColumn`
 * is enough, exactly as Kanban and Gallery need only their own column mappings.
 *
 * Unlike a database-backed adapter this cannot commit atomically: each affected row is
 * patched through `update`. A partial failure is reported and the graph is reloaded so
 * the timeline always shows what was actually stored.
 */
export function createRowsPlanningAdapter<TListParams>(
  input: RowsPlanningAdapterOptions<TListParams>
) {
  const config = planningDefaults(input.config);
  const fields = planningFields(input.gantt);
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const calendars = input.calendars ?? [
    { id: DEFAULT_CALENDAR_ID, workingDays: WORKING_WEEK },
  ];
  const defaultCalendarId =
    input.defaultCalendarId ?? calendars[0]?.id ?? DEFAULT_CALENDAR_ID;
  const source: PlanningSource = {
    id: config.sourceId,
    label: input.sourceLabel ?? config.sourceId,
    calendarId: defaultCalendarId,
    fields,
  };
  const getId =
    input.getId ?? ((row: Record<string, unknown>) => String(row.id));
  const emptySnapshot: PlanningSnapshot = {
    scopeId: config.scopeId,
    revision: digest("empty"),
    tasks: [],
    dependencies: [],
    sources: [source],
    calendars,
    defaultCalendarId,
    complete: true,
  };
  let current = emptySnapshot;

  const collectRows = async (
    signal?: AbortSignal
  ): Promise<Record<string, unknown>[]> => {
    const rows: Record<string, unknown>[] = [];
    const readPage = async (page: number): Promise<void> => {
      signal?.throwIfAborted();
      // compatibleListParams fills every field of the shared list contract.
      const result = await input.list(
        compatibleListParams({
          ...input.listParams,
          page,
          pageSize,
        }) as TListParams
      );
      signal?.throwIfAborted();
      const batch = (result.data ?? []) as Record<string, unknown>[];
      for (const row of batch) {
        rows.push(row);
      }
      const pageCount = Number(result.meta?.pageCount ?? 0);
      const isLastPage =
        batch.length === 0 ||
        (pageCount > 0 ? page >= pageCount : batch.length < pageSize);
      if (isLastPage) {
        return;
      }
      if (page >= MAX_PAGES) {
        throw new PlanningError(
          "incomplete-graph",
          "The planning rows exceeded the page limit."
        );
      }
      await readPage(page + 1);
    };
    await readPage(1);
    return rows;
  };

  const buildSnapshot = (rows: Record<string, unknown>[]): PlanningSnapshot => {
    const normalized = planningTasksFromRows({
      source,
      rows,
      getId,
      gantt: input.gantt,
      toDate: input.toDate ?? defaultToDate,
    });
    const dependencies = input.dependencies?.() ?? [];
    return {
      scopeId: config.scopeId,
      revision: snapshotRevision(normalized.tasks, dependencies),
      tasks: normalized.tasks,
      dependencies,
      sources: [normalized.source],
      calendars,
      defaultCalendarId,
      complete: true,
    };
  };

  const reload = async (signal?: AbortSignal): Promise<PlanningSnapshot> => {
    current = buildSnapshot(await collectRows(signal));
    return structuredClone(current);
  };

  const persist = async (changes: PlanningChange[]): Promise<void> => {
    const patches = changes.flatMap((change) => {
      if (change.ref.source !== config.sourceId) {
        return [];
      }
      const patch = changedRecordPatch(change, fields, config.sourceId);
      return patch ? [{ change, patch }] : [];
    });
    if (patches.length === 0) {
      return;
    }
    const update = input.update;
    if (!update) {
      throw new PlanningError(
        "read-only",
        "This planning has no update action, so dates cannot be saved."
      );
    }
    const save = async (
      change: PlanningChange,
      patch: Record<string, unknown>
    ): Promise<RowsPlanningUpdateResult> => {
      try {
        return await update(change.ref.id, patch, {
          row: change.before.record ?? {},
        });
      } catch (cause) {
        return {
          success: false,
          error: cause instanceof Error ? cause.message : String(cause),
        };
      }
    };
    const results = await Promise.all(
      patches.map(({ change, patch }) => save(change, patch))
    );
    const rejected = results.find((result) => !result.success);
    if (rejected) {
      throw new PlanningError(
        "apply-failed",
        rejected.error ?? "The planning changes could not be saved."
      );
    }
  };

  const actions = createPlanningTransactions({
    config: input.config,
    read: () => current,
    load: async (context) => {
      assertPlanningContext(current, config.scopeId, context);
      return await reload(context.signal);
    },
    commit: async ({ preview }) => {
      try {
        await persist(preview.changes);
      } catch (cause) {
        // Some rows may already be stored; resynchronize before surfacing the failure.
        await reload().catch(() => undefined);
        throw cause;
      }
      return await reload();
    },
  });

  return {
    actions,
    getSnapshot: (): PlanningSnapshot => structuredClone(current),
  };
}
