import { type FieldTextColumn, fieldText } from "../utils/table-contracts";
import { formatColumnDay } from "../utils/value-format";
import type { PlanningTask, TableGanttConfig } from "./types";

/**
 * How the Gantt and the planning dialog show a task's name, its days and the
 * fields a plan changes: as the table shows those columns.
 */
export interface PlanningFormatters {
  /** The title column's value (option labels, number and date formats). */
  task: (task: PlanningTask) => string;
  /** A civil day (`YYYY-MM-DD`) in the start or end column's day format. */
  day: (day: string | null | undefined, side?: "start" | "end") => string;
  /** A changed record field, as "Header: value". */
  field: (key: string, value: unknown) => string;
}

type PlanningColumn = FieldTextColumn & { id: string; header?: string };

export function planningFormatters(
  columns: readonly PlanningColumn[],
  gantt:
    | Pick<TableGanttConfig, "endColumn" | "startColumn" | "titleColumn">
    | undefined,
  locale: string,
  titleColumn = gantt?.titleColumn
): PlanningFormatters {
  const byId = new Map(columns.map((column) => [column.id, column]));
  const titleOf = titleColumn ? byId.get(titleColumn) : undefined;
  return {
    task: (task) =>
      (titleColumn && task.record
        ? fieldText(task.record[titleColumn], titleOf, locale, task.record)
        : "") || task.label,
    day: (day, side = "start") => {
      if (!day) {
        return "";
      }
      const id = side === "end" ? gantt?.endColumn : gantt?.startColumn;
      return formatColumnDay(day, id ? byId.get(id) : undefined, locale);
    },
    field: (key, value) => {
      const column = byId.get(key);
      return `${column?.header ?? key}: ${fieldText(value, column, locale) || "—"}`;
    },
  };
}
