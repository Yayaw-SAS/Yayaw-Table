import { calculatePlanning, planningDefaults } from "./engine";
import {
  type PlanningApplyInput,
  type PlanningContext,
  PlanningError,
  type PlanningLoadInput,
  type PlanningMutation,
  type PlanningPreview,
  type PlanningPreviewInput,
  type PlanningResult,
  type PlanningSnapshot,
  type TablePlanningActions,
  type TablePlanningConfig,
} from "./types";

/** Preview tokens are deliberately bounded; an evicted token requires a new preview. */
const MAX_RETAINED_PLANS = 100;

export interface PlanningCommitInput {
  /** The recalculated graph the adapter must make durable. */
  snapshot: PlanningSnapshot;
  preview: PlanningPreview;
  mutations: PlanningMutation[];
  context: PlanningContext;
}

export interface PlanningTransactionOptions {
  config: TablePlanningConfig;
  /** The authoritative graph as the adapter currently knows it. */
  read: () => PlanningSnapshot;
  load: (input: PlanningLoadInput) => Promise<PlanningSnapshot>;
  /** Makes the recalculated graph durable and returns the stored result. */
  commit: (
    input: PlanningCommitInput
  ) => Promise<PlanningSnapshot> | PlanningSnapshot;
  /** Runs at preview and again at commit, before the final revision check. */
  validate?: (
    snapshot: PlanningSnapshot,
    mutations: PlanningMutation[],
    preview: PlanningPreview
  ) => void | Promise<void>;
}

interface RetainedPlan {
  preview: PlanningPreview;
  mutations: PlanningMutation[];
  context: PlanningContext;
}

const failure = <T>(cause: unknown): PlanningResult<T> => ({
  success: false,
  error: cause instanceof Error ? cause.message : String(cause),
  code: cause instanceof PlanningError ? cause.code : "planning-error",
});

const staleError = (message: string): PlanningError =>
  new PlanningError("stale-preview", message);

const applySignature = (request: PlanningApplyInput): string =>
  JSON.stringify([
    request.scopeId,
    request.sourceId,
    request.previewId,
    request.revision,
  ]);

/** Every adapter entry point rejects a scope or source it does not serve. */
export function assertPlanningContext(
  current: PlanningSnapshot,
  scopeId: string,
  context: PlanningContext
): void {
  if (
    context.scopeId !== current.scopeId ||
    context.scopeId !== scopeId ||
    !current.sources.some((source) => source.id === context.sourceId)
  ) {
    throw new PlanningError(
      "scope-mismatch",
      "The planning scope or source is unavailable."
    );
  }
}

/**
 * The preview/apply state machine every planning adapter shares: revision checks,
 * bounded preview tokens, validation hooks and idempotent commits. Adapters only
 * supply how the graph is read, loaded and made durable.
 */
export function createPlanningTransactions(
  options: PlanningTransactionOptions
): TablePlanningActions {
  const config = planningDefaults(options.config);
  const plans = new Map<string, RetainedPlan>();
  const applied = new Map<
    string,
    { signature: string; snapshot: PlanningSnapshot }
  >();

  const checkContext = (context: PlanningContext): PlanningSnapshot => {
    const current = options.read();
    assertPlanningContext(current, config.scopeId, context);
    return current;
  };

  const priorCommit = (
    request: PlanningApplyInput
  ): PlanningSnapshot | undefined => {
    const prior = applied.get(request.idempotencyKey);
    if (!prior) {
      return undefined;
    }
    if (prior.signature !== applySignature(request)) {
      throw new PlanningError(
        "idempotency-conflict",
        "This request key was already used for another plan."
      );
    }
    return structuredClone(prior.snapshot);
  };

  const retain = (plan: RetainedPlan): void => {
    plans.set(plan.preview.id, plan);
    if (plans.size > MAX_RETAINED_PLANS) {
      const oldest = plans.keys().next().value;
      if (oldest) {
        plans.delete(oldest);
      }
    }
  };

  const requirePlan = (
    request: PlanningApplyInput,
    current: PlanningSnapshot
  ): RetainedPlan => {
    const plan = plans.get(request.previewId);
    if (
      !plan ||
      plan.preview.revision !== request.revision ||
      request.revision !== current.revision
    ) {
      throw staleError("The preview is stale. Reload and preview again.");
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
    return plan;
  };

  const preview = async (
    request: PlanningPreviewInput
  ): Promise<PlanningResult<PlanningPreview>> => {
    try {
      const current = checkContext(request);
      if (request.revision !== current.revision) {
        throw staleError(
          "The planning changed. Reload it and create a new preview."
        );
      }
      const mutations = structuredClone(request.mutations);
      const result = calculatePlanning(current, mutations, {
        ...config,
        sourceId: request.sourceId,
      });
      const plan = { ...result.preview, id: crypto.randomUUID() };
      await options.validate?.(
        structuredClone(current),
        mutations,
        structuredClone(plan)
      );
      if (current.revision !== options.read().revision) {
        throw staleError("The planning changed while validating this preview.");
      }
      retain({
        preview: structuredClone(plan),
        mutations,
        context: { scopeId: request.scopeId, sourceId: request.sourceId },
      });
      return { success: true, data: plan };
    } catch (cause) {
      return failure(cause);
    }
  };

  const apply = async (
    request: PlanningApplyInput
  ): Promise<PlanningResult<PlanningSnapshot>> => {
    try {
      const current = checkContext(request);
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
      const plan = requirePlan(request, current);
      const recalculated = calculatePlanning(current, plan.mutations, {
        ...config,
        sourceId: request.sourceId,
      });
      await options.validate?.(
        structuredClone(current),
        plan.mutations,
        structuredClone(plan.preview)
      );
      // Another asynchronous validation may have committed or changed permissions meanwhile.
      const committed = priorCommit(request);
      if (committed) {
        return { success: true, data: committed };
      }
      if (request.revision !== options.read().revision) {
        throw staleError(
          "The planning changed during validation. No changes were saved."
        );
      }
      const stored = await options.commit({
        snapshot: recalculated.snapshot,
        preview: plan.preview,
        mutations: plan.mutations,
        context: plan.context,
      });
      applied.set(request.idempotencyKey, {
        signature: applySignature(request),
        snapshot: structuredClone(stored),
      });
      plans.delete(request.previewId);
      return { success: true, data: structuredClone(stored) };
    } catch (cause) {
      return failure(cause);
    }
  };

  return { load: options.load, preview, apply };
}
