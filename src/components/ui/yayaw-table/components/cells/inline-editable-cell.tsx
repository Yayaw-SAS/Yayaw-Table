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
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import type { InlineEditOption } from "../../config/helpers";
import type { AnyFieldDefinition, FormSelectOption } from "../forms/types";
import { LocationEditor } from "../location/location-editor";
import { TagPicker } from "../tags/tag-picker";
import { ImageCellEditingContext } from "./image-cell";

/** Server-side choices of a form field with `searchOptions`, already bound to the cell's form context. */
export interface InlineOptionSearch {
  search: (
    query: string,
    signal: AbortSignal
  ) => FormSelectOption[] | Promise<FormSelectOption[]>;
  resolve?: (
    values: unknown[],
    signal: AbortSignal
  ) => FormSelectOption[] | Promise<FormSelectOption[]>;
  /** The field's `createOption`: offered as "Create …" when the search names no existing option. */
  create?: (
    label: string,
    signal: AbortSignal
  ) => FormSelectOption | Promise<FormSelectOption>;
  minLength: number;
  debounceMs: number;
}

/** The list entry that creates an option from the search text. */
const CREATE_OPTION_ITEM = "__yayaw-create-option__";

/** The option `createOption` returned, refused when it has no persisted value. */
function persistedOption(
  option: FormSelectOption | null | undefined
): InlineEditOption {
  if (
    !option ||
    option.value === undefined ||
    option.value === null ||
    option.value === ""
  ) {
    throw new Error("The new option must have a persisted value");
  }
  return { label: option.label, value: option.value };
}

interface InlineEditableCellProps<TData extends Record<string, unknown>> {
  cell: Cell<TData, unknown>;
  inlineConfig: InlineEditColumnRuntimeConfig;
  displayValue: ReactNode;
  rowData: Record<string, unknown>;
  formFieldDefinition?: AnyFieldDefinition;
  schema?: InlineEditValidationSchema;
  optionSearch?: InlineOptionSearch;
  onCommit: (value: unknown) => Promise<InlineEditCommitResult>;
}

const optionKeysOf = (options: readonly InlineEditOption[]) =>
  new Set(options.map((option) => optionControlKey(option.value)));

/** Searched and resolved options stay known, so a choice keeps its label after the next search. */
function rememberOptions(
  known: InlineEditOption[],
  found: readonly InlineEditOption[]
): InlineEditOption[] {
  const keys = optionKeysOf(known);
  const added = found.filter(
    (option) => !keys.has(optionControlKey(option.value))
  );
  return added.length ? [...known, ...added] : known;
}

interface OptionSearchState {
  /** Keys the server returned for the current text; undefined before an answer. */
  matched?: Set<string>;
  remembered: InlineEditOption[];
  searching: boolean;
  error?: string;
}

