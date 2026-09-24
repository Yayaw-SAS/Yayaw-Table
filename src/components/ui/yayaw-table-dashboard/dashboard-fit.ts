/**
 * Fit widgets (`settings.overflow: "fit"`, the default) show the records that
 * fit their height and nothing scrolls. Shared by the React and Vue editions:
 * both mark each record of a table, list, gallery, board and feed with
 * `data-row-id`, board lanes with `data-kanban-lane` and the board with
 * `data-kanban-board`. Hidden records carry `data-dashboard-overflow`, which
 * `dashboard-grid.css` hides.
 */

const RECORD = "[data-row-id]";
const BOARD = "[data-kanban-board]";
const LANE = "[data-kanban-lane]";
export const DASHBOARD_OVERFLOW_ATTRIBUTE = "data-dashboard-overflow";
const HIDDEN = `[${DASHBOARD_OVERFLOW_ATTRIBUTE}]`;
/** Sub-pixel rounding is not overflow. */
const TOLERANCE = 1;
/**
 * Space a view may keep below its last record (paddings and borders of its
 * list, board or feed). Overflow left once every record ends this far above
 * the bottom is not the records' doing: the widget clips it.
 */
const TRAILING_SPACE = 40;
/** Columns a table keeps, however narrow the widget. */
const MIN_COLUMNS = 2;

export interface DashboardFitResult {
  /** Records shown. */
  shown: number;
  /** Records loaded but hidden. */
  hidden: number;
}

const hide = (element: Element) =>
  element.setAttribute(DASHBOARD_OVERFLOW_ATTRIBUTE, "");
const isShown = (element: Element) =>
  !element.closest(HIDDEN) && element.getClientRects().length > 0;
/** Records of the container, the outer one only when a record holds another (a feed post in its item). */
const recordsOf = (container: HTMLElement) =>
  [...container.querySelectorAll(RECORD)].filter(
    (record) => !record.parentElement?.closest(RECORD)
  );

/** Lanes that do not fit the width are hidden from the right; one always stays. */
function fitLanes(container: HTMLElement) {
  for (const board of container.querySelectorAll<HTMLElement>(BOARD)) {
    const lanes = [...board.querySelectorAll(LANE)];
    let shown = lanes.length;
    while (shown > 1 && board.scrollWidth > board.clientWidth + TOLERANCE) {
      shown -= 1;
      const lane = lanes[shown];
      if (lane) {
        hide(lane);
      }
    }
  }
}

/** Table columns that do not fit the width are hidden from the right. */
function fitColumns(container: HTMLElement) {
  for (const table of container.querySelectorAll("table")) {
    const frame = table.parentElement ?? container;
    const rows = [...table.rows];
    const width = Math.max(0, ...rows.map((row) => row.cells.length));
    let shown = width;
    while (
      shown > MIN_COLUMNS &&
      table.getBoundingClientRect().width > frame.clientWidth + TOLERANCE
    ) {
      shown -= 1;
      for (const row of rows) {
        const cell = row.cells.length === width ? row.cells[shown] : undefined;
        if (cell) {
          hide(cell);
        }
      }
    }
  }
}

/** The shown record reaching lowest (the last one in reading order on ties). */
function lowestRecord(records: readonly Element[]) {
  let lowest: { record: Element; bottom: number } | undefined;
  for (const record of records) {
    const bottom = record.getBoundingClientRect().bottom;
    if (!lowest || bottom >= lowest.bottom) {
      lowest = { record, bottom };
    }
  }
  return lowest;
}

/**
 * Records hide from the lowest up while the content overflows, which also
 * accounts for the paddings and borders below them. Records starting below
 * the visible area go first, at once. The first line always stays (the
 * first record, a gallery's first row of cards, each lane's first card).
 */
function fitRecords(container: HTMLElement) {
  const overflows = () =>
    container.scrollHeight > container.clientHeight + TOLERANCE;
  if (!overflows()) {
    return;
  }
  const records = recordsOf(container).filter(isShown);
  const firstTop = records.at(0)?.getBoundingClientRect().top ?? 0;
  const kept = new Set(
    records.filter(
      (record) =>
        Math.abs(record.getBoundingClientRect().top - firstTop) <= TOLERANCE
    )
  );
  const box = container.getBoundingClientRect();
  const bottom = box.top + container.clientTop + container.clientHeight;
  let shown = records.filter((record) => !kept.has(record));
  for (const record of shown) {
    if (record.getBoundingClientRect().top >= bottom) {
      hide(record);
    }
  }
  shown = shown.filter(isShown);
  while (shown.length && overflows()) {
    const lowest = lowestRecord(shown);
    if (!lowest || lowest.bottom <= bottom - TRAILING_SPACE) {
      return;
    }
    hide(lowest.record);
    shown = shown.filter((record) => record !== lowest.record);
  }
}

/**
 * Hides the records, lanes and columns that do not fit in `container` (an
 * element that clips, with a definite height) and counts the records left.
 */
export function fitDashboardRecords(
  container: HTMLElement
): DashboardFitResult {
  for (const element of container.querySelectorAll(HIDDEN)) {
    element.removeAttribute(DASHBOARD_OVERFLOW_ATTRIBUTE);
  }
  fitLanes(container);
  fitColumns(container);
  fitRecords(container);
  const records = recordsOf(container);
  const shown = records.filter(isShown).length;
  return { shown, hidden: records.length - shown };
}

/**
 * Fits `container` now and again when it resizes, its content changes,
 * images load or fonts arrive; `onFit` hears each new result.
 */
export function observeDashboardFit(
  container: HTMLElement,
  onFit: (result: DashboardFitResult) => void
): () => void {
  const view = container.ownerDocument.defaultView;
  let disposed = false;
  let last = "";
  const refit = () => {
    if (disposed || !container.isConnected) {
      return;
    }
    const result = fitDashboardRecords(container);
    const key = `${result.shown}:${result.hidden}`;
    if (key !== last) {
      last = key;
      onFit(result);
    }
  };
  // Both run before paint, so records never flash in before hiding.
  const resize =
    typeof view?.ResizeObserver === "function"
      ? new view.ResizeObserver(refit)
      : undefined;
  resize?.observe(container);
  const mutation =
    typeof view?.MutationObserver === "function"
      ? new view.MutationObserver(refit)
      : undefined;
  mutation?.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  container.addEventListener("load", refit, true);
  container.ownerDocument.fonts?.ready.then(refit).catch(() => undefined);
  refit();
  return () => {
    disposed = true;
    resize?.disconnect();
    mutation?.disconnect();
    container.removeEventListener("load", refit, true);
  };
}
