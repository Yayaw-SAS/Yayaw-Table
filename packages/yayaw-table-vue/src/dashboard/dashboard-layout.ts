/**
 * Grid layouts of dashboard sections: widgets on a 4-column grid, placed,
 * repaired, moved and resized without overlaps (gridstack's top gravity).
 * Each grid section has its own layout. Pure and server-safe, shared by the
 * React and Vue editions (synced to Vue by `scripts/sync-table-contracts.mjs`).
 */

/** Widgets per row on desktop. */
export const DASHBOARD_COLUMNS = 4;
/** Tallest widget, in rows. */
export const DASHBOARD_MAX_HEIGHT = 12;
/** Height of one row, in pixels (the gaps are included). */
export const DASHBOARD_ROW_HEIGHT = 120;
/** Space around each widget, in pixels. */
export const DASHBOARD_MARGIN = 6;
/** Grids narrower than this (phones) stack widgets in one column, without drag. */
export const DASHBOARD_PHONE_MAX_WIDTH = 639;

export type DashboardDirection = "left" | "right" | "up" | "down";
export type DashboardResize = "wider" | "narrower" | "taller" | "shorter";

/** Where a widget sits: columns `x`…`x + w - 1`, rows `y`…`y + h - 1`. */
export interface DashboardLayoutItem {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const integer = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
};
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Sizes of new widgets by type; views depend on their display mode. */
const DEFAULT_SIZES: Readonly<Record<string, { w: number; h: number }>> = {
  view: { w: 2, h: 2 },
  kpi: { w: 1, h: 1 },
  note: { w: 1, h: 2 },
  block: { w: 2, h: 2 },
};
const FALLBACK_SIZE = { w: 2, h: 2 };

/**
 * View widgets by display mode: records and charts take 2×2 (the default),
 * boards, galleries, calendars and feeds 2×3, file trees 1×3, Gantt charts
 * the whole width.
 */
const MODE_SIZES: Readonly<Record<string, { w: number; h: number }>> = {
  kanban: { w: 2, h: 3 },
  gallery: { w: 2, h: 3 },
  calendar: { w: 2, h: 3 },
  feed: { w: 2, h: 3 },
  form: { w: 2, h: 3 },
  filetree: { w: 1, h: 3 },
  gantt: { w: 4, h: 3 },
};

/** Size of a new widget of this type (and, for views, display mode). */
export const defaultWidgetSize = (
  type: string,
  mode?: string
): { w: number; h: number } => ({
  ...((type === "view" && mode ? MODE_SIZES[mode] : undefined) ??
    DEFAULT_SIZES[type] ??
    FALLBACK_SIZE),
});

/** Whole numbers inside the grid: `w` 1…columns, `h` 1…max, `x` keeps it inside. */
export function clampLayoutItem(
  item: DashboardLayoutItem,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem {
  const w = clamp(integer(item.w, 1), 1, columns);
  return {
    widgetId: item.widgetId,
    x: clamp(integer(item.x, 0), 0, columns - w),
    y: Math.max(0, integer(item.y, 0)),
    w,
    h: clamp(integer(item.h, 1), 1, DASHBOARD_MAX_HEIGHT),
  };
}

const overlaps = (a: DashboardLayoutItem, b: DashboardLayoutItem): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const readingOrder = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.y - b.y || a.x - b.x;

/** Rows the layout takes. */
export const layoutRows = (layout: readonly DashboardLayoutItem[]): number =>
  layout.reduce((rows, item) => Math.max(rows, item.y + item.h), 0);

/** Moves each widget down until it overlaps none placed before it. */
function pushDown(
  items: readonly DashboardLayoutItem[]
): DashboardLayoutItem[] {
  const placed: DashboardLayoutItem[] = [];
  for (const item of items) {
    const next = { ...item };
    let blocker = placed.find((other) => overlaps(other, next));
    while (blocker) {
      next.y = blocker.y + blocker.h;
      blocker = placed.find((other) => overlaps(other, next));
    }
    placed.push(next);
  }
  return placed;
}

/** Top gravity, as gridstack's default mode: widgets rise into free space above them. */
export function compactLayout(
  layout: readonly DashboardLayoutItem[]
): DashboardLayoutItem[] {
  const placed: DashboardLayoutItem[] = [];
  for (const item of [...layout].sort(readingOrder)) {
    const next = { ...item };
    while (
      next.y > 0 &&
      !placed.some((other) => overlaps(other, { ...next, y: next.y - 1 }))
    ) {
      next.y -= 1;
    }
    placed.push(next);
  }
  return placed.sort(readingOrder);
}

/**
 * Resolves overlaps: `fixedId` (the widget just moved or resized) keeps its
 * place, the others move below what they overlap, then everything rises.
 */
export function resolveLayout(
  layout: readonly DashboardLayoutItem[],
  fixedId?: string,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const items = layout.map((item) => clampLayoutItem(item, columns));
  const fixed = items.filter((item) => item.widgetId === fixedId);
  const others = items
    .filter((item) => item.widgetId !== fixedId)
    .sort(readingOrder);
  return compactLayout(pushDown([...fixed, ...others]));
}

/** First free place for a widget of this size, scanning rows then columns. */
export function findFreeSpot(
  layout: readonly DashboardLayoutItem[],
  size: { w: number; h: number },
  columns = DASHBOARD_COLUMNS
): { x: number; y: number } {
  const w = clamp(size.w, 1, columns);
  const rows = layoutRows(layout);
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x + w <= columns; x += 1) {
      const candidate = { widgetId: "", x, y, w, h: size.h };
      if (!layout.some((item) => overlaps(item, candidate))) {
        return { x, y };
      }
    }
  }
  return { x: 0, y: rows };
}

