import { calculatePlanning, planningDefaults } from "./engine";
import {
  type PlanningApplyInput,
  type PlanningContext,
  PlanningError,
  type PlanningMutation,
  type PlanningPreview,
  type PlanningResult,
  type PlanningSnapshot,
  planningKey,
  type TablePlanningActions,
  type TablePlanningConfig,
} from "./types";

const failure = <T>(cause: unknown): PlanningResult<T> => ({
  success: false,
  error: cause instanceof Error ? cause.message : String(cause),
  code: cause instanceof PlanningError ? cause.code : "planning-error",
});

/** A complete executable adapter example. Production adapters enforce the same checks in a database transaction. */
export function createMemoryPlanningAdapter(input: {
  snapshot: PlanningSnapshot;
  config: TablePlanningConfig;
  /** Runs at preview and again at commit, before the final revision check. */
  validate?: (
    snapshot: PlanningSnapshot,
    mutations: PlanningMutation[],
    preview: PlanningPreview
  ) => void | Promise<void>;
}) {
  let current = structuredClone(input.snapshot);
  const config = planningDefaults(input.config);
  const plans = new Map<
    string,
    {
      preview: PlanningPreview;
      next: PlanningSnapshot;
      mutations: PlanningMutation[];
      context: PlanningContext;
    }
  >();
  const applied = new Map<
    string,
    { signature: string; snapshot: PlanningSnapshot }
  >();
  const checkContext = (context: PlanningContext): void => {
    if (
      context.scopeId !== current.scopeId ||
      context.scopeId !== config.scopeId ||
      !current.sources.some((source) => source.id === context.sourceId)
    ) {
      throw new PlanningError(
        "scope-mismatch",
        "The planning scope or source is unavailable."
      );
    }
  };
  const signature = (request: PlanningApplyInput): string =>
    JSON.stringify([
      request.scopeId,
      request.sourceId,
      request.previewId,
      request.revision,
    ]);
  const priorCommit = (
    request: PlanningApplyInput
  ): PlanningSnapshot | undefined => {
    const prior = applied.get(request.idempotencyKey);
    if (!prior) {
      return undefined;
    }
    if (prior.signature !== signature(request)) {
      throw new PlanningError(
        "idempotency-conflict",
        "This request key was already used for another plan."
      );
    }
    return structuredClone(prior.snapshot);
  };
  const actions: TablePlanningActions = {
    load(context) {
      checkContext(context);
      context.signal?.throwIfAborted();
      return Promise.resolve(structuredClone(current));
    },
    async preview(request) {
      try {
        checkContext(request);
        if (request.revision !== current.revision) {
          throw new PlanningError(
            "stale-preview",
            "The planning changed. Reload it and create a new preview."
          );
        }
        const revision = current.revision;
        const mutations = structuredClone(request.mutations);
        const result = calculatePlanning(current, mutations, {
          ...config,
          sourceId: request.sourceId,
        });
        const preview = { ...result.preview, id: crypto.randomUUID() };
        await input.validate?.(
          structuredClone(current),
          mutations,
          structuredClone(preview)
        );
        if (revision !== current.revision) {
          throw new PlanningError(
            "stale-preview",
            "The planning changed while validating this preview."
          );
        }
        plans.set(preview.id, {
          preview: structuredClone(preview),
          next: result.snapshot,
          mutations,
          context: { scopeId: request.scopeId, sourceId: request.sourceId },
        });
        // Preview tokens are deliberately bounded; an evicted token requires a new preview.
        if (plans.size > 100) {
          const oldest = plans.keys().next().value;
          if (oldest) {
            plans.delete(oldest);
          }
        }
        return { success: true, data: preview };
      } catch (cause) {
        return failure(cause);
      }
    },
    async apply(request) {
      try {
        checkContext(request);
        if (!request.idempotencyKey) {
          throw new PlanningError(
            "missing-idempotency-key",
            "Applying a plan requires an idempotency key."
          );
        }
        const prior = priorCommit(request);
        if (prior) {
          return { success: true, data: prior };
        }
        const plan = plans.get(request.previewId);
        if (
          !plan ||
          plan.preview.revision !== request.revision ||
          request.revision !== current.revision
        ) {
          throw new PlanningError(
            "stale-preview",
            "The preview is stale. Reload and preview again."
          );
        }
        if (
          plan.context.scopeId !== request.scopeId ||
          plan.context.sourceId !== request.sourceId
        ) {
          throw new PlanningError(
            "scope-mismatch",
            "The preview belongs to another source."
          );
        }
        const recalculated = calculatePlanning(current, plan.mutations, {
          ...config,
          sourceId: request.sourceId,
        });
        await input.validate?.(
          structuredClone(current),
          plan.mutations,
          structuredClone(plan.preview)
        );
        // Another asynchronous validation may have committed or changed permissions meanwhile.
        const committed = priorCommit(request);
        if (committed) {
          return { success: true, data: committed };
        }
        if (request.revision !== current.revision) {
          throw new PlanningError(
            "stale-preview",
            "The planning changed during validation. No changes were saved."
          );
        }
        current = { ...recalculated.snapshot, revision: crypto.randomUUID() };
        applied.set(request.idempotencyKey, {
          signature: signature(request),
          snapshot: structuredClone(current),
        });
        plans.delete(request.previewId);
        return { success: true, data: structuredClone(current) };
      } catch (cause) {
        return failure(cause);
      }
    },
  };
  return {
    actions,
    getSnapshot: (): PlanningSnapshot => structuredClone(current),
    /** Simulate an external transaction, including permission/calendar changes, using a fresh revision. */
    replaceSnapshot(snapshot: PlanningSnapshot): void {
      current = { ...structuredClone(snapshot), revision: crypto.randomUUID() };
    },
  };
}

