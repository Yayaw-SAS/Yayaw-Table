/**
 * Atoms for column footer calculation state.
 * Stores which calculation type is selected per column, keyed by tableId.
 * Persisted to localStorage so choices survive page reloads.
 */
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { atomFamily } from "jotai-family";

import type { CalculationType } from "../types/footer-types";

export const getColumnCalculationsStorageKey = (tableId: string): string => {
  return `${tableId}-column-calculations`;
};

export const getFooterVisibilityStorageKey = (tableId: string): string => {
  return `${tableId}-footer-visible`;
};

/**
 * Per-table map of columnId → selected CalculationType.
 * Persisted to localStorage with key `${tableId}-column-calculations`.
 */
export const columnCalculationsAtom = atomFamily((tableId: string) =>
  atomWithStorage<Record<string, CalculationType>>(
    getColumnCalculationsStorageKey(tableId),
    {}
  )
);

/**
 * Derived atom: whether any column has an active calculation (not "none").
 * Used to conditionally render the footer row.
 */
export const hasActiveCalculationsAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const calculations = get(columnCalculationsAtom(tableId));
    return Object.values(calculations).some((c) => c !== "none");
  })
);

/**
 * Whether the footer row is visible (user can toggle it independently).
 * Persisted to localStorage.
 */
export const footerVisibleAtom = atomFamily((tableId: string) =>
  atomWithStorage<boolean>(getFooterVisibilityStorageKey(tableId), true)
);
