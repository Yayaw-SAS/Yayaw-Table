/** Keep personal preferences separate from shared and system view records. */
export function getTableFavoriteStorageKey(context: {
  tableId: string;
  tableType?: string;
}): string {
  return `yayaw-table-favorite:${JSON.stringify([context.tableType ?? "", context.tableId])}`;
}

/** Explicit host selection wins; missing favorites fall back to the shared default. */
export function resolveInitialTableView<
  T extends { id: string; isDefault?: boolean },
>(
  views: T[],
  initialViewId?: string,
  favoriteViewId?: string | null
): T | undefined {
  if (initialViewId !== undefined) {
    return views.find((view) => view.id === initialViewId);
  }
  return (
    views.find((view) => view.id === favoriteViewId) ??
    views.find((view) => view.isDefault)
  );
}
