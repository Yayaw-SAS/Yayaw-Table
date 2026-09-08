"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnyFieldDefinition } from "../components/forms/types";
import type {
  InlineEditColumnConfig,
  InlineEditEditor,
  InlineEditOption,
  TableInlineEditConfig,
} from "../config/helpers";
import { toValidDate } from "../utils/date-display";
import {
  resolveDataType,
  resolveDataTypeEditor,
  TABLE_DATA_TYPES,
} from "../utils/table-contracts";

const DEFAULT_INLINE_EDIT_DEBOUNCE_MS = 700;
const INLINE_DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type FormFieldType = AnyFieldDefinition["type"];

interface InlineEditIssue {
  message?: string;
  path?: PropertyKey[];
}

interface InlineEditSafeParseResult {
  success: boolean;
  error?: {
    issues?: InlineEditIssue[];
  };
}

export interface InlineEditValidationSchema {
  safeParse: (data: unknown) => InlineEditSafeParseResult;
}

export interface InlineEditCommitResult {
  success: boolean;
  committedValue?: unknown;
  errorMessage?: string;
}

export interface InlineEditColumnRuntimeConfig {
  enabled: boolean;
  debounceMs: number;
  trigger: "doubleClickEnter";
  optimistic: boolean;
  showDelayIndicator: boolean;
  editor: InlineEditEditor;
  formField: string;
  options: InlineEditOption[];
  readonly: boolean;
  columnType?: string;
  typeKey?: string;
}

interface InlineEditColumnLike {
  id: string;
  type?: string;
  typeKey?: string;
  accessorKey?: unknown;
  accessorFn?: unknown;
  options?: unknown;
  inlineEdit?: boolean | InlineEditColumnConfig;
}

export interface InlineEditTableRuntimeConfig {
  enabled: boolean;
  debounceMs: number;
  trigger: "doubleClickEnter";
  optimistic: boolean;
  showDelayIndicator: boolean;
}

interface ResolveInlineEditColumnConfigOptions {
  featureEnabled?: boolean;
}

export interface ResolveInlineEditorInput {
  explicitEditor?: InlineEditEditor;
  columnType?: string;
  formFieldType?: FormFieldType;
  hasOptions?: boolean;
}

export interface ParseInlineEditValueInput {
  editor: InlineEditEditor;
  rawValue: unknown;
  options?: InlineEditOption[];
}

export interface ParseInlineEditValueResult {
  success: boolean;
  value?: unknown;
  errorMessage?: string;
}

export interface ValidateInlineEditValueInput {
  editor: InlineEditEditor;
  candidateValue: unknown;
  rowData: Record<string, unknown>;
  formField: string;
  schema?: InlineEditValidationSchema;
}

export interface ValidateInlineEditValueResult {
  success: boolean;
  errorMessage?: string;
}

export interface UseInlineEditRuntimeOptions {
  initialValue: unknown;
  editor: InlineEditEditor;
  debounceMs: number;
  onCommit: (draftValue: unknown) => Promise<InlineEditCommitResult>;
}

function normalizeInlineEditTableConfig(
  inlineConfig?: TableInlineEditConfig
): InlineEditTableRuntimeConfig {
  return {
    enabled: inlineConfig?.enabled ?? false,
    debounceMs: inlineConfig?.debounceMs ?? DEFAULT_INLINE_EDIT_DEBOUNCE_MS,
    trigger: inlineConfig?.trigger ?? "doubleClickEnter",
    optimistic: inlineConfig?.optimistic ?? true,
    showDelayIndicator: inlineConfig?.showDelayIndicator ?? true,
  };
}

