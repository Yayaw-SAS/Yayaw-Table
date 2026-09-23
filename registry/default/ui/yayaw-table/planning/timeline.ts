import { dateDay, dayDate, isWorkingDay, taskCalendar } from "./calendar";
import { planningTree } from "./engine";
import type { PlanningSession } from "./session";
import {
  type PlanningDate,
  type PlanningSnapshot,
  type PlanningTask,
  planningKey,
  type TableGanttViewConfig,
} from "./types";

/**
 * Timeline geometry and projection, kept free of any framework so the React and Vue
 * timelines stay behaviourally identical while each renders with its own idioms.
 */
export const TIMELINE_ROW_HEIGHT = 42;
export const TIMELINE_HEADER_HEIGHT = 64;
export const TIMELINE_LABEL_WIDTH = 270;
export const TIMELINE_DEFAULT_HEIGHT = 480;
/** A navigable window bounds the rendered schedule; the period controls move it. */
export const TIMELINE_DAYS = 180;

const ZOOM_DAY_WIDTH = { day: 40, week: 24, month: 10 } as const;
const PERIOD_STEP = { day: 7, week: 30, month: 90 } as const;
const DAYS_IN_WEEK = 7;
const MIN_LABEL_WIDTH = 144;
const LABEL_WIDTH_RATIO = 0.42;
const FALLBACK_VIEWPORT_WIDTH = 1100;
const COLUMN_OVERSCAN_BEFORE = 2;
const COLUMN_OVERSCAN_AFTER = 8;
const ROW_OVERSCAN_BEFORE = 6;
const ROW_OVERSCAN_AFTER = 14;
const MIN_BAR_WIDTH = 8;
const LINK_ELBOW = 12;
/** Sunday is day 4 of the UTC epoch week; this realigns a day number to a weekday. */
const EPOCH_WEEKDAY_OFFSET = 4;

export interface TimelineRow {
  task: PlanningTask;
  depth: number;
  hasChildren: boolean;
}

export interface TimelineGeometry {
  /** Day number of the leftmost rendered column. */
  from: number;
  labelWidth: number;
  width: number;
  count: number;
  totalWidth: number;
  columnFrom: number;
  columnTo: number;
  firstRow: number;
  lastRow: number;
  height: number;
  canvasHeight: number;
}

export interface TimelineDayCell {
  day: number;
  date: PlanningDate;
  left: number;
  width: number;
  isToday: boolean;
  weekday: boolean;
  number: string;
}

export interface TimelineSpan {
  left: number;
  width: number;
}

export interface TimelineMonth extends TimelineSpan {
  date: PlanningDate;
}

export interface TimelineLink {
  id: string;
  d: string;
}

/** Today in the user's time zone: the UTC date is a different day near midnight. */
export const timelineToday = (now = new Date()): PlanningDate =>
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

/** How far the previous/next controls move the window at the current zoom. */
export const timelinePeriodStep = (
  zoom: TableGanttViewConfig["zoom"]
): number => PERIOD_STEP[zoom ?? "week"];

/** The earliest scheduled date, so an unanchored timeline opens on the work. */
export function timelineFirstDate(snapshot?: PlanningSnapshot): PlanningDate {
  const dates = snapshot?.tasks
    .flatMap((task) => (task.start ? [task.start] : []))
    .sort();
  return dates?.[0] ?? timelineToday();
}

/** Ordered, filtered and collapsed rows, preserving ancestor context. */
export function timelineRows(
  snapshot: PlanningSnapshot,
  options: {
    hierarchy?: boolean;
    visible?: (task: PlanningTask) => boolean;
    compare?: (a: PlanningTask, b: PlanningTask) => number;
    collapsed?: Set<string>;
  }
): TimelineRow[] {
  const ordered = options.compare
    ? { ...snapshot, tasks: [...snapshot.tasks].sort(options.compare) }
    : snapshot;
  const visible = options.visible
    ? new Set(
        ordered.tasks
          .filter(options.visible)
          .map((task) => planningKey(task.ref))
      )
    : undefined;
  if (options.hierarchy === false) {
    return ordered.tasks
      .filter((task) => !visible || visible.has(planningKey(task.ref)))
      .map((task) => ({ task, depth: 0, hasChildren: false }));
  }
  return planningTree(ordered, visible, options.collapsed ?? new Set());
}

