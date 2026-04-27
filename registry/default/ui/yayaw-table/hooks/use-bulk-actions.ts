/**
 * Hook for managing bulk actions on selected table rows
 */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Row, Table } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type CsvExportColumn, exportRowsAsCsv } from "../utils/csv-export";
import {
  fetchAllFilteredRows,
  type TableListAction,
  toAdvancedFiltersParam,
  toFiltersParam,
  toOrderByParam,
  toPageSize,
} from "../utils/filtered-rows";
import { invalidateTableDataQuery } from "./query-cache-utils";
import { useTableActions } from "./use-table-actions";
import { useTableUrlState } from "./use-table-url-state";

interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

type BulkDeleteAction = (ids: string[]) => Promise<ActionResult>;
type DeleteAction = (id: string) => Promise<ActionResult>;

export interface BulkActionResult {
  clearSelection: boolean;
  closeMenu: boolean;
  message?: string;
  success: boolean;
}

// biome-ignore lint/suspicious/noConfusingVoidType: Keep void for backward compatibility with existing handlers returning Promise<void>.
export type BulkActionCustomHandlerResult = BulkActionResult | void;
export type BulkDeleteActionExecutionResult = BulkActionResult;

const DEFAULT_BULK_ACTION_FAILURE_RESULT: BulkActionResult = {
  clearSelection: false,
  closeMenu: false,
  success: false,
};

function buildBlockedBulkActionResult(message: string): BulkActionResult {
  return {
    clearSelection: false,
    closeMenu: false,
    message,
    success: false,
  };
}

/**
 * Custom delete callbacks can:
 * - return `void` to fully own user feedback,
 * - return `BulkDeleteExecutionOutcome` for library-managed feedback,
 * - return `{ outcome, clearSelection }` to override clear/close behavior explicitly.
 */
export type BulkDeleteCustomHandlerResult =
  | BulkActionResult
  | BulkDeleteExecutionOutcome
  | {
      clearSelection?: boolean;
      closeMenu?: boolean;
      message?: string;
      success?: boolean;
      outcome?: BulkDeleteExecutionOutcome;
    }
  // biome-ignore lint/suspicious/noConfusingVoidType: Keep `void` for backward compatibility with existing async handlers returning Promise<void>.
  | void;

/**
 * Configuration for bulk actions
 */
interface BulkActionsConfig<TData> {
  /**
   * Whether bulk edit action is enabled
   */
  bulkEditEnabled?: boolean;

  /**
   * Whether bulk delete action is enabled
   */
  bulkDeleteEnabled?: boolean;

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
  onBulkEdit?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;

