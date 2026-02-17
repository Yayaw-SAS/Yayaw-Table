"use client";

import type { Cell } from "@tanstack/react-table";
import type { KeyboardEvent, ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type InlineEditColumnRuntimeConfig,
  type InlineEditCommitResult,
  type InlineEditValidationSchema,
  parseInlineEditValue,
  resolveInlineEditOptions,
  resolveInlineEditor,
  toInlineEditDraftValue,
  useInlineEditRuntime,
  validateInlineEditValue,
} from "../../hooks/use-inline-edit-runtime";
import { useTranslations } from "../../providers/table-provider";
import type { AnyFieldDefinition } from "../forms/types";

interface InlineEditableCellProps<TData extends Record<string, unknown>> {
  cell: Cell<TData, unknown>;
  inlineConfig: InlineEditColumnRuntimeConfig;
  displayValue: ReactNode;
  rowData: Record<string, unknown>;
  formFieldDefinition?: AnyFieldDefinition;
  schema?: InlineEditValidationSchema;
  onCommit: (value: unknown) => Promise<InlineEditCommitResult>;
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
          errorMessage: parsedResult.errorMessage ?? t("inline.invalid_value"),
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
    (
      event: KeyboardEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
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
    if (resolvedEditor !== "select") {
      return [];
    }

    const currentValue = String(editorValue);
    if (
      resolvedOptions.some((option) => String(option.value) === currentValue)
    ) {
      return resolvedOptions;
    }

    if (currentValue.length === 0) {
      return resolvedOptions;
    }

    return [
      {
        label: currentValue,
        value: currentValue,
      },
      ...resolvedOptions,
    ];
  }, [editorValue, resolvedEditor, resolvedOptions]);

  const renderEditor = () => {
    if (resolvedEditor === "textarea" || resolvedEditor === "json") {
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
    }

    if (resolvedEditor === "boolean") {
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
            {editorValue ? t("common.true") : t("common.false")}
          </span>
        </div>
      );
    }

    if (resolvedEditor === "select") {
      return (
        <select
          autoFocus
          className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onBlur={handleEditorBlur}
          onChange={(event) => {
            updateDraftValue(event.target.value);
          }}
          onKeyDown={handleEditorKeyDown}
          value={String(editorValue)}
        >
          {selectOptions.length === 0 && (
            <option value="">{t("inline.select_no_options")}</option>
          )}
          {selectOptions.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

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
  };

  return (
    <div className="relative w-full">
      {isEditing ? (
        renderEditor()
      ) : (
        <button
          className={cn(
            "relative min-h-8 w-full cursor-text rounded-sm px-0.5 py-1 text-left outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary/30"
          )}
          onDoubleClick={(event) => {
            event.stopPropagation();
            startEditing();
          }}
          onKeyDown={handleDisplayKeyDown}
          title={t("inline.edit_hint")}
          type="button"
        >
          {displayValue}
        </button>
      )}

      {isSaving && (
        <span className="absolute top-0.5 right-0.5 text-[10px] text-muted-foreground">
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
