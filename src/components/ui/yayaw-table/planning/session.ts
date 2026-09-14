import { loadPlanningSnapshot } from "./adapter";
import {
  calculatePlanning,
  planningDefaults,
  resolvedPlanningSnapshot,
} from "./engine";
import {
  PlanningError,
  type PlanningMutation,
  type PlanningPreview,
  type PlanningRef,
  type PlanningResult,
  type PlanningSnapshot,
  type PlanningTask,
  planningKey,
  type TablePlanningActions,
  type TablePlanningConfig,
} from "./types";

export interface PlanningSessionState {
  snapshot?: PlanningSnapshot;
  preview?: PlanningPreview;
  selected?: PlanningRef;
  busy: boolean;
  error?: string;
}
export interface PlanningSessionOptions {
  config: TablePlanningConfig;
  actions?: TablePlanningActions;
  allowEdit?: boolean;
  canEditRow?: (row: Record<string, unknown>) => boolean;
  onChanged?: () => void | Promise<void>;
}
const CHANGE_EVENT = "yayaw-table-planning-changed";

function mutationRefs(
  mutation: PlanningMutation,
  snapshot: PlanningSnapshot
): PlanningRef[] {
  if (mutation.type === "dependency.put") {
    return [mutation.dependency.from, mutation.dependency.to];
  }
  if (mutation.type === "dependency.remove") {
    return snapshot.dependencies
      .filter((edge) => edge.id === mutation.id)
      .flatMap((edge) => [edge.from, edge.to]);
  }
  if (mutation.type === "parent" && mutation.parent) {
    return [mutation.ref, mutation.parent];
  }
  if (mutation.type === "record") {
    const field = snapshot.sources.find(
      (source) => source.id === mutation.ref.source
    )?.fields?.parent;
    const parentId = field ? mutation.patch[field] : null;
    if (parentId != null && parentId !== "") {
      return [
        mutation.ref,
        { source: mutation.ref.source, id: String(parentId) },
      ];
    }
  }
  return [mutation.ref];
}
/** One session per table instance. Only invalidations, never records or drafts, cross instances. */
export function createPlanningSession(options: PlanningSessionOptions) {
  let state: PlanningSessionState = { busy: false };
  const config = planningDefaults(options.config);
  const listeners = new Set<() => void>();
  let abort: AbortController | undefined;
  let generation = 0;
  let disposed = false;
  let settle: ((result: PlanningResult<PlanningSnapshot>) => void) | undefined;
  let applyKey: string | undefined;
  const publish = (patch: Partial<PlanningSessionState>): void => {
    if (disposed) {
      return;
    }
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener();
    }
  };
  const resultError = (cause: unknown): PlanningResult<PlanningSnapshot> => ({
    success: false,
    code: cause instanceof PlanningError ? cause.code : "planning-error",
    error: cause instanceof Error ? cause.message : String(cause),
  });
  const canEdit = (task: PlanningTask): boolean =>
    options.allowEdit !== false &&
    task.editable !== false &&
    (task.ref.source !== config.sourceId ||
      options.canEditRow?.(task.record ?? {}) !== false);
  const context = { scopeId: config.scopeId, sourceId: config.sourceId };
  const load = async (): Promise<void> => {
    if (!(config.enabled && options.actions)) {
      return;
    }
    abort?.abort();
    abort = new AbortController();
    const ticket = ++generation;
    publish({ busy: true, error: undefined });
    try {
      const snapshot = await loadPlanningSnapshot(
        options.actions,
        context,
        abort.signal,
        (page) => {
          if (ticket === generation) {
            publish({ snapshot: page });
          }
        }
      );
      if (ticket !== generation || disposed) {
        return;
      }
      // A partial/invalid graph remains inspectable, but exposes an actionable error.
      if (!snapshot.complete) {
        throw new PlanningError(
          "incomplete-graph",
          "The planning graph is incomplete. Resolve unavailable records before editing."
        );
      }
      publish({
        snapshot: resolvedPlanningSnapshot(snapshot, config),
        busy: false,
      });
    } catch (cause) {
      if (ticket !== generation || disposed) {
        return;
      }
      publish({
        busy: false,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  };
  const finish = (result: PlanningResult<PlanningSnapshot>): void => {
    const resolve = settle;
    settle = undefined;
    applyKey = undefined;
    publish({ preview: undefined, busy: false });
    resolve?.(result);
  };
  const cancel = (): void => {
    if (state.busy && state.preview) {
      return;
    }
    generation += 1;
    finish({
      success: false,
      code: "cancelled",
      error: "Planning changes were cancelled.",
    });
  };
  const notifyChanged = (): void => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: { scopeId: config.scopeId } })
      );
    } else {
      options.onChanged?.();
    }
  };
  const apply = async (): Promise<void> => {
    if (!state.preview || state.busy || !options.actions) {
      return;
    }
    const preview = state.preview;
    publish({ busy: true, error: undefined });
    applyKey ??= crypto.randomUUID();
    try {
      const result = await options.actions.apply({
        ...context,
        previewId: preview.id,
        revision: preview.revision,
        idempotencyKey: applyKey,
      });
      if (disposed) {
        return;
      }
      if (!(result.success && result.data)) {
        publish({
          busy: false,
          error: result.error ?? "Could not save the planning.",
        });
        if (result.code === "stale-preview") {
          finish(result);
          await load();
          publish({ error: result.error });
        }
        return;
      }
      publish({ snapshot: result.data, error: undefined });
      finish(result);
      notifyChanged();
    } catch (cause) {
      // Preserve both preview and key after an uncertain response; retry cannot duplicate a commit.
      publish({
        busy: false,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  };
  const checkEditable = (task: PlanningTask): void => {
    if (!canEdit(task)) {
      throw new PlanningError(
        "permission-denied",
        `Changes to ${task.label} are not permitted.`
      );
    }
  };
  const validateLocal = (
    snapshot: PlanningSnapshot,
    mutations: PlanningMutation[]
  ): void => {
    const local = calculatePlanning(snapshot, mutations, config);
    for (const change of local.preview.changes) {
      checkEditable(change.before);
      checkEditable(change.after);
    }
    for (const mutation of mutations) {
      for (const ref of mutationRefs(mutation, snapshot)) {
        const task = snapshot.tasks.find(
          (item) => planningKey(item.ref) === planningKey(ref)
        );
        if (task) {
          checkEditable(task);
        }
      }
    }
  };
  const validatePreview = (
    result: PlanningResult<PlanningPreview>
  ): PlanningPreview => {
    if (!(result.success && result.data)) {
      throw new PlanningError(
        result.code ?? "planning-error",
        result.error ?? "Could not prepare this planning change."
      );
    }
    for (const change of result.data.changes) {
      checkEditable(change.before);
      checkEditable(change.after);
    }
    return result.data;
  };
  const request = async (
    mutations: PlanningMutation[]
  ): Promise<PlanningResult<PlanningSnapshot>> => {
    if (settle || state.busy) {
      return {
        success: false,
        error: "Finish the current planning operation first.",
        code: "busy",
      };
    }
    if (!(options.actions && config.enabled) || options.allowEdit === false) {
      return {
        success: false,
        error: "Planning edits are unavailable.",
        code: "permission-denied",
      };
    }
    if (!state.snapshot) {
      await load();
    }
    const snapshot = state.snapshot;
    if (!snapshot?.complete) {
      return {
        success: false,
        error: state.error ?? "Load the complete planning first.",
        code: "incomplete-graph",
      };
    }
    const ticket = ++generation;
    publish({ busy: true, error: undefined });
    try {
      validateLocal(snapshot, mutations);
      const result = await options.actions.preview({
        ...context,
        revision: snapshot.revision,
        mutations,
      });
      if (disposed || generation !== ticket) {
        return { success: false, code: "cancelled" };
      }
      const preview = validatePreview(result);
      const completion = new Promise<PlanningResult<PlanningSnapshot>>(
        (resolve) => {
          settle = resolve;
        }
      );
      publish({ preview, busy: false });
      if (config.scheduling === "automatic") {
        await apply();
      }
      return await completion;
    } catch (cause) {
      const result = resultError(cause);
      publish({ busy: false, error: result.error });
      return result;
    }
  };
  const externalChange = (event: Event): void => {
    const detail = (event as CustomEvent<{ scopeId?: string }>).detail;
    if (detail?.scopeId !== config.scopeId) {
      return;
    }
    Promise.resolve(options.onChanged?.()).catch((cause: unknown) =>
      publish({ error: String(cause) })
    );
    // Keep an open preview for review; its revision is checked when the user applies it.
    if (!(settle || state.busy)) {
      load();
    }
  };

  const session = {
    config,
    canEdit,
    load,
    request,
    apply,
    cancel,
    connect(): void {
      disposed = false;
      if (typeof window !== "undefined") {
        window.addEventListener(CHANGE_EVENT, externalChange);
      }
      load();
    },
    getState: (): PlanningSessionState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(ref?: PlanningRef): void {
      publish({ selected: ref });
    },
    dispose(): void {
      abort?.abort();
      generation += 1;
      finish({ success: false, code: "cancelled" });
      disposed = true;
      listeners.clear();
      if (typeof window !== "undefined") {
        window.removeEventListener(CHANGE_EVENT, externalChange);
      }
    },
  };
  return session;
}
export type PlanningSession = ReturnType<typeof createPlanningSession>;

interface RecordActions {
  update?: (
    id: string,
    patch: Record<string, unknown>
  ) =>
    | Promise<{ success: boolean; data?: unknown; error?: string }>
    | { success: boolean; data?: unknown; error?: string };
  bulkUpdate?: (
    ids: string[],
    patch: Record<string, unknown>
  ) =>
    | Promise<{ success: boolean; data?: unknown; error?: string }>
    | { success: boolean; data?: unknown; error?: string };
}
/** Catalogue forms, bulk editors and inline cells all receive this same guarded action object. */
export function withPlanningActions<T extends RecordActions>(
  actions: T,
  session: PlanningSession
): T {
  if (!session.config.enabled) {
    return actions;
  }
  const updateMany = async (ids: string[], patch: Record<string, unknown>) => {
    const result = await session.request(
      ids.map((id) => ({
        type: "record",
        ref: { source: session.config.sourceId, id },
        patch,
      }))
    );
    const records = result.data?.tasks
      .filter(
        (task) =>
          task.ref.source === session.config.sourceId &&
          ids.includes(task.ref.id)
      )
      .map((task) => task.record);
    return { ...result, data: records };
  };
  return {
    ...actions,
    update: async (id: string, patch: Record<string, unknown>) => {
      const result = await updateMany([id], patch);
      return { ...result, data: result.data?.[0] };
    },
    bulkUpdate: updateMany,
  };
}