  /**
   * Callback when bulk delete is triggered
   */
  onBulkDelete?: (
    rows: Row<TData>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;

  /**
   * Callback when bulk copy is triggered
   */
  onBulkCopy?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;

  /**
   * Callback when bulk export is triggered
   */
  onBulkExport?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;

  /**
   * Minimum number of selected rows to show bulk actions menu
   */
  minimumSelection?: number;

  /**
   * Total number of rows matching the current dataset context.
   */
  rowCount?: number;

  /**
   * Optional table type to auto-wire provider actions when callbacks are not provided
   */
  tableId?: string;
  tableType?: string;

  /**
   * Whether the selection should be cleared when a delete operation fails
   */
  closeOnError?: boolean;

  /**
   * Whether to keep the previous default success toast behavior for custom delete handlers
   */
  showDefaultToastsForCustomHandlers?: boolean;
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
  handleBulkEdit: () => Promise<BulkActionResult>;

  /**
   * Handle bulk delete action
   */
  handleBulkDelete: () => Promise<BulkDeleteActionExecutionResult>;

  /**
   * Handle bulk copy action
   */
  handleBulkCopy: () => Promise<BulkActionResult>;

  /**
   * Handle bulk export action
   */
  handleBulkExport: () => Promise<BulkActionResult>;

  /**
   * Whether bulk export action is enabled
   */
  isBulkExportEnabled: boolean;

  /**
   * Whether bulk edit action is enabled
   */
  isBulkEditEnabled: boolean;

  /**
   * Whether bulk delete action is enabled
   */
  isBulkDeleteEnabled: boolean;

  /**
   * Clear all selections
   */
  clearSelection: () => void;

  /**
   * Close bulk actions menu (clears selection)
   */
  closeBulkActions: () => void;

  /**
   * Whether the user can extend the selection to all matching rows.
   */
  canSelectAll: boolean;

  /**
   * Select all matching rows across pages.
   */
  handleSelectAll: () => Promise<void>;

  /**
   * Whether the cross-page selection is currently being loaded.
   */
  isSelectingAll: boolean;
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

interface BulkDeleteNotificationAdapter {
  error: (message: string) => void;
  success: (message: string) => void;
}

interface CustomBulkDeleteResultResolution {
  feedback?: BulkDeleteFeedback;
  closeMenu: boolean;
  shouldClearSelection: boolean;
  success: boolean;
}

interface CrossPageSelectionState<TData> {
  contextKey: string;
  rowIdsKey: string;
  rows: Row<TData>[];
}

interface CrossPageSelectionResult<TData> {
  rowIds: string[];
  rows: Row<TData>[];
}

const DEFAULT_BULK_DELETE_ERROR =
  "Failed to delete selected rows. Please try again.";
const DEFAULT_NO_VALID_IDS_ERROR =
  "No valid row IDs were found in the selected rows.";
const DEFAULT_SELECT_ALL_ERROR = "Failed to select all matching rows.";

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

export function isBulkActionResult(value: unknown): value is BulkActionResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.success === "boolean" &&
    typeof value.closeMenu === "boolean" &&
    typeof value.clearSelection === "boolean"
  );
}

export function normalizeBulkActionResult(
  result: unknown,
  fallbackResult: BulkActionResult
): BulkActionResult {
  if (typeof result === "boolean") {
    return {
      clearSelection: result,
      closeMenu: result,
      success: result,
    };
  }

  if (!isRecord(result)) {
    return fallbackResult;
  }

  const success =
    typeof result.success === "boolean"
      ? result.success
      : fallbackResult.success;
  const closeMenu =
    typeof result.closeMenu === "boolean"
      ? result.closeMenu
      : fallbackResult.closeMenu;
  let clearSelection = fallbackResult.clearSelection;
  if (typeof result.clearSelection === "boolean") {
    clearSelection = result.clearSelection;
  } else if (typeof result.closeMenu === "boolean") {
    clearSelection = result.closeMenu;
  }
  const message =
    typeof result.message === "string" && result.message.trim().length > 0
      ? result.message
      : fallbackResult.message;

  return {
    clearSelection,
    closeMenu,
    message,
    success,
  };
}

export function isBulkDeleteExecutionOutcome(
  value: unknown
): value is BulkDeleteExecutionOutcome {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.errorMessages) &&
    typeof value.failureCount === "number" &&
    typeof value.successCount === "number" &&
    typeof value.totalCount === "number" &&
    (value.mode === "bulkDelete" ||
      value.mode === "deleteFallback" ||
      value.mode === "notConfigured")
  );
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

function getRecordEntityId(
  record: Record<string, unknown>
): string | undefined {
  const candidateId = record.id ?? record._id;

  if (typeof candidateId === "string" && candidateId.trim().length > 0) {
    return candidateId;
  }

  if (typeof candidateId === "number" || typeof candidateId === "bigint") {
    return String(candidateId);
  }

  return;
}

function getSelectedRowId<TData>(
  row: Pick<Row<TData>, "id" | "original">
): string | undefined {
  const original = row.original as unknown;
  if (isRecord(original)) {
    const originalId = getRecordEntityId(original);
    if (originalId) {
      return originalId;
    }
  }

  if (typeof row.id === "string" && row.id.trim().length > 0) {
    return row.id;
  }

  return;
}