/**
 * The layout of these widgets: one item per widget (unknown items dropped,
 * missing widgets placed in the first free spot), inside the grid, without
 * overlaps and risen to the top.
 */
export function normalizeLayout(
  layout: readonly DashboardLayoutItem[],
  widgets: readonly { id: string; type: string }[],
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const known = new Set(widgets.map((widget) => widget.id));
  const seen = new Set<string>();
  const items: DashboardLayoutItem[] = [];
  for (const item of layout) {
    if (known.has(item.widgetId) && !seen.has(item.widgetId)) {
      seen.add(item.widgetId);
      items.push(clampLayoutItem(item, columns));
    }
  }
  let resolved = resolveLayout(items, undefined, columns);
  for (const widget of widgets) {
    if (!seen.has(widget.id)) {
      const size = defaultWidgetSize(widget.type);
      const spot = findFreeSpot(resolved, size, columns);
      resolved = resolveLayout(
        [...resolved, { widgetId: widget.id, ...spot, ...size }],
        widget.id,
        columns
      );
    }
  }
  return resolved;
}

const sameColumns = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.x < b.x + b.w && b.x < a.x + a.w;
const sameRows = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.y < b.y + b.h && b.y < a.y + a.h;

/** The nearest widget in a direction sharing the item's columns or rows. */
function neighbour(
  layout: readonly DashboardLayoutItem[],
  item: DashboardLayoutItem,
  direction: DashboardDirection
): DashboardLayoutItem | undefined {
  const others = layout.filter((other) => other.widgetId !== item.widgetId);
  const candidates: Record<DashboardDirection, () => DashboardLayoutItem[]> = {
    up: () =>
      others
        .filter((o) => sameColumns(o, item) && o.y + o.h <= item.y)
        .sort((a, b) => b.y + b.h - (a.y + a.h) || a.x - b.x),
    down: () =>
      others
        .filter((o) => sameColumns(o, item) && o.y >= item.y + item.h)
        .sort((a, b) => a.y - b.y || a.x - b.x),
    left: () =>
      others
        .filter((o) => sameRows(o, item) && o.x + o.w <= item.x)
        .sort((a, b) => b.x + b.w - (a.x + a.w) || a.y - b.y),
    right: () =>
      others
        .filter((o) => sameRows(o, item) && o.x >= item.x + item.w)
        .sort((a, b) => a.x - b.x || a.y - b.y),
  };
  return candidates[direction]().at(0);
}

const replaceItem = (
  layout: readonly DashboardLayoutItem[],
  ...changed: DashboardLayoutItem[]
): DashboardLayoutItem[] =>
  layout.map(
    (item) =>
      changed.find((next) => next.widgetId === item.widgetId) ?? { ...item }
  );

/** Left or right: swap with the adjacent widget when both fit, else one column. */
function moveSideways(
  layout: readonly DashboardLayoutItem[],
  item: DashboardLayoutItem,
  direction: "left" | "right",
  columns: number
): DashboardLayoutItem[] {
  const other = neighbour(layout, item, direction);
  const adjacent =
    other &&
    (direction === "left"
      ? other.x + other.w === item.x
      : item.x + item.w === other.x);
  if (other && adjacent) {
    const left = direction === "left" ? item : other;
    const right = direction === "left" ? other : item;
    const start = Math.min(item.x, other.x);
    const moved = [
      { ...left, x: start },
      { ...right, x: start + left.w },
    ];
    if (start + left.w + right.w <= columns) {
      return resolveLayout(replaceItem(layout, ...moved), item.widgetId);
    }
  }
  const x = item.x + (direction === "left" ? -1 : 1);
  return resolveLayout(
    replaceItem(layout, { ...item, x }),
    item.widgetId,
    columns
  );
}

