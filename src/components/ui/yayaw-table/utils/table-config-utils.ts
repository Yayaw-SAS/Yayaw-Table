/**
 * Utilities for handling table configuration transformations
 * Manages conversions between in-memory TanStack Table state and database-storable format
 */

// Import TanStack Table types
import type {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  SortingState,
} from "@/components/ui/yayaw-table/tanstack";
import type {
  TableDisplayMode,
  TableGalleryViewConfig,
  TableKanbanViewConfig,
} from "../types/display-types";
import type { AdvancedFiltersState } from "../types/filter-types";
// Import TableViewConfig type from types
import type { TableViewConfig } from "../types/view-types";
import {
  areTableViewConfigsEqual,
  normalizeTableViewConfig,
} from "./table-view-state";

/**
 * Type definition for a serialized table configuration
 * Ensures all properties are JSON-serializable
 */
export interface SerializedTableViewConfig {
  advancedFilters?: string; // JSON string of advanced filter rules
  columnFilters?: string; // JSON string of filter configurations
  columnOrder?: string; // JSON string of column order
  columnPinning?: string; // JSON string of pinned columns
  columnSizing?: string; // JSON string of user-defined column widths
  columnVisibility?: string; // JSON string of column visibility
  displayMode?: TableDisplayMode; // Display mode for this view
  gallery?: string; // JSON string of Gallery view configuration
  globalSearch?: string; // Global search value
  grouping?: string; // JSON string of grouping columns
  kanban?: string; // JSON string of Kanban view configuration
  pageSize?: number; // Page size restored with the view
  sorting?: string; // JSON string of sort configuration
}

// Define ColumnVisibilityState type if it's not exported from @tanstack/react-table
type ColumnVisibilityState = Record<string, boolean>;

/**
 * Utilities for table configuration
 * Handles conversion between in-memory state and database-storable format
 */
