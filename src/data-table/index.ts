/**
 * Main export file for the DataTable component
 * This file exports all components, hooks, and atoms for the DataTable
 */

// Main component
export { DataTable } from './components/data-table';

// Config helper and types
export { defineTableConfig } from './config/helpers';
export type {
  ColumnDefinition,
  TableBehaviorConfig,
  TableColumnsConfig,
  TableConfig,
  TableTranslationsConfig,
} from './config/helpers';

// Core types used in docs
export type { TableView, TableViewConfig } from './types/view-types';
export * from './types/translations';
export * from './types/filter-types';
export * from './types/column-types';
export * from './types/table-types';