export function timelineGeometry(input: {
  rowCount: number;
  view: TableGanttViewConfig;
  availableWidth?: number;
  height?: number;
  scrollTop: number;
  scrollLeft: number;
  firstDate: PlanningDate;
}): TimelineGeometry {
  const width = ZOOM_DAY_WIDTH[input.view.zoom ?? "week"];
  const anchor = dateDay(input.view.anchorDate ?? input.firstDate);
  const weekStart = input.view.weekStartsOn ?? 1;
  const weekday =
    (((anchor + EPOCH_WEEKDAY_OFFSET) % DAYS_IN_WEEK) + DAYS_IN_WEEK) %
    DAYS_IN_WEEK;
  const from = anchor - ((weekday - weekStart + DAYS_IN_WEEK) % DAYS_IN_WEEK);
  const count = TIMELINE_DAYS;
  const availableWidth = input.availableWidth || FALLBACK_VIEWPORT_WIDTH;
  const labelWidth = Math.min(
    TIMELINE_LABEL_WIDTH,
    Math.max(MIN_LABEL_WIDTH, Math.round(availableWidth * LABEL_WIDTH_RATIO))
  );
  const height = input.height ?? TIMELINE_DEFAULT_HEIGHT;
  const columnFrom = Math.max(
    0,
    Math.floor((input.scrollLeft - labelWidth) / width) - COLUMN_OVERSCAN_BEFORE
  );
  const columnTo = Math.min(
    count,
    columnFrom + Math.ceil(availableWidth / width) + COLUMN_OVERSCAN_AFTER
  );
  const firstRow = Math.max(
    0,
    Math.floor(input.scrollTop / TIMELINE_ROW_HEIGHT) - ROW_OVERSCAN_BEFORE
  );
  const lastRow = Math.min(
    input.rowCount,
    firstRow + Math.ceil(height / TIMELINE_ROW_HEIGHT) + ROW_OVERSCAN_AFTER
  );
  return {
    from,
    labelWidth,
    width,
    count,
    totalWidth: labelWidth + count * width,
    columnFrom,
    columnTo,
    firstRow,
    lastRow,
    height,
    canvasHeight: TIMELINE_HEADER_HEIGHT + input.rowCount * TIMELINE_ROW_HEIGHT,
  };
}

/** Only the day columns inside the rendered window. */
export function timelineDayCells(
  geometry: TimelineGeometry,
  view: TableGanttViewConfig
): TimelineDayCell[] {
  const today = timelineToday();
  const cells: TimelineDayCell[] = [];
  const isMonthZoom = view.zoom === "month";
  for (let day = geometry.columnFrom; day < geometry.columnTo; day += 1) {
    const date = dayDate(geometry.from + day);
    const labelled = !isMonthZoom || day % DAYS_IN_WEEK === 0;
    cells.push({
      day,
      date,
      left: geometry.labelWidth + day * geometry.width,
      width: geometry.width,
      isToday: date === today,
      weekday: labelled && !isMonthZoom,
      number: labelled ? String(Number(date.slice(8))) : "",
    });
  }
  return cells;
}

/** Month bands spanning the rendered window. */
export function timelineMonths(geometry: TimelineGeometry): TimelineMonth[] {
  const months: TimelineMonth[] = [];
  let start = geometry.columnFrom;
  while (start < geometry.columnTo) {
    const date = dayDate(geometry.from + start);
    let end = start + 1;
    while (
      end < geometry.columnTo &&
      dayDate(geometry.from + end).slice(0, 7) === date.slice(0, 7)
    ) {
      end += 1;
    }
    months.push({
      date,
      left: geometry.labelWidth + start * geometry.width,
      width: (end - start) * geometry.width,
    });
    start = end;
  }
  return months;
}

/** Undefined when the task is unscheduled or outside the rendered window. */
export function timelineBar(
  task: PlanningTask,
  geometry: TimelineGeometry
): TimelineSpan | undefined {
  if (!(task.start && task.end)) {
    return undefined;
  }
  const start = dateDay(task.start) - geometry.from;
  const end = dateDay(task.end) - geometry.from + 1;
  if (end <= 0 || start >= geometry.count) {
    return undefined;
  }
  const left = Math.max(0, start) * geometry.width;
  const width = Math.max(
    MIN_BAR_WIDTH,
    (Math.min(geometry.count, end) - Math.max(0, start)) * geometry.width
  );
  return { left, width };
}

/** Non-working day shading for this task's calendar, inside the rendered window. */
export function timelineOffDays(
  task: PlanningTask,
  snapshot: PlanningSnapshot,
  geometry: TimelineGeometry
): TimelineSpan[] {
  const spans: TimelineSpan[] = [];
  let calendar: ReturnType<typeof taskCalendar>;
  try {
    calendar = taskCalendar(task, snapshot);
  } catch {
    // The load error explains an unavailable calendar; keep the task inspectable.
    return spans;
  }
  for (let day = geometry.columnFrom; day < geometry.columnTo; day += 1) {
    if (!isWorkingDay(geometry.from + day, calendar)) {
      spans.push({ left: day * geometry.width, width: geometry.width });
    }
  }
  return spans;
}

