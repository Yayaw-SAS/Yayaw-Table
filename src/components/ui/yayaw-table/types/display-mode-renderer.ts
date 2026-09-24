import type { ComponentType, MouseEvent, ReactNode } from "react";
import type { TableCatalogueColumnConfig } from "../hooks/use-table-config";
import type { TableActions } from "../providers/table-provider";
import type { FileTreeActions } from "../utils/filetree-model";
import type { FormLinkActions, FormSubmitResult } from "../utils/form-view";
import type { TableGalleryMediaConfig } from "../utils/media-contract";
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
  /**
   * Fields of the table's create form (`getFormConfig` for its create form
   * type), when the host declares one: the Form mode asks only these columns.
   */
  formFields?: readonly string[];
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
  /** `actions.aggregate`, for views that ask the host for grouped values (charts). */
  aggregate?: TableActions["aggregate"];
  /** Rows of the current page, for tables without a list action. */
  rows: Record<string, unknown>[];
  /** The view's advanced filters (array or `{ filters, joinOperator }`). */
  advancedFilters: unknown;
  /** The view's first grouping column, for modes that section their records. */
  groupBy?: string;
  /**
   * Show the records matching these advanced filter rules: they join the
   * view's filters and the table mode opens. False when they cannot be added.
   */
  showRecords: (rules: Record<string, unknown>[]) => boolean;
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
  /** Create a record through `actions.create` and refresh the rows, without opening a form. */
  createRecord: (values: Record<string, unknown>) => Promise<FormSubmitResult>;
  /** The saved view shown, or null while no saved view is active. */
  viewId: string | null;
  /** Public form links, when the host provides `actions.formLinks`. */
  formLinks?: FormLinkActions;
  /** The table's `coloredTags` setting, for tags a renderer draws. */
  coloredTags: boolean;
  /** Changes after each mutation so renderers reload their rows. */
  revision: number;
  emptyState: ReactNode;
  /** The table's name (`translations.keys.title`), e.g. for a root label. */
  title?: string;
  /** `actions.tree`: path, move and createFolder for the file tree. */
  tree?: FileTreeActions;
  /**
   * Save a patch through `actions.update` and answer its result without a
   * notification, so the renderer can show the error where it happened.
   */
  patchRow?: (
    row: Record<string, unknown>,
    patch: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;
  /** Delete a record through `actions.delete`; absent when records cannot be deleted. */
  deleteRow?: (
    row: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;
  canDeleteRow: (row: Record<string, unknown>) => boolean;
  /** `table.gallery.media` and image column, for file icons and previews. */
  media?: TableGalleryMediaConfig;
  imageColumn?: string;
  /** Row selection settings of the table. */
  selection: { enabled: boolean; multiple: boolean };
  /** The table keeps its state in the URL (`table.syncUrl`). */
  syncUrl: boolean;
  /** Reload the table's rows (after a change made through `actions.tree`). */
  refresh: () => Promise<void>;
}

export interface DisplayModeRenderer {
  View: ComponentType<{ context: DisplayModeRenderContext }>;
  /** Content of View → Card settings for this mode. */
  Settings?: ComponentType<{ context: DisplayModeSettingsContext }>;
}

export type DisplayModeRenderers = Partial<
  Record<TableDisplayMode, DisplayModeRenderer>
>;
