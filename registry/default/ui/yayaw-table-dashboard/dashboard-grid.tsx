"use client";

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DashboardGridController } from "./dashboard-grid-engine";
import {
  DASHBOARD_MARGIN,
  DASHBOARD_ROW_HEIGHT,
  type DashboardLayoutItem,
  dashboardColumnsForWidth,
  layoutRows,
  stackLayout,
} from "./dashboard-layout";
import "./dashboard-grid.css";

// Layout effects measure before paint in the browser; the server skips them.
const useBrowserLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const readingOrder = (a: DashboardLayoutItem, b: DashboardLayoutItem) =>
  a.y - b.y || a.x - b.x;

const gridVariables = (rows: number) =>
  ({
    "--dashboard-rows": rows,
    "--dashboard-row-height": `${DASHBOARD_ROW_HEIGHT}px`,
    "--dashboard-margin": `${DASHBOARD_MARGIN}px`,
  }) as CSSProperties;

const itemVariables = (item: DashboardLayoutItem) =>
  ({
    "--dashboard-x": item.x,
    "--dashboard-y": item.y,
    "--dashboard-w": item.w,
    "--dashboard-h": item.h,
  }) as CSSProperties;

export interface DashboardGridProps {
  layout: DashboardLayoutItem[];
  editing: boolean;
  onLayoutChange: (layout: DashboardLayoutItem[]) => void;
  renderItem: (widgetId: string, phone: boolean) => ReactNode;
}

/** Four columns with gridstack on desktop; one stacked column on phones. */
export function DashboardGrid(props: DashboardGridProps) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useBrowserLayoutEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const phone = dashboardColumnsForWidth(width) === 1;
  return (
    <div
      data-dashboard-layout={phone ? "stack" : "grid"}
      ref={container}
      style={gridVariables(layoutRows(props.layout))}
    >
      {phone ? <StackedGrid {...props} /> : <DesktopGrid {...props} />}
    </div>
  );
}

function StackedGrid({ layout, renderItem }: DashboardGridProps) {
  return (
    <div className="yayaw-dashboard-stack">
      {stackLayout(layout).map((item) => (
        <div
          data-dashboard-item={item.widgetId}
          data-layout={`${item.x},${item.y},${item.w},${item.h}`}
          key={item.widgetId}
          style={itemVariables(item)}
        >
          {renderItem(item.widgetId, true)}
        </div>
      ))}
    </div>
  );
}

function DesktopGrid({
  editing,
  layout,
  onLayoutChange,
  renderItem,
}: DashboardGridProps) {
  const element = useRef<HTMLDivElement>(null);
  const controller = useRef<DashboardGridController | null>(null);
  const latest = useRef({ editing, layout, onLayoutChange });
  latest.current = { editing, layout, onLayoutChange };
  const [ready, setReady] = useState(false);
  const ordered = useMemo(() => [...layout].sort(readingOrder), [layout]);

  useEffect(() => {
    let cancelled = false;
    let mounted: DashboardGridController | undefined;
    // gridstack loads with the first desktop grid, not with the page.
    import("./dashboard-grid-engine")
      .then(({ mountDashboardGrid }) => {
        if (cancelled || !element.current) {
          return;
        }
        mounted = mountDashboardGrid(element.current, {
          editing: latest.current.editing,
          onChange: (next) => latest.current.onLayoutChange(next),
        });
        controller.current = mounted;
        mounted.sync(latest.current.layout, latest.current.editing);
        setReady(true);
      })
      .catch(() => {
        // Without gridstack, the CSS layout and the keyboard menu still work.
      });
    return () => {
      cancelled = true;
      controller.current = null;
      mounted?.destroy();
    };
  }, []);

  // After each render: new widgets join gridstack, moved ones take their place.
  useBrowserLayoutEffect(() => {
    controller.current?.sync(layout, editing);
  });

  return (
    <div
      className="grid-stack yayaw-dashboard-grid"
      data-editing={editing ? "" : undefined}
      data-grid-ready={ready ? "" : undefined}
      ref={element}
    >
      {ordered.map((item) => (
        <div
          className="grid-stack-item"
          data-dashboard-item={item.widgetId}
          data-layout={`${item.x},${item.y},${item.w},${item.h}`}
          gs-h={item.h}
          gs-id={item.widgetId}
          gs-w={item.w}
          gs-x={item.x}
          gs-y={item.y}
          key={item.widgetId}
          style={itemVariables(item)}
        >
          <div className="grid-stack-item-content">
            {renderItem(item.widgetId, false)}
          </div>
        </div>
      ))}
    </div>
  );
}
