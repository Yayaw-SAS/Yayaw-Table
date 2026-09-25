/**
 * The user's order of saved views, shared by the React and Vue editions. It
 * applies to the view tabs, the "More views" list and the view menu; the view
 * menu moves the current view one step at a time.
 *
 * System views and the default view (`isDefault`, such as a screen's default)
 * keep their place first, in their list order. The user orders the others.
 * Views the order does not name (new ones) come last, in their list order.
 *
 * Server-safe: a host may sort its `list` answer with `orderViews` too.
 */

/** What the order reads from a saved view. */
export interface OrderableView {
  id: string;
  isDefault?: boolean;
  isSystem?: boolean;
}

/** `previous` moves a view left (tabs) or up (lists), `next` right or down. */
export type ViewMoveDirection = "previous" | "next";

/** Where the current view can move; see `viewMoves`. */
export interface ViewMoves {
  previous: boolean;
  next: boolean;
}

/** The table context the order belongs to, as for the favorite. */
export interface ViewOrderContext {
  tableId: string;
  tableType?: string;
}

/** Storage the order falls back to without `actions.views.setOrder`. */
export interface ViewOrderStorage {
  getItem: (key: string) => null | string;
  setItem: (key: string, value: string) => void;
}

/** Whether the user orders this view: system and default views keep their place. */
export function isOrderableView(view: OrderableView): boolean {
  return !(view.isSystem === true || view.isDefault === true);
}

/** View ids from an order, a stored value or a host answer; `undefined` otherwise. */
export function parseViewOrder(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }
  const ids = value.filter((id): id is string => typeof id === "string");
  return [...new Set(ids)];
}

/** The views in the user's order (see the module comment). */
export function orderViews<T extends OrderableView>(
  views: readonly T[],
  order?: readonly string[] | null
): T[] {
  const fixed = views.filter((view) => !isOrderableView(view));
  const orderable = views.filter(isOrderableView);
  const position = new Map<string, number>();
  for (const id of order ?? []) {
    if (!position.has(id)) {
      position.set(id, position.size);
    }
  }
  const named = orderable
    .filter((view) => position.has(view.id))
    .sort(
      (left, right) =>
        (position.get(left.id) ?? 0) - (position.get(right.id) ?? 0)
    );
  const unnamed = orderable.filter((view) => !position.has(view.id));
  return [...fixed, ...named, ...unnamed];
}

/** Ids of the views the user orders, first to last: what `setOrder` receives. */
export function orderableViewIds(views: readonly OrderableView[]): string[] {
  return views.filter(isOrderableView).map((view) => view.id);
}

/**
 * Where a view can move among `views` (in the user's order): `undefined` when
 * it keeps its place, is not listed or has no other view to swap with.
 */
export function viewMoves(
  views: readonly OrderableView[],
  id: string | null | undefined
): ViewMoves | undefined {
  const ids = orderableViewIds(views);
  const index = id ? ids.indexOf(id) : -1;
  if (index < 0 || ids.length < 2) {
    return;
  }
  return { previous: index > 0, next: index < ids.length - 1 };
}

/**
 * The order after moving a view one step (the `viewIds` for `setOrder`), or
 * `undefined` when it cannot move that way.
 */
export function moveViewInOrder(
  views: readonly OrderableView[],
  id: string,
  direction: ViewMoveDirection
): string[] | undefined {
  const moves = viewMoves(views, id);
  if (!moves?.[direction]) {
    return;
  }
  const ids = orderableViewIds(views);
  const index = ids.indexOf(id);
  ids.splice(index, 1);
  ids.splice(direction === "previous" ? index - 1 : index + 1, 0, id);
  return ids;
}

/**
 * A view's place as people see it, counting the table's default view (always
 * the first tab and the first entry of the view menu) before the saved views.
 */
export function viewPosition(
  views: readonly OrderableView[],
  id: string
): { position: number; count: number } | undefined {
  const index = views.findIndex((view) => view.id === id);
  return index < 0
    ? undefined
    : { position: index + 2, count: views.length + 1 };
}

/** The move announcement: `{name}`, `{position}` and `{count}` in `template`. */
export function formatViewMove(
  template: string,
  values: { name: string; position: number; count: number }
): string {
  return template
    .replaceAll("{name}", () => values.name)
    .replaceAll("{position}", String(values.position))
    .replaceAll("{count}", String(values.count));
}

/**
 * The order a view `list` answers with: its `order` field, else the order of
 * the views it lists when the host keeps the order (`hostKeepsOrder`).
 */
export function listedViewOrder(
  answer: unknown,
  hostKeepsOrder: boolean
): string[] | undefined {
  const record =
    answer !== null && typeof answer === "object" && !Array.isArray(answer)
      ? (answer as { data?: unknown; order?: unknown })
      : undefined;
  const order = parseViewOrder(record?.order);
  if (order || !hostKeepsOrder) {
    return order;
  }
  const views = Array.isArray(answer) ? answer : record?.data;
  return Array.isArray(views)
    ? parseViewOrder(
        views.map((view: unknown) =>
          view !== null && typeof view === "object"
            ? (view as { id?: unknown }).id
            : undefined
        )
      )
    : undefined;
}

/** localStorage key of the order without `setOrder`: per table type and table id, like the favorite. */
export function getTableViewOrderStorageKey(context: ViewOrderContext): string {
  return `yayaw-table-view-order:${JSON.stringify([context.tableType ?? "", context.tableId])}`;
}

/** The order stored for a table, `undefined` when none or unreadable. */
export function readStoredViewOrder(
  storage: ViewOrderStorage | undefined,
  context: ViewOrderContext
): string[] | undefined {
  try {
    const raw = storage?.getItem(getTableViewOrderStorageKey(context));
    return raw ? parseViewOrder(JSON.parse(raw)) : undefined;
  } catch {
    return;
  }
}

/** Stores a table's order; `false` when the storage refuses it. */
export function storeViewOrder(
  storage: ViewOrderStorage | undefined,
  context: ViewOrderContext,
  viewIds: readonly string[]
): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(
      getTableViewOrderStorageKey(context),
      JSON.stringify([...viewIds])
    );
    return true;
  } catch {
    return false;
  }
}
