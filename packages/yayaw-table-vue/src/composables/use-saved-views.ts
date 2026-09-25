import {
  computed,
  nextTick,
  onMounted,
  onScopeDispose,
  ref,
  shallowReactive,
  watch,
} from "vue";
import { useTableContext } from "../context";
import {
  createLocalTableViewActions,
  readLocalTableViewOrder,
  storeLocalTableViewOrder,
} from "../core";
import { cloneFormValue, formValuesEqual } from "../form-runtime";
import { resolveInitialTableView } from "../table-view-favorite";
import type {
  TableDisplayMode,
  TableView,
  TableViewActionResult,
  TableViewConfig,
} from "../types";
import { areViewSettingsEqual } from "../view-menu";
import {
  formatViewMove,
  getTableViewOrderStorageKey,
  listedViewOrder,
  moveViewInOrder,
  orderViews,
  parseViewOrder,
  type ViewMoveDirection,
  viewMoves,
  viewPosition,
} from "../view-order";

/**
 * The orders this browser keeps (no `setOrder`), shared by the managers of one
 * table on a page, as React shares them through its query cache.
 */
const localOrders = shallowReactive(new Map<string, string[] | undefined>());

/** Keep persistence and asynchronous state separate from menu/dialog presentation. */
export function useSavedViews(
  initialViews: () => TableView[],
  enabled: () => boolean = () => true
) {
  const context = useTableContext();
  const fallback = createLocalTableViewActions();
  const actions = computed(() => ({
    getFavorite:
      context.actions.value?.views?.getFavorite ?? fallback.getFavorite,
    setFavorite:
      context.actions.value?.views?.setFavorite ?? fallback.setFavorite,
    list: context.actions.value?.views?.list ?? fallback.list,
    create: context.actions.value?.views?.create ?? fallback.create,
    update: context.actions.value?.views?.update ?? fallback.update,
    delete: context.actions.value?.views?.delete ?? fallback.delete,
    // No local action: without the host's, this browser keeps the order.
    setOrder: context.actions.value?.views?.setOrder,
  }));
  const actionContext = {
    tableId: context.config.id,
    tableType: context.tableType,
  };
  // The host keeps the user's order with `setOrder` (and `list` answers
  // with it); otherwise this browser keeps it.
  const hostKeepsOrder = computed(
    () => typeof actions.value.setOrder === "function"
  );
  const views = ref<TableView[]>(cloneFormValue(initialViews()));
  const localOrderKey = getTableViewOrderStorageKey(actionContext);
  const localOrder = computed(() => localOrders.get(localOrderKey));
  /** The views in the user's order: tabs, "More views" and the view menu. */
  const orderedViews = computed(() =>
    orderViews(views.value, hostKeepsOrder.value ? undefined : localOrder.value)
  );
  const active = computed(() =>
    views.value.find((view) => view.id === context.state.activeViewId.value)
  );
  const dirty = computed(() =>
    Boolean(
      active.value &&
        !areViewSettingsEqual(
          context.state.resolveView(context.state.snapshot.value),
          context.state.resolveView(active.value.config)
        )
    )
  );
  const editable = computed(() =>
    Boolean(
      active.value &&
        !active.value.isSystem &&
        active.value.canEdit !== false &&
        context.config.table.allowViewSave
    )
  );
  const deletable = computed(() =>
    Boolean(
      active.value &&
        !active.value.isSystem &&
        active.value.canDelete !== false &&
        context.config.table.allowViewSave
    )
  );
  const busy = ref(false);
  const loading = ref(true);
  const loadError = ref("");
  const error = ref("");
  const dialogError = ref("");
  const dialogOpen = ref(false);
  const name = ref("");
  const shared = ref(false);
  /** Layout of the view being created; a tab's "+" may pick another one. */
  const newViewMode = ref<TableDisplayMode>();
  const favoriteViewId = ref<string | null>(null);
  const effectiveFavoriteViewId = computed(
    () =>
      views.value.find((view) => view.id === favoriteViewId.value)?.id ?? null
  );
  const favorite = computed(
    () =>
      (context.state.activeViewId.value ?? null) ===
      effectiveFavoriteViewId.value
  );
  /** Where the current view can move; undefined when it keeps its place. */
  const moves = computed(() => viewMoves(orderedViews.value, active.value?.id));
  /** Announced after a move, while the focus stays on the action. */
  const moveAnnouncement = ref("");
  let disposed = false;
  let hasInitialized = false;
  let initialSnapshot: TableViewConfig | undefined;
  onScopeDispose(() => {
    disposed = true;
  });
  const label = (reactKey: string, vueKey: string): string =>
    String(
      context.translations.value[reactKey] ??
        context.translations.value[vueKey] ??
        vueKey
    );
  const resultData = <T>(
    result: TableViewActionResult<T>,
    fallbackMessage: string
  ): T | undefined => {
    if (result.success === false || result.error) {
      throw new Error(result.error || fallbackMessage);
    }
    return result.data;
  };
  const select = (view?: TableView): void => {
    if (busy.value) {
      return;
    }
    error.value = "";
    hasInitialized = true;
    if (view) {
      context.state.applyView(view.config, view.id);
    } else {
      context.state.reset();
    }
  };
  const initialize = (): void => {
    if (
      !(hasInitialized || context.state.hasInitialTableUrlState) &&
      context.state.initialViewId === context.state.activeViewId.value &&
      formValuesEqual(initialSnapshot, context.state.snapshot.value)
    ) {
      const initial = resolveInitialTableView(
        views.value,
        context.state.initialViewId,
        favoriteViewId.value
      );
      if (initial) {
        select(initial);
      }
    }
  };
  const loadFavorite = async (): Promise<void> => {
    try {
      const data = resultData(
        await actions.value.getFavorite(actionContext),
        label("views.favoriteError", "favoriteViewError")
      );
      if (!disposed) {
        favoriteViewId.value = data?.viewId ?? null;
      }
    } catch (cause) {
      if (!disposed) {
        loadError.value =
          cause instanceof Error
            ? cause.message
            : label("views.favoriteError", "favoriteViewError");
      }
    }
  };
  /** The order this browser keeps, when the host does not (no `setOrder`). */
  const loadLocalOrder = (): void => {
    if (!hostKeepsOrder.value) {
      localOrders.set(localOrderKey, readLocalTableViewOrder(actionContext));
    }
  };
  /** The saved views; false when the manager was disposed meanwhile. */
  const loadViews = async (): Promise<boolean> => {
    const response = await actions.value.list(actionContext);
    const loaded = Array.isArray(response)
      ? response
      : (resultData(
          response,
          label("views.notifications.error.load", "viewLoadError")
        ) ?? []);
    if (disposed) {
      return false;
    }
    // Persisted records supersede initial seeds, including their renamed/configured values.
    const merged = cloneFormValue([
      ...new Map(
        [...initialViews(), ...loaded].map((view) => [view.id, view])
      ).values(),
    ]);
    const order = listedViewOrder(response, hostKeepsOrder.value);
    views.value = order ? orderViews(merged, order) : merged;
    return true;
  };
  const load = async (): Promise<void> => {
    if (!enabled()) {
      loading.value = false;
      return;
    }
    loading.value = true;
    loadError.value = "";
    loadLocalOrder();
    // Parent URL hydration finishes before testing whether the user has edited the table.
    await nextTick();
    initialSnapshot ??= cloneFormValue(context.state.snapshot.value);
    // A view the link or the host names does not depend on the favorite: it
    // applies once the views are loaded (persisted records win over seeds).
    const explicit = context.state.initialViewId !== undefined;
    const favoriteLoaded = loadFavorite();
    try {
      if (!(await loadViews())) {
        return;
      }
      if (explicit) {
        initialize();
      }
      await favoriteLoaded;
      if (disposed) {
        return;
      }
      initialize();
      hasInitialized = true;
    } catch (cause) {
      if (!disposed) {
        loadError.value =
          cause instanceof Error
            ? cause.message
            : label("views.notifications.error.load", "viewLoadError");
      }
    } finally {
      if (!disposed) {
        loading.value = false;
      }
    }
  };
  const openSave = (): void => {
    if (busy.value || loading.value || !context.config.table.allowViewSave) {
      return;
    }
    name.value = "";
    shared.value = false;
    newViewMode.value = context.state.displayMode.value;
    dialogError.value = "";
    dialogOpen.value = true;
  };
  const closeSave = (): void => {
    if (!busy.value) {
      dialogOpen.value = false;
    }
  };
  const run = async (
    operation: () => Promise<void>,
    target: typeof error,
    fallbackMessage: string
  ): Promise<void> => {
    if (busy.value) {
      return;
    }
    busy.value = true;
    target.value = "";
    try {
      await operation();
    } catch (cause) {
      if (!disposed) {
        target.value = cause instanceof Error ? cause.message : fallbackMessage;
      }
    } finally {
      if (!disposed) {
        busy.value = false;
      }
    }
  };
  const upsert = (view: TableView): void => {
    const index = views.value.findIndex((item) => item.id === view.id);
    if (index < 0) {
      views.value.push(cloneFormValue(view));
    } else {
      views.value[index] = cloneFormValue(view);
    }
  };
  const notify = (reactKey: string, vueKey: string): void => {
    context.status.value = {
      type: "success",
      message: label(reactKey, vueKey),
    };
  };
  const toggleFavorite = async (): Promise<void> => {
    const view = active.value;
    if ((!view && context.state.activeViewId.value) || loading.value) {
      return;
    }
    const viewId = view && !favorite.value ? view.id : null;
    // The built-in default represents no personal override; its filled star is stable.
    if (!view && effectiveFavoriteViewId.value === null && !loadError.value) {
      return;
    }
    const failure = label("views.favoriteError", "favoriteViewError");
    await run(
      async () => {
        const result = resultData(
          await actions.value.setFavorite(viewId, actionContext),
          failure
        );
        if (!disposed) {
          favoriteViewId.value = result ? result.viewId : viewId;
        }
      },
      error,
      failure
    );
  };
  /** Keeps a new order with the host's `setOrder`, else in this browser. */
  const persistOrder = async (
    viewIds: string[],
    failure: string
  ): Promise<string[]> => {
    const setOrder = actions.value.setOrder;
    if (!setOrder) {
      if (!storeLocalTableViewOrder(actionContext, viewIds)) {
        throw new Error(failure);
      }
      localOrders.set(localOrderKey, viewIds);
      return viewIds;
    }
    const saved = resultData(
      await setOrder({ ...actionContext, viewIds }),
      failure
    );
    const order = parseViewOrder(saved?.viewIds) ?? viewIds;
    if (!disposed) {
      views.value = orderViews(views.value, order);
    }
    return order;
  };
  /** Moves the current view one step, keeps the new order and announces it. */
  const move = async (direction: ViewMoveDirection): Promise<void> => {
    const view = active.value;
    const viewIds =
      view && moveViewInOrder(orderedViews.value, view.id, direction);
    if (!(view && viewIds) || busy.value) {
      return;
    }
    const failure = label("views.orderError", "viewOrderError");
    await run(
      async () => {
        const order = await persistOrder(viewIds, failure);
        const place = viewPosition(
          orderViews(orderedViews.value, order),
          view.id
        );
        if (place && !disposed) {
          moveAnnouncement.value = formatViewMove(
            label("views.moved", "viewMoved"),
            { name: view.name, ...place }
          );
        }
      },
      error,
      failure
    );
  };
  const save = async (): Promise<void> => {
    if (!context.config.table.allowViewSave) {
      return;
    }
    if (!name.value.trim()) {
      dialogError.value = label(
        "views.dialog.save.namePlaceholder",
        "viewNamePlaceholder"
      );
      return;
    }
    const current = cloneFormValue(context.state.snapshot.value);
    const config = {
      ...current,
      displayMode: newViewMode.value ?? current.displayMode,
    };
    const failure = label(
      "views.notifications.error.create",
      "viewCreateError"
    );
    await run(
      async () => {
        const result = await actions.value.create({
          ...actionContext,
          name: name.value.trim(),
          config,
          isGlobal: context.config.table.allowViewSharing && shared.value,
        });
        const view = resultData(result, failure);
        if (!view) {
          throw new Error(failure);
        }
        if (disposed) {
          return;
        }
        upsert(view);
        // Preserve table edits made while persistence was pending.
        if (
          config.displayMode !== current.displayMode ||
          formValuesEqual(current, context.state.snapshot.value)
        ) {
          context.state.applyView(view.config, view.id);
        } else {
          context.state.activeViewId.value = view.id;
        }
        dialogOpen.value = false;
        notify("views.notifications.created", "viewCreated");
      },
      dialogError,
      failure
    );
  };
  const update = async (): Promise<void> => {
    const view = active.value;
    if (!(view && editable.value && dirty.value)) {
      return;
    }
    const config = cloneFormValue(context.state.snapshot.value);
    const failure = label(
      "views.notifications.error.update",
      "viewUpdateError"
    );
    await run(
      async () => {
        const result = await actions.value.update(view.id, {
          ...actionContext,
          name: view.name,
          config,
        });
        const saved = resultData(result, failure) ?? { ...view, config };
        if (disposed) {
          return;
        }
        upsert(saved);
        if (
          context.state.activeViewId.value === view.id &&
          formValuesEqual(config, context.state.snapshot.value)
        ) {
          context.state.applyView(saved.config, saved.id);
        }
        notify("views.notifications.updated", "viewUpdated");
      },
      error,
      failure
    );
  };
  const remove = async (): Promise<void> => {
    const view = active.value;
    if (!(view && deletable.value)) {
      return;
    }
    const before = cloneFormValue(context.state.snapshot.value);
    const failure = label(
      "views.notifications.error.delete",
      "viewDeleteError"
    );
    await run(
      async () => {
        resultData(await actions.value.delete(view.id, actionContext), failure);
        if (disposed) {
          return;
        }
        views.value = views.value.filter((item) => item.id !== view.id);
        if (context.state.activeViewId.value === view.id) {
          if (formValuesEqual(before, context.state.snapshot.value)) {
            context.state.reset();
          } else {
            context.state.activeViewId.value = undefined;
          }
        }
        notify("views.notifications.deleted", "viewDeleted");
      },
      error,
      failure
    );
  };
  onMounted(load);
  watch(enabled, (isEnabled) => {
    if (isEnabled) {
      load();
    }
  });
  return {
    context,
    views,
    orderedViews,
    moves,
    move,
    moveAnnouncement,
    active,
    dirty,
    editable,
    deletable,
    busy,
    loading,
    loadError,
    error,
    dialogError,
    dialogOpen,
    name,
    shared,
    newViewMode,
    favorite,
    favoriteViewId: effectiveFavoriteViewId,
    toggleFavorite,
    label,
    select,
    load,
    openSave,
    closeSave,
    save,
    update,
    remove,
  };
}