/**
 * Keyboard alternative to dragging: up and down swap with the nearest widget
 * above or below, left and right with the adjacent one (or move a column).
 */
export function moveLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  direction: DashboardDirection,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!(item && canMoveLayoutItem(layout, widgetId, direction, columns))) {
    return layout.map((entry) => ({ ...entry }));
  }
  if (direction === "left" || direction === "right") {
    return moveSideways(layout, item, direction, columns);
  }
  const other = neighbour(layout, item, direction);
  if (!other) {
    return layout.map((entry) => ({ ...entry }));
  }
  // Up: take the place of the widget above. Down: let the widget below rise
  // into this place and settle under it.
  const y = direction === "up" ? other.y : other.y + other.h;
  const moved = replaceItem(layout, { ...item, y });
  return direction === "up"
    ? resolveLayout(moved, item.widgetId, columns)
    : resolveLayout(moved, other.widgetId, columns);
}

/** Whether the widget can move that way (menus disable the others). */
export function canMoveLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  direction: DashboardDirection,
  columns = DASHBOARD_COLUMNS
): boolean {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!item) {
    return false;
  }
  switch (direction) {
    case "left":
      return item.x > 0;
    case "right":
      return item.x + item.w < columns;
    case "up":
    case "down":
      return Boolean(neighbour(layout, item, direction));
    default:
      return false;
  }
}

const RESIZE_CHANGES: Record<DashboardResize, { w: number; h: number }> = {
  wider: { w: 1, h: 0 },
  narrower: { w: -1, h: 0 },
  taller: { w: 0, h: 1 },
  shorter: { w: 0, h: -1 },
};

/** Whether the widget can grow or shrink that way. */
export function canResizeLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  change: DashboardResize,
  columns = DASHBOARD_COLUMNS
): boolean {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!item) {
    return false;
  }
  const { w, h } = RESIZE_CHANGES[change];
  const width = item.w + w;
  const height = item.h + h;
  return (
    width >= 1 &&
    width <= columns &&
    height >= 1 &&
    height <= DASHBOARD_MAX_HEIGHT
  );
}

/** Keyboard alternative to the resize handle; a wider widget moves left when it must. */
export function resizeLayoutItem(
  layout: readonly DashboardLayoutItem[],
  widgetId: string,
  change: DashboardResize,
  columns = DASHBOARD_COLUMNS
): DashboardLayoutItem[] {
  const item = layout.find((entry) => entry.widgetId === widgetId);
  if (!(item && canResizeLayoutItem(layout, widgetId, change, columns))) {
    return layout.map((entry) => ({ ...entry }));
  }
  const { w, h } = RESIZE_CHANGES[change];
  const width = item.w + w;
  const next = {
    ...item,
    w: width,
    h: item.h + h,
    x: Math.min(item.x, columns - width),
  };
  return resolveLayout(replaceItem(layout, next), widgetId, columns);
}

/** Columns for a grid this wide: one on phones, four otherwise. */
export const dashboardColumnsForWidth = (width: number): number =>
  width > 0 && width <= DASHBOARD_PHONE_MAX_WIDTH ? 1 : DASHBOARD_COLUMNS;

/** Phone layout: widgets in reading order, one per row, full width, same heights. */
export function stackLayout(
  layout: readonly DashboardLayoutItem[]
): DashboardLayoutItem[] {
  let y = 0;
  return [...layout].sort(readingOrder).map((item) => {
    const stacked = { ...item, x: 0, y, w: 1 };
    y += item.h;
    return stacked;
  });
}

/** Whether two layouts place the same widgets at the same places (in any order). */
export const sameLayout = (
  a: readonly DashboardLayoutItem[],
  b: readonly DashboardLayoutItem[]
): boolean =>
  a.length === b.length &&
  a.every((item) => {
    const other = b.find((entry) => entry.widgetId === item.widgetId);
    return (
      other &&
      other.x === item.x &&
      other.y === item.y &&
      other.w === item.w &&
      other.h === item.h
    );
  });

/**
 * Positions a grid section's gridstack reported after a drag or resize,
 * normalized; an unchanged layout keeps the same section object.
 */
export function applyGridLayout<
  T extends { layout: readonly DashboardLayoutItem[] },
>(section: T, items: readonly DashboardLayoutItem[]): T {
  const layout = normalizeLayout(
    section.layout.map(
      (item) => items.find((next) => next.widgetId === item.widgetId) ?? item
    ),
    section.layout.map((item) => ({ id: item.widgetId, type: "view" }))
  );
  return sameLayout(layout, section.layout) ? section : { ...section, layout };
}
