/**
 * Hook for managing bulk actions on selected table rows
 */
"use client";

import type { Row, Table } from "@tanstack/react-table";
import { useCallback } from "react";
import { type CsvExportColumn, exportRowsAsCsv } from "../utils/csv-export";
import { useTableActions } from "./use-table-actions";

/**
 * Configuration for bulk actions
 */
interface BulkActionsConfig<TData> {
  /**
   * Whether bulk export action is enabled
   */
  bulkExportEnabled?: boolean;

  /**
   * CSV columns for export
   */
  csvExportColumns?: CsvExportColumn[];

  /**
   * Table instance from TanStack Table
   */
  table: Table<TData>;

  /**
   * Callback when bulk edit is triggered
   */
  onBulkEdit?: (rows: Row<TData>[]) => void;

  /**
   * Callback when bulk delete is triggered
   */
  onBulkDelete?: (rows: Row<TData>[]) => void;

  /**
   * Callback when bulk copy is triggered
   */
  onBulkCopy?: (rows: Row<TData>[]) => void;

  /**
   * Callback when bulk export is triggered
   */
  onBulkExport?: (rows: Row<TData>[]) => void | Promise<void>;

  /**
   * Minimum number of selected rows to show bulk actions menu
   */
  minimumSelection?: number;

  /**
   * Optional table type to auto-wire provider actions when callbacks are not provided
   */
  tableId?: string;
  tableType?: string;
}

/**
 * Return type for the bulk actions hook
 */
interface BulkActionsReturn<TData> {
  /**
   * Currently selected rows
   */
  selectedRows: Row<TData>[];

  /**
   * Number of selected rows
   */
  selectedCount: number;

  /**
   * Whether the bulk actions menu should be visible
   */
  showBulkActions: boolean;

  /**
   * Handle bulk edit action
   */
  handleBulkEdit: () => void;

  /**
   * Handle bulk delete action
   */
  handleBulkDelete: () => void;

  /**
   * Handle bulk copy action
   */
  handleBulkCopy: () => void;

  /**
   * Handle bulk export action
   */
  handleBulkExport: () => void;

  /**
   * Whether bulk export action is enabled
   */
  isBulkExportEnabled: boolean;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Close bulk actions menu (clears selection)
   */
  closeBulkActions: () => void;
}

const _DEBUG = false;
/**
 * Hook to manage bulk actions for data table
 *
 * Provides state management and handlers for bulk operations
 * on selected table rows
 */