function getSortedSelectedIds(rowSelection: Record<string, boolean>): string[] {
  return Object.entries(rowSelection)
    .filter(([, isSelected]) => isSelected)
    .map(([rowId]) => rowId)
    .sort();
}

export function buildRowSelectionState(
  rowIds: string[]
): Record<string, boolean> {
  const selection: Record<string, boolean> = {};

  for (const rowId of rowIds) {
    if (rowId.trim().length === 0) {
      continue;
    }

    selection[rowId] = true;
  }

  return selection;
}

export function createSyntheticSelectedRows<TData>(
  records: Record<string, unknown>[]
): Row<TData>[] {
  const rows: Row<TData>[] = [];
  const seenIds = new Set<string>();

  for (const record of records) {
    const rowId = getRecordEntityId(record);
    if (!rowId || seenIds.has(rowId)) {
      continue;
    }

    seenIds.add(rowId);
    rows.push({
      id: rowId,
      original: record as TData,
    } as Row<TData>);
  }

  return rows;
}

export function mergeSelectedRows<TData>({
  crossPageRows,
  currentPageRows,
}: {
  crossPageRows: Row<TData>[];
  currentPageRows: Row<TData>[];
}): Row<TData>[] {
  const rowsById = new Map<string, Row<TData>>();

  for (const row of crossPageRows) {
    const rowId = getSelectedRowId(row);
    if (!rowId) {
      continue;
    }

    rowsById.set(rowId, row);
  }

  for (const row of currentPageRows) {
    const rowId = getSelectedRowId(row);
    if (!rowId) {
      continue;
    }

    rowsById.set(rowId, row);
  }

  return [...rowsById.values()];
}

