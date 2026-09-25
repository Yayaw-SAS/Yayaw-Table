"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildBulkEditTargets } from "../../hooks/use-bulk-actions";
import type { TableMutationContext } from "../../providers/table-provider";
import {
  type TagCatalogApi,
  useTagCatalog,
} from "../../providers/tag-catalog-provider";
import type { Row } from "../../tanstack";
import {
  countTagLabel,
  formatTagLabel,
  planTagBulkUpdate,
  type ResolvedTagColumn,
  selectionTagUsage,
  type TagPatch,
} from "../../utils/tag-catalog";
import { bulkCompletion } from "../forms/bulk-form";
import { TagPicker } from "./tag-picker";

export type BulkTagsMode = "add" | "remove";

export interface BulkTagsTarget {
  id: string;
  /** The row's id in the table's selection, when it differs from `id`. */
  selectionId?: string;
  row: Record<string, unknown>;
}

interface MutationResult {
  success: boolean;
  error?: string;
  failedIds?: string[];
}

export interface BulkTagsActions {
  bulkUpdate?: (
    ids: string[],
    data: Record<string, unknown>
  ) => Promise<MutationResult>;
  update?: (
    id: string,
    data: Record<string, unknown>,
    context?: TableMutationContext
  ) => Promise<MutationResult>;
}

interface CachedPayload {
  data?: unknown[];
  [key: string]: unknown;
}

const rowIdOf = (row: unknown): string | undefined => {
  const record = row as Record<string, unknown>;
  const id = record?.id ?? record?._id;
  return id === null || id === undefined ? undefined : String(id);
};

/** Sets the tags field of the cached rows with these ids. */
function setCachedTags(
  queryClient: QueryClient,
  tableId: string,
  field: string,
  values: Record<string, unknown>
) {
  const snapshots = queryClient.getQueriesData<CachedPayload>({
    queryKey: ["tableData", tableId],
  });
  for (const [key, payload] of snapshots) {
    if (!Array.isArray(payload?.data)) {
      continue;
    }
    let changed = false;
    const data = payload.data.map((row) => {
      const id = rowIdOf(row);
      if (id === undefined || !Object.hasOwn(values, id)) {
        return row;
      }
      changed = true;
      return { ...(row as Record<string, unknown>), [field]: values[id] };
    });
    if (changed) {
      queryClient.setQueryData(key, { ...payload, data });
    }
  }
}

/**
 * Shows the rows' new tags at once; answers what puts back the tags of
 * the rows that were not saved.
 */
function patchCachedRows(
  queryClient: QueryClient,
  tableId: string,
  field: string,
  targets: readonly BulkTagsTarget[],
  values: Record<string, unknown>
): (ids: string[]) => void {
  setCachedTags(queryClient, tableId, field, values);
  return (ids) => {
    setCachedTags(
      queryClient,
      tableId,
      field,
      Object.fromEntries(
        targets
          .filter((target) => ids.includes(target.id))
          .map((target) => [target.id, target.row[field]])
      )
    );
  };
}

const errorText = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * The bulk menu's "Add tags" and "Remove tags" and their dialog, for tables
 * with tags columns holding lists, when every selected row can be edited
 * with `bulkUpdate` or `update`.
 */
export function useBulkTags<TData>({
  actions,
  allowBulkEdit,
  canEditRow,
  selectedRows,
}: {
  actions?: BulkTagsActions;
  allowBulkEdit?: boolean;
  canEditRow?: (row: Record<string, unknown>) => boolean;
  selectedRows: Row<TData>[];
}) {
  const catalog = useTagCatalog();
  const columns = useMemo(
    () => catalog?.columns.filter((column) => column.multiple) ?? [],
    [catalog]
  );
  const [open, setOpen] = useState<{
    mode: BulkTagsMode;
    targets: BulkTagsTarget[];
  } | null>(null);
  const available =
    columns.length > 0 &&
    allowBulkEdit !== false &&
    Boolean(actions?.bulkUpdate || actions?.update) &&
    selectedRows.every(
      (row) => canEditRow?.(row.original as Record<string, unknown>) !== false
    );
  const menuActions = useMemo(() => {
    if (!(available && catalog)) {
      return;
    }
    const start = (mode: BulkTagsMode) => () =>
      setOpen({ mode, targets: buildBulkEditTargets(selectedRows) });
    return {
      addLabel: catalog.labels.addTags,
      removeLabel: catalog.labels.removeTags,
      onAdd: start("add"),
      onRemove: start("remove"),
    };
  }, [available, catalog, selectedRows]);
  const dialog =
    catalog && columns.length
      ? {
          catalog,
          columns,
          mode: open?.mode ?? null,
          targets: open?.targets ?? [],
          onClose: () => setOpen(null),
        }
      : undefined;
  return { menuActions, dialog };
}