function addUnique<T>(
  items: T[],
  seen: Set<string>,
  key: (item: T) => string,
  target: T[],
  code: string
): void {
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) {
      throw new PlanningError(
        code,
        "A graph page contains a duplicate identity."
      );
    }
    seen.add(id);
    target.push(item);
  }
}
/** Page the graph independently of table filters. Every page must belong to the same revision. */
export async function loadPlanningSnapshot(
  actions: TablePlanningActions,
  context: PlanningContext,
  signal?: AbortSignal,
  onPage?: (snapshot: PlanningSnapshot) => void
): Promise<PlanningSnapshot> {
  let result: PlanningSnapshot | undefined;
  let cursor: string | undefined;
  const cursors = new Set<string>();
  const taskIds = new Set<string>();
  const dependencyIds = new Set<string>();
  for (let page = 0; page < 1000; page += 1) {
    signal?.throwIfAborted();
    const next = await actions.load({ ...context, cursor, signal });
    signal?.throwIfAborted();
    if (
      next.scopeId !== context.scopeId ||
      (result && result.revision !== next.revision)
    ) {
      throw new PlanningError(
        "stale-graph",
        "The planning changed while its graph was loading. Retry the load."
      );
    }
    if (!result) {
      result = { ...next, tasks: [], dependencies: [] };
    }
    addUnique(
      next.tasks,
      taskIds,
      (task) => planningKey(task.ref),
      result.tasks,
      "duplicate-task"
    );
    addUnique(
      next.dependencies,
      dependencyIds,
      (edge) => edge.id,
      result.dependencies,
      "duplicate-dependency"
    );
    result.complete = next.complete;
    result.nextCursor = next.nextCursor;
    onPage?.(structuredClone(result));
    if (!next.nextCursor) {
      return result;
    }
    if (cursors.has(next.nextCursor)) {
      throw new PlanningError(
        "invalid-cursor",
        "The planning loader repeated a page cursor."
      );
    }
    cursors.add(next.nextCursor);
    cursor = next.nextCursor;
  }
  throw new PlanningError(
    "incomplete-graph",
    "The planning graph exceeded the page limit."
  );
}
