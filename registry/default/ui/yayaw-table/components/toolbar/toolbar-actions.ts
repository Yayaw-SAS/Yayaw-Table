import type {
  ToolbarAction,
  ToolbarActionContext,
  ToolbarActionsInput,
  ToolbarActionsPlacement,
  ToolbarActionVariant,
} from "../../types/toolbar-types";

export const DEFAULT_TOOLBAR_ACTIONS_PLACEMENT: ToolbarActionsPlacement =
  "between-create-export";

export const DEFAULT_TOOLBAR_ACTION_VARIANT: ToolbarActionVariant = "outline";

const TOOLBAR_ACTIONS_PLACEMENTS = new Set<ToolbarActionsPlacement>([
  "before-create",
  "between-create-export",
  "after-export",
]);

const EMPTY_PENDING_ACTION_IDS = new Set<string>();

export interface PartitionedToolbarActions<TAction = ToolbarAction> {
  afterExport: TAction[];
  beforeCreate: TAction[];
  betweenCreateAndExport: TAction[];
  placement: ToolbarActionsPlacement;
}

export interface ToolbarActionResolvedState {
  disabled: boolean;
  loading: boolean;
  showInIconMode: boolean;
  tooltip: string;
  variant: ToolbarActionVariant;
}

export const shouldRenderToolbarAction = ({
  actionsAsIcons,
  state,
}: {
  actionsAsIcons: boolean;
  state: ToolbarActionResolvedState;
}): boolean => {
  if (!actionsAsIcons) {
    return true;
  }

  return state.showInIconMode;
};

const isValidToolbarAction = (value: unknown): value is ToolbarAction => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as Partial<ToolbarAction>;

  return (
    typeof action.id === "string" &&
    action.id.length > 0 &&
    typeof action.label === "string" &&
    action.label.length > 0 &&
    typeof action.onClick === "function"
  );
};

export const normalizeToolbarActionsPlacement = (
  placement: null | string | ToolbarActionsPlacement | undefined
): ToolbarActionsPlacement => {
  if (!placement) {
    return DEFAULT_TOOLBAR_ACTIONS_PLACEMENT;
  }

  return TOOLBAR_ACTIONS_PLACEMENTS.has(placement as ToolbarActionsPlacement)
    ? (placement as ToolbarActionsPlacement)
    : DEFAULT_TOOLBAR_ACTIONS_PLACEMENT;
};

export const resolveToolbarActions = ({
  context,
  toolbarActions,
}: {
  context: ToolbarActionContext;
  toolbarActions?: ToolbarActionsInput;
}): ToolbarAction[] => {
  if (!toolbarActions) {
    return [];
  }

  const resolvedActions =
    typeof toolbarActions === "function"
      ? toolbarActions(context)
      : toolbarActions;

  if (!Array.isArray(resolvedActions)) {
    return [];
  }

  return resolvedActions.filter(isValidToolbarAction);
};

export const partitionToolbarActions = <TAction>({
  actions,
  placement,
}: {
  actions: TAction[];
  placement: null | string | ToolbarActionsPlacement | undefined;
}): PartitionedToolbarActions<TAction> => {
  const normalizedPlacement = normalizeToolbarActionsPlacement(placement);

  const partitionedActions: PartitionedToolbarActions<TAction> = {
    afterExport: [],
    beforeCreate: [],
    betweenCreateAndExport: [],
    placement: normalizedPlacement,
  };

  if (normalizedPlacement === "before-create") {
    partitionedActions.beforeCreate = actions;
  } else if (normalizedPlacement === "after-export") {
    partitionedActions.afterExport = actions;
  } else {
    partitionedActions.betweenCreateAndExport = actions;
  }

  return partitionedActions;
};

const resolveToolbarActionDisabled = ({
  action,
  context,
}: {
  action: ToolbarAction;
  context: ToolbarActionContext;
}): boolean => {
  if (typeof action.disabled === "function") {
    return action.disabled(context);
  }

  return action.disabled === true;
};

export const resolveToolbarActionState = ({
  action,
  context,
  pendingActionIds = EMPTY_PENDING_ACTION_IDS,
}: {
  action: ToolbarAction;
  context: ToolbarActionContext;
  pendingActionIds?: ReadonlySet<string>;
}): ToolbarActionResolvedState => {
  return {
    disabled: resolveToolbarActionDisabled({ action, context }),
    loading: action.loading === true || pendingActionIds.has(action.id),
    showInIconMode: action.showInIconMode !== false,
    tooltip: action.tooltip || action.label,
    variant: action.variant ?? DEFAULT_TOOLBAR_ACTION_VARIANT,
  };
};
