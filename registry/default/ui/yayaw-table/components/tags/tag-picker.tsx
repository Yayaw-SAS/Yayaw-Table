"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Loader2, Plus, XIcon } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  cleanTagName,
  filterTags,
  findTagByName,
  formatTagLabel,
  TAG_CREATE_ITEM,
  type TableTag,
  type TagLabels,
  tagCreateName,
  tagIdsOf,
  tagPickerEnter,
  tagValueOf,
  withTagSelected,
} from "../../utils/tag-catalog";
import { TagChip, tagChipProps } from "./tag-chip";

export interface TagPickerProps {
  /** The catalog to pick from. */
  tags: readonly TableTag[];
  /** Tag ids: a list, or one id when `multiple` is false. */
  value: unknown;
  multiple: boolean;
  onChange: (value: unknown) => void;
  /** Creates a tag from what was typed ("Create “name”"); none without it. */
  onCreate?: (name: string) => Promise<TableTag>;
  labels: TagLabels;
  /** Accessible name of the input. */
  label: string;
  coloredTags?: boolean;
  disabled?: boolean;
  /**
   * `cell`: an inline editor, open at once; Enter or leaving commits, Escape
   * cancels. `field`: a form control that opens on demand.
   */
  mode?: "cell" | "field";
  onCommit?: () => void;
  onCancel?: () => void;
  /** Numbers shown next to tags (records using them). */
  counts?: Readonly<Record<string, number>>;
  /** The catalog could not load: shown with a Retry button. */
  loadError?: boolean;
  onRetry?: () => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  className?: string;
}

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

const NAVIGATION_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
]);

