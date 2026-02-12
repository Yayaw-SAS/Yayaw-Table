/**
 * Hook for managing bulk actions on selected table rows
 */
"use client";

import type { Row, Table } from "@tanstack/react-table";
import { useCallback } from "react";
import { toast } from "sonner";
import { type CsvExportColumn, exportRowsAsCsv } from "../utils/csv-export";
import { useTableActions } from "./use-table-actions";

interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

type BulkDeleteAction = (ids: string[]) => Promise<ActionResult>;
type DeleteAction = (id: string) => Promise<ActionResult>;

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
  onBulkEdit?: (rows: Row<TData>[]) => Promise<void> | void;

  /**
   * Callback when bulk delete is triggered
   */
  onBulkDelete?: (rows: Row<TData>[]) => Promise<void> | void;

  /**
   * Callback when bulk copy is triggered
   */
  onBulkCopy?: (rows: Row<TData>[]) => Promise<void> | void;

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
  handleBulkEdit: () => Promise<void>;

  /**
   * Handle bulk delete action
   */
  handleBulkDelete: () => Promise<void>;

  /**
   * Handle bulk copy action
   */
  handleBulkCopy: () => Promise<void>;

  /**
   * Handle bulk export action
   */
  handleBulkExport: () => Promise<void>;

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

export interface BulkDeleteExecutionOutcome {
  errorMessages: string[];
  failureCount: number;
  mode: "bulkDelete" | "deleteFallback" | "notConfigured";
  successCount: number;
  totalCount: number;
}

export interface BulkDeleteFeedback {
  message: string;
  tone: "error" | "success";
}

export interface BulkEditResolution {
  message: string;
  status: "missingPayload" | "notConfigured";
}

const DEFAULT_BULK_DELETE_ERROR =
  "Failed to delete selected rows. Please try again.";
const DEFAULT_NO_VALID_IDS_ERROR =
  "No valid row IDs were found in the selected rows.";

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

