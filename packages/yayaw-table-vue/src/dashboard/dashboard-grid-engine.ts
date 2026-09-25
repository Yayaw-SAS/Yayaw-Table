/**
 * The desktop grid, driven by gridstack.js in both editions. Loaded on demand
 * (`import("./dashboard-grid-engine")`) with gridstack's styles, so neither
 * the table nor phones download it. The framework renders the items
 * (`.grid-stack-item[gs-id]`); this controller hands them to gridstack and
 * reports the positions users drag and resize to.
 */
import "gridstack/dist/gridstack.min.css";
import { type GridItemHTMLElement, GridStack } from "gridstack";
import {
  DASHBOARD_COLUMNS,
  DASHBOARD_MARGIN,
  DASHBOARD_ROW_HEIGHT,
  type DashboardLayoutItem,
} from "./dashboard-layout";

export interface DashboardGridController {
  /** Hands new items to gridstack, drops removed ones and applies `layout`. */
  sync: (layout: readonly DashboardLayoutItem[], editing: boolean) => void;
  destroy: () => void;
}

const itemElements = (element: HTMLElement): GridItemHTMLElement[] =>
  [...element.children].filter(
    (child): child is GridItemHTMLElement =>
      child instanceof HTMLElement &&
      child.classList.contains("grid-stack-item")
  );

const place = (item: DashboardLayoutItem) => ({
  x: item.x,
  y: item.y,
  w: item.w,
  h: item.h,
});

const differs = (
  element: GridItemHTMLElement,
  item: DashboardLayoutItem
): boolean => {
  const node = element.gridstackNode;
  return (
    !node ||
    node.x !== item.x ||
    node.y !== item.y ||
    node.w !== item.w ||
    node.h !== item.h
  );
};

/** Starts gridstack on the grid element; `onChange` receives every widget's place after a drag or resize. */
export function mountDashboardGrid(
  element: HTMLElement,
  options: {
    editing: boolean;
    onChange: (layout: DashboardLayoutItem[]) => void;
  }
): DashboardGridController {
  const grid = GridStack.init(
    {
      column: DASHBOARD_COLUMNS,
      cellHeight: DASHBOARD_ROW_HEIGHT,
      margin: DASHBOARD_MARGIN,
      handle: "[data-dashboard-drag-handle]",
      animate: false,
      disableDrag: !options.editing,
      disableResize: !options.editing,
      resizable: { handles: "se" },
    },
    element
  );
  if (!grid) {
    throw new Error("gridstack could not start on the dashboard grid.");
  }
  let syncing = false;
  const report = () => {
    if (syncing) {
      return;
    }
    const layout: DashboardLayoutItem[] = [];
    for (const node of grid.engine.nodes) {
      if (node.id) {
        layout.push({
          widgetId: String(node.id),
          x: node.x ?? 0,
          y: node.y ?? 0,
          w: node.w ?? 1,
          h: node.h ?? 1,
        });
      }
    }
    options.onChange(layout);
  };
  grid.on("change", report);

  const sync = (layout: readonly DashboardLayoutItem[], editing: boolean) => {
    syncing = true;
    grid.batchUpdate();
    try {
      for (const node of [...grid.engine.nodes]) {
        if (node.el && node.el.parentElement !== element) {
          grid.removeWidget(node.el, false, false);
        }
      }
      for (const child of itemElements(element)) {
        const id = child.getAttribute("gs-id");
        const item = layout.find((entry) => entry.widgetId === id);
        if (item && !child.gridstackNode) {
          grid.makeWidget(child, { id: item.widgetId, ...place(item) });
        } else if (item && differs(child, item)) {
          grid.update(child, place(item));
        }
      }
    } finally {
      grid.batchUpdate(false);
      syncing = false;
    }
    grid.enableMove(editing);
    grid.enableResize(editing);
  };

  return {
    sync,
    destroy: () => {
      grid.offAll();
      grid.destroy(false);
    },
  };
}
