/**
 * Hook for managing bulk actions on selected table rows
 */
"use client";

import { useSetAtom } from "jotai";
import { tableDataMenuOpenToViewAtom } from "../atoms/table-atoms";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  Row,
  RowSelectionState,
  Table,
} from "@/components/ui/yayaw-table/tanstack";
import type { BulkEditTarget } from "../components/forms/catalogue-bulk-editor";
import { cloneFormValue } from "../components/forms/form-runtime";
import { type CsvExportColumn, exportRowsAsCsv } from "../utils/csv-export";
import type { CsvSeparator } from "../utils/export-model";
import {
  fetchAllFilteredRows,
  type TableListAction,
  toAdvancedFiltersParam,
  toFiltersParam,
  toOrderByParam,
  toPageSize,
} from "../utils/filtered-rows";
import {
  type BulkFeedbackMessages,
  bulkFeedbackMessages,
  countedBulkFeedback,
  formatBulkFeedback,
  resolveBulkFeedbackMessages,
} from "../utils/bulk-feedback";
import { recordValue } from "../utils/table-contracts";
import { useTranslations } from "../providers/table-provider";
import { invalidateTableDataQuery } from "./query-cache-utils";
import { useTableActions } from "./use-table-actions";
import { useTableUrlState } from "./use-table-url-state";

function canStartSelectAll<TData>(
  table: Table<TData> | undefined,
  busy: boolean
): table is Table<TData> {
  return Boolean(
    table &&
      !busy &&
      table.options.enableRowSelection !== false &&
      table.options.enableMultiRowSelection !== false
  );
}

interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

type BulkDeleteAction = (ids: string[]) => Promise<ActionResult>;
type BulkCopyAction = (ids: string[]) => Promise<ActionResult>;
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

  /** `table.exportCsvSeparator` of the CSV file, "," by default. */
  csvSeparator?: CsvSeparator;

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
   * Open the Export screen with the selection instead of a direct CSV file.
   */
  exportScreenEnabled?: boolean;
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

  /** Keep selected rows when search, filters, sorting, or grouping changes. */
  preserveSelectionOnQuery?: boolean;
}

/**
 * Return type for the bulk actions hook
 */