function pluralizeRows(count: number): string {
  return count === 1 ? "row" : "rows";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeUniqueMessages(messages: string[]): string[] {
  const filtered = messages
    .map((message) => message.trim())
    .filter((message) => message.length > 0);

  return [...new Set(filtered)];
}

function readNumberField(
  data: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return;
}

function readArrayLengthField(
  data: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return;
}

function inferBulkDeleteCounts(
  result: ActionResult,
  totalCount: number
): { failureCount: number; successCount: number } {
  if (totalCount === 0) {
    return { failureCount: 0, successCount: 0 };
  }

  if (!result.success) {
    return { failureCount: totalCount, successCount: 0 };
  }

  let successCount = totalCount;

  if (Array.isArray(result.data)) {
    successCount = Math.min(totalCount, result.data.length);
  } else if (isRecord(result.data)) {
    const explicitSuccess = readNumberField(result.data, [
      "successCount",
      "deletedCount",
    ]);
    const explicitFailure = readNumberField(result.data, [
      "failureCount",
      "failedCount",
    ]);
    const succeededIdsLength = readArrayLengthField(result.data, [
      "successIds",
      "succeededIds",
      "deletedIds",
    ]);
    const failedIdsLength = readArrayLengthField(result.data, [
      "failedIds",
      "errorIds",
    ]);

    if (typeof explicitSuccess === "number") {
      successCount = Math.max(0, Math.min(totalCount, explicitSuccess));
    } else if (typeof succeededIdsLength === "number") {
      successCount = Math.max(0, Math.min(totalCount, succeededIdsLength));
    } else if (typeof explicitFailure === "number") {
      successCount = Math.max(
        0,
        totalCount - Math.max(0, Math.min(totalCount, explicitFailure))
      );
    } else if (typeof failedIdsLength === "number") {
      successCount = Math.max(
        0,
        totalCount - Math.max(0, Math.min(totalCount, failedIdsLength))
      );
    }
  }

  const failureCount = Math.max(0, totalCount - successCount);
  return { failureCount, successCount };
}

export function extractSelectedRowIds<TData>(selectedRows: Row<TData>[]): string[] {
  const ids = new Set<string>();

  for (const row of selectedRows) {
    const original = row.original as unknown;

    if (isRecord(original) && "id" in original) {
      const rowId = original.id;
      if (typeof rowId === "string" && rowId.trim().length > 0) {
        ids.add(rowId);
        continue;
      }

      if (typeof rowId === "number" || typeof rowId === "bigint") {
        ids.add(String(rowId));
        continue;
      }
    }

    if (typeof row.id === "string" && row.id.trim().length > 0) {
      ids.add(row.id);
    }
  }

  return [...ids];
}

export async function executeBulkDeleteOperation({
  bulkDelete,
  deleteOne,
  ids,
}: {
  bulkDelete?: BulkDeleteAction;
  deleteOne?: DeleteAction;
  ids: string[];
}): Promise<BulkDeleteExecutionOutcome> {
  const totalCount = ids.length;

  if (totalCount === 0) {
    return {
      errorMessages: [DEFAULT_NO_VALID_IDS_ERROR],
      failureCount: 0,
      mode: "notConfigured",
      successCount: 0,
      totalCount,
    };
  }

  if (bulkDelete) {
    try {
      const result = await bulkDelete(ids);
      const { failureCount, successCount } = inferBulkDeleteCounts(
        result,
        totalCount
      );

      const errorMessages = normalizeUniqueMessages([
        result.error ?? "",
        !result.success ? DEFAULT_BULK_DELETE_ERROR : "",
      ]);

      return {
        errorMessages,
        failureCount,
        mode: "bulkDelete",
        successCount,
        totalCount,
      };
    } catch (error) {
      return {
        errorMessages: [
          toErrorMessage(error, DEFAULT_BULK_DELETE_ERROR),
        ],
        failureCount: totalCount,
        mode: "bulkDelete",
        successCount: 0,
        totalCount,
      };
    }
  }

  if (deleteOne) {
    const settledResults = await Promise.allSettled(
      ids.map(async (id) => {
        const result = await deleteOne(id);
        if (!result.success) {
          throw new Error(
            result.error || `Could not delete row with id "${id}".`
          );
        }
      })
    );

    let successCount = 0;
    const errorMessages: string[] = [];

    for (const result of settledResults) {
      if (result.status === "fulfilled") {
        successCount += 1;
        continue;
      }

      errorMessages.push(toErrorMessage(result.reason, DEFAULT_BULK_DELETE_ERROR));
    }

    return {
      errorMessages: normalizeUniqueMessages(errorMessages),
      failureCount: totalCount - successCount,
      mode: "deleteFallback",
      successCount,
      totalCount,
    };
  }

  return {
    errorMessages: [
      "Bulk delete is not configured. Provide actions.bulkDelete(ids) or actions.delete(id).",
    ],
    failureCount: totalCount,
    mode: "notConfigured",
    successCount: 0,
    totalCount,
  };
}

export function buildBulkDeleteFeedback(
  outcome: BulkDeleteExecutionOutcome
): BulkDeleteFeedback {
  const { errorMessages, failureCount, successCount, totalCount } = outcome;

  if (successCount === totalCount && totalCount > 0) {
    return {
      message: `Deleted ${successCount} ${pluralizeRows(successCount)} successfully.`,
      tone: "success",
    };
  }

  const firstError = errorMessages[0];

  if (successCount > 0) {
    const partialMessage = `Deleted ${successCount} of ${totalCount} rows. ${failureCount} failed.`;
    return {
      message: firstError ? `${partialMessage} ${firstError}` : partialMessage,
      tone: "error",
    };
  }

  const baseError =
    firstError ||
    `Failed to delete ${totalCount} ${pluralizeRows(totalCount)}.`;

  return {
    message: baseError,
    tone: "error",
  };
}

export function resolveBulkEditWithoutCustom(options: {
  hasBulkUpdateAction: boolean;
}): BulkEditResolution {
  if (options.hasBulkUpdateAction) {
    return {
      message:
        "Bulk edit needs update values before calling actions.bulkUpdate(ids, data). Provide onBulkEdit to open a bulk form and collect a payload.",
      status: "missingPayload",
    };
  }

  return {
    message:
      "Bulk edit is not configured. Provide onBulkEdit or actions.bulkUpdate(ids, data).",
    status: "notConfigured",
  };
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
  const handleBulkEdit = useCallback(async () => {
    if (selectedRows.length === 0) {
      return;
    }
    if (onBulkEdit) {
      try {
        await Promise.resolve(onBulkEdit(selectedRows));
      } catch (error) {
        toast.error(toErrorMessage(error, "Bulk edit failed."));
      }
      return;
    }

    const resolution = resolveBulkEditWithoutCustom({
      hasBulkUpdateAction: Boolean(provider?.actions.bulkUpdate),
    });

    toast.info(resolution.message);
  }, [selectedRows, onBulkEdit, provider?.actions.bulkUpdate]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      return;
    }

    if (onBulkDelete) {
      try {
        await Promise.resolve(onBulkDelete(selectedRows));
        toast.success(
          `Deleted ${selectedRows.length} ${pluralizeRows(selectedRows.length)} successfully.`
        );
        clearSelection();
      } catch (error) {
        toast.error(toErrorMessage(error, DEFAULT_BULK_DELETE_ERROR));
      }
      return;
    }

    const ids = extractSelectedRowIds(selectedRows);
    if (ids.length === 0) {
      toast.error(DEFAULT_NO_VALID_IDS_ERROR);
      return;
    }

    const outcome = await executeBulkDeleteOperation({
      bulkDelete: provider?.actions.bulkDelete as BulkDeleteAction | undefined,
      deleteOne: provider?.actions.delete as DeleteAction | undefined,
      ids,
    });

    const feedback = buildBulkDeleteFeedback(outcome);
    if (feedback.tone === "success") {
      toast.success(feedback.message);
      clearSelection();
      return;
    }

    toast.error(feedback.message);
  }, [selectedRows, onBulkDelete, clearSelection, provider?.actions]);

  // Handle bulk copy
  const handleBulkCopy = useCallback(async () => {
    if (selectedRows.length === 0) {
      return;
    }

    if (onBulkCopy) {
      try {
        await Promise.resolve(onBulkCopy(selectedRows));
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to copy selected rows."));
      }
      return;
    }

    // Default copy to clipboard
    try {
      const data = selectedRows.map((row) => row.original as unknown);
      const jsonString = JSON.stringify(data, null, 2);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString);
        toast.success(
          `Copied ${selectedRows.length} ${pluralizeRows(selectedRows.length)} to clipboard.`
        );
        return;
      }

      throw new Error("Clipboard API is not available in this environment.");
    } catch (error) {
      toast.error(toErrorMessage(error, "Failed to copy selected rows."));
    }
  }, [selectedRows, onBulkCopy]);

  // Handle bulk CSV export
  const handleBulkExport = useCallback(async () => {
    if (!bulkExportEnabled || selectedRows.length === 0) {
      return;
    }

    if (onBulkExport) {
      try {
        await Promise.resolve(onBulkExport(selectedRows));
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to export selected rows."));
      }
      return;
    }

    try {
      const rowsToExport = selectedRows.map(
        (row) => row.original as Record<string, unknown>
      );

      const fallbackColumns =
        rowsToExport.length > 0
          ? Object.keys(rowsToExport[0]).map((id) => ({ id, label: id }))
          : [];

      exportRowsAsCsv({
        columns:
          csvExportColumns.length > 0 ? csvExportColumns : fallbackColumns,
        rows: rowsToExport,
        tableId: tableId ?? tableType ?? "table",
      });
    } catch (error) {
      toast.error(toErrorMessage(error, "Failed to export selected rows."));
    }
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
 * Default bulk action handlers.
 */
export const defaultBulkActions = {
  onBulkEdit: <TData>(_rows: Row<TData>[]) => {
    toast.info(
      "Bulk edit requires configuration. Provide onBulkEdit or actions.bulkUpdate(ids, data)."
    );
  },

  onBulkDelete: <TData>(rows: Row<TData>[]) => {
    if (rows.length > 0) {
      toast.info(
        "Bulk delete requires configuration. Provide actions.bulkDelete(ids) or actions.delete(id)."
      );
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
    toast.info("Bulk export requires configuration.");
  },
};
