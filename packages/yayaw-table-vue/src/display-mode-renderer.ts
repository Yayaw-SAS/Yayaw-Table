import type { Component } from "vue";
import type { ScopedRowsRequest } from "./scoped-rows";
import type { ColumnDefinition, TableDisplayMode, TableRecord } from "./types";

/** What a mode's settings panel needs. */
export interface DisplayModeSettingsContext {
  tableId: string;
  locale: string;
  columns: ColumnDefinition[];
  /** Table defaults for this mode, before the view's own settings. */
  defaults: Record<string, unknown>;
  /** The active view's own settings for this mode. */
  settings: Record<string, unknown>;
  /** Save settings for this mode in the view and URL (`undefined` resets them). */
  updateSettings: (settings: Record<string, unknown> | undefined) => void;
  translate: (key: string, fallback: string) => string;
}

/**
 * What the table gives a display mode rendered by an optional registry item,
 * such as the calendar. The item never reaches into table internals.
 */
export interface DisplayModeRenderContext extends DisplayModeSettingsContext {
  tableType: string;
  /** The current query (search, filters, sorting) as list parameters. */
  listParams: Record<string, unknown>;
  list?: ScopedRowsRequest["list"];
  /** Rows matching the current query, for tables without a list action. */
  rows: TableRecord[];
  getRowId: (row: TableRecord) => string;
  canEditRow: (row: TableRecord) => boolean;
  canCreate: boolean;
  /** Save a patch through `actions.update`; resolves false on failure. */
  updateRow: (row: TableRecord, patch: TableRecord) => Promise<boolean>;
  /** Open a record like a row click (details, edit or link). */
  openRow: (row: TableRecord, event?: MouseEvent) => void;
  /** Open the create form with prefilled values. */
  createRow: (initial: TableRecord) => void;
  /** Changes after each mutation so renderers reload their rows. */
  revision: number;
}

/** Components receive a `context` prop. */
export interface DisplayModeRenderer {
  view: Component;
  /** Content of View → Card settings for this mode. */
  settings?: Component;
}

export type DisplayModeRenderers = Partial<
  Record<TableDisplayMode, DisplayModeRenderer>
>;