/** Runs a bulk tag plan; answers the ids that were not saved and the first error. */
async function runBulkTagPlan({
  actions,
  column,
  plan,
  targets,
}: {
  actions: BulkTagsActions;
  column: ResolvedTagColumn;
  plan: ReturnType<typeof planTagBulkUpdate>;
  targets: BulkTagsTarget[];
}): Promise<{ failed: string[]; error?: string }> {
  const failed: string[] = [];
  let error: string | undefined;
  for (const call of plan.calls) {
    if (actions.bulkUpdate) {
      try {
        const result = await actions.bulkUpdate(call.ids, call.patch);
        const progress = bulkCompletion(call.ids, result ?? { success: false });
        failed.push(...progress.remaining);
        if (!result?.success) {
          error ??= result?.error;
        }
      } catch (cause) {
        failed.push(...call.ids);
        error ??= errorText(cause);
      }
      continue;
    }
    // Without bulkUpdate, each row gets its resulting tags through update.
    for (const id of call.ids) {
      try {
        const row = targets.find((target) => target.id === id)?.row ?? {};
        const result = await actions.update?.(
          id,
          { [column.field]: plan.next[id] },
          { row: { ...row } }
        );
        if (!result?.success) {
          failed.push(id);
          error ??= result?.error;
        }
      } catch (cause) {
        failed.push(id);
        error ??= errorText(cause);
      }
    }
  }
  return { failed, error };
}

/**
 * Bulk "Add tags" and "Remove tags": pick tags (create them on the fly when
 * adding), then the selection is patched at once and saved through
 * `bulkUpdate` (see `planTagBulkUpdate`), or `update` row by row. Failed rows
 * are restored and stay selected.
 */
