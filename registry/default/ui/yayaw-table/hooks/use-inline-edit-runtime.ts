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
}

interface InlineEditColumnLike {
  id: string;
  type?: string;
  inlineEdit?: boolean | InlineEditColumnConfig;
}

export interface InlineEditTableRuntimeConfig {
  enabled: boolean;
  debounceMs: number;
  trigger: "doubleClickEnter";
  optimistic: boolean;
  showDelayIndicator: boolean;
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
  tableInlineConfig?: TableInlineEditConfig
): InlineEditColumnRuntimeConfig {
  const normalizedTableConfig =
    normalizeInlineEditTableConfig(tableInlineConfig);
  const inlineColumnConfig =
    typeof column.inlineEdit === "boolean"
      ? { enabled: column.inlineEdit }
      : (column.inlineEdit ?? {});

  const enabledFromColumn =
    typeof column.inlineEdit === "boolean"
      ? column.inlineEdit
      : inlineColumnConfig.enabled;

  const isReadonly = Boolean(inlineColumnConfig.readonly);
  const isSystemColumn = column.id === "actions" || column.id === "select";
  const isEnabled =
    !(isReadonly || isSystemColumn) &&
    (enabledFromColumn ?? normalizedTableConfig.enabled);

  return {
    enabled: isEnabled,
    debounceMs:
      inlineColumnConfig.debounceMs ?? normalizedTableConfig.debounceMs,
    trigger: normalizedTableConfig.trigger,
    optimistic: normalizedTableConfig.optimistic,
    showDelayIndicator: normalizedTableConfig.showDelayIndicator,
    editor: inlineColumnConfig.editor ?? "auto",
    formField: inlineColumnConfig.formField ?? column.id,
    options: inlineColumnConfig.options ?? [],
    readonly: isReadonly,
    columnType: column.type,
  };
}

function mapFormFieldTypeToInlineEditor(
  formFieldType?: FormFieldType
): InlineEditEditor | undefined {
  switch (formFieldType) {
    case "checkbox":
    case "switch":
      return "boolean";
    case "date":
      return "date";
    case "number":
      return "number";
    case "select":
    case "select-with-add-new":
      return "select";
    case "textarea":
      return "textarea";
    case "text":
      return "text";
    default:
      return;
  }
}

function mapColumnTypeToInlineEditor(columnType?: string): InlineEditEditor {
  const normalizedType = columnType?.toLowerCase();

  switch (normalizedType) {
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "number":
      return "number";
    case "option":
    case "select":
      return "select";
    case "multioption":
      return "multiSelect";
    case "tag":
    case "code":
    case "text":
      return "text";
    default:
      return "text";
  }
}

export function resolveInlineEditor({
  explicitEditor,
  columnType,
  formFieldType,
  hasOptions = false,
}: ResolveInlineEditorInput): InlineEditEditor {
  if (explicitEditor && explicitEditor !== "auto") {
    return explicitEditor;
  }

  if (columnType?.toLowerCase() === "multioption") {
    return "multiSelect";
  }

  const formMappedEditor = mapFormFieldTypeToInlineEditor(formFieldType);
  if (formMappedEditor) {
    return formMappedEditor;
  }

  if (hasOptions) {
    return "select";
  }

  return mapColumnTypeToInlineEditor(columnType);
}

export function resolveInlineEditOptions(
  columnOptions: InlineEditOption[],
  formField?: AnyFieldDefinition
): InlineEditOption[] {
  if (columnOptions.length > 0) {
    return columnOptions;
  }

  if (formField?.type === "select") {
    return formField.options.map((option) => ({
      label: option.label,
      value: option.value,
    }));
  }

  if (formField?.type === "select-with-add-new" && formField.options) {
    return formField.options.map((option) => ({
      label: option.label,
      value: option.value,
    }));
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
    return { success: true, value: rawValue };
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
      return { success: true, value: date };
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

  return { success: true, value: parsedDate };
}

function parseNumberValue(rawValue: unknown): ParseInlineEditValueResult {
  if (rawValue == null || rawValue === "") {
    return { success: true, value: null };
  }

  const parsedValue =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseFloat(String(rawValue));

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
  const normalizedValue = rawValue == null ? "" : String(rawValue);
  const matchingOption = options.find(
    (option) => String(option.value) === normalizedValue
  );
  return matchingOption?.value ?? normalizedValue;
}

function toDraftMultiSelectValue(rawValue: unknown): string[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
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
      if (typeof value === "string") {
        return value;
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
      return value == null ? "" : String(value);
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
  const [committedValue, setCommittedValue] = useState(initialValue);
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
    return () => {
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

    setCommittedValue(initialValue);
    setDraftValue(toInlineEditDraftValue(initialValue, editor));
  }, [editor, initialValue, isDirty, isEditing, isSaving]);

  const commitDraftValue = useCallback(
    async (valueToCommit: unknown): Promise<boolean> => {
      clearScheduledSave();
      setIsSaving(true);
      setErrorMessage(undefined);

      try {
        const commitResult = await onCommit(valueToCommit);
        if (!commitResult.success) {
          setErrorMessage(
            commitResult.errorMessage ?? "Inline edit save failed."
          );
          return false;
        }

        const nextCommittedValue = commitResult.committedValue ?? valueToCommit;
        const normalizedCommittedDraft = toInlineEditDraftValue(
          nextCommittedValue,
          editor
        );

        setCommittedValue(nextCommittedValue);
        setDraftValue(normalizedCommittedDraft);
        setErrorMessage(undefined);

        const hasPendingChanges =
          toComparableString(draftValueRef.current) !==
          toComparableString(normalizedCommittedDraft);
        setIsDirty(hasPendingChanges);

        return true;
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Inline edit save failed."
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [clearScheduledSave, editor, onCommit]
  );

  const scheduleSave = useCallback(
    (nextValue: unknown) => {
      clearScheduledSave();

      if (debounceMs <= 0) {
        commitDraftValue(nextValue).catch(() => undefined);
        return;
      }

      setScheduledAt(Date.now() + debounceMs);
      scheduledSaveTimerRef.current = setTimeout(() => {
        commitDraftValue(nextValue).catch(() => undefined);
      }, debounceMs);
    },
    [clearScheduledSave, commitDraftValue, debounceMs]
  );

  const updateDraftValue = useCallback(
    (
      nextValue: unknown,
      options?: {
        disableAutoSave?: boolean;
      }
    ) => {
      const baselineDraft = toInlineEditDraftValue(committedValue, editor);
      const hasChanges =
        toComparableString(nextValue) !== toComparableString(baselineDraft);

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

      scheduleSave(nextValue);
    },
    [clearScheduledSave, committedValue, editor, scheduleSave]
  );

  const flushChanges = useCallback(async (): Promise<boolean> => {
    if (!isDirty || isSaving) {
      clearScheduledSave();
      return true;
    }

    return await commitDraftValue(draftValueRef.current);
  }, [clearScheduledSave, commitDraftValue, isDirty, isSaving]);

  const startEditing = useCallback(() => {
    setErrorMessage(undefined);
    setDraftValue(toInlineEditDraftValue(committedValue, editor));
    setIsEditing(true);
  }, [committedValue, editor]);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const cancelEditing = useCallback(() => {
    clearScheduledSave();
    setErrorMessage(undefined);
    setIsDirty(false);
    setDraftValue(toInlineEditDraftValue(committedValue, editor));
    setIsEditing(false);
  }, [clearScheduledSave, committedValue, editor]);

  const commitAndClose = useCallback(async (): Promise<boolean> => {
    const committed = await flushChanges();
    setIsEditing(false);
    return committed;
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
