/**
 * Hook for managing bulk actions on selected table rows
 */
'use client';

import type { Row, Table } from '@tanstack/react-table';
import { useTableActions } from './use-table-actions';
import { useCallback, useEffect, useState } from 'react';

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

const DEBUG = false;
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
  // Auto-wire provider actions when tableType is provided
  const provider = tableType
    ? useTableActions<{ id: string }>({ tableType, enableLogging: false })
    : undefined;
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
    if (DEBUG) {
      console.log('🔍 useBulkActions updateSelection:', {
        selectedCount: selected.length,
        showBulkActions: selected.length >= minimumSelection,
        rowSelection,
        minimumSelection,
      });
    }
  }, [table, minimumSelection]);

  // React to selection changes by tracking a stable key derived from rowSelection
  const selectionKey = JSON.stringify(table?.getState().rowSelection || {});

  useEffect(() => {
    if (!table) {
      return;
    }
    updateSelection();
  }, [table, selectionKey, updateSelection]);

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
        if (original && typeof original === 'object' && 'id' in original) {
          const idValue = (original as { id: unknown }).id;
          if (typeof idValue === 'string') {
            void provider.actions.update(idValue, original as Record<string, unknown>);
          }
        }
      }
    }
  }, [selectedRows, onBulkEdit]);

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
        if (original && typeof original === 'object' && 'id' in original) {
          const idValue = (original as { id: unknown }).id;
          if (typeof idValue === 'string') {
            void provider.actions.delete(idValue);
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
        void navigator.clipboard.writeText(jsonString);
      }
    } catch (_err) {}
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
export const defaultBulkActions = {
  /**
   * Default bulk edit handler - opens edit dialog/modal
   */
  onBulkEdit: <TData>(rows: Row<TData>[]) => {
    console.log('Bulk edit:', rows.length, 'items');
    // TODO: Implement bulk edit logic
    alert(`Edit ${rows.length} items`);
  },

  /**
   * Default bulk delete handler - shows confirmation dialog
   */
  onBulkDelete: <TData>(rows: Row<TData>[]) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${rows.length} item${rows.length > 1 ? 's' : ''}?`
    );

    if (confirmed) {
      console.log('Bulk delete:', rows.length, 'items');
      // TODO: Implement bulk delete logic
      alert(`Deleted ${rows.length} items`);
    }
  },

  /**
   * Default bulk copy handler - copies data to clipboard
   */
  onBulkCopy: <TData>(rows: Row<TData>[]) => {
    try {
      const data = rows.map((row) => row.original);
      const jsonString = JSON.stringify(data, null, 2);

      // Try to copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(jsonString);
        alert(`Copied ${rows.length} items to clipboard`);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = jsonString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`Copied ${rows.length} items to clipboard`);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy items to clipboard');
    }
  },
};
