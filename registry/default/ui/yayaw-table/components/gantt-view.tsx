"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Layers,
  RotateCw,
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dateDay, dayDate } from "../planning/calendar";
import {
  type PlanningFormatters,
  planningFormatters,
} from "../planning/format";
import type { PlanningSurfaceLabels } from "../planning/labels";
import type { PlanningSession } from "../planning/session";
import {
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_ROW_HEIGHT,
  type TimelineGeometry,
  type TimelineRow,
  timelineBar,
  timelineCanEdit,
  timelineCanResize,
  timelineDateMutation,
  timelineDayCells,
  timelineFirstDate,
  timelineGeometry,
  timelineLinks,
  timelineMonths,
  timelineOffDays,
  timelinePeriodStep,
  timelineRows,
  timelineToday,
  timelineTodayOffset,
} from "../planning/timeline";
import {
  type PlanningMutation,
  type PlanningSnapshot,
  type PlanningTask,
  planningKey,
  type TableGanttConfig,
  type TableGanttViewConfig,
} from "../planning/types";
import type { Row, Table as TanStackTable } from "../tanstack";
import { flexRender } from "../tanstack";

const SELECTION_COLUMN_ID = "select";
const SYSTEM_COLUMN_IDS = new Set([SELECTION_COLUMN_ID, "actions"]);
const EMPTY_FORMAT_COLUMNS: never[] = [];
const TREE_INDENT = 16;
const LABEL_PADDING = 8;
const KEYBOARD_WEEK = 7;
const MIN_BAR_WIDTH = 8;

type DragOperation = "move" | "start" | "end";

interface DragState {
  key: string;
  operation: DragOperation;
  originX: number;
  deltaDays: number;
  moved: boolean;
}

export interface DataTableGanttViewProps<
  TData extends Record<string, unknown>,
> {
  busy: boolean;
  className?: string;
  compare?: (a: PlanningTask, b: PlanningTask) => number;
  config: TableGanttConfig;
  emptyState: ReactNode;
  error?: string;
  getRowId?: (row: TData) => string;
  isRowActive?: (row: Row<TData>) => boolean;
  isRowClickable?: (row: Row<TData>) => boolean;
  labels: PlanningSurfaceLabels;
  locale: string;
  onClearFilters?: () => void;
  onRowClick?: (row: Row<TData>, event: ReactMouseEvent<HTMLElement>) => void;
  onViewChange: (view: TableGanttViewConfig) => void;
  session: PlanningSession;
  snapshot?: PlanningSnapshot;
  table: TanStackTable<TData>;
  view: TableGanttViewConfig;
  visible?: (task: PlanningTask) => boolean;
  /** The table's columns: names and days read in their formats. */
  columns?: readonly PlanningFormatColumn[];
}

type PlanningFormatColumn = Parameters<typeof planningFormatters>[0][number];

function rowIdentity<TData extends Record<string, unknown>>(
  row: Row<TData>,
  getRowId?: (row: TData) => string
): string {
  return getRowId?.(row.original) ?? String(row.original.id ?? row.id);
}

/** Table rows keyed the way planning refs are, so a task can find its record. */
function useRowsByTaskId<TData extends Record<string, unknown>>(
  table: TanStackTable<TData>,
  getRowId?: (row: TData) => string
): Map<string, Row<TData>> {
  const rows = table.getRowModel().rows;
  return useMemo(() => {
    const index = new Map<string, Row<TData>>();
    for (const row of rows) {
      index.set(rowIdentity(row, getRowId), row);
    }
    return index;
  }, [rows, getRowId]);
}

function titleColumnId<TData extends Record<string, unknown>>(
  table: TanStackTable<TData>,
  configured?: string
): string | undefined {
  if (configured) {
    return configured;
  }
  return table
    .getVisibleLeafColumns()
    .find((column) => !SYSTEM_COLUMN_IDS.has(column.id))?.id;
}