export function canSelectAllRows({
  hasListAction,
  isSelectingAll,
  rowCount,
  selectedCount,
}: {
  hasListAction: boolean;
  isSelectingAll: boolean;
  rowCount?: number;
  selectedCount: number;
}): boolean {
  return (
    hasListAction &&
    !isSelectingAll &&
    typeof rowCount === "number" &&
    rowCount > 0 &&
    selectedCount > 0 &&
    rowCount > selectedCount
  );
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

export function extractSelectedRowIds<TData>(
  selectedRows: Row<TData>[]
): string[] {
  const ids = new Set<string>();

  for (const row of selectedRows) {
    const rowId = getSelectedRowId(row);
    if (rowId) {
      ids.add(rowId);
    }
  }

  return [...ids];
}

export async function loadAllMatchingRowsForSelection<TData>({
  advancedFiltersParam,
  filtersParam,
  globalSearchParam,
  listAction,
  pageSizeParam,
  sortParam,
}: {
  advancedFiltersParam: unknown;
  filtersParam: unknown;
  globalSearchParam: string;
  listAction: TableListAction;
  pageSizeParam: string;
  sortParam: unknown;
}): Promise<CrossPageSelectionResult<TData>> {
  const rows = await fetchAllFilteredRows({
    listAction,
    advancedFilters: toAdvancedFiltersParam(advancedFiltersParam),
    filters: toFiltersParam(filtersParam),
    orderBy: toOrderByParam(sortParam),
    pageSize: toPageSize(pageSizeParam),
    search: globalSearchParam.trim(),
  });

  const selectedRows = createSyntheticSelectedRows<TData>(rows);

  return {
    rowIds: extractSelectedRowIds(selectedRows),
    rows: selectedRows,
  };
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
        result.success ? "" : DEFAULT_BULK_DELETE_ERROR,
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
        errorMessages: [toErrorMessage(error, DEFAULT_BULK_DELETE_ERROR)],
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

      errorMessages.push(
        toErrorMessage(result.reason, DEFAULT_BULK_DELETE_ERROR)
      );
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

interface BulkDeleteResultOverrides {
  explicitClearSelection?: boolean;
  explicitCloseMenu?: boolean;
  explicitMessage?: string;
  explicitSuccess?: boolean;
  recordResult?: Record<string, unknown>;
}

function readBulkDeleteResultOverrides(
  result: BulkDeleteCustomHandlerResult
): BulkDeleteResultOverrides {
  const recordResult = isRecord(result) ? result : undefined;

  return {
    explicitClearSelection:
      recordResult && typeof recordResult.clearSelection === "boolean"
        ? recordResult.clearSelection
        : undefined,
    explicitCloseMenu:
      recordResult && typeof recordResult.closeMenu === "boolean"
        ? recordResult.closeMenu
        : undefined,
    explicitMessage:
      recordResult && typeof recordResult.message === "string"
        ? recordResult.message
        : undefined,
    explicitSuccess:
      recordResult && typeof recordResult.success === "boolean"
        ? recordResult.success
        : undefined,
    recordResult,
  };
}

function resolveStructuredBulkDeleteOutcome(
  result: BulkDeleteCustomHandlerResult,
  recordResult?: Record<string, unknown>
): BulkDeleteExecutionOutcome | undefined {
  if (isBulkDeleteExecutionOutcome(result)) {
    return result;
  }

  if (isBulkDeleteExecutionOutcome(recordResult?.outcome)) {
    return recordResult.outcome;
  }

  return;
}

function resolveBulkDeleteStructuredResult(options: {
  closeOnError: boolean;
  explicitClearSelection?: boolean;
  explicitCloseMenu?: boolean;
  outcome: BulkDeleteExecutionOutcome;
}): CustomBulkDeleteResultResolution {
  const feedback = buildBulkDeleteFeedback(options.outcome);
  const isSuccess = feedback.tone === "success";

  return {
    closeMenu:
      options.explicitCloseMenu ?? (isSuccess ? true : options.closeOnError),
    feedback,
    shouldClearSelection:
      options.explicitClearSelection ??
      (isSuccess ? true : options.closeOnError),
    success: isSuccess,
  };
}

function resolveBulkDeleteLegacyDefaultResult(options: {
  explicitClearSelection?: boolean;
  explicitCloseMenu?: boolean;
  selectedCount: number;
}): CustomBulkDeleteResultResolution {
  return {
    closeMenu: options.explicitCloseMenu ?? true,
    feedback: {
      message: `Deleted ${options.selectedCount} ${pluralizeRows(options.selectedCount)} successfully.`,
      tone: "success",
    },
    shouldClearSelection: options.explicitClearSelection ?? true,
    success: true,
  };
}

function resolveBulkDeleteExplicitSuccessResult(options: {
  closeOnError: boolean;
  explicitClearSelection?: boolean;
  explicitCloseMenu?: boolean;
  explicitMessage?: string;
  explicitSuccess?: boolean;
}): CustomBulkDeleteResultResolution | undefined {
  if (typeof options.explicitSuccess !== "boolean") {
    return;
  }

  const shouldClearSelection =
    options.explicitClearSelection ??
    (options.explicitSuccess ? true : options.closeOnError);
  const feedbackMessage =
    typeof options.explicitMessage === "string"
      ? options.explicitMessage.trim()
      : "";

  return {
    closeMenu: options.explicitCloseMenu ?? shouldClearSelection,
    feedback:
      feedbackMessage.length > 0
        ? {
            message: feedbackMessage,
            tone: options.explicitSuccess ? "success" : "error",
          }
        : undefined,
    shouldClearSelection,
    success: options.explicitSuccess,
  };
}

function resolveBulkDeleteMessageOnlyResult(options: {
  explicitClearSelection?: boolean;
  explicitCloseMenu?: boolean;
  explicitMessage?: string;
}): CustomBulkDeleteResultResolution | undefined {
  const feedbackMessage =
    typeof options.explicitMessage === "string"
      ? options.explicitMessage.trim()
      : "";

  if (feedbackMessage.length === 0) {
    return;
  }

  return {
    closeMenu: options.explicitCloseMenu ?? false,
    feedback: {
      message: feedbackMessage,
      tone: "error",
    },
    shouldClearSelection: options.explicitClearSelection ?? false,
    success: false,
  };
}

export function resolveCustomBulkDeleteHandlerResult({
  closeOnError,
  result,
  selectedCount,
  showDefaultToastsForCustomHandlers,
}: {
  closeOnError: boolean;
  result: BulkDeleteCustomHandlerResult;
  selectedCount: number;
  showDefaultToastsForCustomHandlers: boolean;
}): CustomBulkDeleteResultResolution {
  const overrides = readBulkDeleteResultOverrides(result);

  if (isBulkActionResult(result)) {
    return {
      closeMenu: result.closeMenu,
      feedback: result.message
        ? {
            message: result.message,
            tone: result.success ? "success" : "error",
          }
        : undefined,
      shouldClearSelection: result.clearSelection,
      success: result.success,
    };
  }

  const structuredOutcome = resolveStructuredBulkDeleteOutcome(
    result,
    overrides.recordResult
  );
  if (structuredOutcome) {
    return resolveBulkDeleteStructuredResult({
      closeOnError,
      explicitClearSelection: overrides.explicitClearSelection,
      explicitCloseMenu: overrides.explicitCloseMenu,
      outcome: structuredOutcome,
    });
  }

  if (showDefaultToastsForCustomHandlers) {
    return resolveBulkDeleteLegacyDefaultResult({
      explicitClearSelection: overrides.explicitClearSelection,
      explicitCloseMenu: overrides.explicitCloseMenu,
      selectedCount,
    });
  }

  const explicitSuccessResolution = resolveBulkDeleteExplicitSuccessResult({
    closeOnError,
    explicitClearSelection: overrides.explicitClearSelection,
    explicitCloseMenu: overrides.explicitCloseMenu,
    explicitMessage: overrides.explicitMessage,
    explicitSuccess: overrides.explicitSuccess,
  });
  if (explicitSuccessResolution) {
    return explicitSuccessResolution;
  }

  const explicitMessageResolution = resolveBulkDeleteMessageOnlyResult({
    explicitClearSelection: overrides.explicitClearSelection,
    explicitCloseMenu: overrides.explicitCloseMenu,
    explicitMessage: overrides.explicitMessage,
  });
  if (explicitMessageResolution) {
    return explicitMessageResolution;
  }

  return {
    closeMenu: overrides.explicitCloseMenu ?? false,
    shouldClearSelection: overrides.explicitClearSelection ?? false,
    success: overrides.explicitClearSelection === true,
  };
}

export async function executeCustomBulkDeleteHandler<TData>({
  clearSelection,
  closeOnError,
  notify,
  onBulkDelete,
  selectedRows,
  showDefaultToastsForCustomHandlers,
}: {
  clearSelection: () => void;
  closeOnError: boolean;
  notify?: BulkDeleteNotificationAdapter;
  onBulkDelete: (
    rows: Row<TData>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;
  selectedRows: Row<TData>[];
  showDefaultToastsForCustomHandlers: boolean;
}): Promise<BulkDeleteActionExecutionResult> {
  const notifier = notify ?? toast;

  try {
    const rawResult = await Promise.resolve(onBulkDelete(selectedRows));
    const resolution = resolveCustomBulkDeleteHandlerResult({
      closeOnError,
      result: rawResult,
      selectedCount: selectedRows.length,
      showDefaultToastsForCustomHandlers,
    });

    if (resolution.feedback) {
      if (resolution.feedback.tone === "success") {
        notifier.success(resolution.feedback.message);
      } else {
        notifier.error(resolution.feedback.message);
      }
    }

    if (resolution.shouldClearSelection) {
      clearSelection();
    }

    return {
      clearSelection: resolution.shouldClearSelection,
      closeMenu: resolution.closeMenu,
      message: resolution.feedback?.message,
      success: resolution.success,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error, DEFAULT_BULK_DELETE_ERROR);
    notifier.error(errorMessage);
    if (closeOnError) {
      clearSelection();
    }

    return {
      clearSelection: closeOnError,
      closeMenu: closeOnError,
      message: errorMessage,
      success: false,
    };
  }
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

function showBulkActionMessage(result: BulkActionResult): void {
  if (!result.message || result.message.trim().length === 0) {
    return;
  }

  if (result.success) {
    toast.success(result.message);
    return;
  }

  toast.error(result.message);
}

const _DEBUG = false;
/**
 * Hook to manage bulk actions for data table
 *
 * Provides state management and handlers for bulk operations
 * on selected table rows
 */
export function useBulkActions<TData>({
  bulkEditEnabled = true,
  bulkDeleteEnabled = true,
  bulkExportEnabled = true,
  closeOnError = false,
  csvExportColumns = [],
  rowCount,
  table,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  minimumSelection = 1,
  showDefaultToastsForCustomHandlers = false,
  tableId,
  tableType,
}: BulkActionsConfig<TData>): BulkActionsReturn<TData> {
  // Call hook unconditionally to satisfy Rules of Hooks; use result only when tableType is set
  const queryClient = useQueryClient();
  const providerResult = useTableActions<{ id: string }>({
    tableType: tableType ?? "",
    enableLogging: false,
  });
  const provider = tableType ? providerResult : undefined;
  const resolvedTableId = tableId ?? tableType ?? "";
  const queryTableId = resolvedTableId || undefined;
  const {
    advancedFiltersParam,
    filtersParam,
    globalSearchParam,
    pageSizeParam,
    sortParam,
  } = useTableUrlState({
    tableId: resolvedTableId,
  });
  const [crossPageSelection, setCrossPageSelection] =
    useState<CrossPageSelectionState<TData> | null>(null);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const currentRowSelection =
    table && typeof table.getState === "function"
      ? table.getState().rowSelection || {}
      : {};
  const currentPageSelectedRows = useMemo(() => {
    if (!table || typeof table.getState !== "function") {
      return [] as Row<TData>[];
    }

    const rows = table.getCoreRowModel().rows;
    return rows.filter((row) => currentRowSelection[row.id]) as Row<TData>[];
  }, [currentRowSelection, table]);
  const currentSelectionIds = useMemo(
    () => getSortedSelectedIds(currentRowSelection),
    [currentRowSelection]
  );
  const currentSelectionIdsKey = useMemo(
    () => currentSelectionIds.join("|"),
    [currentSelectionIds]
  );
  const selectionContextKey = useMemo(
    () =>
      JSON.stringify({
        advancedFiltersParam,
        filtersParam,
        globalSearchParam,
        resolvedTableId,
        sortParam,
      }),
    [
      advancedFiltersParam,
      filtersParam,
      globalSearchParam,
      resolvedTableId,
      sortParam,
    ]
  );

  // Use core row model so selected rows are correct even when grouping is active (collapsed = getRowModel() has no leaves)
  const selectedRows = useMemo(() => {
    if (!crossPageSelection) {
      return currentPageSelectedRows;
    }

    return mergeSelectedRows({
      crossPageRows: crossPageSelection.rows,
      currentPageRows: currentPageSelectedRows,
    });
  }, [crossPageSelection, currentPageSelectedRows]);
  const showBulkActions = selectedRows.length >= minimumSelection;

  useEffect(() => {
    if (!crossPageSelection) {
      return;
    }

    if (crossPageSelection.contextKey !== selectionContextKey) {
      setCrossPageSelection(null);
      table?.setRowSelection({});
      return;
    }

    if (crossPageSelection.rowIdsKey !== currentSelectionIdsKey) {
      setCrossPageSelection(null);
    }
  }, [crossPageSelection, currentSelectionIdsKey, selectionContextKey, table]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setCrossPageSelection(null);
    if (!table) {
      return;
    }
    table.setRowSelection({});
  }, [table]);

  const canSelectAll = canSelectAllRows({
    hasListAction: typeof provider?.actions.list === "function",
    isSelectingAll,
    rowCount,
    selectedCount: selectedRows.length,
  });

  const handleSelectAll = useCallback(async (): Promise<void> => {
    const listAction = provider?.actions.list as TableListAction | undefined;

    if (!(table && listAction && canSelectAll)) {
      return;
    }

    setIsSelectingAll(true);
    try {
      const nextSelection = await loadAllMatchingRowsForSelection<TData>({
        advancedFiltersParam,
        filtersParam,
        globalSearchParam,
        listAction,
        pageSizeParam,
        sortParam,
      });

      if (nextSelection.rowIds.length === 0) {
        toast.error(DEFAULT_NO_VALID_IDS_ERROR);
        return;
      }

      table.setRowSelection(buildRowSelectionState(nextSelection.rowIds));
      setCrossPageSelection({
        contextKey: selectionContextKey,
        rowIdsKey: nextSelection.rowIds.slice().sort().join("|"),
        rows: nextSelection.rows,
      });
    } catch (error) {
      toast.error(toErrorMessage(error, DEFAULT_SELECT_ALL_ERROR));
    } finally {
      setIsSelectingAll(false);
    }
  }, [
    advancedFiltersParam,
    canSelectAll,
    filtersParam,
    globalSearchParam,
    pageSizeParam,
    provider?.actions.list,
    selectionContextKey,
    sortParam,
    table,
  ]);

  const invalidateTableData = useCallback(async (): Promise<void> => {
    if (!queryTableId) {
      return;
    }

    await invalidateTableDataQuery({
      queryClient,
      tableId: queryTableId,
    });
  }, [queryClient, queryTableId]);

  // Handle bulk edit
  const handleBulkEdit = useCallback(async (): Promise<BulkActionResult> => {
    const successResult: BulkActionResult = {
      clearSelection: false,
      closeMenu: true,
      success: true,
    };

    if (!bulkEditEnabled) {
      return buildBlockedBulkActionResult(
        "Bulk edit is disabled by table configuration."
      );
    }

    if (selectedRows.length === 0) {
      return DEFAULT_BULK_ACTION_FAILURE_RESULT;
    }

    if (onBulkEdit) {
      try {
        const rawResult = await Promise.resolve(onBulkEdit(selectedRows));
        const result = normalizeBulkActionResult(rawResult, successResult);
        showBulkActionMessage(result);
        return result;
      } catch (error) {
        const errorMessage = toErrorMessage(error, "Bulk edit failed.");
        toast.error(errorMessage);
        return {
          ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
          message: errorMessage,
        };
      }
    }

    const resolution = resolveBulkEditWithoutCustom({
      hasBulkUpdateAction: Boolean(provider?.actions.bulkUpdate),
    });

    toast.info(resolution.message);
    return {
      ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
      message: resolution.message,
    };
  }, [bulkEditEnabled, selectedRows, onBulkEdit, provider?.actions.bulkUpdate]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async (): Promise<BulkActionResult> => {
    if (!bulkDeleteEnabled) {
      return buildBlockedBulkActionResult(
        "Bulk delete is disabled by table configuration."
      );
    }

    if (selectedRows.length === 0) {
      return DEFAULT_BULK_ACTION_FAILURE_RESULT;
    }

    if (onBulkDelete) {
      const result = await executeCustomBulkDeleteHandler({
        clearSelection,
        closeOnError,
        onBulkDelete,
        selectedRows,
        showDefaultToastsForCustomHandlers,
      });
      await invalidateTableData();
      return result;
    }

    const ids = extractSelectedRowIds(selectedRows);
    if (ids.length === 0) {
      toast.error(DEFAULT_NO_VALID_IDS_ERROR);
      if (closeOnError) {
        clearSelection();
      }
      return {
        clearSelection: closeOnError,
        closeMenu: closeOnError,
        message: DEFAULT_NO_VALID_IDS_ERROR,
        success: false,
      };
    }

    const outcome = await executeBulkDeleteOperation({
      bulkDelete: provider?.actions.bulkDelete as BulkDeleteAction | undefined,
      deleteOne: provider?.actions.delete as DeleteAction | undefined,
      ids,
    });

    if (outcome.successCount > 0) {
      await invalidateTableData();
    }

    const feedback = buildBulkDeleteFeedback(outcome);
    if (feedback.tone === "success") {
      toast.success(feedback.message);
      clearSelection();
      return {
        clearSelection: true,
        closeMenu: true,
        message: feedback.message,
        success: true,
      };
    }

    toast.error(feedback.message);
    if (closeOnError) {
      clearSelection();
    }
    return {
      clearSelection: closeOnError,
      closeMenu: closeOnError,
      message: feedback.message,
      success: false,
    };
  }, [
    selectedRows,
    onBulkDelete,
    clearSelection,
    provider?.actions,
    bulkDeleteEnabled,
    closeOnError,
    invalidateTableData,
    showDefaultToastsForCustomHandlers,
  ]);

  // Handle bulk copy
  const handleBulkCopy = useCallback(async (): Promise<BulkActionResult> => {
    const successResult: BulkActionResult = {
      clearSelection: false,
      closeMenu: true,
      success: true,
    };

    if (selectedRows.length === 0) {
      return DEFAULT_BULK_ACTION_FAILURE_RESULT;
    }

    if (onBulkCopy) {
      try {
        const rawResult = await Promise.resolve(onBulkCopy(selectedRows));
        const result = normalizeBulkActionResult(rawResult, successResult);
        showBulkActionMessage(result);
        return result;
      } catch (error) {
        const errorMessage = toErrorMessage(
          error,
          "Failed to copy selected rows."
        );
        toast.error(errorMessage);
        return {
          ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
          message: errorMessage,
        };
      }
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
        return {
          ...successResult,
          message: `Copied ${selectedRows.length} ${pluralizeRows(selectedRows.length)} to clipboard.`,
        };
      }

      throw new Error("Clipboard API is not available in this environment.");
    } catch (error) {
      const errorMessage = toErrorMessage(
        error,
        "Failed to copy selected rows."
      );
      toast.error(errorMessage);
      return {
        ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
        message: errorMessage,
      };
    }
  }, [selectedRows, onBulkCopy]);

  // Handle bulk CSV export
  const handleBulkExport = useCallback(async (): Promise<BulkActionResult> => {
    const successResult: BulkActionResult = {
      clearSelection: false,
      closeMenu: true,
      success: true,
    };

    if (!bulkExportEnabled || selectedRows.length === 0) {
      return DEFAULT_BULK_ACTION_FAILURE_RESULT;
    }

    if (onBulkExport) {
      try {
        const rawResult = await Promise.resolve(onBulkExport(selectedRows));
        const result = normalizeBulkActionResult(rawResult, successResult);
        showBulkActionMessage(result);
        return result;
      } catch (error) {
        const errorMessage = toErrorMessage(
          error,
          "Failed to export selected rows."
        );
        toast.error(errorMessage);
        return {
          ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
          message: errorMessage,
        };
      }
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
      return successResult;
    } catch (error) {
      const errorMessage = toErrorMessage(
        error,
        "Failed to export selected rows."
      );
      toast.error(errorMessage);
      return {
        ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
        message: errorMessage,
      };
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
    isBulkDeleteEnabled: bulkDeleteEnabled,
    isBulkEditEnabled: bulkEditEnabled,
    isBulkExportEnabled: bulkExportEnabled,
    clearSelection,
    closeBulkActions,
    canSelectAll,
    handleSelectAll,
    isSelectingAll,
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
