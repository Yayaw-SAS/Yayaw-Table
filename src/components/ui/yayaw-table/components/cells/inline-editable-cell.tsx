"use client";

import {
  AlignLeft,
  Braces,
  Calendar,
  CalendarClock,
  ChevronDown,
  Hash,
  Link,
  ListChecks,
  type LucideIcon,
  MapPin,
  PencilLine,
  Tag,
} from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import type { Cell } from "@/components/ui/yayaw-table/tanstack";
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
} from "@/src/components/ui/combobox";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Switch } from "@/src/components/ui/switch";
import { Textarea } from "@/src/components/ui/textarea";
import {
  type InlineEditColumnRuntimeConfig,
  type InlineEditCommitResult,
  type InlineEditValidationSchema,
  parseInlineEditValue,
  resolveInlineEditOptions,
  resolveInlineEditor,
  useInlineEditRuntime,
  validateInlineEditValue,
} from "../../hooks/use-inline-edit-runtime";
import { useTagCatalog } from "../../providers/tag-catalog-provider";
import { useTranslations } from "../../providers/table-provider";
import {
  type InlineEditorIcon,
  inlineEditorIcon,
  optionControlKey,
  optionControlValue,
  resolveDataType,
} from "../../utils/table-contracts";
import { TableTooltip } from "../../utils/table-tooltip";
import type { AnyFieldDefinition } from "../forms/types";
import { LocationEditor } from "../location/location-editor";
import { TagPicker } from "../tags/tag-picker";

interface InlineEditableCellProps<TData extends Record<string, unknown>> {
  cell: Cell<TData, unknown>;
  inlineConfig: InlineEditColumnRuntimeConfig;
  displayValue: ReactNode;
  rowData: Record<string, unknown>;
  formFieldDefinition?: AnyFieldDefinition;
  schema?: InlineEditValidationSchema;
  onCommit: (value: unknown) => Promise<InlineEditCommitResult>;
}

const INLINE_EDITOR_ICON_COMPONENTS: Record<InlineEditorIcon, LucideIcon> = {
  braces: Braces,
  calendar: Calendar,
  calendarClock: CalendarClock,
  chevron: ChevronDown,
  hash: Hash,
  link: Link,
  list: ListChecks,
  mapPin: MapPin,
  pencil: PencilLine,
  tag: Tag,
  text: AlignLeft,
};

/** A link shown in the cell keeps opening; the rest of the cell edits. */
const isLinkClick = (target: EventTarget): boolean =>
  target instanceof Element && target.closest("a[href]") !== null;

/** Floats over the cell's end (its start for right-aligned numbers), so it takes no column width or row height; cell actions, when present, end the cell instead. */
function InlineEditorIconChip({
  icon,
  placement,
}: {
  icon: InlineEditorIcon | null;
  placement: "start" | "end";
}) {
  if (!icon) {
    return null;
  }
  const Icon = INLINE_EDITOR_ICON_COMPONENTS[icon];
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-[5px] border bg-background p-[0.25em] text-muted-foreground opacity-0 shadow-sm group-hover/inline:opacity-100 group-focus-visible/inline:opacity-100 group-has-[[data-cell-actions]]/inline:hidden",
        placement === "start" ? "start-1" : "end-1"
      )}
      data-inline-icon={icon}
    >
      <Icon className="size-[0.85em]" />
    </span>
  );
}

