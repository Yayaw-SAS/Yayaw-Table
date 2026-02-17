"use client";

import type { Cell } from "@tanstack/react-table";
import type { KeyboardEvent, ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AnyFieldDefinition } from "../forms/types";
import {
  parseInlineEditValue,
  resolveInlineEditor,
  resolveInlineEditOptions,
  toInlineEditDraftValue,
  type InlineEditColumnRuntimeConfig,
  type InlineEditCommitResult,
  type InlineEditValidationSchema,
  useInlineEditRuntime,
  validateInlineEditValue,
} from "../../hooks/use-inline-edit-runtime";
import { useTranslations } from "../../providers/table-provider";

interface InlineEditableCellProps<TData extends Record<string, unknown>> {
  cell: Cell<TData, unknown>;
  inlineConfig: InlineEditColumnRuntimeConfig;
  displayValue: ReactNode;
  rowData: Record<string, unknown>;
  formFieldDefinition?: AnyFieldDefinition;
  schema?: InlineEditValidationSchema;
  onCommit: (value: unknown) => Promise<InlineEditCommitResult>;
}

interface NormalizedSelectOption {
  label: string;
  value: string;
}

function getEditorCurrentValues(
  editor: InlineEditColumnRuntimeConfig["editor"],
  editorValue: unknown
): string[] {
  if (editor === "multiSelect") {
    if (!Array.isArray(editorValue)) {
      return [];
    }
    return editorValue.map((value) => String(value));
  }

  return [String(editorValue)];
}

function normalizeSelectOptions({
  editor,
  editorValue,
  options,
}: {
  editor: InlineEditColumnRuntimeConfig["editor"];
  editorValue: unknown;
  options: InlineEditColumnRuntimeConfig["options"];
}): NormalizedSelectOption[] {
  if (editor !== "select" && editor !== "multiSelect") {
    return [];
  }

  const normalizedOptions = new Map<string, NormalizedSelectOption>();

  for (const option of options) {
    const normalizedValue = String(option.value);
    if (normalizedValue.length === 0) {
      continue;
    }

    normalizedOptions.set(normalizedValue, {
      label: option.label,
      value: normalizedValue,
    });
  }

  const currentValues = getEditorCurrentValues(editor, editorValue);
  for (const currentValue of currentValues) {
    if (currentValue.length === 0 || normalizedOptions.has(currentValue)) {
      continue;
    }

    normalizedOptions.set(currentValue, {
      label: currentValue,
      value: currentValue,
    });
  }

  return Array.from(normalizedOptions.values());
}

