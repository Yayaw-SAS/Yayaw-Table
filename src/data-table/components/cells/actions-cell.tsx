/**
 * Actions cell component for data tables
 * Provides standardized display of row action buttons with enhanced dropdown menu
 */
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useSetAtom } from "jotai";
import { MoreHorizontal } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui-custom/icon";
import { cn } from "@/lib/utils";
import { useTranslations } from "../../providers/table-provider";

import type { ActionItem } from "../columns/actions-column";
import {
  type CatalogueFormState,
  catalogueFormAtom,
  openUpdateForm,
} from "../forms/atoms/catalogue-form-atoms";

// Type definition for ActionsCell props
interface ActionsCellProps<TData> {
  actions: ActionItem<TData>[];
  onRefresh?: () => Promise<void> | void;
  row: Row<TData>;
}

/**
 * Cell component for the actions column
 * Renders a dropdown menu with action buttons
 */
function ActionsCellBase<TData>({
  actions,
  onRefresh,
  row,
}: ActionsCellProps<TData>) {
  const { t } = useTranslations();
  const rowData = row.original;
  const _rowId = row.id;

  // Get query client for invalidating queries
  const queryClient = useQueryClient();

  // Create a stable version of the onRefresh callback
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Create a mutation for handling actions with automatic invalidation
  const actionMutation = useMutation({
    mutationFn: async (action: ActionItem<TData>) => {
      if (!action.onClick) {
        throw new Error("Action does not have an onClick handler");
      }
      return await action.onClick(rowData);
    },
    onSuccess: () => {
      // Invalidate all table data queries to trigger a refresh
      queryClient.invalidateQueries({ queryKey: ["tableData"] });

      // Also call the onRefresh function if provided
      if (onRefreshRef.current) {
        onRefreshRef.current();
      }
    },
  });

  // Helper function to determine if action opens a form
  const isFormAction = useCallback((action: ActionItem<TData>): boolean => {
    if (action.type !== "edit" || !action.onClick) {
      return false;
    }
    const actionString = action.onClick.toString();
    return (
      actionString.includes("openUpdateForm") ||
      actionString.includes("setFormState")
    );
  }, []);

  // Helper function to get success message for action
  const getSuccessMessage = useCallback(
    (_action: ActionItem<TData>): string => {
      // All actions use the same success message for now
      return t("common.success");
    },
    [t]
  );

  // Helper function to handle action execution
  const executeAction = useCallback(
    async (action: ActionItem<TData>): Promise<void> => {
      await actionMutation.mutateAsync(action);
    },
    [actionMutation]
  );

  // Helper function to handle toasts
  const handleToasts = useCallback(
    (action: ActionItem<TData>, toastId: string | number): void => {
      if (!isFormAction(action)) {
        const successMessage = getSuccessMessage(action);
        toast.success(successMessage, { id: toastId });
      }
    },
    [isFormAction, getSuccessMessage]
  );

  // Stable action click handler
  const handleActionClick = useCallback(
    async (action: ActionItem<TData>) => {
      try {
        const isForm = isFormAction(action);

        // Show loading toast for non-form actions
        let toastId: number | string = "";
        if (!isForm) {
          toastId = toast.loading(t("common.loading"));
        }

        // Execute the action
        await executeAction(action);

        // Handle success toasts
        handleToasts(action, toastId);
      } catch (error) {
        // Show error toast
        toast.error(error instanceof Error ? error.message : t("common.error"));
      }
    },
    [t, isFormAction, executeAction, handleToasts]
  );

  // Memoize action groups to prevent recalculation on every render
  const actionGroups = useMemo(() => {
    // Group actions by type
    const filteredStandardActions = actions.filter(
      (action) =>
        action.type === "view" ||
        action.type === "edit" ||
        action.type === "duplicate"
    );

    const filteredCustomActions = actions.filter(
      (action) => action.type === "custom" || !action.type
    );

    const filteredDestructiveActions = actions.filter(
      (action) => action.type === "delete"
    );

    // Only show separators if we have multiple groups of actions
    const calculatedShowFirstSeparator =
      filteredStandardActions.length > 0 &&
      (filteredCustomActions.length > 0 ||
        filteredDestructiveActions.length > 0);

    const calculatedShowSecondSeparator =
      filteredCustomActions.length > 0 && filteredDestructiveActions.length > 0;

    return {
      customActions: filteredCustomActions,
      destructiveActions: filteredDestructiveActions,
      showFirstSeparator: calculatedShowFirstSeparator,
      showSecondSeparator: calculatedShowSecondSeparator,
      standardActions: filteredStandardActions,
    };
  }, [actions]);

  const {
    customActions,
    destructiveActions,
    showFirstSeparator,
    showSecondSeparator,
    standardActions,
  } = actionGroups;

  // Memoize action groups rendering to prevent recalculation on every render
  const standardActionsGroup = useMemo(() => {
    if (standardActions.length === 0) {
      return null;
    }

    return (
      <DropdownMenuGroup>
        {standardActions.map((action, index) => {
          // Determine if the action is disabled
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(rowData)
              : action.disabled;

          return (
            <DropdownMenuItem
              className={action.className}
              disabled={isDisabled}
              key={`standard-${action.type}-${index}`}
              onClick={() => handleActionClick(action)}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    );
  }, [standardActions, rowData, handleActionClick]);

  const customActionsGroup = useMemo(() => {
    if (customActions.length === 0) {
      return null;
    }

    return (
      <DropdownMenuGroup>
        {customActions.map((action, index) => {
          // Determine if the action is disabled
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(rowData)
              : action.disabled;

          return (
            <DropdownMenuItem
              className={action.className}
              disabled={isDisabled}
              key={`custom-${action.label}-${index}`}
              onClick={() => handleActionClick(action)}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    );
  }, [customActions, rowData, handleActionClick]);

  const destructiveActionsGroup = useMemo(() => {
    if (destructiveActions.length === 0) {
      return null;
    }

    return (
      <DropdownMenuGroup>
        {destructiveActions.map((action, index) => {
          // Determine if the action is disabled
          const isDisabled =
            typeof action.disabled === "function"
              ? action.disabled(rowData)
              : action.disabled;

          return (
            <DropdownMenuItem
              className={cn("text-destructive", action.className)}
              disabled={isDisabled}
              key={`destructive-${action.label}-${index}`}
              onClick={() => handleActionClick(action)}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label || "Delete"}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuGroup>
    );
  }, [destructiveActions, rowData, handleActionClick]);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Open actions menu"
            className="h-8 w-8 p-0"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* Standard actions group */}
          {standardActionsGroup}

          {/* Separator between standard and custom actions */}
          {showFirstSeparator && <DropdownMenuSeparator />}

          {/* Custom actions */}
          {customActionsGroup}

          {/* Separator before destructive actions */}
          {showSecondSeparator && <DropdownMenuSeparator />}

          {/* Destructive actions */}
          {destructiveActionsGroup}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Create memoized version with custom equality check
export const ActionsCell = memo(
  ActionsCellBase,
  (
    prevProps: ActionsCellProps<unknown>,
    nextProps: ActionsCellProps<unknown>
  ) => {
    // 1. Check row ID equality
    if (prevProps.row.id !== nextProps.row.id) {
      return false;
    }

    // 2. Compare actions array more deeply
    if (prevProps.actions.length !== nextProps.actions.length) {
      return false;
    }

    // 3. Compare action labels to detect changes in action options
    for (let i = 0; i < prevProps.actions.length; i++) {
      if (prevProps.actions[i].label !== nextProps.actions[i].label) {
        return false;
      }
      if (prevProps.actions[i].type !== nextProps.actions[i].type) {
        return false;
      }
    }

    // 4. Check for refresh function reference changes
    if (prevProps.onRefresh !== nextProps.onRefresh) {
      return false;
    }

    // If we get here, consider props equal enough to prevent re-render
    return true;
  }
) as typeof ActionsCellBase;

/**
 * Wrapper component that creates the cell content with translations
 * This is needed because we can't use hooks directly in the column definition
 */
export function ActionsCellWithTranslations<
  TData extends Record<string, unknown>,
>({
  actions,
  onRefresh,
  row,
  standardActions,
}: {
  actions: ActionItem<TData>[];
  onRefresh?: () => Promise<void> | void;
  row: Row<TData>;
  standardActions: {
    includeDelete: boolean;
    includeDuplicate?: boolean;
    includeEdit: boolean;
    includeView?: boolean;
    onDelete?: (rowData: TData) => Promise<boolean | undefined> | undefined;
    onDuplicate?: (rowData: TData) => Promise<boolean | undefined> | undefined;
    onEdit?: (rowData: TData) => Promise<boolean | undefined> | undefined;
    onView?: (rowData: TData) => Promise<boolean | undefined> | undefined;
    /**
     * Table ID to use for the form
     * If provided, will be used to determine the form type
     */
    tableId?: string;
  };
}) {
  const { t } = useTranslations();
  const allActions: ActionItem<TData>[] = [...actions];
  // Get the setAtom function for the catalogue form
  const setFormState = useSetAtom(catalogueFormAtom);
  // Get the query client for invalidating queries
  const queryClient = useQueryClient();

  // Stable reference to the tableId to prevent callback recreation
  const tableIdRef = useRef(standardActions.tableId);
  tableIdRef.current = standardActions.tableId;

  // Add standard view action if requested
  if (standardActions.includeView && standardActions.onView) {
    allActions.unshift({
      icon: <Icon name="Eye" size="sm" />,
      label: t("actions.view"),
      onClick: standardActions.onView,
      type: "view",
    });
  }

  // Create an edit handler that uses the Jotai atom with stable dependencies
  const handleEdit = useCallback(
    (rowData: TData): Promise<boolean | undefined> | undefined => {
      try {
        // Only proceed if edit action is included
        if (!standardActions.includeEdit) {
          return;
        }

        // Check if we have a tableId in the standardActions or in the row
        const tableId =
          tableIdRef.current ||
          (rowData && typeof rowData === "object" && "tableId" in rowData
            ? String(rowData.tableId)
            : undefined);

        // If we have a tableId, use it to open the form
        if (tableId) {
          // Pass the row data directly to maintain the generic nature of the component
          const initialData = rowData;

          // Create a simple success callback that doesn't capture complex dependencies
          const handleSuccess = (_data: unknown) => {
            try {
              // Invalidate the table data query to refresh the table
              queryClient.invalidateQueries({
                queryKey: ["tableData", tableId],
              });

              // Also call the onRefresh function if provided
              if (onRefresh && typeof onRefresh === "function") {
                onRefresh();
              }
            } catch (_error) {
              // Ignore error in refresh
            }
          };

          // Create the initial state for the form
          const formState = openUpdateForm(
            tableId, // Use tableId directly as form type
            tableId,
            initialData, // Use the row data as initial form data
            handleSuccess
          );

          // Set the form state directly
          setFormState(
            formState as CatalogueFormState<Record<string, unknown>>
          );
          return;
        }

        // Otherwise, use the standard onEdit handler if provided
        if (standardActions.onEdit) {
          return standardActions.onEdit(rowData);
        }
        return;
      } catch (_error) {
        return;
      }
    },
    [
      standardActions.includeEdit,
      standardActions.onEdit,
      onRefresh,
      setFormState,
      queryClient,
    ]
  );

  // Add edit action to the dropdown menu if edit is included
  if (standardActions.includeEdit) {
    allActions.unshift({
      icon: <Icon name="Pencil" size="sm" />,
      label: t("actions.edit"),
      onClick: handleEdit,
      type: "edit",
    });
  }

  // Add standard duplicate action if requested
  if (standardActions.includeDuplicate && standardActions.onDuplicate) {
    allActions.push({
      icon: <Icon name="Copy" size="sm" />,
      label: t("actions.duplicate"),
      onClick: standardActions.onDuplicate,
      type: "duplicate",
    });
  }

  // Add standard delete action if requested
  if (standardActions.includeDelete && standardActions.onDelete) {
    allActions.push({
      icon: <Icon name="Trash" size="sm" />,
      label: t("actions.delete"),
      onClick: standardActions.onDelete,
      type: "delete",
    });
  }

  // Process other actions to ensure they have proper translations
  const processedActions = allActions.map((action) => {
    // If it's already a standard action with translation, return as is
    if (["delete", "duplicate", "edit", "view"].includes(action.type || "")) {
      return action;
    }

    return {
      ...action,
      // If the label looks like a translation key, translate it
      label: action.label.includes(".") ? t(action.label) : action.label,
    };
  });

  return (
    <ActionsCell actions={processedActions} onRefresh={onRefresh} row={row} />
  );
}
