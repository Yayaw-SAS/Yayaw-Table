import { type RefObject, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { createActivityUndo } from "../utils/activity-shortcuts";
import {
  createSelectionDuplicate,
  duplicateLabels,
} from "../utils/duplicate-shortcut";
import {
  type DetailRecord,
  type DetailRevertHandler,
  detailLabels,
  detailRedoMessage,
  detailUndoMessage,
  type RecordDetailsConfig,
} from "../utils/record-details";
import { registerSelectionShortcuts } from "../utils/selection-shortcuts";

export function useSelectionShortcuts(
  root: RefObject<HTMLElement | null>,
  enabled: boolean,
  selectAll: (() => Promise<void>) | undefined,
  undo?: () => Promise<void>,
  duplicate?: () => Promise<void>,
  redo?: () => Promise<void>
): void {
  const latest = useRef({ enabled, selectAll, undo, duplicate, redo });
  latest.current = { enabled, selectAll, undo, duplicate, redo };
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
      get duplicate() {
        return latest.current.duplicate
          ? () => {
              return latest.current.duplicate?.();
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
      get redo() {
        return latest.current.redo
          ? () => {
              return latest.current.redo?.();
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
    onRedoActivity?: DetailRevertHandler;
    rows: readonly DetailRecord[];
    refetch: () => Promise<unknown>;
    locale: string;
    selectAll?: () => Promise<void>;
    duplicateEnabled?: boolean;
    duplicate?: Omit<
      Parameters<typeof createSelectionDuplicate>[0],
      "refresh" | "success" | "error"
    >;
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
        redoHandler: () => undoState.current.onRedoActivity,
        rows: () => undoState.current.rows,
        onReverted: async () => {
          await undoState.current.refetch();
        },
        onSuccess: (entry, kind) => {
          const labels = detailLabels(
            undoState.current.locale,
            undoState.current.details?.labels
          );
          toast.success(
            kind === "undo"
              ? detailUndoMessage(entry, labels)
              : detailRedoMessage(entry, labels)
          );
        },
        onError: (error, kind) => {
          const labels = detailLabels(undoState.current.locale);
          toast.error(
            error ?? (kind === "undo" ? labels.undoError : labels.redoError)
          );
        },
        onUnavailable: (kind) => {
          const labels = detailLabels(undoState.current.locale);
          toast.info(
            kind === "undo" ? labels.undoUnavailable : labels.redoUnavailable
          );
        },
      }),
    []
  );
  const duplicate = useMemo(
    () =>
      createSelectionDuplicate({
        rows: () => undoState.current.duplicate?.rows() ?? [],
        getId: (row) =>
          undoState.current.duplicate?.getId(row) ?? String(row.id),
        canDuplicate: (row) =>
          undoState.current.duplicate?.canDuplicate(row) ?? false,
        action: () => undoState.current.duplicate?.action(),
        refresh: () => undoState.current.refetch(),
        select: (rows) => undoState.current.duplicate?.select(rows),
        success: (count) =>
          toast.success(
            duplicateLabels(undoState.current.locale, count).success
          ),
        error: (error) =>
          toast.error(
            error ?? duplicateLabels(undoState.current.locale, 0).error
          ),
      }),
    []
  );
  useSelectionShortcuts(
    root,
    true,
    state.enableRowSelection && state.enableMultiRowSelection
      ? state.selectAll
      : undefined,
    state.onRevertActivity ? activityUndo.undo : undefined,
    state.duplicateEnabled && state.duplicate?.action() ? duplicate : undefined,
    state.onRedoActivity ? activityUndo.redo : undefined
  );
}