interface NormalizedSelectOption {
  disabled?: boolean;
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
    return editorValue.map(optionControlKey);
  }

  return [optionControlKey(editorValue)];
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
    const normalizedValue = optionControlKey(option.value);
    if (normalizedValue.length === 0) {
      continue;
    }

    normalizedOptions.set(normalizedValue, {
      label: option.label,
      value: normalizedValue,
      disabled: option.disabled,
    });
  }

  const currentValues = getEditorCurrentValues(editor, editorValue);
  for (const currentValue of currentValues) {
    if (currentValue.length === 0 || normalizedOptions.has(currentValue)) {
      continue;
    }

    normalizedOptions.set(currentValue, {
      label: String(optionControlValue(currentValue)),
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
  const tagCatalog = useTagCatalog();
  const tagColumn = tagCatalog?.column(cell.column.id);

  const resolvedOptions = useMemo(
    () => resolveInlineEditOptions(inlineConfig.options, formFieldDefinition),
    [formFieldDefinition, inlineConfig.options]
  );

  const fieldWithTime =
    formFieldDefinition?.type === "date" && formFieldDefinition.withTime === true;
  const timeZone =
    inlineConfig.timeZone ??
    (formFieldDefinition?.type === "date"
      ? formFieldDefinition.timeZone
      : undefined);

  const resolvedEditor = useMemo(
    () =>
      resolveInlineEditor({
        explicitEditor: inlineConfig.editor,
        columnType: resolveDataType(
          inlineConfig.columnType,
          rowData,
          inlineConfig.typeKey
        ),
        formFieldType: formFieldDefinition?.type,
        hasOptions: resolvedOptions.length > 0,
        withTime: inlineConfig.withTime || fieldWithTime,
      }),
    [
      fieldWithTime,
      inlineConfig.withTime,
      formFieldDefinition?.type,
      inlineConfig.columnType,
      inlineConfig.typeKey,
      rowData,
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
        timeZone,
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
      timeZone,
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
    timeZone,
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

      if (
        (resolvedEditor === "json" || resolvedEditor === "textarea") &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      commitAndClose().catch(() => undefined);
    },
    [cancelEditing, commitAndClose, resolvedEditor]
  );

  const focusEditor = useCallback((node: HTMLElement | null) => {
    node?.focus();
  }, []);

  const handleEditorBlur = useCallback(() => {
    commitAndClose().catch(() => undefined);
  }, [commitAndClose]);

  const editorValue = draftValue;

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

    return editorValue.map(optionControlKey);
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
        ref={focusEditor}
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
    focusEditor,
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
          {editorValue ? t("common.true") : t("common.false")}
        </span>
      </div>
    );
  }, [editorValue, handleEditorBlur, t, updateDraftValue]);

  const renderSelectEditor = useCallback(() => {
    return (
      <Select
        items={selectOptions}
        open
        onOpenChange={(open, details) => {
          if (details.reason === "escape-key") {
            cancelEditing();
            return;
          }
          if (!open) {
            commitAndClose().catch(() => undefined);
          }
        }}
        onValueChange={(value) => {
          updateDraftValue(value == null ? "" : optionControlValue(value));
        }}
        value={optionControlKey(editorValue)}
      >
        <SelectTrigger className="h-8 w-full">
          <SelectValue placeholder={t("inline.select_no_options")} />
        </SelectTrigger>
        <SelectContent>
          {selectOptions.length === 0 ? (
            <SelectItem disabled value="__no-options__">
              {t("inline.select_no_options")}
            </SelectItem>
          ) : (
            selectOptions.map((option) => (
              <SelectItem
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    );
  }, [
    editorValue,
    selectOptions,
    cancelEditing,
    commitAndClose,
    t,
    updateDraftValue,
  ]);

  const renderMultiSelectEditor = useCallback(() => {
    return (
      <Combobox
        open
        multiple
        items={selectOptions.map((option) => option.value)}
        itemToStringLabel={getOptionLabel}
        onOpenChange={(open, details) => {
          if (details.reason === "escape-key") {
            cancelEditing();
            return;
          }
          if (!open) {
            commitAndClose().catch(() => undefined);
          }
        }}
        onValueChange={(values) => {
          const nextValues = Array.isArray(values)
            ? values.map((value) => String(value))
            : [];
          for (const selected of selectedMultiValues) {
            if (
              selectOptions.find((option) => option.value === selected)
                ?.disabled &&
              !nextValues.includes(selected)
            ) {
              nextValues.push(selected);
            }
          }
          updateDraftValue(nextValues.map(optionControlValue));
        }}
        value={selectedMultiValues}
      >
        <ComboboxChips
          className="h-[var(--yayaw-inline-control-height,2rem)] min-h-[var(--yayaw-inline-control-height,2rem)] w-full flex-nowrap overflow-hidden py-0"
          ref={multiSelectAnchorRef}
        >
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {selectedMultiValues.map((selectedValue) => (
              <ComboboxChip
                className="shrink-0"
                showRemove={
                  !selectOptions.find(
                    (option) => option.value === selectedValue
                  )?.disabled
                }
                key={selectedValue}
              >
                {getOptionLabel(selectedValue)}
              </ComboboxChip>
            ))}
          </div>
          <ComboboxChipsInput
            aria-label={
              typeof cell.column.columnDef.header === "string"
                ? cell.column.columnDef.header
                : cell.column.id
            }
            ref={focusEditor}
            className="h-6 min-w-16"
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelEditing();
              } else if (event.key === "Enter") {
                event.stopPropagation();
                if (
                  !event.currentTarget.getAttribute("aria-activedescendant")
                ) {
                  event.preventDefault();
                  commitAndClose().catch(() => undefined);
                }
              }
            }}
            placeholder={
              selectedMultiValues.length === 0
                ? t("inline.select_no_options")
                : undefined
            }
          />
        </ComboboxChips>
        <ComboboxContent anchor={multiSelectAnchorRef}>
          <ComboboxEmpty>{t("filters.noResults")}</ComboboxEmpty>
          <ComboboxList>
            {(value: string) => (
              <ComboboxItem
                disabled={
                  selectOptions.find((option) => option.value === value)
                    ?.disabled
                }
                key={value}
                value={value}
              >
                {getOptionLabel(value)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  }, [
    cancelEditing,
    commitAndClose,
    cell.column.columnDef.header,
    cell.column.id,
    focusEditor,
    getOptionLabel,
    multiSelectAnchorRef,
    selectOptions,
    selectedMultiValues,
    t,
    updateDraftValue,
  ]);

  const renderInputEditor = useCallback(() => {
    let inputType = "text";
    if (resolvedEditor === "number") {
      inputType = "number";
    } else if (resolvedEditor === "date") {
      inputType = "date";
    } else if (resolvedEditor === "datetime") {
      inputType = "datetime-local";
    } else if (resolvedEditor === "url") {
      inputType = "url";
    }

    return (
      <Input
        ref={focusEditor}
        className={cn(
          // Cell editors keep the density text size of the cell they replace.
          "h-8 py-1 text-[length:inherit] md:text-[length:inherit]",
          resolvedEditor === "number" && "text-right"
        )}
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
    focusEditor,
    handleEditorBlur,
    handleEditorKeyDown,
    resolvedEditor,
    updateDraftValue,
  ]);

  const renderLocationEditor = () => (
    <div className="relative">
      <div className="min-h-8 px-0.5 py-1" ref={setLocationAnchor}>
        {displayValue}
      </div>
      {/* Mounted once its cell is known: it floats under that cell. */}
      {locationAnchor ? (
        <LocationEditor
          anchor={locationAnchor}
          autoFocus
          floating
          label={
            typeof cell.column.columnDef.header === "string"
              ? cell.column.columnDef.header
              : cell.column.id
          }
          onCancel={cancelEditing}
          onChange={(value) => updateDraftValue(value, { disableAutoSave: true })}
          onInvalidDraft={(draft) => updateDraftValue(draft, { disableAutoSave: true })}
          onDone={() => {
            commitAndClose().catch(() => undefined);
          }}
          onFocusLeave={() => {
            commitAndClose().catch(() => undefined);
          }}
          value={editorValue}
        />
      ) : null}
    </div>
  );

  const [locationAnchor, setLocationAnchor] = useState<HTMLDivElement | null>(
    null
  );

  const renderTagEditor = () => {
    if (!(tagCatalog && tagColumn)) {
      return null;
    }
    const columnId = tagColumn.columnId;
    return (
      <TagPicker
        coloredTags={tagCatalog.coloredTags(columnId)}
        label={
          typeof cell.column.columnDef.header === "string"
            ? cell.column.columnDef.header
            : cell.column.id
        }
        labels={tagCatalog.labels}
        loadError={tagCatalog.status(columnId) === "error"}
        mode="cell"
        multiple={tagColumn.multiple}
        onCancel={cancelEditing}
        onChange={(next) => updateDraftValue(next)}
        onCommit={() => {
          commitAndClose().catch(() => undefined);
        }}
        onCreate={
          tagCatalog.canCreate(columnId)
            ? (name) => tagCatalog.create(columnId, name)
            : undefined
        }
        onRetry={() => {
          tagCatalog.reload(columnId).catch(() => undefined);
        }}
        tags={tagCatalog.tags(columnId)}
        value={editorValue}
      />
    );
  };

  const renderEditor = () => {
    if (tagColumn) {
      return renderTagEditor();
    }
    if (resolvedEditor === "location") {
      return renderLocationEditor();
    }
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

  const editorIcon = inlineEditorIcon(resolvedEditor, {
    tags: Boolean(tagColumn),
  });

  return (
    <div className="relative w-full">
      {isEditing ? (
        renderEditor()
      ) : (
        <TableTooltip label={t("inline.edit_hint")}>
          <button
            className={cn(
              "group/inline relative flex min-h-8 w-full cursor-pointer items-center rounded-sm px-0.5 py-1 outline-none",
              resolvedEditor === "number"
                ? "justify-end text-right"
                : "justify-start text-left",
              // The field outline tells which cells edit in place, on the row's hover tint too.
              "hover:bg-background hover:shadow-[inset_0_0_0_1px_var(--border)]",
              "focus-visible:ring-2 focus-visible:ring-primary/30"
            )}
            data-density-control=""
            data-inline-editor={resolvedEditor}
            onClick={(event) => {
              event.stopPropagation();
              if (!isLinkClick(event.target)) {
                startEditing();
                // A boolean cell toggles on the click that opens it, as its switch would.
                if (resolvedEditor === "boolean" && !isSaving) {
                  updateDraftValue(!draftValue);
                }
              }
            }}
            onKeyDown={handleDisplayKeyDown}
            type="button"
          >
            {displayValue}
            <InlineEditorIconChip
              icon={editorIcon}
              placement={resolvedEditor === "number" ? "start" : "end"}
            />
          </button>
        </TableTooltip>
      )}

      {isSaving && (
        <span aria-live="polite" className="sr-only">
          {t("inline.saving")}
        </span>
      )}

      {inlineConfig.showDelayIndicator &&
        (isSaving || (isDirty && scheduledAt != null)) && (
          <div
            className="absolute right-0 bottom-0 left-0 h-[2px] overflow-hidden rounded-full bg-muted"
            title={t(isSaving ? "inline.saving" : "inline.save_scheduled")}
          >
            <div
              className={cn(
                "h-full bg-primary transition-[width] duration-75 motion-reduce:transition-none",
                isSaving && "animate-pulse motion-reduce:animate-none"
              )}
              style={{ width: `${isSaving ? 100 : delayProgress}%` }}
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