/** Debounced, cancellable server search for the inline select editors. */
function useInlineOptionSearch(
  optionSearch: InlineOptionSearch | undefined,
  active: boolean,
  query: string,
  selectedValues: unknown[]
) {
  const [state, setState] = useState<OptionSearchState>({
    remembered: [],
    searching: false,
  });
  // Hosts rebuild the search callbacks on each render: requests follow the latest ones without restarting.
  const latest = useRef(optionSearch);
  latest.current = optionSearch;
  const text = query.trim();
  const enabled = Boolean(optionSearch);
  const resolves = Boolean(optionSearch?.resolve);
  const minLength = Math.max(1, optionSearch?.minLength ?? 1);
  const debounceMs = Math.max(0, optionSearch?.debounceMs ?? 0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Labels are resolved once per editing session, for the values it opened with.
  useEffect(() => {
    const resolve = latest.current?.resolve;
    if (!(active && resolve && selectedValues.length)) {
      return;
    }
    const request = new AbortController();
    (async () => {
      try {
        const found = await resolve(selectedValues, request.signal);
        if (!request.signal.aborted) {
          setState((previous) => ({
            ...previous,
            remembered: rememberOptions(previous.remembered, found),
          }));
        }
      } catch {
        // The raw value stays shown; saving does not depend on its label.
      }
    })();
    return () => request.abort();
  }, [active, resolves]);
  useEffect(() => {
    setState((previous) =>
      previous.matched || previous.error || previous.searching
        ? { remembered: previous.remembered, searching: false }
        : previous
    );
    if (!(enabled && active) || text.length < minLength) {
      return;
    }
    const request = new AbortController();
    setState((previous) => ({ ...previous, searching: true }));
    const timer = setTimeout(async () => {
      const search = latest.current?.search;
      if (!search) {
        return;
      }
      try {
        const found = await search(text, request.signal);
        if (request.signal.aborted) {
          return;
        }
        setState((previous) => ({
          remembered: rememberOptions(previous.remembered, found),
          matched: optionKeysOf(found),
          searching: false,
        }));
      } catch (cause) {
        if (!request.signal.aborted) {
          setState((previous) => ({
            ...previous,
            searching: false,
            error: cause instanceof Error ? cause.message : String(cause),
          }));
        }
      }
    }, debounceMs);
    return () => {
      request.abort();
      clearTimeout(timer);
    };
  }, [active, debounceMs, enabled, minLength, text]);
  return state;
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
  optionSearch,
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

  // Server results are read at commit time: the commit is created before the search runs.
  const searchedOptions = useRef<InlineEditOption[]>([]);
  const runtimeCommit = useCallback(
    async (draftValue: unknown): Promise<InlineEditCommitResult> => {
      const parsedResult = parseInlineEditValue({
        editor: resolvedEditor,
        rawValue: draftValue,
        options: [...resolvedOptions, ...searchedOptions.current],
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

  const searchesOptions =
    Boolean(optionSearch) &&
    (resolvedEditor === "select" || resolvedEditor === "multiSelect");
  const [searchQuery, setSearchQuery] = useState("");
  // Options created from the search, and the creation in progress.
  const [createdOptions, setCreatedOptions] = useState<InlineEditOption[]>(
    []
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const createRequest = useRef<AbortController | undefined>(undefined);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const focusSearchInput = useCallback((node: HTMLInputElement | null) => {
    searchInput.current = node;
    node?.focus();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Each editing session starts with an empty search.
  useEffect(() => {
    setSearchQuery("");
    setCreatedOptions([]);
    setCreateError(undefined);
    createRequest.current?.abort();
  }, [isEditing]);
  useEffect(() => () => createRequest.current?.abort(), []);
  const openedValues = useMemo(
    () =>
      getEditorCurrentValues(resolvedEditor, cell.getValue())
        .filter((key) => key.length > 0)
        .map(optionControlValue),
    [cell, resolvedEditor]
  );
  const optionSearchState = useInlineOptionSearch(
    searchesOptions ? optionSearch : undefined,
    isEditing,
    searchQuery,
    openedValues
  );
  searchedOptions.current = rememberOptions(
    optionSearchState.remembered,
    createdOptions
  );
  const editorOptions = useMemo(
    () =>
      rememberOptions(
        [...resolvedOptions, ...optionSearchState.remembered],
        createdOptions
      ),
    [createdOptions, optionSearchState.remembered, resolvedOptions]
  );

  const selectOptions = useMemo(() => {
    return normalizeSelectOptions({
      editor: resolvedEditor,
      editorValue,
      options: editorOptions,
    });
  }, [editorOptions, editorValue, resolvedEditor]);

  const multiSelectAnchorRef = useComboboxAnchor();
  const selectedMultiValues = useMemo(() => {
    if (resolvedEditor === "select" && searchesOptions) {
      const key = optionControlKey(editorValue);
      return key ? [key] : [];
    }
    if (resolvedEditor !== "multiSelect" || !Array.isArray(editorValue)) {
      return [];
    }

    return editorValue.map(optionControlKey);
  }, [editorValue, resolvedEditor, searchesOptions]);

  // With a server search, the server decides what matches: its results show even when the label lacks the text.
  const { matched } = optionSearchState;
  const filterOption = useCallback(
    (value: string, query: string) =>
      matched?.has(value) === true ||
      (selectOptions.find((option) => option.value === value)?.label ?? value)
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    [matched, selectOptions]
  );
  const createText = searchQuery.trim();
  const createsOption =
    searchesOptions &&
    Boolean(optionSearch?.create) &&
    createText.length > 0 &&
    !optionSearchState.searching &&
    !selectOptions.some(
      (option) =>
        option.label.trim().toLocaleLowerCase() ===
        createText.toLocaleLowerCase()
    );
  const addCreatedOption = useCallback(
    (created: InlineEditOption) => {
      // The commit parses against these options before the next render.
      searchedOptions.current = rememberOptions(searchedOptions.current, [
        created,
      ]);
      setCreatedOptions((previous) => rememberOptions(previous, [created]));
      setSearchQuery("");
      if (resolvedEditor === "select") {
        updateDraftValue(created.value, { disableAutoSave: true });
        commitAndClose().catch(() => undefined);
        return;
      }
      const current = Array.isArray(editorValue) ? editorValue : [];
      updateDraftValue([
        ...current.filter((value) => !Object.is(value, created.value)),
        created.value,
      ]);
      // Back from the app's own form: the editor goes on with the new option chosen.
      searchInput.current?.focus();
    },
    [commitAndClose, editorValue, resolvedEditor, updateDraftValue]
  );
  const createOption = useCallback(async () => {
    const create = optionSearch?.create;
    if (!(create && createText) || creating) {
      return;
    }
    createRequest.current?.abort();
    const request = new AbortController();
    createRequest.current = request;
    setCreating(true);
    setCreateError(undefined);
    try {
      const option = await create(createText, request.signal);
      if (request.signal.aborted) {
        return;
      }
      addCreatedOption(persistedOption(option));
    } catch (cause) {
      if (!request.signal.aborted) {
        setCreateError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (!request.signal.aborted) {
        setCreating(false);
      }
    }
  }, [addCreatedOption, createText, creating, optionSearch?.create]);
  const searchStatus = (() => {
    if (optionSearchState.error) {
      return optionSearchState.error;
    }
    return optionSearchState.searching
      ? t("loading")
      : t("filters.noResults");
  })();

  const getOptionLabel = useCallback(
    (optionValue: string): string => {
      if (optionValue === CREATE_OPTION_ITEM) {
        return creating
          ? t("loading")
          : t("inline.create_option", { label: createText });
      }
      const matchingOption = selectOptions.find(
        (option) => option.value === optionValue
      );
      return matchingOption?.label ?? optionValue;
    },
    [createText, creating, selectOptions, t]
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

  /** The chips list's new selection, a searched single select committing its one choice. */
  const chooseValues = useCallback(
    (values: unknown) => {
      const nextValues = Array.isArray(values)
        ? values.map((value) => String(value))
        : [];
      if (resolvedEditor === "select") {
        const chosen = nextValues.find(
          (value) => !selectedMultiValues.includes(value)
        );
        updateDraftValue(
          chosen === undefined ? "" : optionControlValue(chosen),
          { disableAutoSave: true }
        );
        // A single choice is the whole edit, as with a select.
        commitAndClose().catch(() => undefined);
        return;
      }
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
    },
    [
      commitAndClose,
      resolvedEditor,
      selectOptions,
      selectedMultiValues,
      updateDraftValue,
    ]
  );

  const renderMultiSelectEditor = useCallback(() => {
    return (
      <Combobox
        open
        multiple
        items={[
          ...selectOptions.map((option) => option.value),
          ...(createsOption ? [CREATE_OPTION_ITEM] : []),
        ]}
        itemToStringLabel={getOptionLabel}
        {...(searchesOptions
          ? {
              filter: (value: string, query: string) =>
                value === CREATE_OPTION_ITEM || filterOption(value, query),
              inputValue: searchQuery,
              onInputValueChange: (value: string) => setSearchQuery(value),
            }
          : {})}
        onOpenChange={(open, details) => {
          // A pressed choice keeps the list open; the value change commits a single choice.
          if (details.reason === "item-press") {
            return;
          }
          if (details.reason === "escape-key") {
            cancelEditing();
            return;
          }
          // A creation in progress keeps the editor, so the app can show its own form over it.
          if (!(open || creating)) {
            commitAndClose().catch(() => undefined);
          }
        }}
        onValueChange={(values) => {
          if (Array.isArray(values) && values.includes(CREATE_OPTION_ITEM)) {
            createOption().catch(() => undefined);
            return;
          }
          chooseValues(values);
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
            ref={focusSearchInput}
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
          {optionSearchState.error || createError ? (
            <div
              className="px-2 py-2 text-center text-destructive text-sm"
              role="alert"
            >
              {createError ?? optionSearchState.error}
            </div>
          ) : (
            <ComboboxEmpty>{searchStatus}</ComboboxEmpty>
          )}
          <ComboboxList>
            {(value: string) => (
              <ComboboxItem
                disabled={
                  value === CREATE_OPTION_ITEM
                    ? creating
                    : selectOptions.find((option) => option.value === value)
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
    chooseValues,
    createError,
    createOption,
    createsOption,
    creating,
    filterOption,
    focusSearchInput,
    getOptionLabel,
    multiSelectAnchorRef,
    optionSearchState.error,
    searchQuery,
    searchStatus,
    searchesOptions,
    selectOptions,
    selectedMultiValues,
    t,
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
      return searchesOptions
        ? renderMultiSelectEditor()
        : renderSelectEditor();
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
            <ImageCellEditingContext value={true}>
              {displayValue}
            </ImageCellEditingContext>
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