export function resolveInlineEditColumnConfig(
  column: InlineEditColumnLike,
  tableInlineConfig?: TableInlineEditConfig,
  options?: ResolveInlineEditColumnConfigOptions
): InlineEditColumnRuntimeConfig {
  const normalizedTableConfig =
    normalizeInlineEditTableConfig(tableInlineConfig);
  const isFeatureEnabled = options?.featureEnabled ?? true;
  const inlineColumnConfig =
    typeof column.inlineEdit === "boolean"
      ? { enabled: column.inlineEdit }
      : (column.inlineEdit ?? {});

  const enabledFromColumn =
    typeof column.inlineEdit === "boolean"
      ? column.inlineEdit
      : inlineColumnConfig.enabled;

  const isReadonly = Boolean(
    inlineColumnConfig.readonly ||
      (column.accessorFn && !inlineColumnConfig.formField)
  );
  const isSystemColumn = column.id === "actions" || column.id === "select";
  const supportsEditor =
    column.type === "dynamicType" ||
    TABLE_DATA_TYPES[resolveDataType(column.type)].inline !== null ||
    (inlineColumnConfig.editor && inlineColumnConfig.editor !== "auto");
  const isEnabled =
    Boolean(supportsEditor) &&
    isFeatureEnabled &&
    !isReadonly &&
    !isSystemColumn &&
    (enabledFromColumn ?? normalizedTableConfig.enabled);

  return {
    enabled: isEnabled,
    debounceMs:
      inlineColumnConfig.debounceMs ?? normalizedTableConfig.debounceMs,
    trigger: normalizedTableConfig.trigger,
    optimistic: normalizedTableConfig.optimistic,
    showDelayIndicator: normalizedTableConfig.showDelayIndicator,
    editor: inlineColumnConfig.editor ?? "auto",
    formField:
      inlineColumnConfig.formField ??
      (typeof column.accessorKey === "string" ? column.accessorKey : column.id),
    options:
      inlineColumnConfig.options ??
      (Array.isArray(column.options) ? column.options : []),
    readonly: isReadonly,
    columnType: column.type,
    typeKey: column.typeKey,
  };
}

export const resolveInlineEditor = resolveDataTypeEditor;

export function resolveInlineEditOptions(
  columnOptions: InlineEditOption[],
  formField?: AnyFieldDefinition
): InlineEditOption[] {
  if (columnOptions.length > 0) {
    return columnOptions;
  }

  if (
    formField?.type === "select" ||
    formField?.type === "multiSelect" ||
    formField?.type === "radio"
  ) {
    return (Array.isArray(formField.options) ? formField.options : []).map(
      (option) => ({
        ...option,
      })
    );
  }

  if (formField?.type === "select-with-add-new" && formField.options) {
    return (Array.isArray(formField.options) ? formField.options : []).map(
      (option) => ({
        ...option,
      })
    );
  }

  return [];
}

function parseBooleanValue(rawValue: unknown): boolean {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    if (rawValue.toLowerCase() === "true") {
      return true;
    }
    if (rawValue.toLowerCase() === "false") {
      return false;
    }
  }

  return Boolean(rawValue);
}

function parseDateValue(rawValue: unknown): ParseInlineEditValueResult {
  if (rawValue == null || rawValue === "") {
    return { success: true, value: null };
  }

  if (rawValue instanceof Date) {
    if (Number.isNaN(rawValue.getTime())) {
      return {
        success: false,
        errorMessage: "Inline edit expects a valid date.",
      };
    }
    return { success: true, value: toDraftDateInputValue(rawValue) };
  }

  const rawString = String(rawValue).trim();
  const matchedDate = INLINE_DATE_INPUT_PATTERN.exec(rawString);

  if (matchedDate) {
    const year = Number.parseInt(matchedDate[1], 10);
    const month = Number.parseInt(matchedDate[2], 10);
    const day = Number.parseInt(matchedDate[3], 10);
    const date = new Date(year, month - 1, day);
    const isExactMatch =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    if (isExactMatch) {
      return { success: true, value: toDraftDateInputValue(date) };
    }

    return {
      success: false,
      errorMessage: "Inline edit expects a valid date.",
    };
  }

  const parsedDate = toValidDate(rawString);
  if (!parsedDate) {
    return {
      success: false,
      errorMessage: "Inline edit expects a valid date.",
    };
  }

  return { success: true, value: toDraftDateInputValue(parsedDate) };
}

