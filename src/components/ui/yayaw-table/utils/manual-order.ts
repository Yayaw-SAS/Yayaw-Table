/**
 * Manual order belongs to a view, not to the records: the host stores one
 * order per view and sorts by it when a list request uses this sort id.
 */
export const MANUAL_ORDER_SORT_ID = "__manual";

export interface ManualOrderMove {
  /** Saved view whose order changes; `null` is the table's default view. */
  viewId: string | null;
  id: string;
  /** Row now directly above the moved row, if any. */
  previousId?: string;
  /** Row now directly below the moved row, if any. */
  nextId?: string;
}

export function isManualOrder(sorting: unknown): boolean {
  return (
    Array.isArray(sorting) &&
    sorting.some(
      (sort) =>
        typeof sort === "object" &&
        sort !== null &&
        (sort as { id?: unknown }).id === MANUAL_ORDER_SORT_ID
    )
  );
}

/** Sorting a view by its manual order replaces every other sort. */
export const manualOrderSorting = () => [
  { id: MANUAL_ORDER_SORT_ID, desc: false },
];

/** Add the view identity a host needs to apply the view's own order. */
export function withManualOrderView<T extends Record<string, unknown>>(
  params: T,
  sorting: unknown,
  viewId: string | null | undefined
): T & { viewId?: string | null } {
  return isManualOrder(sorting)
    ? { ...params, viewId: viewId ?? null }
    : params;
}

/** The order after moving `id` to `toIndex`, and its new neighbours. */
export function moveInOrder(
  ids: readonly string[],
  id: string,
  toIndex: number
): { ids: string[]; previousId?: string; nextId?: string } | undefined {
  const from = ids.indexOf(id);
  if (from === -1) {
    return;
  }
  const next = ids.filter((item) => item !== id);
  const index = Math.max(0, Math.min(toIndex, next.length));
  if (index === from) {
    return;
  }
  next.splice(index, 0, id);
  return { ids: next, previousId: next[index - 1], nextId: next[index + 1] };
}
