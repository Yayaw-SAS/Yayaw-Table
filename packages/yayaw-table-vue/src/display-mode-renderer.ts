import type { Component } from "vue";
import type { FileTreeActions } from "./filetree-model";
import type { FormLinkActions, FormSubmitResult } from "./form-view";
import type { TableGalleryMediaConfig } from "./media-contract";
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
  list?: ScopedRowsRequest["list"];
  /** `actions.aggregate`, for views that ask the host for grouped values (charts). */
  aggregate?: (params: Record<string, unknown>) => unknown;
  /** Rows matching the current query, for tables without a list action. */
  rows: TableRecord[];
  /** The view's advanced filters (`{ filters, joinOperator }`). */
  advancedFilters: unknown;
  /** The view's first grouping column, for modes that section their records. */
  groupBy?: string;
  /**
   * Show the records matching these advanced filter rules: they join the
   * view's filters and the table mode opens. False when they cannot be added.
   */
  showRecords: (rules: Record<string, unknown>[]) => boolean;
  getRowId: (row: TableRecord) => string;
  canEditRow: (row: TableRecord) => boolean;
  canCreate: boolean;
  /** Save a patch through `actions.update`; resolves false on failure. */
  updateRow: (row: TableRecord, patch: TableRecord) => Promise<boolean>;
  /** Open a record like a row click (details, edit or link). */
  openRow: (row: TableRecord, event?: MouseEvent) => void;
  /** Open the create form with prefilled values. */
  createRow: (initial: TableRecord) => void;
  /** Create a record through `actions.create` and refresh the rows, without opening a form. */
  createRecord: (values: TableRecord) => Promise<FormSubmitResult>;
  /** The saved view shown, or null while no saved view is active. */
  viewId: string | null;
  /** Public form links, when the host provides `actions.formLinks`. */
  formLinks?: FormLinkActions;
  /** The table's `coloredTags` setting, for tags a renderer draws. */
  coloredTags: boolean;
  /** Changes after each mutation so renderers reload their rows. */
  revision: number;
  /** The table's name (`translations.keys.title`), e.g. for a root label. */
  title?: string;
  /** `actions.tree`: path, move and createFolder for the file tree. */
  tree?: FileTreeActions;
  /**
   * Save a patch through `actions.update` and answer its result without a
   * notification, so the renderer can show the error where it happened.
   */
  patchRow?: (
    row: TableRecord,
    patch: TableRecord
  ) => Promise<{ success: boolean; error?: string }>;
  /** Delete a record through `actions.delete`; absent when records cannot be deleted. */
  deleteRow?: (
    row: TableRecord
  ) => Promise<{ success: boolean; error?: string }>;
  canDeleteRow: (row: TableRecord) => boolean;
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

/** Components receive a `context` prop. */
export interface DisplayModeRenderer {
  view: Component;
  /** Content of View → Card settings for this mode. */
  settings?: Component;
}

export type DisplayModeRenderers = Partial<
  Record<TableDisplayMode, DisplayModeRenderer>
>;
