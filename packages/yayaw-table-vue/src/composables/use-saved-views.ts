import { computed, nextTick, onMounted, onScopeDispose, ref } from "vue";
import { useTableContext } from "../context";
import { createLocalTableViewActions } from "../core";
import { cloneFormValue, formValuesEqual } from "../form-runtime";
import type {
  TableView,
  TableViewActionResult,
  TableViewConfig,
} from "../types";

/** Keep persistence and asynchronous state separate from menu/dialog presentation. */
export function useSavedViews(initialViews: () => TableView[]) {
  const context = useTableContext();
  const fallback = createLocalTableViewActions();
  const actions = computed(() => ({
    list: context.actions.value?.views?.list ?? fallback.list,
    create: context.actions.value?.views?.create ?? fallback.create,
    update: context.actions.value?.views?.update ?? fallback.update,
    delete: context.actions.value?.views?.delete ?? fallback.delete,
  }));
  const actionContext = {
    tableId: context.config.id,
    tableType: context.tableType,
  };
  const views = ref<TableView[]>(cloneFormValue(initialViews()));
  const active = computed(() =>
    views.value.find((view) => view.id === context.state.activeViewId.value)
  );
  const dirty = computed(() =>
    Boolean(
      active.value &&
        !formValuesEqual(
          context.state.resolveView(context.state.snapshot.value),
          context.state.resolveView(active.value.config)
        )
    )
  );
  const editable = computed(() =>
    Boolean(
      active.value &&
        !active.value.isSystem &&
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
      const requested = context.state.initialViewId;
      const initial = requested
        ? views.value.find((view) => view.id === requested)
        : views.value.find((view) => view.isDefault);
      if (initial) {
        select(initial);
      }
    }
  };
  const load = async (): Promise<void> => {
    loading.value = true;
    loadError.value = "";
    // Parent URL hydration finishes before testing whether the user has edited the table.
    await nextTick();
    initialSnapshot ??= cloneFormValue(context.state.snapshot.value);
    try {
      const response = await actions.value.list(actionContext);
      const loaded = Array.isArray(response)
        ? response
        : (resultData(
            response,
            label("views.notifications.error.load", "viewLoadError")
          ) ?? []);
      if (disposed) {
        return;
      }
      // Persisted records supersede initial seeds, including their renamed/configured values.
      views.value = cloneFormValue([
        ...new Map(
          [...initialViews(), ...loaded].map((view) => [view.id, view])
        ).values(),
      ]);
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
    const config = cloneFormValue(context.state.snapshot.value);
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
        if (formValuesEqual(config, context.state.snapshot.value)) {
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
    if (!(view && editable.value)) {
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
  return {
    context,
    views,
    active,
    dirty,
    editable,
    busy,
    loading,
    loadError,
    error,
    dialogError,
    dialogOpen,
    name,
    shared,
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