function parseNumberValue(rawValue: unknown): ParseInlineEditValueResult {
  if (rawValue == null || rawValue === "") {
    return { success: true, value: null };
  }

  const parsedValue =
    typeof rawValue === "number" ? rawValue : Number(String(rawValue));

  if (!Number.isFinite(parsedValue)) {
    return {
      success: false,
      errorMessage: "Inline edit expects a valid number.",
    };
  }

  return { success: true, value: parsedValue };
}

function parseJsonValue(rawValue: unknown): ParseInlineEditValueResult {
  if (rawValue == null || rawValue === "") {
    return { success: true, value: null };
  }

  if (typeof rawValue === "object") {
    return { success: true, value: rawValue };
  }

  const rawString = String(rawValue);
  try {
    return {
      success: true,
      value: JSON.parse(rawString),
    };
  } catch {
    return {
      success: false,
      errorMessage: "Inline edit expects valid JSON.",
    };
  }
}

function mapOptionValue(
  rawValue: unknown,
  options: InlineEditOption[]
): boolean | number | string {
  const matchingOption = options.find((option) =>
    Object.is(option.value, rawValue)
  );
  if (matchingOption) {
    return matchingOption.value;
  }
  if (["boolean", "number", "string"].includes(typeof rawValue)) {
    return rawValue as boolean | number | string;
  }
  return "";
}

function toDraftMultiSelectValue(
  rawValue: unknown
): Array<boolean | number | string> {
  return Array.isArray(rawValue)
    ? rawValue.filter((value): value is boolean | number | string =>
        ["boolean", "number", "string"].includes(typeof value)
      )
    : [];
}

export function parseInlineEditValue({
  editor,
  rawValue,
  options = [],
}: ParseInlineEditValueInput): ParseInlineEditValueResult {
  switch (editor) {
    case "boolean":
      return { success: true, value: parseBooleanValue(rawValue) };
    case "date":
      return parseDateValue(rawValue);
    case "json":
      return parseJsonValue(rawValue);
    case "number":
      return parseNumberValue(rawValue);
    case "select": {
      const resolvedValue = mapOptionValue(rawValue, options);
      return {
        success: true,
        value: resolvedValue,
      };
    }
    case "multiSelect": {
      const rawValues = toDraftMultiSelectValue(rawValue);
      const resolvedValues = rawValues.map((value) =>
        mapOptionValue(value, options)
      );
      return {
        success: true,
        value: resolvedValues,
      };
    }
    default:
      return {
        success: true,
        value: rawValue == null ? "" : String(rawValue),
      };
  }
}

function getSchemaErrorForField(
  fieldName: string,
  issues: InlineEditIssue[]
): string | undefined {
  const fieldIssue = issues.find(
    (issue) =>
      String(issue.path?.[0] ?? "") === fieldName && Boolean(issue.message)
  );
  if (fieldIssue?.message) {
    return fieldIssue.message;
  }

  const firstIssue = issues.find((issue) => Boolean(issue.message));
  return firstIssue?.message;
}

export function validateInlineEditValue({
  editor,
  candidateValue,
  rowData,
  formField,
  schema,
}: ValidateInlineEditValueInput): ValidateInlineEditValueResult {
  if (editor === "number") {
    const isValidNumber =
      candidateValue === null ||
      (typeof candidateValue === "number" && Number.isFinite(candidateValue));
    if (!isValidNumber) {
      return {
        success: false,
        errorMessage: "Inline edit expects a valid number.",
      };
    }
  }

  if (editor === "date") {
    const isValidDate =
      candidateValue === null || Boolean(toValidDate(candidateValue));
    if (!isValidDate) {
      return {
        success: false,
        errorMessage: "Inline edit expects a valid date.",
      };
    }
  }

  if (editor === "multiSelect" && !Array.isArray(candidateValue)) {
    return {
      success: false,
      errorMessage: "Inline edit expects an array of values.",
    };
  }

  if (!schema) {
    return { success: true };
  }

  const schemaResult = schema.safeParse({
    ...rowData,
    [formField]: candidateValue,
  });

  if (!schemaResult.success) {
    const issues = schemaResult.error?.issues ?? [];
    const errorMessage = getSchemaErrorForField(formField, issues);
    return {
      success: false,
      errorMessage: errorMessage ?? "Inline edit validation failed.",
    };
  }

  return { success: true };
}

