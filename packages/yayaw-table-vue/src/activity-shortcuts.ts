import {
  canRedoDetailActivity,
  canRevertDetailActivity,
  type DetailActivity,
  type DetailRecord,
  type DetailRevertHandler,
  detailActivity,
  type RecordDetailsConfig,
} from "./record-details";

export interface TableActivityRecord {
  row: DetailRecord;
  activity: readonly DetailActivity[];
}

export type ActivityShortcut = "undo" | "redo";

/**
 * Reuse the record activity contract, including records no longer in the visible dataset. Undo reverts the
 * newest change; redo re-applies the newest undo through `redoHandler`, until a new change clears it.
 */
export function createActivityUndo(options: {
  rows: () => readonly DetailRecord[];
  config: () => RecordDetailsConfig | undefined;
  handler: () => DetailRevertHandler | undefined;
  redoHandler?: () => DetailRevertHandler | undefined;
  onReverted: () => Promise<void>;
  /** The undone change, or for a redo the change it re-applies. */
  onSuccess?: (entry: DetailActivity, kind: ActivityShortcut) => void;
  onError: (error: string | undefined, kind: ActivityShortcut) => void;
  onUnavailable: (kind: ActivityShortcut) => void;
}): { undo: () => Promise<void>; redo: () => Promise<void> } {
  let pending = false;
  const completed = new Set<string>();
  const run = async (kind: ActivityShortcut): Promise<void> => {
    const config = options.config();
    const handler =
      kind === "undo" ? options.handler() : options.redoHandler?.();
    if (pending || !config || !handler) {
      return;
    }
    const records =
      config.history?.() ??
      options
        .rows()
        .map((row) => ({ row, activity: detailActivity(config, row) }));
    const candidates = activityCandidates(records, config, completed);
    const selected = shortcutGroup(kind, candidates);
    if (!selected) {
      options.onUnavailable(kind);
      return;
    }
    const { candidate, group } = selected;
    pending = true;
    try {
      const changed = await revertGroup(group, handler, completed, (error) =>
        options.onError(error, kind)
      );
      if (changed) {
        await options.onReverted();
      }
      if (changed === group.length) {
        options.onSuccess?.(
          kind === "undo"
            ? candidate.entry
            : redoneChange(candidate, candidates),
          kind
        );
      }
    } catch (error) {
      options.onError(errorMessage(error), kind);
    } finally {
      pending = false;
    }
  };
  return { undo: () => run("undo"), redo: () => run("redo") };
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

const newestFirst = (a: DetailActivity, b: DetailActivity): number =>
  Date.parse(b.at) - Date.parse(a.at);

function activityCandidates(
  records: readonly TableActivityRecord[],
  config: RecordDetailsConfig,
  completed: Set<string>
) {
  return records
    .flatMap(({ row, activity }) => {
      const sorted = [...activity].sort(newestFirst);
      return sorted.map((entry) => {
        const own = config.canRevert?.(entry, row) !== false;
        const open = own && !completed.has(entry.id);
        return {
          row,
          entry,
          own,
          // A change undone, or an undo event redone, already.
          done:
            completed.has(entry.id) ||
            activity.some(
              (item) => item.reverts === entry.id || item.redoes === entry.id
            ),
          undoable: open && canRevertDetailActivity(entry, sorted),
          redoable: open && canRedoDetailActivity(entry, sorted),
        };
      });
    })
    .sort((a, b) => newestFirst(a.entry, b.entry));
}

type Candidate = ReturnType<typeof activityCandidates>[number];

/** The events one shortcut inverts together, or nothing when one of them cannot be inverted. */
function shortcutGroup(
  kind: ActivityShortcut,
  candidates: readonly Candidate[]
): { candidate: Candidate; group: Candidate[] } | undefined {
  const candidate =
    kind === "undo"
      ? candidates.find((item) => item.undoable)
      : nextRedo(candidates);
  if (!candidate) {
    return;
  }
  // Undo events may carry the transaction of the change they invert: each kind groups its own events.
  const group = candidate.entry.transactionId
    ? candidates.filter(
        (item) =>
          item.entry.transactionId === candidate.entry.transactionId &&
          Boolean(item.entry.reverts) === (kind === "redo") &&
          !item.done
      )
    : [candidate];
  const allowed = (item: Candidate) =>
    kind === "undo" ? item.undoable : item.redoable;
  return group.every(allowed) ? { candidate, group } : undefined;
}

/** The newest undo still to redo, unless a newer change of the user's (not a redo) cleared it. */
function nextRedo(candidates: readonly Candidate[]): Candidate | undefined {
  for (const item of candidates) {
    if (!item.own || item.done) {
      continue;
    }
    if (item.entry.reverts) {
      if (item.redoable) {
        return item;
      }
    } else if (!item.entry.redoes) {
      return;
    }
  }
  return;
}

/** The change an undo event inverted, for the success message. */
function redoneChange(
  undo: Candidate,
  candidates: readonly Candidate[]
): DetailActivity {
  return (
    candidates.find((item) => item.entry.id === undo.entry.reverts)?.entry ??
    undo.entry
  );
}

async function revertGroup(
  group: readonly Candidate[],
  handler: DetailRevertHandler,
  completed: Set<string>,
  onError: (error?: string) => void
): Promise<number> {
  let changed = 0;
  try {
    for (const item of group) {
      const result = await handler(item.row, item.entry);
      if (!result.success) {
        onError(result.error);
        break;
      }
      completed.add(item.entry.id);
      changed += 1;
    }
  } catch (error) {
    onError(errorMessage(error));
  }
  // Partial success must refresh before the remaining members can be retried.
  return changed;
}