interface BulkActionsReturn<TData> {
  selectOriginalRows: (rows: TData[]) => void;
  bulkEditTargets: BulkEditTarget[] | null;
  closeBulkEdit: () => void;
  /** Deselects the saved rows (of `targets`, default the bulk editor's) and reloads. */
  completeBulkEdit: (ids: string[], targets?: BulkEditTarget[]) => Promise<void>;
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

/** English copy, used when a helper is called without the table's messages. */
const DEFAULT_BULK_FEEDBACK = bulkFeedbackMessages();

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
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

export function buildRowSelectionState(rowIds: string[]): RowSelectionState {
  const selection: RowSelectionState = {};

  for (const rowId of rowIds) {
    if (rowId.trim().length === 0) {
      continue;
    }

    selection[rowId] = true;
  }

  return selection;
}

export function createSyntheticSelectedRows<TData>(
  records: Record<string, unknown>[],
  getRowId?: (record: TData, index: number) => string
): Row<TData>[] {
  const rows: Row<TData>[] = [];
  const seenIds = new Set<string>();

  for (const [index, record] of records.entries()) {
    const rowId =
      getRowId?.(record as TData, index) ?? getRecordEntityId(record);
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

/** Entity IDs go to persistence; table IDs are retained only to clear completed selections. */
export function buildBulkEditTargets<TData>(
  rows: Pick<Row<TData>, "id" | "original">[]
): BulkEditTarget[] {
  return rows.flatMap((row) => {
    const id = getSelectedRowId(row);
    return id
      ? [
          {
            id,
            selectionId: row.id,
            row: cloneFormValue(recordValue(row.original)),
          },
        ]
      : [];
  });
}

export function completedBulkSelectionIds(
  targets: BulkEditTarget[],
  ids: string[]
): Set<string> {
  const completed = new Set(ids);
  return new Set(
    targets
      .filter((target) => completed.has(target.id))
      .map((target) => target.selectionId ?? target.id)
  );
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
  getRowId,
  canSelectRow,
}: {
  advancedFiltersParam: unknown;
  filtersParam: unknown;
  globalSearchParam: string;
  listAction: TableListAction;
  pageSizeParam: string;
  sortParam: unknown;
  getRowId?: (row: TData, index: number) => string;
  canSelectRow?: (row: Row<TData>) => boolean;
}): Promise<CrossPageSelectionResult<TData>> {
  const rows = await fetchAllFilteredRows({
    listAction,
    advancedFilters: toAdvancedFiltersParam(advancedFiltersParam),
    filters: toFiltersParam(filtersParam),
    orderBy: toOrderByParam(sortParam),
    pageSize: toPageSize(pageSizeParam),
    search: globalSearchParam.trim(),
  });

  const selectedRows = createSyntheticSelectedRows<TData>(
    rows,
    getRowId
  ).filter((row) => canSelectRow?.(row) !== false);

  return {
    rowIds: selectedRows.map((row) => row.id),
    rows: selectedRows,
  };
}

/**
 * Copy the selected records through the host's `actions.bulkCopy(ids)`, as
 * Vue does. The caller refreshes the table after a success.
 */
export async function executeBulkCopyAction({
  bulkCopy,
  ids,
  messages = DEFAULT_BULK_FEEDBACK,
}: {
  bulkCopy: BulkCopyAction;
  ids: string[];
  messages?: BulkFeedbackMessages;
}): Promise<BulkActionResult> {
  if (ids.length === 0) {
    return {
      ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
      message: messages.noValidIds,
    };
  }

  try {
    const result = await bulkCopy(ids);
    if (result.success) {
      return {
        clearSelection: false,
        closeMenu: true,
        message: countedBulkFeedback(
          messages.copiedOne,
          messages.copiedMany,
          ids.length
        ),
        success: true,
      };
    }

    return {
      ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
      message: result.error?.trim() || messages.copyError,
    };
  } catch (error) {
    return {
      ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
      message: toErrorMessage(error, messages.copyError),
    };
  }
}

export async function executeBulkDeleteOperation({
  bulkDelete,
  deleteOne,
  ids,
  messages = DEFAULT_BULK_FEEDBACK,
}: {
  bulkDelete?: BulkDeleteAction;
  deleteOne?: DeleteAction;
  ids: string[];
  messages?: BulkFeedbackMessages;
}): Promise<BulkDeleteExecutionOutcome> {
  const totalCount = ids.length;

  if (totalCount === 0) {
    return {
      errorMessages: [messages.noValidIds],
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
        result.success ? "" : messages.deleteError,
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
        errorMessages: [toErrorMessage(error, messages.deleteError)],
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
            result.error ||
              formatBulkFeedback(messages.deleteRowError, { id })
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
        toErrorMessage(result.reason, messages.deleteError)
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
  outcome: BulkDeleteExecutionOutcome,
  messages: BulkFeedbackMessages = DEFAULT_BULK_FEEDBACK
): BulkDeleteFeedback {
  const { errorMessages, failureCount, successCount, totalCount } = outcome;

  if (successCount === totalCount && totalCount > 0) {
    return {
      message: countedBulkFeedback(
        messages.deletedOne,
        messages.deletedMany,
        successCount
      ),
      tone: "success",
    };
  }

  const firstError = errorMessages[0];

  if (successCount > 0) {
    const partialMessage = formatBulkFeedback(messages.deletedPartial, {
      count: successCount,
      failed: failureCount,
      total: totalCount,
    });
    return {
      message: firstError ? `${partialMessage} ${firstError}` : partialMessage,
      tone: "error",
    };
  }

  const baseError =
    firstError ||
    countedBulkFeedback(
      messages.deleteFailedOne,
      messages.deleteFailedMany,
      totalCount
    );

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
  messages: BulkFeedbackMessages;
  outcome: BulkDeleteExecutionOutcome;
}): CustomBulkDeleteResultResolution {
  const feedback = buildBulkDeleteFeedback(options.outcome, options.messages);
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
  messages: BulkFeedbackMessages;
  selectedCount: number;
}): CustomBulkDeleteResultResolution {
  return {
    closeMenu: options.explicitCloseMenu ?? true,
    feedback: {
      message: countedBulkFeedback(
        options.messages.deletedOne,
        options.messages.deletedMany,
        options.selectedCount
      ),
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
  messages = DEFAULT_BULK_FEEDBACK,
  result,
  selectedCount,
  showDefaultToastsForCustomHandlers,
}: {
  closeOnError: boolean;
  messages?: BulkFeedbackMessages;
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
      messages,
      outcome: structuredOutcome,
    });
  }

  if (showDefaultToastsForCustomHandlers) {
    return resolveBulkDeleteLegacyDefaultResult({
      explicitClearSelection: overrides.explicitClearSelection,
      explicitCloseMenu: overrides.explicitCloseMenu,
      messages,
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
  messages = DEFAULT_BULK_FEEDBACK,
  notify,
  onBulkDelete,
  selectedRows,
  showDefaultToastsForCustomHandlers,
}: {
  clearSelection: () => void;
  closeOnError: boolean;
  messages?: BulkFeedbackMessages;
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
      messages,
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
    const errorMessage = toErrorMessage(error, messages.deleteError);
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
  exportScreenEnabled = false,
  closeOnError = false,
  csvExportColumns,
  csvSeparator,
  rowCount,
  table,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  minimumSelection = 1,
  showDefaultToastsForCustomHandlers = false,
  preserveSelectionOnQuery = false,
  tableId,
  tableType,
}: BulkActionsConfig<TData>): BulkActionsReturn<TData> {
  // Call hook unconditionally to satisfy Rules of Hooks; use result only when tableType is set
  const queryClient = useQueryClient();
  const { locale, translations } = useTranslations();
  const feedbackOverrides = translations.bulk?.feedback;
  const messages = useMemo(
    () => resolveBulkFeedbackMessages(locale, feedbackOverrides),
    [locale, feedbackOverrides]
  );
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
    groupingParam,
    pageSizeParam,
    sortParam,
  } = useTableUrlState({
    tableId: resolvedTableId,
  });
  const setMenuOpenToView = useSetAtom(
    tableDataMenuOpenToViewAtom(resolvedTableId)
  );
  const [crossPageSelection, setCrossPageSelection] =
    useState<CrossPageSelectionState<TData> | null>(null);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [bulkEditTargets, setBulkEditTargets] = useState<
    BulkEditTarget[] | null
  >(null);
  const currentRowSelection = table.store.state.rowSelection;
  const currentPageRows = table.getCoreRowModel().rows;
  const currentPageSelectedRows = useMemo(() => {
    return currentPageRows.filter((row) => currentRowSelection[row.id]);
  }, [currentRowSelection, currentPageRows]);
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
        groupingParam,
        sortParam,
      }),
    [
      advancedFiltersParam,
      filtersParam,
      globalSearchParam,
      resolvedTableId,
      groupingParam,
      sortParam,
    ]
  );
  const selectionPersistenceKey = preserveSelectionOnQuery
    ? resolvedTableId
    : selectionContextKey;

  const latestSelection = useRef({
    contextKey: selectionContextKey,
    idsKey: currentSelectionIdsKey,
  });
  const selectionRequest = useRef(0);
  useEffect(() => {
    selectionRequest.current += 1;
    latestSelection.current = {
      contextKey: selectionContextKey,
      idsKey: currentSelectionIdsKey,
    };
  }, [selectionContextKey, currentSelectionIdsKey]);
  useEffect(
    () => () => {
      selectionRequest.current += 1;
    },
    []
  );

  // Keep selected records from visited pages, and replace them when fresh rows arrive.
  const selectedRows = useMemo(() => {
    if (
      crossPageSelection &&
      crossPageSelection.contextKey !== selectionPersistenceKey
    ) {
      return [];
    }
    return mergeSelectedRows({
      crossPageRows:
        crossPageSelection?.rows.filter((row) => currentRowSelection[row.id]) ??
        [],
      currentPageRows: currentPageSelectedRows,
    });
  }, [
    crossPageSelection,
    selectionPersistenceKey,
    currentRowSelection,
    currentPageSelectedRows,
  ]);
  const showBulkActions = selectedRows.length >= minimumSelection;

  useEffect(() => {
    if (
      crossPageSelection &&
      crossPageSelection.contextKey !== selectionPersistenceKey
    ) {
      setCrossPageSelection(null);
      table?.setRowSelection({});
      return;
    }
    if (selectedRows.length === 0 && !crossPageSelection) {
      return;
    }
    if (
      crossPageSelection?.rowIdsKey === currentSelectionIdsKey &&
      crossPageSelection.rows.length === selectedRows.length &&
      crossPageSelection.rows.every((row, index) => {
        const selectedRow = selectedRows[index];
        return (
          row.id === selectedRow?.id && row.original === selectedRow.original
        );
      })
    ) {
      return;
    }
    setCrossPageSelection({
      contextKey: selectionPersistenceKey,
      rowIdsKey: currentSelectionIdsKey,
      rows: selectedRows,
    });
  }, [
    crossPageSelection,
    selectedRows,
    currentSelectionIdsKey,
    selectionPersistenceKey,
    table,
  ]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    selectionRequest.current += 1;
    setCrossPageSelection(null);
    if (!table) {
      return;
    }
    table.setRowSelection({});
  }, [table]);

  const canSelectAll = canSelectAllRows({
    hasListAction: typeof provider?.actions.list === "function",
    isSelectingAll:
      isSelectingAll ||
      table?.options.enableRowSelection === false ||
      table?.options.enableMultiRowSelection === false,
    rowCount,
    selectedCount: selectedRows.length,
  });

  const handleSelectAll = useCallback(async (): Promise<void> => {
    const listAction = provider?.actions.list as TableListAction | undefined;

    if (!canStartSelectAll(table, isSelectingAll)) {
      return;
    }

    if (!listAction) {
      table.toggleAllPageRowsSelected(true);
      return;
    }

    if (selectedRows.length >= (rowCount ?? Number.POSITIVE_INFINITY)) {
      return;
    }

    const request = ++selectionRequest.current;
    const initialIdsKey = currentSelectionIdsKey;
    setIsSelectingAll(true);
    try {
      const nextSelection = await loadAllMatchingRowsForSelection<TData>({
        advancedFiltersParam,
        filtersParam,
        globalSearchParam,
        listAction,
        pageSizeParam,
        sortParam,
        getRowId: selectionRowId(table),
        canSelectRow: selectionRowPermission(table),
      });

      if (
        request !== selectionRequest.current ||
        latestSelection.current.contextKey !== selectionContextKey ||
        latestSelection.current.idsKey !== initialIdsKey
      ) {
        return;
      }
      if (nextSelection.rowIds.length === 0) {
        toast.error(messages.noValidIds);
        return;
      }

      table.setRowSelection(buildRowSelectionState(nextSelection.rowIds));
      setCrossPageSelection({
        contextKey: selectionContextKey,
        rowIdsKey: nextSelection.rowIds.slice().sort().join("|"),
        rows: nextSelection.rows,
      });
    } catch (error) {
      if (
        request === selectionRequest.current &&
        latestSelection.current.contextKey === selectionContextKey
      ) {
        toast.error(toErrorMessage(error, messages.selectAllError));
      }
    } finally {
      setIsSelectingAll(false);
    }
  }, [
    advancedFiltersParam,
    isSelectingAll,
    messages,
    rowCount,
    selectedRows.length,
    currentSelectionIdsKey,
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
      return buildBlockedBulkActionResult(messages.editDisabled);
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
        const errorMessage = toErrorMessage(error, messages.editError);
        toast.error(errorMessage);
        return {
          ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
          message: errorMessage,
        };
      }
    }

    if (provider?.actions.bulkUpdate) {
      setBulkEditTargets(buildBulkEditTargets(selectedRows));
      return successResult;
    }

    const resolution = resolveBulkEditWithoutCustom({
      hasBulkUpdateAction: Boolean(provider?.actions.bulkUpdate),
    });

    toast.info(resolution.message);
    return {
      ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
      message: resolution.message,
    };
  }, [
    bulkEditEnabled,
    messages,
    selectedRows,
    onBulkEdit,
    provider?.actions.bulkUpdate,
  ]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async (): Promise<BulkActionResult> => {
    if (!bulkDeleteEnabled) {
      return buildBlockedBulkActionResult(messages.deleteDisabled);
    }

    if (selectedRows.length === 0) {
      return DEFAULT_BULK_ACTION_FAILURE_RESULT;
    }

    if (onBulkDelete) {
      const result = await executeCustomBulkDeleteHandler({
        clearSelection,
        closeOnError,
        messages,
        onBulkDelete,
        selectedRows,
        showDefaultToastsForCustomHandlers,
      });
      await invalidateTableData();
      return result;
    }

    const ids = extractSelectedRowIds(selectedRows);
    if (ids.length === 0) {
      toast.error(messages.noValidIds);
      if (closeOnError) {
        clearSelection();
      }
      return {
        clearSelection: closeOnError,
        closeMenu: closeOnError,
        message: messages.noValidIds,
        success: false,
      };
    }

    const deleteAction = provider?.actions.delete;
    const outcome = await executeBulkDeleteOperation({
      bulkDelete: provider?.actions.bulkDelete as BulkDeleteAction | undefined,
      deleteOne: deleteAction
        ? (id) => {
            const selected = selectedRows.find(
              (row) => String(row.original.id ?? row.id) === id
            );
            return deleteAction(id, { row: { ...selected?.original } });
          }
        : undefined,
      ids,
      messages,
    });

    if (outcome.successCount > 0) {
      await invalidateTableData();
    }

    const feedback = buildBulkDeleteFeedback(outcome, messages);
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
    messages,
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
        const errorMessage = toErrorMessage(error, messages.copyError);
        toast.error(errorMessage);
        return {
          ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
          message: errorMessage,
        };
      }
    }

    const bulkCopyAction = provider?.actions.bulkCopy;
    if (bulkCopyAction) {
      const result = await executeBulkCopyAction({
        bulkCopy: bulkCopyAction,
        ids: extractSelectedRowIds(selectedRows),
        messages,
      });
      if (result.success) {
        await invalidateTableData();
      }
      showBulkActionMessage(result);
      return result;
    }

    // Default copy to clipboard
    try {
      const data = selectedRows.map((row) => row.original as unknown);
      const jsonString = JSON.stringify(data, null, 2);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString);
        const copiedMessage = countedBulkFeedback(
          messages.copiedToClipboardOne,
          messages.copiedToClipboardMany,
          selectedRows.length
        );
        toast.success(copiedMessage);
        return {
          ...successResult,
          message: copiedMessage,
        };
      }

      throw new Error(messages.clipboardUnavailable);
    } catch (error) {
      const errorMessage = toErrorMessage(error, messages.copyError);
      toast.error(errorMessage);
      return {
        ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
        message: errorMessage,
      };
    }
  }, [
    selectedRows,
    messages,
    onBulkCopy,
    provider?.actions.bulkCopy,
    invalidateTableData,
  ]);

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
        const errorMessage = toErrorMessage(error, messages.exportError);
        toast.error(errorMessage);
        return {
          ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
          message: errorMessage,
        };
      }
    }

    // The Export screen offers format, columns and values for the selection.
    if (exportScreenEnabled) {
      setMenuOpenToView("export");
      // Keep the selection: it is what the screen exports.
      return { ...successResult, closeMenu: false };
    }

    try {
      const rowsToExport = selectedRows.map(
        (row) => row.original as Record<string, unknown>
      );

      // Without columns from the table, every field of the first row;
      // an empty list means no column may be exported.
      const fallbackColumns =
        rowsToExport.length > 0
          ? Object.keys(rowsToExport[0]).map((id) => ({ id, label: id }))
          : [];

      exportRowsAsCsv({
        columns: csvExportColumns ?? fallbackColumns,
        rows: rowsToExport,
        separator: csvSeparator,
        tableId: tableId ?? tableType ?? "table",
      });
      return successResult;
    } catch (error) {
      const errorMessage = toErrorMessage(error, messages.exportError);
      toast.error(errorMessage);
      return {
        ...DEFAULT_BULK_ACTION_FAILURE_RESULT,
        message: errorMessage,
      };
    }
  }, [
    bulkExportEnabled,
    messages,
    selectedRows,
    onBulkExport,
    csvExportColumns,
    csvSeparator,
    tableId,
    tableType,
      exportScreenEnabled,
    setMenuOpenToView,
  ]);

  // Close bulk actions (alias for clearSelection)
  const closeBulkActions = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  return {
    bulkEditTargets,
    closeBulkEdit: () => setBulkEditTargets(null),
    completeBulkEdit: async (ids, targets) => {
      const completed = completedBulkSelectionIds(
        targets ?? bulkEditTargets ?? [],
        ids
      );
      table.setRowSelection((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([id]) => !completed.has(id))
        )
      );
      setCrossPageSelection((previous) =>
        previous
          ? {
              ...previous,
              rows: previous.rows.filter((row) => !completed.has(row.id)),
              rowIdsKey: previous.rows
                .filter((row) => !completed.has(row.id))
                .map((row) => row.id)
                .sort()
                .join("|"),
            }
          : null
      );
      await invalidateTableData();
    },
    selectOriginalRows: (originals: TData[]) => {
      const rows = createSyntheticSelectedRows<TData>(
        originals as Record<string, unknown>[],
        selectionRowId(table)
      );
      table.setRowSelection(buildRowSelectionState(rows.map((row) => row.id)));
      setCrossPageSelection({
        contextKey: selectionContextKey,
        rowIdsKey: rows
          .map((row) => row.id)
          .sort()
          .join("|"),
        rows,
      });
    },
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

function selectionRowId<TData>(table: Table<TData>) {
  const getRowId = table.options.getRowId;
  return getRowId
    ? (row: TData, index: number) =>
        getRowId(row as TData & Record<string, unknown>, index)
    : undefined;
}

function selectionRowPermission<TData>(table: Table<TData>) {
  return typeof table.options.enableRowSelection === "function"
    ? table.options.enableRowSelection
    : undefined;
}