function InlineEditableCellBase<TData extends Record<string, unknown>>({
  cell,
  inlineConfig,
  displayValue,
  rowData,
  formFieldDefinition,
  schema,
  onCommit,
}: InlineEditableCellProps<TData>) {
  const { t } = useTranslations();

  const resolvedOptions = useMemo(
    () => resolveInlineEditOptions(inlineConfig.options, formFieldDefinition),
    [formFieldDefinition, inlineConfig.options]
  );

  const resolvedEditor = useMemo(
    () =>
      resolveInlineEditor({
        explicitEditor: inlineConfig.editor,
        columnType: inlineConfig.columnType,
        formFieldType: formFieldDefinition?.type,
        hasOptions: resolvedOptions.length > 0,
      }),
    [
      formFieldDefinition?.type,
      inlineConfig.columnType,
      inlineConfig.editor,
      resolvedOptions.length,
    ]
  );

  const runtimeCommit = useCallback(
    async (draftValue: unknown): Promise<InlineEditCommitResult> => {
      const parsedResult = parseInlineEditValue({
        editor: resolvedEditor,
        rawValue: draftValue,
        options: resolvedOptions,
      });

      if (!parsedResult.success) {
        return {
          success: false,
          errorMessage:
            parsedResult.errorMessage ?? t("inline.invalid_value"),
        };
      }

      const validationResult = validateInlineEditValue({
        editor: resolvedEditor,
        candidateValue: parsedResult.value,
        formField: inlineConfig.formField,
        rowData,
        schema,
      });

      if (!validationResult.success) {
        return {
          success: false,
          errorMessage:
            validationResult.errorMessage ?? t("inline.invalid_value"),
        };
      }

      return await onCommit(parsedResult.value);
    },
    [
      inlineConfig.formField,
      onCommit,
      resolvedEditor,
      resolvedOptions,
      rowData,
      schema,
      t,
    ]
  );

  const {
    commitAndClose,
    delayProgress,
    draftValue,
    errorMessage,
    isDirty,
    isEditing,
    isSaving,
    scheduledAt,
    startEditing,
    stopEditing,
    cancelEditing,
    updateDraftValue,
  } = useInlineEditRuntime({
    initialValue: cell.getValue(),
    editor: resolvedEditor,
    debounceMs: inlineConfig.debounceMs,
    onCommit: runtimeCommit,
  });

  const handleDisplayKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startEditing();
    },
    [startEditing]
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelEditing();
        return;
      }

      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      commitAndClose().catch(() => undefined);
    },
    [cancelEditing, commitAndClose]
  );

  const handleEditorBlur = useCallback(() => {
    commitAndClose().catch(() => undefined);
  }, [commitAndClose]);

  const editorValue = useMemo(() => {
    return toInlineEditDraftValue(draftValue, resolvedEditor);
  }, [draftValue, resolvedEditor]);

  const selectOptions = useMemo(() => {
    return normalizeSelectOptions({
      editor: resolvedEditor,
      editorValue,
      options: resolvedOptions,
    });
  }, [editorValue, resolvedEditor, resolvedOptions]);

  const multiSelectAnchorRef = useComboboxAnchor();
  const selectedMultiValues = useMemo(() => {
    if (resolvedEditor !== "multiSelect" || !Array.isArray(editorValue)) {
      return [];
    }

    return editorValue.map((value) => String(value));
  }, [editorValue, resolvedEditor]);

  const getOptionLabel = useCallback(
    (optionValue: string): string => {
      const matchingOption = selectOptions.find(
        (option) => option.value === optionValue
      );
      return matchingOption?.label ?? optionValue;
    },
    [selectOptions]
  );

  const renderTextareaEditor = useCallback(() => {
    return (
      <Textarea
        autoFocus
        className="min-h-20 py-1 text-sm"
        onBlur={handleEditorBlur}
        onChange={(event) => {
          updateDraftValue(event.target.value);
        }}
        onKeyDown={handleEditorKeyDown}
        rows={resolvedEditor === "json" ? 6 : 4}
        value={String(editorValue)}
      />
    );
  }, [
    editorValue,
    handleEditorBlur,
    handleEditorKeyDown,
    resolvedEditor,
    updateDraftValue,
  ]);

  const renderBooleanEditor = useCallback(() => {
    return (
      <div className="flex min-h-8 items-center gap-2 px-1">
        <Switch
          checked={Boolean(editorValue)}
          onBlur={handleEditorBlur}
          onCheckedChange={(checked) => {
            updateDraftValue(Boolean(checked));
          }}
        />
        <span className="text-muted-foreground text-xs">
          {Boolean(editorValue) ? t("common.true") : t("common.false")}
        </span>
      </div>
    );
  }, [editorValue, handleEditorBlur, t, updateDraftValue]);

  const renderSelectEditor = useCallback(() => {
    return (
      <Select
        onOpenChange={(open) => {
          if (!open) {
            stopEditing();
          }
        }}
        onValueChange={(value) => {
          updateDraftValue(value ?? "");
        }}
        value={String(editorValue)}
      >
        <SelectTrigger autoFocus className="h-8 w-full">
          <SelectValue placeholder={t("inline.select_no_options")} />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.length === 0 ? (
            <SelectItem disabled value="__no-options__">
              {t("inline.select_no_options")}
            </SelectItem>
          ) : (
            selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }, [editorValue, selectOptions, stopEditing, t, updateDraftValue]);

  const renderMultiSelectEditor = useCallback(() => {
    return (
      <Combobox
        multiple
        onOpenChange={(open) => {
          if (!open) {
            stopEditing();
          }
        }}
        onValueChange={(values) => {
          updateDraftValue(
            Array.isArray(values) ? values.map((value) => String(value)) : []
          );
        }}
        value={selectedMultiValues}
      >
        <ComboboxChips className="w-full" ref={multiSelectAnchorRef}>
          {selectedMultiValues.map((selectedValue) => (
            <ComboboxChip key={selectedValue}>
              {getOptionLabel(selectedValue)}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            autoFocus
            className="h-6 min-w-16"
            onKeyDown={(event) => {
              if (event.key !== "Escape") {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
              cancelEditing();
            }}
            placeholder={
              selectedMultiValues.length === 0
                ? t("inline.select_no_options")
                : undefined
            }
          />
        </ComboboxChips>
        <ComboboxContent anchor={multiSelectAnchorRef}>
          <ComboboxList>
            <ComboboxEmpty>{t("filters.noResults")}</ComboboxEmpty>
            {selectOptions.map((option) => (
              <ComboboxItem key={option.value} value={option.value}>
                {option.label}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  }, [
    cancelEditing,
    getOptionLabel,
    multiSelectAnchorRef,
    selectOptions,
    selectedMultiValues,
    stopEditing,
    t,
    updateDraftValue,
  ]);

  const renderInputEditor = useCallback(() => {
    let inputType = "text";
    if (resolvedEditor === "number") {
      inputType = "number";
    } else if (resolvedEditor === "date") {
      inputType = "date";
    }

    return (
      <Input
        autoFocus
        className="h-8 py-1 text-sm"
        onBlur={handleEditorBlur}
        onChange={(event) => {
          updateDraftValue(event.target.value);
        }}
        onKeyDown={handleEditorKeyDown}
        type={inputType}
        value={String(editorValue)}
      />
    );
  }, [
    editorValue,
    handleEditorBlur,
    handleEditorKeyDown,
    resolvedEditor,
    updateDraftValue,
  ]);

  const renderEditor = () => {
    if (resolvedEditor === "textarea" || resolvedEditor === "json") {
      return renderTextareaEditor();
    }

    if (resolvedEditor === "boolean") {
      return renderBooleanEditor();
    }

    if (resolvedEditor === "select") {
      return renderSelectEditor();
    }

    if (resolvedEditor === "multiSelect") {
      return renderMultiSelectEditor();
    }

    return renderInputEditor();
  };

  return (
    <div className="relative w-full">
      {isEditing ? (
        renderEditor()
      ) : (
        <button
          className={cn(
            "relative min-h-8 w-full cursor-text rounded-sm px-0.5 py-1 text-left outline-none",
            "focus-visible:ring-primary/30 focus-visible:ring-2"
          )}
          onDoubleClick={(event) => {
            event.stopPropagation();
            startEditing();
          }}
          onKeyDown={handleDisplayKeyDown}
          type="button"
          title={t("inline.edit_hint")}
        >
          {displayValue}
        </button>
      )}

      {isSaving && (
        <span className="absolute top-0.5 right-0.5 text-muted-foreground text-[10px]">
          {t("inline.saving")}
        </span>
      )}

      {!isSaving &&
        isDirty &&
        scheduledAt != null &&
        inlineConfig.showDelayIndicator && (
          <div
            className="absolute right-0 bottom-0 left-0 h-[2px] overflow-hidden rounded-full bg-muted"
            title={t("inline.save_scheduled")}
          >
            <div
              className="h-full bg-primary transition-[width] duration-75"
              style={{ width: `${delayProgress}%` }}
            />
          </div>
        )}

      {errorMessage && (
        <p className="mt-1 text-destructive text-xs">{errorMessage}</p>
      )}
    </div>
  );
}

export const InlineEditableCell = memo(
  InlineEditableCellBase
) as typeof InlineEditableCellBase;
