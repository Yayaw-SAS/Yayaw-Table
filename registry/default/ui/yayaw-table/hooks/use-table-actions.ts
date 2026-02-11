/**
 * Hook for managing table CRUD actions
 * Provides unified error handling and success callbacks
 */
"use client";

import { useCallback, useMemo } from "react";
import { useTableActions as useProviderTableActions } from "../providers/table-provider";

/**
 * Generic action result type
 */
interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Generic table actions interface
 */
interface TableActions {
  list?: (params: unknown) => Promise<{
    data: unknown[];
    meta: { pageCount: number; totalCount: number };
  }>;
  create?: (data: unknown) => Promise<ActionResult>;
  update?: (id: string, data: unknown) => Promise<ActionResult>;
  delete?: (id: string) => Promise<ActionResult>;
  duplicate?: (id: string) => Promise<ActionResult>;
  bulkDelete?: (ids: string[]) => Promise<ActionResult>;
  bulkCopy?: (ids: string[]) => Promise<ActionResult>;
  bulkUpdate?: (ids: string[], updateData: unknown) => Promise<ActionResult>;
}

/**
 * Options for the table actions hook
 */
interface UseTableActionsOptions {
  tableType: string;
  onSuccess?: () => Promise<void>;
  onError?: (error: string, action: string) => void;
  enableLogging?: boolean;
}

/**
 * Hook for managing table CRUD actions with unified error handling
 */
export function useTableActions<
  TData extends Record<string, unknown> = Record<string, unknown>,
>(options: UseTableActionsOptions) {
  const {
    tableType,
    onSuccess,
    onError,
    enableLogging: _enableLogging = true,
  } = options;

  // Get actions from provider
  const getTableActions = useProviderTableActions();

  const actions = useMemo(() => {
    const tableActions = getTableActions?.(tableType) as
      | TableActions
      | undefined;

    if (!tableActions) {
      // Return empty actions if none found
      return {
        list: async () => ({ data: [], meta: { pageCount: 0, totalCount: 0 } }),
      } as TableActions;
    }

    return tableActions;
  }, [getTableActions, tableType]);

  // Helper function to handle action failure
  const handleActionFailure = useCallback(
    (actionName: string, error?: string) => {
      if (onError) {
        onError(error || "Unknown error", actionName);
      }
    },
    [onError]
  );

  // Helper function to handle action exception
  const handleActionException = useCallback(
    (actionName: string, error: unknown) => {
      if (onError) {
        onError(
          error instanceof Error ? error.message : String(error),
          actionName
        );
      }
    },
    [onError]
  );

  // Helper function to handle action success
  const handleActionSuccess = useCallback(async () => {
    if (onSuccess) {
      await onSuccess();
    }
  }, [onSuccess]);

  /**
   * Generic action executor with unified error handling
   */
  const executeAction = useCallback(
    async <T = boolean>(
      actionName: string,
      actionFn: () => Promise<ActionResult>,
      successReturnValue: T = true as T
    ): Promise<T | false> => {
      try {
        const result = await actionFn();

        if (!result.success) {
          handleActionFailure(actionName, result.error);
          return false;
        }

        await handleActionSuccess();
        return successReturnValue;
      } catch (error) {
        handleActionException(actionName, error);
        return false;
      }
    },
    [handleActionFailure, handleActionSuccess, handleActionException]
  );

  /**
   * Create handler
   */
  const handleCreate = useCallback(
    async (data: Partial<TData>): Promise<boolean> => {
      if (!actions.create) {
        const _errorMsg = `Create action not available for ${tableType}`;
        if (onError) {
          onError("Action not available", "create");
        }

        return false;
      }

      const createFn = actions.create;
      return createFn
        ? await executeAction("create", () => createFn(data))
        : false;
    },
    [actions.create, executeAction, tableType, onError]
  );

  /**
   * Update handler
   */
  const handleEdit = useCallback(
    async (
      row: TData & { id: string },
      data: Partial<TData>
    ): Promise<boolean> => {
      if (!actions.update) {
        const _errorMsg = `Update action not available for ${tableType}`;
        if (onError) {
          onError("Action not available", "update");
        }

        return false;
      }

      const updateFn = actions.update;
      return updateFn
        ? await executeAction("update", () => updateFn(row.id, data))
        : false;
    },
    [actions.update, executeAction, tableType, onError]
  );

  /**
   * Delete handler
   */
  const handleDelete = useCallback(
    async (row: TData & { id: string }): Promise<boolean> => {
      if (!actions.delete) {
        const _errorMsg = `Delete action not available for ${tableType}`;
        if (onError) {
          onError("Action not available", "delete");
        }

        return false;
      }

      const deleteFn = actions.delete;
      return deleteFn
        ? await executeAction("delete", () => deleteFn(row.id))
        : false;
    },
    [actions.delete, executeAction, tableType, onError]
  );

  /**
   * Duplicate handler
   */
  const handleDuplicate = useCallback(
    async (row: TData & { id: string }): Promise<boolean> => {
      if (!actions.duplicate) {
        const _errorMsg = `Duplicate action not available for ${tableType}`;
        if (onError) {
          onError("Action not available", "duplicate");
        }

        return false;
      }

      const duplicateFn = actions.duplicate;
      return duplicateFn
        ? await executeAction("duplicate", () => duplicateFn(row.id))
        : false;
    },
    [actions.duplicate, executeAction, tableType, onError]
  );

  return {
    // Raw actions from provider
    actions,

    // Enhanced handlers
    handleCreate,
    handleEdit,
    handleDelete,
    handleDuplicate,

    // Utility
    hasAction: (actionName: keyof TableActions) => !!actions[actionName],
    isActionsAvailable: Object.keys(actions).length > 1, // More than just 'list'
  };
}