function GanttControls({
  busy,
  labels,
  onNavigate,
  onReload,
  period,
}: {
  busy: boolean;
  labels: PlanningSurfaceLabels;
  onNavigate: (anchorDate: string | undefined) => void;
  onReload: () => void;
  period: { label: string; previous: string; next: string };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <h3 className="font-medium text-base">{period.label}</h3>
      <div className="flex items-center gap-1">
        <Button
          aria-label={labels.previous}
          className="size-8"
          onClick={() => onNavigate(period.previous)}
          size="icon"
          title={labels.previous}
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <Button
          className="h-8 font-normal"
          onClick={() => onNavigate(timelineToday())}
          size="sm"
          type="button"
          variant="ghost"
        >
          {labels.today}
        </Button>
        <Button
          aria-label={labels.next}
          className="size-8"
          onClick={() => onNavigate(period.next)}
          size="icon"
          title={labels.next}
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
        <Button
          aria-label={labels.retry}
          className="size-8"
          disabled={busy}
          onClick={onReload}
          size="icon"
          title={labels.retry}
          type="button"
          variant="ghost"
        >
          <RotateCw aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function GanttHeader({
  formatDay,
  geometry,
  labels,
  locale,
  view,
}: {
  formatDay: PlanningFormatters["day"];
  geometry: TimelineGeometry;
  labels: PlanningSurfaceLabels;
  locale: string;
  view: TableGanttViewConfig;
}) {
  const days = timelineDayCells(geometry, view);
  const months = timelineMonths(geometry);
  const weekdayFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: view.zoom === "day" ? "short" : "narrow",
        timeZone: "UTC",
      }),
    [locale, view.zoom]
  );
  const monthFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale]
  );
  return (
    <div
      className="sticky top-0 z-20 bg-background"
      style={{ height: TIMELINE_HEADER_HEIGHT }}
    >
      <div
        className="sticky left-0 z-30 flex h-full items-end gap-2 border-border border-r border-b bg-background px-2 pb-2 font-medium text-muted-foreground text-sm"
        style={{ width: geometry.labelWidth }}
      >
        <FileText aria-hidden="true" className="size-4" />
        <span>{labels.task}</span>
      </div>
      {months.map((month) => (
        <div
          className="absolute top-0 truncate border-border border-b px-2 py-1 text-muted-foreground text-xs"
          key={month.date}
          style={{ left: month.left, width: month.width }}
        >
          {monthFormat.format(new Date(`${month.date}T00:00:00Z`))}
        </div>
      ))}
      {days.map((cell) => (
        <div
          aria-current={cell.isToday ? "date" : undefined}
          className={cn(
            "absolute flex flex-col items-center justify-end gap-0.5 border-border border-b pb-1 text-[11px]",
            cell.isToday
              ? "font-semibold text-destructive"
              : "text-muted-foreground"
          )}
          key={cell.date}
          style={{ left: cell.left, top: 24, width: cell.width, height: 40 }}
          title={formatDay(cell.date)}
        >
          {cell.weekday ? (
            <span className="opacity-70">
              {weekdayFormat.format(new Date(`${cell.date}T00:00:00Z`))}
            </span>
          ) : null}
          {cell.number ? (
            <span
              className={cn(
                cell.isToday &&
                  "flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
              )}
            >
              {cell.number}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function GanttBar({
  canResize,
  dragDelta,
  editable,
  formatters,
  geometry,
  labels,
  onDrag,
  onKeyAdjust,
  onOpen,
  span,
  summary,
  task,
}: {
  canResize: boolean;
  formatters: PlanningFormatters;
  dragDelta: { operation: DragOperation; days: number } | undefined;
  editable: boolean;
  geometry: TimelineGeometry;
  labels: PlanningSurfaceLabels;
  onDrag: (
    event: ReactPointerEvent<HTMLElement>,
    operation: DragOperation
  ) => void;
  onKeyAdjust: (operation: DragOperation, days: number) => void;
  onOpen: () => void;
  span: { left: number; width: number };
  summary: boolean;
  task: PlanningTask;
}) {
  const shift = dragDelta ? dragDelta.days * geometry.width : 0;
  const moveShift = dragDelta?.operation === "move" ? shift : 0;
  const startShift = dragDelta?.operation === "start" ? shift : 0;
  const endShift = dragDelta?.operation === "end" ? shift : 0;
  // Names and days as the table shows the title, start and end columns.
  const range = `${formatters.day(task.start, "start")} – ${formatters.day(task.end, "end")}`;
  const name = formatters.task(task);
  const keyAdjust =
    (operation: DragOperation) => (event: React.KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      onKeyAdjust(
        operation,
        (event.key === "ArrowLeft" ? -1 : 1) *
          (event.shiftKey ? KEYBOARD_WEEK : 1)
      );
    };
  return (
    <div
      className={cn(
        "group/bar absolute top-1.5 bottom-1.5 rounded-md border",
        summary ? "border-border bg-muted" : "border-primary/25 bg-primary/15"
      )}
      style={{
        left: span.left + moveShift + startShift,
        width: Math.max(MIN_BAR_WIDTH, span.width - startShift + endShift),
      }}
    >
      <button
        aria-label={`${labels.move} ${name}: ${range}`}
        className={cn(
          "flex size-full items-center truncate rounded-md px-2 text-left font-medium text-xs",
          editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        )}
        onClick={onOpen}
        onKeyDown={editable ? keyAdjust("move") : undefined}
        onPointerDown={editable ? (event) => onDrag(event, "move") : undefined}
        title={`${name}: ${range}`}
        type="button"
      >
        {name}
      </button>
      {editable && canResize
        ? (["start", "end"] as const).map((side) => (
            <button
              aria-label={`${side === "start" ? labels.resizeStart : labels.resizeEnd} ${name}`}
              className={cn(
                "absolute inset-y-0 w-2 cursor-ew-resize rounded-sm opacity-0 transition-opacity focus-visible:opacity-100 group-hover/bar:opacity-100",
                "bg-primary/40 [@media(hover:none)]:opacity-100",
                side === "start" ? "left-0" : "right-0"
              )}
              key={side}
              onKeyDown={keyAdjust(side)}
              onPointerDown={(event) => onDrag(event, side)}
              type="button"
            />
          ))
        : null}
    </div>
  );
}

function GanttTrack({
  dragDelta,
  formatters,
  geometry,
  labels,
  onDrag,
  onKeyAdjust,
  onOpen,
  row,
  session,
  snapshot,
}: {
  dragDelta: { operation: DragOperation; days: number } | undefined;
  formatters: PlanningFormatters;
  geometry: TimelineGeometry;
  labels: PlanningSurfaceLabels;
  onDrag: (
    event: ReactPointerEvent<HTMLElement>,
    operation: DragOperation
  ) => void;
  onKeyAdjust: (operation: DragOperation, days: number) => void;
  onOpen: () => void;
  row: TimelineRow;
  session: PlanningSession;
  snapshot: PlanningSnapshot;
}) {
  const { task, hasChildren } = row;
  const span = timelineBar(task, geometry);
  const offDays = timelineOffDays(task, snapshot, geometry);
  const editable = timelineCanEdit({ task, hasChildren, session, snapshot });
  const summary = hasChildren && session.config.parentDates !== "independent";
  return (
    <div
      className="absolute inset-y-0"
      style={{
        left: geometry.labelWidth,
        width: geometry.count * geometry.width,
        backgroundImage:
          "linear-gradient(to right, var(--border) 0 1px, transparent 1px)",
        backgroundSize: `${geometry.width}px 100%`,
      }}
    >
      {offDays.map((off) => (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 bg-muted/45"
          key={off.left}
          style={{ left: off.left, width: off.width }}
        />
      ))}
      {span ? (
        <GanttBar
          canResize={timelineCanResize({ hasChildren, session })}
          dragDelta={dragDelta}
          editable={editable}
          formatters={formatters}
          geometry={geometry}
          labels={labels}
          onDrag={onDrag}
          onKeyAdjust={onKeyAdjust}
          onOpen={onOpen}
          span={span}
          summary={summary}
          task={task}
        />
      ) : (
        <span className="absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground text-xs italic">
          {labels.unscheduled}
        </span>
      )}
    </div>
  );
}

export function DataTableGanttView<TData extends Record<string, unknown>>({
  busy,
  className,
  compare,
  config,
  emptyState,
  error,
  getRowId,
  isRowActive,
  isRowClickable,
  labels,
  locale,
  onClearFilters,
  onRowClick,
  onViewChange,
  session,
  snapshot,
  table,
  view,
  visible,
  columns = EMPTY_FORMAT_COLUMNS,
}: DataTableGanttViewProps<TData>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [availableWidth, setAvailableWidth] = useState(0);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [drag, setDrag] = useState<DragState | undefined>(undefined);
  const rowsByTaskId = useRowsByTaskId(table, getRowId);
  const titleId = titleColumnId(table, config.titleColumn);
  const formatters = useMemo(
    () => planningFormatters(columns, config, locale, titleId),
    [columns, config, locale, titleId]
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      setAvailableWidth(element.clientWidth);
    });
    observer.observe(element);
    setAvailableWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(
    () =>
      snapshot
        ? timelineRows(snapshot, {
            hierarchy: session.config.hierarchy,
            visible,
            compare,
            collapsed: new Set(collapsed),
          })
        : [],
    [snapshot, session.config.hierarchy, visible, compare, collapsed]
  );

  const geometry = useMemo(
    () =>
      timelineGeometry({
        rowCount: rows.length,
        view,
        availableWidth,
        height: config.height,
        scrollTop: scroll.top,
        scrollLeft: scroll.left,
        firstDate: timelineFirstDate(snapshot),
      }),
    [rows.length, view, availableWidth, config.height, scroll, snapshot]
  );

  const requestDates = useCallback(
    (mutations: PlanningMutation[]) => {
      if (mutations.length) {
        session.request(mutations).catch(() => undefined);
      }
    },
    [session]
  );

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const element = viewportRef.current;
    if (element) {
      setScroll({ top: element.scrollTop, left: element.scrollLeft });
    }
  }, []);

  const startDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      key: string,
      operation: DragOperation
    ) => {
      if (event.button !== 0) {
        return;
      }
      setDrag({
        key,
        operation,
        originX: event.clientX,
        deltaDays: 0,
        moved: false,
      });
    },
    []
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      setDrag((current) => {
        if (!current) {
          return current;
        }
        const days = Math.round(
          (event.clientX - current.originX) / geometry.width
        );
        if (days === current.deltaDays) {
          return current;
        }
        return { ...current, deltaDays: days, moved: true };
      });
    },
    [geometry.width]
  );

  const periodLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${dayDate(geometry.from)}T00:00:00Z`)),
    [locale, geometry.from]
  );

  const step = timelinePeriodStep(view.zoom);
  const anchor = dateDay(view.anchorDate ?? timelineFirstDate(snapshot));

  if (!snapshot) {
    return (
      <div className={cn("space-y-2", className)}>
        <output className="block text-muted-foreground text-sm">
          {busy ? labels.loading : labels.noAdapter}
        </output>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={cn("space-y-3", className)}>
        {emptyState}
        {onClearFilters ? (
          <div className="flex justify-center">
            <Button
              onClick={onClearFilters}
              size="sm"
              type="button"
              variant="outline"
            >
              {labels.clear}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const todayOffset = timelineTodayOffset(geometry);
  const links =
    view.showDependencies === false
      ? []
      : timelineLinks(rows, snapshot, geometry);

  return (
    <section
      aria-label={labels.planning}
      className={cn("space-y-1", className)}
    >
      <GanttControls
        busy={busy}
        labels={labels}
        onNavigate={(anchorDate) => onViewChange({ ...view, anchorDate })}
        onReload={() => session.load()}
        period={{
          label: periodLabel,
          previous: dayDate(anchor - step),
          next: dayDate(anchor + step),
        }}
      />
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div
        className="relative overflow-auto rounded-md border border-border"
        onScroll={handleScroll}
        ref={viewportRef}
        style={{ height: geometry.height }}
      >
        <div
          className="relative"
          style={{ width: geometry.totalWidth, height: geometry.canvasHeight }}
        >
          <GanttHeader
            formatDay={formatters.day}
            geometry={geometry}
            labels={labels}
            locale={locale}
            view={view}
          />
          {rows.slice(geometry.firstRow, geometry.lastRow).map((row, index) => {
            const position = geometry.firstRow + index;
            const key = planningKey(row.task.ref);
            const tableRow =
              row.task.ref.source === session.config.sourceId
                ? rowsByTaskId.get(row.task.ref.id)
                : undefined;
            return (
              <div
                className={cn(
                  "absolute inset-x-0 border-border border-b",
                  row.hasChildren && "bg-muted/25",
                  tableRow && isRowActive?.(tableRow) && "bg-accent/40"
                )}
                data-task={key}
                key={key}
                style={{
                  top: TIMELINE_HEADER_HEIGHT + position * TIMELINE_ROW_HEIGHT,
                  height: TIMELINE_ROW_HEIGHT,
                }}
              >
                <div
                  className="sticky left-0 z-10 flex h-full items-center gap-1 border-border border-r bg-background pr-2"
                  style={{
                    width: geometry.labelWidth,
                    paddingLeft: LABEL_PADDING + row.depth * TREE_INDENT,
                  }}
                >
                  {row.hasChildren ? (
                    <Button
                      aria-expanded={!collapsed.has(key)}
                      aria-label={
                        collapsed.has(key) ? labels.expand : labels.collapse
                      }
                      className="size-5 shrink-0 text-muted-foreground"
                      onClick={() => toggleCollapsed(key)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      {collapsed.has(key) ? (
                        <ChevronRight aria-hidden="true" className="size-4" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="size-4" />
                      )}
                    </Button>
                  ) : (
                    <span aria-hidden="true" className="size-5 shrink-0" />
                  )}
                  {tableRow
                    ?.getVisibleCells()
                    .filter((cell) => cell.column.id === SELECTION_COLUMN_ID)
                    .map((cell) => (
                      <span className="shrink-0" key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </span>
                    ))}
                  {row.hasChildren ? (
                    <Layers
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  ) : (
                    <FileText
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <GanttLabel
                    isClickable={
                      tableRow ? isRowClickable?.(tableRow) !== false : false
                    }
                    onOpen={() => session.open(row.task.ref)}
                    onRowClick={onRowClick}
                    row={tableRow}
                    task={row.task}
                    taskName={formatters.task(row.task)}
                    titleId={titleId}
                  />
                </div>
                <GanttTrack
                  dragDelta={
                    drag?.key === key
                      ? { operation: drag.operation, days: drag.deltaDays }
                      : undefined
                  }
                  formatters={formatters}
                  geometry={geometry}
                  labels={labels}
                  onDrag={(event, operation) =>
                    startDrag(event, key, operation)
                  }
                  onKeyAdjust={(operation, days) =>
                    requestDates(
                      timelineDateMutation(row.task, operation, days)
                    )
                  }
                  onOpen={() => session.open(row.task.ref)}
                  row={row}
                  session={session}
                  snapshot={snapshot}
                />
              </div>
            );
          })}
          {links.length ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 text-muted-foreground/70"
              height={geometry.canvasHeight}
              width={geometry.totalWidth}
            >
              <title>{labels.dependencies}</title>
              {links.map((link) => (
                <path
                  d={link.d}
                  fill="none"
                  key={link.id}
                  stroke="currentColor"
                />
              ))}
            </svg>
          ) : null}
          {todayOffset === undefined ? null : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute w-px bg-destructive/60"
              style={{
                left: todayOffset,
                top: TIMELINE_HEADER_HEIGHT,
                height: geometry.canvasHeight - TIMELINE_HEADER_HEIGHT,
              }}
            />
          )}
        </div>
      </div>
      {drag ? (
        <DragSurface
          onMove={moveDrag}
          onRelease={() => {
            const target = rows.find(
              (row) => planningKey(row.task.ref) === drag.key
            );
            if (target && drag.moved && drag.deltaDays) {
              requestDates(
                timelineDateMutation(
                  target.task,
                  drag.operation,
                  drag.deltaDays
                )
              );
            } else if (target && drag.operation === "move") {
              // The surface swallows the click, so a press without a drag still opens the task.
              session.open(target.task.ref);
            }
            setDrag(undefined);
          }}
        />
      ) : null}
    </section>
  );
}

/** A transparent layer keeps pointer tracking alive while a bar is dragged. */
function DragSurface({
  onMove,
  onRelease,
}: {
  onMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onRelease: () => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 cursor-grabbing"
      onPointerCancel={onRelease}
      onPointerMove={onMove}
      onPointerUp={onRelease}
    />
  );
}

function GanttLabel<TData extends Record<string, unknown>>({
  isClickable,
  onOpen,
  onRowClick,
  row,
  task,
  taskName,
  titleId,
}: {
  isClickable: boolean;
  onOpen: () => void;
  onRowClick?: (row: Row<TData>, event: ReactMouseEvent<HTMLElement>) => void;
  row?: Row<TData>;
  task: PlanningTask;
  /** The title as the table shows it, for tooltips and unloaded rows. */
  taskName: string;
  titleId?: string;
}) {
  const cell = row
    ?.getVisibleCells()
    .find((item) => item.column.id === titleId);
  const content = cell
    ? flexRender(cell.column.columnDef.cell, cell.getContext())
    : taskName;
  if (row && onRowClick && isClickable) {
    return (
      <button
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
        onClick={(event) => onRowClick(row, event)}
        title={`${task.ref.source} · ${taskName}`}
        type="button"
      >
        {content}
      </button>
    );
  }
  return (
    <button
      className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
      onClick={onOpen}
      title={`${task.ref.source} · ${taskName}`}
      type="button"
    >
      {content}
    </button>
  );
}
