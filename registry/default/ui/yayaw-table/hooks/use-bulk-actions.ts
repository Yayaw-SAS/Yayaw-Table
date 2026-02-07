/**
 * Hook for managing bulk actions on selected table rows
 */
"use client";

import type { Row, Table } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { useTableActions } from "./use-table-actions";

/**
 * Configuration for bulk actions
 */
interface BulkActionsConfig<TData> {
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
   * Minimum number of selected rows to show bulk actions menu
   */
  minimumSelection?: number;

  /**
   * Optional table type to auto-wire provider actions when callbacks are not provided
   */
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
  table,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  minimumSelection = 1,
  tableType,
}: BulkActionsConfig<TData>): BulkActionsReturn<TData> {
  // Call hook unconditionally to satisfy Rules of Hooks; use result only when tableType is set
  const providerResult = useTableActions<{ id: string }>({
    tableType: tableType ?? "",
    enableLogging: false,
  });
  const provider = tableType ? providerResult : undefined;
  const [selectedRows, setSelectedRows] = useState<Row<TData>[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Update selected rows based on table state
  const updateSelection = useCallback(() => {
    if (!table) {
      setSelectedRows([]);
      setShowBulkActions(false);
      return;
    }

    const rowSelection = table.getState().rowSelection;
    const allRows = table.getRowModel().rows;
    const selected = allRows.filter((row) => rowSelection[row.id]);

    setSelectedRows(selected);
    setShowBulkActions(selected.length >= minimumSelection);

    // Debug logs
  }, [table, minimumSelection]);

  // React to selection changes: re-run when table or updateSelection changes
  useEffect(() => {
    if (!table) {
      return;
    }
    updateSelection();
  }, [table, updateSelection]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    if (!table) {
      return;
    }

    table.setRowSelection({});
    updateSelection(); // Force update after clearing selection
  }, [table, updateSelection]);

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
};
