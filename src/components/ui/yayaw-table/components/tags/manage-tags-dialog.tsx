"use client";

import { Check, MoreHorizontal, Search } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import type { TagCatalogApi } from "../../providers/tag-catalog-provider";
import {
  cleanTagName,
  countTagLabel,
  filterTags,
  findTagByName,
  formatTagLabel,
  type TableTag,
  type TagLabels,
} from "../../utils/tag-catalog";
import { TAG_COLOR_NAMES, type TagColorName } from "../../utils/tag-colors";
import { TagChip, TagSwatch } from "./tag-chip";

type Confirmation =
  | { kind: "delete"; id: string }
  | { kind: "merge"; id: string; targetId?: string };

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

const COLOR_LABEL_KEYS: Record<TagColorName, keyof TagLabels> = {
  gray: "colorGray",
  brown: "colorBrown",
  orange: "colorOrange",
  yellow: "colorYellow",
  green: "colorGreen",
  blue: "colorBlue",
  purple: "colorPurple",
  pink: "colorPink",
  red: "colorRed",
};

/** "12 records" for the tags "Manage tags" counted. */
function usageText(labels: TagLabels, count: number | undefined) {
  if (count === undefined) {
    return;
  }
  return count === 0
    ? labels.usageNone
    : countTagLabel(labels.usageOne, labels.usageMany, count);
}

/** What deleting a tag does, with the number of records that lose it. */
export function deleteTagDescription(
  labels: TagLabels,
  count: number | undefined,
  counting: boolean
): string {
  if (count === undefined) {
    return counting ? labels.counting : labels.deleteUnknown;
  }
  if (count === 0) {
    return labels.deleteUnused;
  }
  return countTagLabel(labels.deleteUsedOne, labels.deleteUsedMany, count);
}