export function useBulkActions<TData>({
  bulkExportEnabled = true,
  csvExportColumns = [],
  table,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  minimumSelection = 1,
  tableId,
  tableType,
}: BulkActionsConfig<TData>): BulkActionsReturn<TData> {
  // Call hook unconditionally to satisfy Rules of Hooks; use result only when tableType is set
  const providerResult = useTableActions<{ id: string }>({
    tableType: tableType ?? "",
    enableLogging: false,
  });
  const provider = tableType ? providerResult : undefined;

  // Use core row model so selected rows are correct even when grouping is active (collapsed = getRowModel() has no leaves)
  const selectedRows =
    table && typeof table.getState === "function"
      ? (() => {
          const rowSelection = table.getState().rowSelection || {};
          const rows = table.getCoreRowModel().rows;
          return rows.filter((row) => rowSelection[row.id]) as Row<TData>[];
        })()
      : [];
  const showBulkActions = selectedRows.length >= minimumSelection;

  // Clear all selections
  const clearSelection = useCallback(() => {
    if (!table) {
      return;
    }
    table.setRowSelection({});
  }, [table]);

  // Handle bulk edit
  const handleBulkEdit = useCallback(() => {
    if (selectedRows.length === 0) {
      return;
    }
    if (onBulkEdit) {
      onBulkEdit(selectedRows);
      return;
    }
    // If provider available, delegate to update for each selected row (no-op without data)
    if (provider?.actions.update) {
      for (const row of selectedRows) {
        const original = row.original as unknown;
        if (original && typeof original === "object" && "id" in original) {
          const idValue = (original as { id: unknown }).id;
          if (typeof idValue === "string") {
            provider.actions
              .update(idValue, original as Record<string, unknown>)
              .catch(() => {
                /* ignore update errors */
              });
          }
        }
      }
    }
  }, [selectedRows, onBulkEdit, provider?.actions?.update]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedRows.length === 0) {
      return;
    }
    if (onBulkDelete) {
      onBulkDelete(selectedRows);
      clearSelection();
      return;
    }
    if (provider?.actions.delete) {
      for (const row of selectedRows) {
        const original = row.original as unknown;
        if (original && typeof original === "object" && "id" in original) {
          const idValue = (original as { id: unknown }).id;
          if (typeof idValue === "string") {
            provider.actions.delete(idValue).catch(() => {
              /* ignore delete errors */
            });
          }
        }
      }
      clearSelection();
    }
  }, [selectedRows, onBulkDelete, clearSelection, provider?.actions]);

  // Handle bulk copy
  const handleBulkCopy = useCallback(() => {
    if (selectedRows.length === 0) {
      return;
    }
    if (onBulkCopy) {
      onBulkCopy(selectedRows);
      return;
    }
    // Default copy to clipboard
    try {
      const data = selectedRows.map((row) => row.original as unknown);
      const jsonString = JSON.stringify(data, null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(jsonString).catch(() => {
          /* ignore clipboard errors */
        });
      }
    } catch {
      /* ignore clipboard errors */
    }
  }, [selectedRows, onBulkCopy]);

  // Handle bulk CSV export
  const handleBulkExport = useCallback(() => {
    if (!bulkExportEnabled || selectedRows.length === 0) {
      return;
    }

    if (onBulkExport) {
      Promise.resolve(onBulkExport(selectedRows)).catch(() => {
        /* ignore export errors */
      });
      return;
    }

    const rowsToExport = selectedRows.map(
      (row) => row.original as Record<string, unknown>
    );

    const fallbackColumns =
      rowsToExport.length > 0
        ? Object.keys(rowsToExport[0]).map((id) => ({ id, label: id }))
        : [];

    exportRowsAsCsv({
      columns: csvExportColumns.length > 0 ? csvExportColumns : fallbackColumns,
      rows: rowsToExport,
      tableId: tableId ?? tableType ?? "table",
    });
  }, [
    bulkExportEnabled,
    selectedRows,
    onBulkExport,
    csvExportColumns,
    tableId,
    tableType,
  ]);

  // Close bulk actions (alias for clearSelection)
  const closeBulkActions = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return {
    selectedRows,
    selectedCount: selectedRows.length,
    showBulkActions,
    handleBulkEdit,
    handleBulkDelete,
    handleBulkCopy,
    handleBulkExport,
    isBulkExportEnabled: bulkExportEnabled,
    clearSelection,
    closeBulkActions,
  };
}

/**
 * Default bulk action handlers
 *
 * Provides basic implementations for common bulk actions
 */
/**
 * Default bulk action handlers (no-op / silent).
 * Apps should provide their own handlers for user feedback (toast, modal, etc.).
 */
export const defaultBulkActions = {
  onBulkEdit: <TData>(_rows: Row<TData>[]) => {
    /* Provide onBulkEdit in table config for custom behavior */
  },

  onBulkDelete: <TData>(rows: Row<TData>[]) => {
    /* Provide onBulkDelete in table config; consider confirmation UI in app */
    if (rows.length > 0) {
      /* no-op unless app provides handler */
    }
  },

  onBulkCopy: <TData>(rows: Row<TData>[]) => {
    try {
      const data = rows.map((row) => row.original);
      const jsonString = JSON.stringify(data, null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(jsonString).catch(() => {
          /* ignore clipboard errors */
        });
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = jsonString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch {
      /* ignore clipboard errors */
    }
  },

  onBulkExport: <TData>(_rows: Row<TData>[]) => {
    /* Provide onBulkExport in table config for custom behavior */
  },
};
