"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  resolveTableViewConfig,
  tableViewDefaults,
} from "../utils/table-view-state";
import { canonicalViewConfig, type ViewConfig } from "../utils/view-config";
import type { TableCatalogueConfig } from "./use-table-config";
import { useTableUrlState } from "./use-table-url-state";

/**
 * The view the table shows, as a saved view stores it and both editions
 * report it (`canonicalViewConfig`): its state (the URL's or the instance's)
 * completed with the table's defaults.
 */
export function useCurrentViewConfig(
  tableId: string,
  config: TableCatalogueConfig
): ViewConfig {
  const defaults = useMemo(() => tableViewDefaults(config), [config]);
  const { getCurrentViewConfig } = useTableUrlState({
    defaultDensity: config.table.density,
    defaultDisplayMode: config.table.defaultDisplayMode,
    defaultGantt: config.table.gantt,
    defaultPageSize: config.table.defaultPageSize,
    tableId,
  });
  const current = canonicalViewConfig(
    resolveTableViewConfig(getCurrentViewConfig(), defaults)
  );
  // One object per distinct view, whatever re-renders the table.
  const key = JSON.stringify(current);
  return useMemo(() => JSON.parse(key) as ViewConfig, [key]);
}

/**
 * Calls `onChange` with the view the table shows: once it starts, then after
 * each change of its sort, filters, search, columns, display mode or mode
 * settings (`DataTable`'s `onViewConfigChange`).
 */
export function useViewConfigReport(
  tableId: string,
  config: TableCatalogueConfig,
  onChange: (config: ViewConfig) => void
): void {
  const current = useCurrentViewConfig(tableId, config);
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    latest.current(current);
  }, [current]);
}
