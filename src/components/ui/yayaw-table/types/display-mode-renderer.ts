import type { ComponentType, MouseEvent, ReactNode } from "react";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { TableActions } from "../providers/table-provider";
import type { TableDisplayMode } from "./display-types";

/** What a mode's settings panel needs. */
export interface DisplayModeSettingsContext {
  tableId: string;
  locale: string;
  columns: TableCatalogueColumnConfig[];
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
  list?: TableActions["list"];
  /** Rows of the current page, for tables without a list action. */
  rows: Record<string, unknown>[];
  getRowId: (row: Record<string, unknown>) => string;
  canEditRow: (row: Record<string, unknown>) => boolean;
  canCreate: boolean;
  /** Save a patch through `actions.update`; resolves false on failure. */
  updateRow: (
    row: Record<string, unknown>,
    patch: Record<string, unknown>
  ) => Promise<boolean>;
  /** Open a record like a row click (details, edit or link). */
  openRow: (row: Record<string, unknown>, event?: MouseEvent<HTMLElement>) => void;
  /** Open the create form with prefilled values. */
  createRow: (initial: Record<string, unknown>) => void;
  /** Changes after each mutation so renderers reload their rows. */
  revision: number;
  emptyState: ReactNode;
}

export interface DisplayModeRenderer {
  View: ComponentType<{ context: DisplayModeRenderContext }>;
  /** Content of View → Card settings for this mode. */
  Settings?: ComponentType<{ context: DisplayModeSettingsContext }>;
}

export type DisplayModeRenderers = Partial<
  Record<TableDisplayMode, DisplayModeRenderer>
>;
