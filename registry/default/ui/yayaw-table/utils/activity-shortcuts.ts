import {
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

/** Reuse the record activity contract, including records no longer in the visible dataset. */
export function createActivityUndo(options: {
  rows: () => readonly DetailRecord[];
  config: () => RecordDetailsConfig | undefined;
  handler: () => DetailRevertHandler | undefined;
  onReverted: () => Promise<void>;
  onError: (error?: string) => void;
  onUnavailable: () => void;
}): { undo: () => Promise<void> } {
  let pending = false;
  const completed = new Set<string>();
  return {
    undo: async () => {
      const config = options.config();
      const handler = options.handler();
      if (pending || !config || !handler) {
        return;
      }
      const records =
        config.history?.() ??
        options
          .rows()
          .map((row) => ({ row, activity: detailActivity(config, row) }));
      const candidates = activityCandidates(records, config, completed);
      const candidate = candidates.find((item) => item.allowed);
      if (!candidate) {
        options.onUnavailable();
        return;
      }
      const group = candidate.entry.transactionId
        ? candidates.filter(
            (item) =>
              item.entry.transactionId === candidate.entry.transactionId &&
              !item.reverted
          )
        : [candidate];
      if (group.some((item) => !item.allowed)) {
        options.onUnavailable();
        return;
      }
      pending = true;
      try {
        const changed = await revertGroup(
          group,
          handler,
          completed,
          options.onError
        );
        if (changed) {
          await options.onReverted();
        }
      } catch (error) {
        options.onError(errorMessage(error));
      } finally {
        pending = false;
      }
    },
  };
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function activityCandidates(
  records: readonly TableActivityRecord[],
  config: RecordDetailsConfig,
  completed: Set<string>
) {
  return records
    .flatMap(({ row, activity }) => {
      const sorted = [...activity].sort(
        (a, b) => Date.parse(b.at) - Date.parse(a.at)
      );
      return sorted.map((entry) => ({
        row,
        entry,
        reverted:
          completed.has(entry.id) ||
          activity.some((item) => item.reverts === entry.id),
        allowed:
          !completed.has(entry.id) &&
          canRevertDetailActivity(entry, sorted) &&
          config.canRevert?.(entry, row) !== false,
      }));
    })
    .sort((a, b) => Date.parse(b.entry.at) - Date.parse(a.entry.at));
}

async function revertGroup(
  group: ReturnType<typeof activityCandidates>,
  handler: DetailRevertHandler,
  completed: Set<string>,
  onError: (error?: string) => void
): Promise<boolean> {
  let changed = false;
  try {
    for (const item of group) {
      const result = await handler(item.row, item.entry);
      if (!result.success) {
        onError(result.error);
        break;
      }
      completed.add(item.entry.id);
      changed = true;
    }
  } catch (error) {
    onError(errorMessage(error));
  }
  // Partial success must refresh before the remaining members can be retried.
  return changed;
}
