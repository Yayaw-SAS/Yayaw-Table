"use client";

import { useRef, useState } from "react";
import {
  canRevertDetailActivity,
  type DetailActivity,
  type DetailLabels,
  type DetailRecord,
  type DetailRevertHandler,
  type RecordDetailsConfig,
} from "../../utils/record-details";

export function useActivityUndo({
  activity,
  row,
  config,
  labels,
  handler,
  onReverted,
}: {
  activity: DetailActivity[];
  row: DetailRecord;
  config: RecordDetailsConfig;
  labels: DetailLabels;
  handler?: DetailRevertHandler;
  onReverted?: (entry: DetailActivity) => void;
}) {
  const [pending, setPending] = useState<string>();
  const pendingRef = useRef(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [error, setError] = useState<{ id: string; message: string }>();
  const isUndone = (entry: DetailActivity) =>
    completed.includes(entry.id) ||
    activity.some((item) => item.reverts === entry.id);
  const canUndo = (entry: DetailActivity) =>
    Boolean(handler) &&
    !isUndone(entry) &&
    canRevertDetailActivity(entry, activity) &&
    config.canRevert?.(entry, row) !== false;
  const undo = async (entry: DetailActivity) => {
    if (!handler || pendingRef.current || !canUndo(entry)) {
      return;
    }
    pendingRef.current = true;
    setPending(entry.id);
    setError(undefined);
    try {
      const result = await handler(row, entry);
      if (!result.success) {
        throw new Error(result.error ?? labels.undoError);
      }
    } catch (cause) {
      setError({
        id: entry.id,
        message: cause instanceof Error ? cause.message : labels.undoError,
      });
      return;
    } finally {
      pendingRef.current = false;
      setPending(undefined);
    }
    setCompleted((items) => [...items, entry.id]);
    onReverted?.(entry);
  };
  return { pending, error, isUndone, canUndo, undo };
}
