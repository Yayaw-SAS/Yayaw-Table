import { planningDefaults } from "./engine";
import {
  assertPlanningContext,
  createPlanningTransactions,
} from "./transactions";
import {
  type PlanningContext,
  PlanningError,
  type PlanningMutation,
  type PlanningPreview,
  type PlanningSnapshot,
  planningKey,
  type TablePlanningActions,
  type TablePlanningConfig,
} from "./types";

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
  const actions = createPlanningTransactions({
    config: input.config,
    read: () => current,
    load: (context) => {
      assertPlanningContext(current, config.scopeId, context);
      context.signal?.throwIfAborted();
      return Promise.resolve(structuredClone(current));
    },
    commit: ({ snapshot }) => {
      current = { ...snapshot, revision: crypto.randomUUID() };
      return structuredClone(current);
    },
    validate: input.validate,
  });
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
