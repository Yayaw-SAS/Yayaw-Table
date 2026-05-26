/**
 * Main export file for the DataTable component
 * This file exports all components, hooks, and atoms for the DataTable
 */

export type {
  BulkAction,
  BulkActionConfirmConfig,
  BulkActionContext,
  BulkActionHandler,
  BulkActionHandlerResult,
  BulkActionResult,
  BulkActionVariant,
  CustomBulkActionsInput,
} from "./components/bulk-actions";
// Main component
export { DataTable } from "./components/data-table";
export type {
  AnyFieldDefinition,
  CollectionFieldActionLabels,
  CollectionFieldColumnDefinition,
  CollectionFieldCreateAction,
  CollectionFieldDefinition,
  CollectionFieldItem,
  FieldValues,
  FormConfig,
  FormConfigContext,
  FormConfigMode,
  FormFieldApi,
} from "./components/forms";
export {
  CatalogueForm,
  CollectionEditor,
  CollectionField,
  createCollectionField,
  defineFormConfig,
  FormBuilder,
} from "./components/forms";
export type {
  CatalogueFormLayoutConfig,
  TableFormConfig,
} from "./config/form-config";
export type {
  ColumnDefinition,
  InlineEditColumnConfig,
  InlineEditEditor,
  InlineEditOption,
  TableBehaviorConfig,
  TableColumnsConfig,
  TableConfig,
  TableEmptyStateConfig,
  TableInlineEditConfig,
  TableLayoutPreset,
  TableRowClickMode,
  TableTranslationsConfig,
} from "./config/helpers";
// Config helper and types
export { defineTableConfig } from "./config/helpers";
export * from "./types/column-types";
export * from "./types/date-types";
export * from "./types/filter-types";
export * from "./types/footer-types";
export * from "./types/table-types";
export * from "./types/toolbar-types";
export * from "./types/translations";
// Core types used in docs
export type { TableView, TableViewConfig } from "./types/view-types";
