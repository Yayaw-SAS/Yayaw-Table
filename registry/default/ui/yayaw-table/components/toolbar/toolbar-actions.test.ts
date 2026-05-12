import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  ToolbarAction,
  ToolbarActionContext,
} from "../../types/toolbar-types";
import {
  DEFAULT_TOOLBAR_ACTIONS_PLACEMENT,
  normalizeToolbarActionsPlacement,
  partitionToolbarActions,
  resolveToolbarActionState,
  resolveToolbarActions,
  shouldRenderToolbarAction,
} from "./toolbar-actions";

const baseContext: ToolbarActionContext = {
  actionsAsIcons: false,
  hasListAction: true,
  isCreateEnabled: true,
  isExportEnabled: true,
  isExporting: false,
  isMobile: false,
  selectedCount: 0,
  selectedOriginalRows: [],
  selectedRowIds: [],
  selectedRows: [],
  tableId: "products",
  tableType: "products",
};

function createAction(overrides?: Partial<ToolbarAction>): ToolbarAction {
  return {
    id: "recalculate-prices",
    label: "Recalculate prices",
    onClick: async () => {
      await Promise.resolve();
    },
    ...overrides,
  };
}

describe("normalizeToolbarActionsPlacement", () => {
  it("uses default placement when value is undefined", () => {
    const placement = normalizeToolbarActionsPlacement(undefined);

    assert.equal(placement, DEFAULT_TOOLBAR_ACTIONS_PLACEMENT);
  });

  it("falls back to default placement when value is invalid", () => {
    const placement = normalizeToolbarActionsPlacement("invalid");

    assert.equal(placement, DEFAULT_TOOLBAR_ACTIONS_PLACEMENT);
  });
});

describe("partitionToolbarActions", () => {
  it("places actions between create and export by default", () => {
    const actions = [createAction()];

    const partitioned = partitionToolbarActions({
      actions,
      placement: undefined,
    });

    assert.deepEqual(partitioned.beforeCreate, []);
    assert.deepEqual(partitioned.betweenCreateAndExport, actions);
    assert.deepEqual(partitioned.afterExport, []);
  });

  it("places actions before create when requested", () => {
    const actions = [createAction()];

    const partitioned = partitionToolbarActions({
      actions,
      placement: "before-create",
    });

    assert.deepEqual(partitioned.beforeCreate, actions);
    assert.deepEqual(partitioned.betweenCreateAndExport, []);
    assert.deepEqual(partitioned.afterExport, []);
  });

  it("places actions after export when requested", () => {
    const actions = [createAction()];

    const partitioned = partitionToolbarActions({
      actions,
      placement: "after-export",
    });

    assert.deepEqual(partitioned.beforeCreate, []);
    assert.deepEqual(partitioned.betweenCreateAndExport, []);
    assert.deepEqual(partitioned.afterExport, actions);
  });
});

describe("resolveToolbarActions", () => {
  it("returns empty array when toolbarActions is undefined", () => {
    const resolvedActions = resolveToolbarActions({
      context: baseContext,
      toolbarActions: undefined,
    });

    assert.deepEqual(resolvedActions, []);
  });

  it("resolves toolbarActions from callback with context", () => {
    let receivedContext: ToolbarActionContext | undefined;

    const resolvedActions = resolveToolbarActions({
      context: baseContext,
      toolbarActions: (context) => {
        receivedContext = context;
        return [createAction()];
      },
    });

    assert.equal(receivedContext, baseContext);
    assert.equal(resolvedActions.length, 1);
    assert.equal(resolvedActions[0].id, "recalculate-prices");
  });
});

describe("resolveToolbarActionState", () => {
  it("supports disabled boolean and disabled callback", () => {
    const disabledByBoolean = resolveToolbarActionState({
      action: createAction({ disabled: true }),
      context: baseContext,
    });

    const disabledByCallback = resolveToolbarActionState({
      action: createAction({
        disabled: (context) => context.isExporting,
        id: "recalculate-prices-callback",
      }),
      context: {
        ...baseContext,
        isExporting: true,
      },
    });

    assert.equal(disabledByBoolean.disabled, true);
    assert.equal(disabledByCallback.disabled, true);
  });

  it("exposes selection context to disabled callbacks", () => {
    const disabledBySelection = resolveToolbarActionState({
      action: createAction({
        disabled: (context) => context.selectedCount === 0,
        id: "requires-selection",
      }),
      context: baseContext,
    });

    const enabledWithSelection = resolveToolbarActionState({
      action: createAction({
        disabled: (context) =>
          context.selectedRowIds.includes("row-1") === false,
        id: "requires-row",
      }),
      context: {
        ...baseContext,
        selectedCount: 1,
        selectedOriginalRows: [{ id: "row-1" }],
        selectedRowIds: ["row-1"],
      },
    });

    assert.equal(disabledBySelection.disabled, true);
    assert.equal(enabledWithSelection.disabled, false);
  });

  it("supports loading prop and pending async state", () => {
    const loadingFromProp = resolveToolbarActionState({
      action: createAction({ loading: true }),
      context: baseContext,
    });

    const loadingFromPendingState = resolveToolbarActionState({
      action: createAction({ id: "pending-action" }),
      context: baseContext,
      pendingActionIds: new Set(["pending-action"]),
    });

    assert.equal(loadingFromProp.loading, true);
    assert.equal(loadingFromPendingState.loading, true);
  });

  it("resolves icon-mode visibility defaults", () => {
    const visibleByDefault = resolveToolbarActionState({
      action: createAction(),
      context: baseContext,
    });

    const hiddenInIconMode = resolveToolbarActionState({
      action: createAction({
        id: "hidden-icon-mode",
        showInIconMode: false,
      }),
      context: baseContext,
    });

    assert.equal(visibleByDefault.showInIconMode, true);
    assert.equal(hiddenInIconMode.showInIconMode, false);
  });

  it("applies icon and text mode visibility behavior", () => {
    const hiddenInIconState = resolveToolbarActionState({
      action: createAction({
        id: "text-only-action",
        showInIconMode: false,
      }),
      context: baseContext,
    });

    const isVisibleInIconMode = shouldRenderToolbarAction({
      actionsAsIcons: true,
      state: hiddenInIconState,
    });
    const isVisibleInTextMode = shouldRenderToolbarAction({
      actionsAsIcons: false,
      state: hiddenInIconState,
    });

    assert.equal(isVisibleInIconMode, false);
    assert.equal(isVisibleInTextMode, true);
  });

  it("uses default outline variant and label tooltip fallback", () => {
    const resolvedState = resolveToolbarActionState({
      action: createAction(),
      context: baseContext,
    });

    assert.equal(resolvedState.variant, "outline");
    assert.equal(resolvedState.tooltip, "Recalculate prices");
  });
});