/** What the list says above its tags: creating, a failure, a catalog that did not load. */
function TagPickerStatus({
  creating,
  error,
  labels,
  loadError,
  onRetry,
}: {
  creating?: string;
  error?: string;
  labels: TagLabels;
  loadError?: boolean;
  onRetry?: () => void;
}) {
  if (!(creating || error || loadError)) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 px-2 pt-2 text-xs">
      {loadError ? (
        <p className="flex items-center gap-2 text-destructive" role="alert">
          {labels.loadError}
          {onRetry ? (
            <button
              className="underline underline-offset-2"
              onClick={onRetry}
              type="button"
            >
              {labels.retry}
            </button>
          ) : null}
        </p>
      ) : null}
      {creating ? (
        <output className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          {labels.creating}
        </output>
      ) : null}
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A selected tag: its name on its color, and a button that removes it. */
function TagPickerChip({
  coloredTags,
  disabled,
  labels,
  tag,
}: {
  coloredTags?: boolean;
  disabled?: boolean;
  labels: TagLabels;
  tag: TableTag;
}) {
  const chip = tagChipProps({ color: tag.color, coloredTags, id: tag.id });
  return (
    <ComboboxPrimitive.Chip
      {...chip}
      className={cn(
        chip.className,
        "flex h-[calc(--spacing(5.5))] max-w-full shrink-0 items-center gap-1 rounded-md px-1.5 text-xs"
      )}
      data-tag-id={tag.id}
    >
      <span className="truncate">{tag.name}</span>
      {disabled ? null : (
        <ComboboxPrimitive.ChipRemove
          aria-label={formatTagLabel(labels.removeTag, { name: tag.name })}
          className="-mr-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm opacity-60 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon aria-hidden="true" className="size-3" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  );
}

/** A tag of the list, with its count, or "Create “name”". */
function TagPickerItem({
  coloredTags,
  count,
  createLabel,
  creating,
  item,
  tag,
}: {
  coloredTags?: boolean;
  count?: number;
  createLabel: string;
  creating: boolean;
  item: string;
  tag: TableTag;
}) {
  if (item === TAG_CREATE_ITEM) {
    return (
      <ComboboxItem data-tag-create="" disabled={creating} value={item}>
        <Plus aria-hidden="true" className="size-4" />
        <span className="truncate">{createLabel}</span>
      </ComboboxItem>
    );
  }
  return (
    <ComboboxItem value={item}>
      <TagChip
        color={tag.color}
        coloredTags={coloredTags}
        id={tag.id}
        name={tag.name}
      />
      {count === undefined ? null : (
        <span className="ml-auto text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      )}
    </ComboboxItem>
  );
}

/**
 * Picks tags from a catalog: colored chips, search by name (without case or
 * accents) and "Create “name”" when nothing has that name. Arrow keys move in
 * the list, Enter picks, Backspace removes the last chip.
 */
export function TagPicker({
  className,
  coloredTags,
  counts,
  describedBy,
  disabled,
  id,
  invalid,
  label,
  labels,
  loadError,
  mode = "field",
  multiple,
  onCancel,
  onChange,
  onCommit,
  onCreate,
  onRetry,
  placeholder,
  tags,
  value,
}: TagPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(mode === "cell");
  const [creating, setCreating] = useState<string>();
  const [error, setError] = useState<string>();
  const anchor = useComboboxAnchor();
  const latestValue = useRef(value);
  latestValue.current = value;
  const pendingCreate = useRef<Promise<void> | undefined>(undefined);
  // Enter picks the highlighted tag only after typing or moving in the list.
  const navigated = useRef(false);
  const selected = useMemo(() => tagIdsOf(value), [value]);
  const byId = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const tagOf = useCallback(
    (tagId: string): TableTag => byId.get(tagId) ?? { id: tagId, name: tagId },
    [byId]
  );
  const createName =
    onCreate && !creating ? tagCreateName(query, tags) : undefined;
  const items = useMemo(() => {
    const ids = tags.map((tag) => tag.id);
    for (const tagId of selected) {
      if (!byId.has(tagId)) {
        ids.push(tagId);
      }
    }
    return createName ? [...ids, TAG_CREATE_ITEM] : ids;
  }, [byId, createName, selected, tags]);
  const filteredItems = useMemo(() => {
    const found = filterTags(tags, query).map((tag) => tag.id);
    return createName ? [...found, TAG_CREATE_ITEM] : found;
  }, [createName, query, tags]);
  const createLabel = formatTagLabel(labels.create, {
    name: cleanTagName(query),
  });

  const finish = useCallback(async () => {
    await pendingCreate.current;
    onCommit?.();
  }, [onCommit]);

  const create = useCallback(() => {
    const name = tagCreateName(query, tags);
    if (!(name && onCreate) || pendingCreate.current) {
      return;
    }
    setCreating(name);
    setError(undefined);
    const run = onCreate(name)
      .then((tag) => {
        const next = withTagSelected(latestValue.current, tag.id, multiple);
        latestValue.current = next;
        onChange(next);
        setQuery("");
        if (!multiple && mode === "cell") {
          onCommit?.();
        }
      })
      .catch((cause) => {
        setError(errorMessage(cause));
      })
      .finally(() => {
        setCreating(undefined);
        pendingCreate.current = undefined;
      });
    pendingCreate.current = run;
  }, [mode, multiple, onChange, onCommit, onCreate, query, tags]);

  const handleValueChange = (next: string[]) => {
    navigated.current = false;
    const ids = Array.isArray(next) ? next : [];
    if (ids.includes(TAG_CREATE_ITEM)) {
      create();
      return;
    }
    setError(undefined);
    setQuery("");
    if (multiple) {
      onChange(tagValueOf(ids, true));
      return;
    }
    const added = ids.find((tagId) => !selected.includes(tagId));
    onChange(tagValueOf(added ? [added] : [], false));
    if (added && mode === "cell") {
      finish().catch(() => undefined);
    }
  };

  const handleOpenChange = (
    nextOpen: boolean,
    details: { reason?: string }
  ) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    // Picking keeps the list open to pick more.
    if (details.reason === "item-press" || details.reason === "input-clear") {
      return;
    }
    if (mode === "cell") {
      if (details.reason === "escape-key") {
        onCancel?.();
      } else {
        finish().catch(() => undefined);
      }
      return;
    }
    setOpen(false);
    setQuery("");
  };

  const pickTyped = () => {
    const existing = findTagByName(tags, query);
    if (!existing) {
      create();
      return;
    }
    handleValueChange(
      selected.includes(existing.id) ? selected : [...selected, existing.id]
    );
  };

  const handleEnter = (
    event: KeyboardEvent<HTMLInputElement> & {
      preventBaseUIHandler?: () => void;
    }
  ) => {
    if (mode === "cell") {
      event.stopPropagation();
    }
    const action = tagPickerEnter({
      query,
      navigated: navigated.current,
      highlighted: Boolean(
        event.currentTarget.getAttribute("aria-activedescendant")
      ),
    });
    if (action === "highlighted") {
      return;
    }
    event.preventDefault();
    event.preventBaseUIHandler?.();
    if (action === "typed") {
      pickTyped();
    } else if (mode === "cell") {
      finish().catch(() => undefined);
    } else {
      setOpen(false);
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement> & {
      preventBaseUIHandler?: () => void;
    }
  ) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (NAVIGATION_KEYS.has(event.key)) {
      navigated.current = true;
    } else if (event.key === "Escape" && mode === "cell") {
      event.preventDefault();
      event.stopPropagation();
      onCancel?.();
    } else if (event.key === "Enter") {
      handleEnter(event);
    }
  };

  const emptyPlaceholder =
    placeholder ?? (onCreate ? labels.search : labels.searchOnly);
  const status = (
    <TagPickerStatus
      creating={creating}
      error={error}
      labels={labels}
      loadError={loadError}
      onRetry={onRetry}
    />
  );

  return (
    <div className={cn("relative w-full", className)} data-tag-picker="">
      <Combobox
        autoHighlight
        disabled={disabled}
        filteredItems={filteredItems}
        inputValue={query}
        items={items}
        itemToStringLabel={(item: string) =>
          item === TAG_CREATE_ITEM ? createLabel : tagOf(item).name
        }
        multiple
        onInputValueChange={(next: string) => {
          navigated.current = false;
          setQuery(next);
        }}
        onOpenChange={handleOpenChange}
        onValueChange={handleValueChange}
        open={open}
        value={selected}
      >
        <ComboboxChips
          aria-invalid={invalid || undefined}
          className={cn(
            "w-full",
            mode === "cell" &&
              "min-h-[var(--yayaw-inline-control-height,2rem)] py-0.5"
          )}
          ref={anchor}
        >
          {selected.map((tagId) => (
            <TagPickerChip
              coloredTags={coloredTags}
              disabled={disabled}
              key={tagId}
              labels={labels}
              tag={tagOf(tagId)}
            />
          ))}
          <ComboboxChipsInput
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={label}
            autoFocus={mode === "cell"}
            className="h-6 min-w-16 bg-transparent text-sm"
            id={id}
            onKeyDown={handleKeyDown}
            placeholder={selected.length ? undefined : emptyPlaceholder}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          {status}
          <ComboboxEmpty>
            {tags.length ? labels.noMatch : labels.noTags}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <TagPickerItem
                coloredTags={coloredTags}
                count={counts?.[item]}
                createLabel={createLabel}
                creating={Boolean(creating)}
                item={item}
                key={item}
                tag={tagOf(item)}
              />
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {mode === "field" && !open ? status : null}
    </div>
  );
}