function toDraftDateInputValue(value: unknown): string {
  const parsedDate = toValidDate(value);
  if (!parsedDate) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toComparableString(value: unknown): string {
  try {
    const serializedValue = JSON.stringify(value);
    return serializedValue ?? String(value);
  } catch {
    return String(value);
  }
}

export function toInlineEditDraftValue(
  value: unknown,
  editor: InlineEditEditor
): unknown {
  switch (editor) {
    case "boolean":
      return Boolean(value);
    case "date":
      return toDraftDateInputValue(value);
    case "json":
      if (value == null || value === "") {
        return "";
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    case "number":
      return value == null ? "" : String(value);
    case "multiSelect":
      return toDraftMultiSelectValue(value);
    case "select":
      return value ?? "";
    default:
      return value == null ? "" : String(value);
  }
}

export function useInlineEditRuntime({
  initialValue,
  editor,
  debounceMs,
  onCommit,
}: UseInlineEditRuntimeOptions) {
  const [draftValue, setDraftValue] = useState(() =>
    toInlineEditDraftValue(initialValue, editor)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<number | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  const scheduledSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const draftValueRef = useRef(draftValue);
  const committedDraftRef = useRef(draftValue);
  const externalDraftRef = useRef(draftValue);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const closingRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    draftValueRef.current = draftValue;
  }, [draftValue]);

  const clearScheduledSave = useCallback(() => {
    if (scheduledSaveTimerRef.current) {
      clearTimeout(scheduledSaveTimerRef.current);
      scheduledSaveTimerRef.current = null;
    }
    setScheduledAt(undefined);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearScheduledSave();
    };
  }, [clearScheduledSave]);

  useEffect(() => {
    if (scheduledAt == null) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 50);

    return () => {
      clearInterval(interval);
    };
  }, [scheduledAt]);

  useEffect(() => {
    if (isEditing || isDirty || isSaving) {
      return;
    }

    const nextDraft = toInlineEditDraftValue(initialValue, editor);
    if (
      toComparableString(nextDraft) ===
      toComparableString(externalDraftRef.current)
    ) {
      return;
    }
    externalDraftRef.current = nextDraft;
    if (
      toComparableString(nextDraft) ===
      toComparableString(committedDraftRef.current)
    ) {
      return;
    }
    committedDraftRef.current = nextDraft;
    draftValueRef.current = nextDraft;
    setDraftValue(nextDraft);
  }, [editor, initialValue, isDirty, isEditing, isSaving]);

  const commitDraftValue = useCallback(async (): Promise<boolean> => {
    clearScheduledSave();
    // Serialize autosave and dismissal so neither drops the other's result.
    while (inFlightRef.current) {
      if (!(await inFlightRef.current)) {
        return false;
      }
    }
    if (!mountedRef.current) {
      return false;
    }
    const valueToCommit = draftValueRef.current;
    if (
      toComparableString(valueToCommit) ===
      toComparableString(committedDraftRef.current)
    ) {
      return true;
    }
    setIsSaving(true);
    setErrorMessage(undefined);
    const request = Promise.resolve().then(async () => {
      try {
        const result = await onCommit(valueToCommit);
        if (!result.success) {
          setErrorMessage(result.errorMessage ?? "Inline edit save failed.");
          return false;
        }
        const nextCommittedValue = result.committedValue ?? valueToCommit;
        const normalized = toInlineEditDraftValue(nextCommittedValue, editor);
        committedDraftRef.current = normalized;
        // An older response must never replace a newer selection or text draft.
        if (
          toComparableString(draftValueRef.current) ===
          toComparableString(valueToCommit)
        ) {
          draftValueRef.current = normalized;
          setDraftValue(normalized);
        }
        setIsDirty(
          toComparableString(draftValueRef.current) !==
            toComparableString(normalized)
        );
        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Inline edit save failed."
        );
        return false;
      } finally {
        inFlightRef.current = null;
        setIsSaving(false);
      }
    });
    inFlightRef.current = request;
    return await request;
  }, [clearScheduledSave, editor, onCommit]);

  const scheduleSave = useCallback(() => {
    clearScheduledSave();

    if (debounceMs <= 0) {
      commitDraftValue().catch(() => undefined);
      return;
    }

    setScheduledAt(Date.now() + debounceMs);
    scheduledSaveTimerRef.current = setTimeout(() => {
      commitDraftValue().catch(() => undefined);
    }, debounceMs);
  }, [clearScheduledSave, commitDraftValue, debounceMs]);

  const updateDraftValue = useCallback(
    (
      nextValue: unknown,
      options?: {
        disableAutoSave?: boolean;
      }
    ) => {
      const baselineDraft = committedDraftRef.current;
      const hasChanges =
        toComparableString(nextValue) !== toComparableString(baselineDraft);

      draftValueRef.current = nextValue;
      setDraftValue(nextValue);
      setErrorMessage(undefined);
      setIsDirty(hasChanges);

      if (!hasChanges) {
        clearScheduledSave();
        return;
      }

      if (options?.disableAutoSave) {
        return;
      }

      scheduleSave();
    },
    [clearScheduledSave, scheduleSave]
  );

  const flushChanges = useCallback(async (): Promise<boolean> => {
    do {
      if (!(await commitDraftValue())) {
        return false;
      }
    } while (
      toComparableString(draftValueRef.current) !==
      toComparableString(committedDraftRef.current)
    );
    return true;
  }, [commitDraftValue]);

  const startEditing = useCallback(() => {
    if (inFlightRef.current) {
      return;
    }
    setErrorMessage(undefined);
    draftValueRef.current = committedDraftRef.current;
    setDraftValue(committedDraftRef.current);
    setIsEditing(true);
  }, []);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const cancelEditing = useCallback(() => {
    // An acknowledged write cannot be cancelled by hiding its pending editor.
    if (inFlightRef.current) {
      return;
    }
    clearScheduledSave();
    setErrorMessage(undefined);
    setIsDirty(false);
    draftValueRef.current = committedDraftRef.current;
    setDraftValue(committedDraftRef.current);
    setIsEditing(false);
  }, [clearScheduledSave]);

  const commitAndClose = useCallback((): Promise<boolean> => {
    if (closingRef.current) {
      return closingRef.current;
    }
    const closing = flushChanges()
      .then((committed) => {
        if (committed) {
          setIsEditing(false);
        }
        return committed;
      })
      .finally(() => {
        closingRef.current = null;
      });
    closingRef.current = closing;
    return closing;
  }, [flushChanges]);

  const delayProgress = useMemo(() => {
    if (scheduledAt == null || debounceMs <= 0) {
      return 0;
    }

    const remainingMs = Math.max(0, scheduledAt - currentTimeMs);
    const elapsedMs = debounceMs - remainingMs;
    return Math.min(100, Math.max(0, (elapsedMs / debounceMs) * 100));
  }, [currentTimeMs, debounceMs, scheduledAt]);

  return {
    isEditing,
    draftValue,
    isDirty,
    isSaving,
    scheduledAt,
    delayProgress,
    errorMessage,
    startEditing,
    stopEditing,
    cancelEditing,
    updateDraftValue,
    flushChanges,
    commitAndClose,
  };
}
