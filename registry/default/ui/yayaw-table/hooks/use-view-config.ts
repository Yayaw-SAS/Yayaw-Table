"use client";

import { useEffect, useMemo, useRef } from "react";
import type { TableViewConfig } from "../types/view-types";
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

/**
 * Settings a host asks a running table to show (`DataTable`'s `viewRequest`),
 * e.g. a dashboard number that filters the table beside it.
 */
export interface TableViewRequest {
  /** Identifies the request: the same settings apply again under a new key. */
  key: number | string;
  /** View settings, as a saved view's `config`. */
  config: ViewConfig;
  /**
   * Replace the whole view with `config` (a saved view) instead of laying
   * `config` over the view the table shows (its filters only, say).
   */
  replace?: boolean;
  /** The saved view to mark active; the table keeps its active view without one. */
  viewId?: null | string;
}

/**
 * Applies each new `viewRequest` once, as a choice of the user (Back returns
 * to the view it replaced). A request already there when the table starts is
 * ignored: `initialView` and saved views decide where a table starts.
 */
export function useViewRequest(
  tableId: string,
  config: TableCatalogueConfig,
  request: TableViewRequest | undefined
): void {
  const defaults = useMemo(() => tableViewDefaults(config), [config]);
  const { applyViewConfig, getCurrentViewConfig, viewParam } = useTableUrlState(
    {
      defaultDensity: config.table.density,
      defaultDisplayMode: config.table.defaultDisplayMode,
      defaultGantt: config.table.gantt,
      defaultPageSize: config.table.defaultPageSize,
      tableId,
    }
  );
  const applied = useRef(request?.key);
  const apply = useRef(() => undefined as undefined);
  apply.current = () => {
    if (!request) {
      return;
    }
    const base = request.replace ? {} : getCurrentViewConfig();
    applyViewConfig(
      resolveTableViewConfig(
        { ...base, ...request.config } as TableViewConfig,
        defaults
      ),
      {
        viewId: request.viewId === undefined ? viewParam : request.viewId,
        history: "push",
      }
    );
  };
  const key = request?.key;
  useEffect(() => {
    if (key === undefined || applied.current === key) {
      return;
    }
    applied.current = key;
    apply.current();
  }, [key]);
}