function endpointX(
  task: PlanningTask & { start: string; end: string },
  finish: boolean,
  geometry: TimelineGeometry
): number {
  return (
    geometry.labelWidth +
    (dateDay(finish ? task.end : task.start) -
      geometry.from +
      (finish ? 1 : 0)) *
      geometry.width
  );
}

function scheduledAt(
  value: { task: PlanningTask; i: number } | undefined,
  first: number,
  last: number
): value is { task: PlanningTask & { start: string; end: string }; i: number } {
  return Boolean(
    value &&
      value.i >= first &&
      value.i < last &&
      value.task.start &&
      value.task.end
  );
}

/** Paths are drawn only when both endpoints are inside the rendered window. */
export function timelineLinks(
  rows: TimelineRow[],
  snapshot: PlanningSnapshot,
  geometry: TimelineGeometry
): TimelineLink[] {
  const positions = new Map(
    rows.map((row, i) => [planningKey(row.task.ref), { task: row.task, i }])
  );
  const links: TimelineLink[] = [];
  for (const edge of snapshot.dependencies) {
    const a = positions.get(planningKey(edge.from));
    const b = positions.get(planningKey(edge.to));
    if (
      !(
        scheduledAt(a, geometry.firstRow, geometry.lastRow) &&
        scheduledAt(b, geometry.firstRow, geometry.lastRow)
      )
    ) {
      continue;
    }
    const ax = endpointX(a.task, edge.type[0] === "F", geometry);
    const bx = endpointX(b.task, edge.type[1] === "F", geometry);
    if (
      ax < geometry.labelWidth ||
      bx < geometry.labelWidth ||
      ax > geometry.totalWidth ||
      bx > geometry.totalWidth
    ) {
      continue;
    }
    const ay = TIMELINE_HEADER_HEIGHT + (a.i + 0.5) * TIMELINE_ROW_HEIGHT;
    const by = TIMELINE_HEADER_HEIGHT + (b.i + 0.5) * TIMELINE_ROW_HEIGHT;
    const mid = Math.max(ax, bx) + LINK_ELBOW;
    links.push({
      id: edge.id,
      d: `M ${ax} ${ay} H ${mid} V ${by} H ${bx} l 5 -3 m -5 3 l 5 3`,
    });
  }
  return links;
}

/** Horizontal offset of the current date, or undefined when it is out of view. */
export function timelineTodayOffset(
  geometry: TimelineGeometry
): number | undefined {
  const today = dateDay(timelineToday()) - geometry.from;
  return today >= 0 && today < geometry.count
    ? geometry.labelWidth + (today + 0.5) * geometry.width
    : undefined;
}

/** Authorization, feature flags and in-flight state all gate a bar edit. */
export function timelineCanEdit(input: {
  task: PlanningTask;
  hasChildren: boolean;
  session: PlanningSession;
  snapshot: PlanningSnapshot;
}): boolean {
  const state = input.session.getState();
  const config = input.session.config;
  return (
    input.session.canEdit(input.task) &&
    config.allowDateEdit !== false &&
    !state.busy &&
    !state.preview &&
    input.snapshot.complete &&
    (!input.hasChildren ||
      config.parentDates === "independent" ||
      config.allowSummaryMove !== false)
  );
}

/** A leaf, or an independently dated parent, can be resized as well as moved. */
export function timelineCanResize(input: {
  hasChildren: boolean;
  session: PlanningSession;
}): boolean {
  return (
    !input.hasChildren || input.session.config.parentDates === "independent"
  );
}

/** The mutation a pointer drag or arrow key produces, shared by both editions. */
export function timelineDateMutation(
  task: PlanningTask,
  operation: "move" | "start" | "end",
  days: number
): import("./types").PlanningMutation[] {
  if (!days) {
    return [];
  }
  if (operation === "move") {
    return [{ type: "move", ref: task.ref, days }];
  }
  if (!(task.start && task.end)) {
    return [];
  }
  return [
    {
      type: "dates",
      ref: task.ref,
      start:
        operation === "start"
          ? dayDate(dateDay(task.start) + days)
          : task.start,
      end: operation === "end" ? dayDate(dateDay(task.end) + days) : task.end,
    },
  ];
}
