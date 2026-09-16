import { type RefObject, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { createActivityUndo } from "../utils/activity-shortcuts";
import {
  type DetailRecord,
  type DetailRevertHandler,
  detailLabels,
  type RecordDetailsConfig,
} from "../utils/record-details";
import { registerSelectionShortcuts } from "../utils/selection-shortcuts";

export function useSelectionShortcuts(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  selectAll: (() => Promise<void>) | undefined,
  undo?: () => Promise<void>
): void {
  const latest = useRef({ enabled, selectAll, undo });
  latest.current = { enabled, selectAll, undo };
  useEffect(() => {
    if (!root.current) {
      return;
    }
    return registerSelectionShortcuts({
      root: root.current,
      enabled: () => latest.current.enabled,
      get selectAll() {
        return latest.current.selectAll
          ? () => {
              return latest.current.selectAll?.();
            }
          : undefined;
      },
      get undo() {
        return latest.current.undo
          ? () => {
              return latest.current.undo?.();
            }
          : undefined;
      },
    });
  }, [root]);
}

export function useTableActivityShortcuts(
  root: RefObject<HTMLElement | null>,
  state: {
    details?: RecordDetailsConfig;
    onRevertActivity?: DetailRevertHandler;
    rows: readonly DetailRecord[];
    refetch: () => Promise<unknown>;
    locale: string;
    selectAll?: () => Promise<void>;
    enableRowSelection: boolean;
    enableMultiRowSelection: boolean;
  }
): void {
  const undoState = useRef(state);
  undoState.current = state;
  const activityUndo = useMemo(
    () =>
      createActivityUndo({
        config: () => undoState.current.details,
        handler: () => undoState.current.onRevertActivity,
        rows: () => undoState.current.rows,
        onReverted: async () => {
          await undoState.current.refetch();
        },
        onError: (error) =>
          toast.error(
            error ?? detailLabels(undoState.current.locale).undoError
          ),
        onUnavailable: () =>
          toast.info(detailLabels(undoState.current.locale).undoUnavailable),
      }),
    []
  );
  useSelectionShortcuts(
    root,
    true,
    state.enableRowSelection && state.enableMultiRowSelection
      ? state.selectAll
      : undefined,
    state.onRevertActivity ? activityUndo.undo : undefined
  );
}