export function BulkTagsDialog({
  actions,
  catalog,
  columns,
  mode,
  onClose,
  onCompleted,
  tableId,
  targets,
}: {
  actions: BulkTagsActions;
  catalog: TagCatalogApi;
  /** Tags columns holding lists, the first one preselected. */
  columns: ResolvedTagColumn[];
  mode: BulkTagsMode | null;
  onClose: () => void;
  /** Rows saved (ids of `targets`); the table deselects them and reloads. */
  onCompleted: (
    ids: string[],
    targets: BulkTagsTarget[]
  ) => Promise<void> | void;
  tableId: string;
  targets: BulkTagsTarget[];
}) {
  const queryClient = useQueryClient();
  const labels = catalog.labels;
  const pickerId = useId();
  const [columnId, setColumnId] = useState(columns[0]?.columnId ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const open = mode !== null && targets.length > 0;
  useEffect(() => {
    if (open) {
      setPicked([]);
      setColumnId((current) =>
        columns.some((column) => column.columnId === current)
          ? current
          : (columns[0]?.columnId ?? "")
      );
    }
  }, [columns, open]);
  const column = columns.find((item) => item.columnId === columnId);
  const catalogTags = column ? catalog.tags(column.columnId) : [];
  const usage = useMemo(
    () =>
      column && mode === "remove"
        ? selectionTagUsage(
            targets.map((target) => target.row[column.field]),
            catalogTags
          )
        : [],
    [catalogTags, column, mode, targets]
  );
  const count = targets.length;
  const title =
    mode === "remove"
      ? countTagLabel(labels.removeTitleOne, labels.removeTitleMany, count)
      : countTagLabel(labels.addTitleOne, labels.addTitleMany, count);

  const apply = () => {
    if (!(column && mode && picked.length)) {
      return;
    }
    const patch: TagPatch =
      mode === "add" ? { add: picked } : { remove: picked };
    const plan = planTagBulkUpdate({
      rows: targets.map((target) => ({
        id: target.id,
        value: target.row[column.field],
      })),
      field: column.field,
      patch,
      mode: column.bulk,
    });
    const restore = patchCachedRows(
      queryClient,
      tableId,
      column.field,
      targets,
      plan.next
    );
    const selectedTargets = [...targets];
    onClose();
    runBulkTagPlan({ actions, column, plan, targets: selectedTargets })
      .then(async ({ failed, error }) => {
        const completed = selectedTargets
          .map((target) => target.id)
          .filter((id) => !failed.includes(id));
        if (failed.length) {
          restore(failed);
          toast.error(
            error ?? formatTagLabel(labels.bulkFailed, { count: failed.length })
          );
        } else {
          toast.success(
            mode === "add"
              ? countTagLabel(labels.addedOne, labels.addedMany, count)
              : countTagLabel(labels.removedOne, labels.removedMany, count)
          );
        }
        await onCompleted(completed, selectedTargets);
      })
      .catch((cause) => {
        restore(selectedTargets.map((target) => target.id));
        toast.error(errorText(cause));
      });
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      open={open}
    >
      <DialogContent data-bulk-tags={mode ?? undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{labels.chooseTags}</DialogDescription>
        </DialogHeader>
        {columns.length > 1 ? (
          <div className="grid gap-1.5">
            <span className="font-medium text-sm" id={`${pickerId}-column`}>
              {labels.column}
            </span>
            <Select
              items={columns.map((item) => ({
                label: catalog.columnLabel(item.columnId),
                value: item.columnId,
              }))}
              onValueChange={(next) => {
                setColumnId(String(next));
                setPicked([]);
              }}
              value={columnId}
            >
              <SelectTrigger aria-labelledby={`${pickerId}-column`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((item) => (
                  <SelectItem key={item.columnId} value={item.columnId}>
                    {catalog.columnLabel(item.columnId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {column && mode === "remove" && usage.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {labels.noSelectionTags}
          </p>
        ) : null}
        {column && !(mode === "remove" && usage.length === 0) ? (
          <TagPicker
            coloredTags={catalog.coloredTags(column.columnId)}
            counts={
              mode === "remove"
                ? Object.fromEntries(
                    usage.map(({ tag, count: uses }) => [tag.id, uses])
                  )
                : undefined
            }
            key={`${mode}:${column.columnId}`}
            label={labels.chooseTags}
            labels={labels}
            loadError={catalog.status(column.columnId) === "error"}
            multiple
            onChange={(next) => setPicked(next as string[])}
            onCreate={
              mode === "add" && catalog.canCreate(column.columnId)
                ? (name) => catalog.create(column.columnId, name)
                : undefined
            }
            onRetry={() => {
              catalog.reload(column.columnId).catch(() => undefined);
            }}
            tags={mode === "remove" ? usage.map(({ tag }) => tag) : catalogTags}
            value={picked}
          />
        ) : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            {labels.cancel}
          </Button>
          <Button
            disabled={!picked.length}
            onClick={apply}
            type="button"
            variant={mode === "remove" ? "destructive" : "default"}
          >
            {mode === "remove" ? labels.remove : labels.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The bulk tags dialog of a table, when it has tags columns holding lists. */
export function BulkTagsLayer({
  actions,
  dialog,
  onCompleted,
  tableId,
}: {
  actions?: BulkTagsActions;
  dialog: ReturnType<typeof useBulkTags>["dialog"];
  onCompleted: (
    ids: string[],
    targets: BulkTagsTarget[]
  ) => Promise<void> | void;
  tableId: string;
}) {
  if (!dialog) {
    return null;
  }
  return (
    <BulkTagsDialog
      {...dialog}
      actions={actions ?? {}}
      onCompleted={onCompleted}
      tableId={tableId}
    />
  );
}
