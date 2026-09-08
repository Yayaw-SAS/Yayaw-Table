const SCROLLABLE_OVERFLOW = /auto|scroll|hidden/;

/** Conservative sizing keeps variable-height rows and pagination inside the available viewport. */
export function fitPageSize(
  availableHeight: number,
  rowHeight: number
): number {
  if (
    !(Number.isFinite(availableHeight) && Number.isFinite(rowHeight)) ||
    rowHeight <= 0
  ) {
    return 1;
  }
  return Math.max(
    1,
    Math.min(500, Math.floor(Math.max(0, availableHeight) / rowHeight))
  );
}

export interface AutoPageMeasurement {
  pageSize: number;
  tableHeight: number;
}

/** Observe layout, not scroll position, so scrolling to the selector does not change the capacity. */
export function observeAutoPageSize(
  root: HTMLElement,
  onMeasure: (value: AutoPageMeasurement) => void
): () => void {
  const win = root.ownerDocument.defaultView;
  if (!win) {
    return () => undefined;
  }
  let disposed = false;
  let frame = 0;
  let tallestRow = 0;
  let previousWidth = 0;
  const ancestors: HTMLElement[] = [];
  for (
    let element = root.parentElement;
    element;
    element = element.parentElement
  ) {
    ancestors.push(element);
  }
  const measure = () => {
    frame = 0;
    if (disposed || !root.isConnected || !root.getClientRects().length) {
      return;
    }
    const table = root.querySelector("table");
    const body = table?.querySelector("tbody");
    if (!(table && body)) {
      return;
    }
    const rows = [...body.querySelectorAll("tr")].filter(
      (row) => row.querySelector("td")?.colSpan === 1
    );
    const width = table.getBoundingClientRect().width;
    if (width !== previousWidth) {
      tallestRow = 0;
      previousWidth = width;
    }
    for (const row of rows) {
      tallestRow = Math.max(tallestRow, row.getBoundingClientRect().height);
    }
    if (tallestRow <= 0) {
      return;
    }
    const scroller = ancestors.find((element) => {
      const style = win.getComputedStyle(element);
      return (
        SCROLLABLE_OVERFLOW.test(style.overflowY) &&
        element.clientHeight < element.scrollHeight
      );
    });
    const viewportHeight =
      scroller?.clientHeight ?? win.visualViewport?.height ?? win.innerHeight;
    const origin = scroller
      ? scroller.getBoundingClientRect().top +
        scroller.clientTop -
        scroller.scrollTop
      : -win.scrollY;
    const tableTop = Math.max(0, table.getBoundingClientRect().top - origin);
    const bodyTop = Math.max(0, body.getBoundingClientRect().top - origin);
    const footer = root.querySelector<HTMLElement>("[data-yayaw-pagination]");
    const footerHeight = footer?.getBoundingClientRect().height ?? 48;
    const calculationsHeight =
      table.querySelector("tfoot")?.getBoundingClientRect().height ?? 0;
    const tableHeight = Math.max(
      80,
      viewportHeight - tableTop - footerHeight - 24
    );
    const available =
      viewportHeight - bodyTop - footerHeight - calculationsHeight - 24;
    onMeasure({ pageSize: fitPageSize(available, tallestRow), tableHeight });
  };
  const schedule = () => {
    if (!(disposed || frame)) {
      frame = win.requestAnimationFrame(measure);
    }
  };
  const resize =
    typeof win.ResizeObserver === "function"
      ? new win.ResizeObserver(schedule)
      : undefined;
  resize?.observe(root);
  for (const ancestor of ancestors) {
    resize?.observe(ancestor);
  }
  const mutation = new win.MutationObserver(schedule);
  mutation.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  win.addEventListener("resize", schedule);
  win.visualViewport?.addEventListener("resize", schedule);
  root.addEventListener("load", schedule, true);
  root.ownerDocument.fonts?.ready.then(schedule, schedule);
  schedule();
  return () => {
    disposed = true;
    win.cancelAnimationFrame(frame);
    resize?.disconnect();
    mutation.disconnect();
    win.removeEventListener("resize", schedule);
    win.visualViewport?.removeEventListener("resize", schedule);
    root.removeEventListener("load", schedule, true);
  };
}
