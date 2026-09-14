import { dateDay } from "./calendar";
import {
  PlanningError,
  type PlanningFields,
  type PlanningRef,
  type PlanningSource,
  type PlanningTask,
  type TableGanttConfig,
} from "./types";

export interface PlanningRowAdapter<T extends Record<string, unknown>> {
  source: PlanningSource;
  rows: T[];
  getId: (row: T) => string;
  gantt?: TableGanttConfig;
  getChildren?: (row: T) => T[] | undefined;
  getParent?: (row: T) => PlanningRef | null | undefined;
  /** Convert timestamps explicitly using the application's time zone. */
  toDate?: (value: unknown) => string | null;
}
/** Normalize records or existing subRows without choosing database column names. */
export function planningTasksFromRows<T extends Record<string, unknown>>(
  input: PlanningRowAdapter<T>
): { source: PlanningSource; tasks: PlanningTask[] } {
  const start = input.gantt?.startColumn ?? input.source.fields?.start;
  const end = input.gantt?.endColumn ?? input.source.fields?.end;
  if (!(start && end)) {
    throw new PlanningError(
      "missing-fields",
      "Map both start and end columns for this planning source."
    );
  }
  const fields = {
    ...input.source.fields,
    start,
    end,
    title: input.gantt?.titleColumn ?? input.source.fields?.title,
  };
  const source = { ...input.source, fields };
  const tasks: PlanningTask[] = [];
  const getChildren =
    input.getChildren ??
    ((row: T) => (Array.isArray(row.subRows) ? (row.subRows as T[]) : []));
  const queue = input.rows.map((row) => ({
    row,
    parent: null as PlanningRef | null,
  }));
  const seen = new Set<string>();
  // Iterating the growing queue handles deeply nested data without recursion.
  for (const { row, parent } of queue) {
    const task = normalizeRow(row, parent, fields, input);
    if (!task.ref.id || seen.has(task.ref.id)) {
      throw new PlanningError(
        "duplicate-task",
        "The source contains a repeated record or cyclic subRows."
      );
    }
    seen.add(task.ref.id);
    tasks.push(task);
    for (const child of getChildren(row) ?? []) {
      queue.push({ row: child, parent: task.ref });
    }
  }
  return { source, tasks };
}
function normalizeRow<T extends Record<string, unknown>>(
  row: T,
  inheritedParent: PlanningRef | null,
  fields: PlanningFields,
  input: PlanningRowAdapter<T>
): PlanningTask {
  const ref = { source: input.source.id, id: input.getId(row) };
  const toDate = input.toDate ?? civilDate;
  const fieldParent = fields.parent ? row[fields.parent] : null;
  let parent =
    fieldParent == null || fieldParent === ""
      ? inheritedParent
      : { source: ref.source, id: String(fieldParent) };
  if (input.getParent) {
    parent = input.getParent(row) ?? null;
  }
  const calendar = fields.calendar ? row[fields.calendar] : undefined;
  // The hierarchy is normalized separately; avoid repeating nested records in every ancestor.
  const record: Record<string, unknown> = structuredClone(row);
  if (!input.getChildren) {
    record.subRows = undefined;
  }
  return {
    ref,
    label: String(fields.title ? (row[fields.title] ?? ref.id) : ref.id),
    start: toDate(row[fields.start]),
    end: toDate(row[fields.end]),
    parent,
    calendarId: calendar == null ? undefined : String(calendar),
    record,
  };
}
function civilDate(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new PlanningError(
      "invalid-date",
      "Use civil date strings or provide an explicit date adapter."
    );
  }
  dateDay(value);
  return value;
}
