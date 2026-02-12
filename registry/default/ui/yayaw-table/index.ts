/**
 * Main export file for the DataTable component
 * This file exports all components, hooks, and atoms for the DataTable
 */

// Main component
export { DataTable } from "./components/data-table";
export type {
  ColumnDefinition,
  TableBehaviorConfig,
  TableColumnsConfig,
  TableConfig,
  TableTranslationsConfig,
} from "./config/helpers";
// Config helper and types
export { defineTableConfig } from "./config/helpers";
export * from "./types/column-types";
export * from "./types/date-types";
export * from "./types/filter-types";
export * from "./types/table-types";
export * from "./types/translations";
// Core types used in docs
export type { TableView, TableViewConfig } from "./types/view-types";