export const tableConfigUtils = {
  /**
   * Determines if two configurations are equivalent
   * Useful for detecting if changes have been made
   * @param config1 - First configuration to compare
   * @param config2 - Second configuration to compare
   * @returns True if configurations are equivalent
   */
  areEqual: (config1: TableViewConfig, config2: TableViewConfig): boolean => {
    return areTableViewConfigsEqual(config1, config2);
  },

  /**
   * Creates a deep clone of a configuration
   * @param config - Configuration to clone
   * @returns Deep copy of the configuration
   */
  clone: (config: TableViewConfig): TableViewConfig => {
    return JSON.parse(JSON.stringify(config)) as TableViewConfig;
  },

  /**
   * Converts a serialized configuration from storage to a usable TableViewConfig
   * @param serializedConfig - Configuration as stored in the database
   * @returns TableViewConfig object ready for use with TanStack Table
   */
  fromStorage: (
    serializedConfig: SerializedTableViewConfig | string
  ): TableViewConfig => {
    // If the input is a string, parse it as JSON
    let config: SerializedTableViewConfig;
    try {
      if (typeof serializedConfig === "string") {
        config = JSON.parse(serializedConfig) as SerializedTableViewConfig;
      } else {
        config = serializedConfig;
      }
    } catch {
      // Return empty config if parsing fails
      return {};
    }

    // Parse column filters and ensure they have the correct structure
    let columnFilters: ColumnFiltersState | undefined;
    if (config.columnFilters) {
      try {
        // Handle the case where columnFilters might already be an object
        const parsedFilters =
          typeof config.columnFilters === "string"
            ? JSON.parse(config.columnFilters)
            : config.columnFilters;

        // Ensure each filter has the correct structure
        if (Array.isArray(parsedFilters)) {
          columnFilters = parsedFilters.map((filter: unknown) => {
            const filterObj = filter as { id?: unknown; value?: unknown };
            // Make sure the ID is a string
            const id =
              typeof filterObj.id === "string"
                ? filterObj.id
                : String(filterObj.id || "");
            return {
              id,
              value: filterObj.value,
            };
          });
        } else {
          columnFilters = [];
        }
      } catch {
        columnFilters = [];
      }
    }

    // Helper function to safely parse JSON or handle already parsed objects
    const safelyParse = <T>(value: unknown, defaultValue: T): T => {
      if (!value) {
        return defaultValue;
      }

      try {
        if (typeof value === "string") {
          return JSON.parse(value) as T;
        }
        // If it's already an object, return it directly
        return value as T;
      } catch {
        return defaultValue;
      }
    };

    const parsedConfig: TableViewConfig = {
      advancedFilters: safelyParse<AdvancedFiltersState>(
        config.advancedFilters,
        []
      ),
      columnFilters,
      columnOrder: safelyParse<ColumnOrderState>(config.columnOrder, []),
      columnPinning: safelyParse<ColumnPinningState>(
        config.columnPinning,
        { left: [], right: [] }
      ),
      columnSizing: safelyParse<ColumnSizingState>(config.columnSizing, {}),
      columnVisibility: safelyParse<ColumnVisibilityState>(
        config.columnVisibility,
        {}
      ),
      displayMode:
        config.displayMode === "gallery" ||
        config.displayMode === "kanban" ||
        config.displayMode === "table"
          ? config.displayMode
          : undefined,
      gallery: safelyParse<TableGalleryViewConfig>(config.gallery, {}),
      globalSearch:
        typeof config.globalSearch === "string" ? config.globalSearch : "",
      grouping: safelyParse<string[]>(config.grouping, []),
      kanban: safelyParse<TableKanbanViewConfig>(config.kanban, {}),
      pageSize:
        typeof config.pageSize === "number" && Number.isFinite(config.pageSize)
          ? config.pageSize
          : undefined,
      sorting: safelyParse<SortingState>(config.sorting, []),
    };

    // Create TableViewConfig with parsed JSON properties
    return normalizeTableViewConfig(parsedConfig);
  },

  /**
   * Converts a TableViewConfig to a format that can be stored in the database
   * @param config - In-memory TableViewConfig used by TanStack Table
   * @returns SerializedTableViewConfig ready for database storage
   */
  toStorage: (config: TableViewConfig): SerializedTableViewConfig => {
    // Normalize column filters to ensure only simple data is stored
    const normalizedColumnFilters = config.columnFilters?.map((filter) => {
      // Extract only the essential properties and normalize column IDs
      // This prevents complex objects like functions or module references from being serialized
      let columnId =
        typeof filter.id === "string" ? filter.id : String(filter.id);

      // Clean up Turbopack references if present
      if (columnId.includes("__TURBOPACK_")) {
        // Try to extract a simpler ID from the path
        const simplifiedId = columnId.split("/").pop()?.split("$").pop();
        if (simplifiedId) {
          columnId = simplifiedId;
        }
      }

      return {
        id: columnId,
        value: filter.value,
      };
    });

    const normalizedConfig = normalizeTableViewConfig({
      ...config,
      columnFilters: normalizedColumnFilters,
    });

    // Convert each property to a JSON string for storage
    return {
      advancedFilters: normalizedConfig.advancedFilters
        ? JSON.stringify(normalizedConfig.advancedFilters)
        : undefined,
      columnFilters: normalizedConfig.columnFilters
        ? JSON.stringify(normalizedConfig.columnFilters)
        : undefined,
      columnOrder: normalizedConfig.columnOrder
        ? JSON.stringify(normalizedConfig.columnOrder)
        : undefined,
      columnPinning: normalizedConfig.columnPinning
        ? JSON.stringify(normalizedConfig.columnPinning)
        : undefined,
      columnSizing: normalizedConfig.columnSizing
        ? JSON.stringify(normalizedConfig.columnSizing)
        : undefined,
      columnVisibility: normalizedConfig.columnVisibility
        ? JSON.stringify(normalizedConfig.columnVisibility)
        : undefined,
      displayMode: normalizedConfig.displayMode,
      gallery: normalizedConfig.gallery
        ? JSON.stringify(normalizedConfig.gallery)
        : undefined,
      globalSearch: normalizedConfig.globalSearch,
      grouping: normalizedConfig.grouping
        ? JSON.stringify(normalizedConfig.grouping)
        : undefined,
      kanban: normalizedConfig.kanban
        ? JSON.stringify(normalizedConfig.kanban)
        : undefined,
      pageSize: normalizedConfig.pageSize,
      sorting: normalizedConfig.sorting
        ? JSON.stringify(normalizedConfig.sorting)
        : undefined,
    };
  },
};