function TagNameInput({
  disabled,
  labels,
  onRename,
  tag,
  tags,
}: {
  disabled: boolean;
  labels: TagLabels;
  onRename: (name: string) => Promise<void>;
  tag: TableTag;
  tags: readonly TableTag[];
}) {
  const [draft, setDraft] = useState(tag.name);
  const [error, setError] = useState<string>();
  const errorId = useId();
  useEffect(() => setDraft(tag.name), [tag.name]);
  const commit = async () => {
    const name = cleanTagName(draft);
    if (name === tag.name) {
      setDraft(tag.name);
      setError(undefined);
      return;
    }
    if (!name) {
      setError(labels.emptyName);
      return;
    }
    const other = findTagByName(
      tags.filter((item) => item.id !== tag.id),
      name
    );
    if (other) {
      setError(formatTagLabel(labels.duplicateName, { name: other.name }));
      return;
    }
    setError(undefined);
    try {
      await onRename(name);
    } catch (cause) {
      setError(errorText(cause));
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit().catch(() => undefined);
    } else if (event.key === "Escape" && draft !== tag.name) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(tag.name);
      setError(undefined);
    }
  };
  return (
    <div className="min-w-0 flex-1">
      <Input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        aria-label={formatTagLabel(labels.renameTag, { name: tag.name })}
        className="h-8"
        disabled={disabled}
        onBlur={() => {
          commit().catch(() => undefined);
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        value={draft}
      />
      {error ? (
        <p className="mt-1 text-destructive text-xs" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TagColorMenu({
  coloredTags,
  labels,
  onColor,
  tag,
}: {
  coloredTags: boolean;
  labels: TagLabels;
  onColor: (color: string | null) => void;
  tag: TableTag;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={formatTagLabel(labels.colorOf, { name: tag.name })}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <TagSwatch color={tag.color} coloredTags={coloredTags} id={tag.id} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuItem onClick={() => onColor(null)}>
          <TagSwatch coloredTags={coloredTags} id={tag.id} />
          <span className="flex-1">{labels.defaultColor}</span>
          {tag.color ? null : <Check aria-hidden="true" className="size-4" />}
        </DropdownMenuItem>
        {TAG_COLOR_NAMES.map((color) => (
          <DropdownMenuItem key={color} onClick={() => onColor(color)}>
            <TagSwatch color={color} id={tag.id} />
            <span className="flex-1">{labels[COLOR_LABEL_KEYS[color]]}</span>
            {tag.color === color ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConfirmPanel({
  busy,
  catalog,
  columnId,
  confirmation,
  counting,
  counts,
  onCancel,
  onConfirm,
  onTarget,
  tags,
}: {
  busy: boolean;
  catalog: TagCatalogApi;
  columnId: string;
  confirmation: Confirmation;
  counting: boolean;
  counts?: Record<string, number>;
  onCancel: () => void;
  onConfirm: () => void;
  onTarget: (targetId: string) => void;
  tags: readonly TableTag[];
}) {
  const labels = catalog.labels;
  const headingId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  const tag = tags.find((item) => item.id === confirmation.id);
  if (!tag) {
    return null;
  }
  const isMerge = confirmation.kind === "merge";
  const target = isMerge
    ? tags.find((item) => item.id === confirmation.targetId)
    : undefined;
  const others = tags.filter((item) => item.id !== tag.id);
  const coloredTags = catalog.coloredTags(columnId);
  let description: string | undefined;
  if (isMerge) {
    description = target
      ? formatTagLabel(labels.mergeDescription, {
          source: tag.name,
          target: target.name,
        })
      : undefined;
  } else {
    description = deleteTagDescription(labels, counts?.[tag.id], counting);
  }
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-3 rounded-lg border p-3"
      data-tags-confirm={confirmation.kind}
    >
      <h3 className="font-medium text-sm" id={headingId}>
        {isMerge
          ? formatTagLabel(labels.mergeInto, { name: tag.name })
          : formatTagLabel(labels.deleteTitle, { name: tag.name })}
      </h3>
      {isMerge ? (
        <Select
          items={others.map((item) => ({ label: item.name, value: item.id }))}
          onValueChange={(next) => onTarget(String(next))}
          value={confirmation.targetId ?? null}
        >
          <SelectTrigger aria-labelledby={headingId} className="w-full">
            <SelectValue placeholder={labels.searchOnly} />
          </SelectTrigger>
          <SelectContent>
            {others.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                <TagChip
                  color={item.color}
                  coloredTags={coloredTags}
                  id={item.id}
                  name={item.name}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          disabled={busy}
          onClick={onCancel}
          ref={cancelRef}
          type="button"
          variant="outline"
        >
          {labels.cancel}
        </Button>
        <Button
          disabled={busy || (isMerge && !target)}
          onClick={onConfirm}
          type="button"
          variant="destructive"
        >
          {isMerge ? labels.mergeConfirm : labels.delete}
        </Button>
      </div>
    </section>
  );
}

function TagActionsMenu({
  busy,
  canMerge,
  canRemove,
  labels,
  onAsk,
  tag,
}: {
  busy: boolean;
  canMerge: boolean;
  canRemove: boolean;
  labels: TagLabels;
  onAsk: (confirmation: Confirmation) => void;
  tag: TableTag;
}) {
  if (!(canMerge || canRemove)) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={formatTagLabel(labels.tagActions, { name: tag.name })}
            disabled={busy}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canMerge ? (
          <DropdownMenuItem onClick={() => onAsk({ kind: "merge", id: tag.id })}>
            {labels.merge}
          </DropdownMenuItem>
        ) : null}
        {canRemove ? (
          <DropdownMenuItem
            onClick={() => onAsk({ kind: "delete", id: tag.id })}
            variant="destructive"
          >
            {labels.delete}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One tag of "Manage tags": its color, its name, its records and its actions. */
function ManagedTagRow({
  busy,
  catalog,
  columnId,
  count,
  onAsk,
  onColor,
  tag,
}: {
  busy: boolean;
  catalog: TagCatalogApi;
  columnId: string;
  count?: number;
  onAsk: (confirmation: Confirmation) => void;
  onColor: (color: string | null) => void;
  tag: TableTag;
}) {
  const labels = catalog.labels;
  const tags = catalog.tags(columnId);
  const coloredTags = catalog.coloredTags(columnId);
  const canUpdate = catalog.canUpdate(columnId);
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md py-1",
        busy && "opacity-70"
      )}
      data-tag-row={tag.id}
    >
      {canUpdate && coloredTags ? (
        <TagColorMenu
          coloredTags={coloredTags}
          labels={labels}
          onColor={onColor}
          tag={tag}
        />
      ) : null}
      {canUpdate ? (
        <TagNameInput
          disabled={busy}
          labels={labels}
          onRename={(name) =>
            catalog.update(columnId, tag.id, { name }).then(() => {
              toast.success(labels.saved);
            })
          }
          tag={tag}
          tags={tags}
        />
      ) : (
        <span className="min-w-0 flex-1">
          <TagChip
            color={tag.color}
            coloredTags={coloredTags}
            id={tag.id}
            name={tag.name}
          />
        </span>
      )}
      <span className="w-24 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
        {usageText(labels, count)}
      </span>
      <TagActionsMenu
        busy={busy}
        canMerge={catalog.canMerge(columnId) && tags.length > 1}
        canRemove={catalog.canRemove(columnId)}
        labels={labels}
        onAsk={onAsk}
        tag={tag}
      />
    </li>
  );
}

/** The searchable list of a column's tags. */
function ManagedTagList({
  busy,
  catalog,
  columnId,
  counts,
  onAsk,
  onColor,
}: {
  busy: boolean;
  catalog: TagCatalogApi;
  columnId: string;
  counts?: Record<string, number>;
  onAsk: (confirmation: Confirmation) => void;
  onColor: (tag: TableTag, color: string | null) => void;
}) {
  const labels = catalog.labels;
  const tags = catalog.tags(columnId);
  const [query, setQuery] = useState("");
  const visible = filterTags(tags, query);
  const loading = catalog.status(columnId) === "loading";
  let status: string | undefined;
  if (loading) {
    status = labels.loading;
  } else if (catalog.status(columnId) === "error") {
    status = undefined;
  } else if (tags.length === 0) {
    status = labels.noTags;
  } else if (visible.length === 0) {
    status = labels.noMatch;
  }
  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          aria-label={labels.searchOnly}
          className="pl-8"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchOnly}
          type="search"
          value={query}
        />
      </div>
      {catalog.status(columnId) === "error" ? (
        <p className="flex items-center gap-2 text-destructive text-sm" role="alert">
          {labels.loadError}
          <Button
            onClick={() => {
              catalog.reload(columnId).catch(() => undefined);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {labels.retry}
          </Button>
        </p>
      ) : null}
      {status ? (
        <output className="text-muted-foreground text-sm">{status}</output>
      ) : null}
      <ul
        aria-label={labels.tags}
        className="-mx-1 grid max-h-[50vh] gap-1 overflow-y-auto px-1"
      >
        {visible.map((tag) => (
          <ManagedTagRow
            busy={busy}
            catalog={catalog}
            columnId={columnId}
            count={counts ? (counts[tag.id] ?? 0) : undefined}
            key={tag.id}
            onAsk={onAsk}
            onColor={(color) => onColor(tag, color)}
            tag={tag}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * "Manage tags" of a tags column: rename, recolor, merge into another tag
 * and delete (confirmed with the number of records that use the tag, counted
 * with `aggregate`).
 */
export function ManageTagsDialog({
  catalog,
  columnId,
  onOpenChange,
  open,
}: {
  catalog: TagCatalogApi;
  columnId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const labels = catalog.labels;
  const tags = catalog.tags(columnId);
  const [counts, setCounts] = useState<Record<string, number>>();
  const [counting, setCounting] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const loadCounts = useCallback(async () => {
    if (!catalog.canCount) {
      return;
    }
    setCounting(true);
    try {
      setCounts(await catalog.usage(columnId));
    } catch {
      setCounts(undefined);
    } finally {
      setCounting(false);
    }
  }, [catalog, columnId]);
  useEffect(() => {
    if (open) {
      setConfirmation(null);
      setError(undefined);
      loadCounts().catch(() => undefined);
    }
  }, [loadCounts, open]);

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      toast.success(done);
      setConfirmation(null);
      loadCounts().catch(() => undefined);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };
  const confirm = () => {
    if (confirmation?.kind === "merge" && confirmation.targetId) {
      const { id, targetId } = confirmation;
      run(() => catalog.merge(columnId, [id], targetId), labels.merged).catch(
        () => undefined
      );
    } else if (confirmation?.kind === "delete") {
      const { id } = confirmation;
      run(() => catalog.remove(columnId, id), labels.deleted).catch(
        () => undefined
      );
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg" data-manage-tags={columnId}>
        <DialogHeader>
          <DialogTitle>{labels.manageTags}</DialogTitle>
          <DialogDescription>
            {formatTagLabel(labels.manageDescription, {
              column: catalog.columnLabel(columnId),
            })}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {confirmation ? (
          <ConfirmPanel
            busy={busy}
            catalog={catalog}
            columnId={columnId}
            confirmation={confirmation}
            counting={counting}
            counts={counts}
            onCancel={() => setConfirmation(null)}
            onConfirm={confirm}
            onTarget={(targetId) =>
              setConfirmation((current) =>
                current?.kind === "merge" ? { ...current, targetId } : current
              )
            }
            tags={tags}
          />
        ) : (
          <ManagedTagList
            busy={busy}
            catalog={catalog}
            columnId={columnId}
            counts={counts}
            onAsk={setConfirmation}
            onColor={(tag, color) => {
              run(
                () => catalog.update(columnId, tag.id, { color }),
                labels.saved
              ).catch(() => undefined);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
