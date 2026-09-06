/**
 * Bulk Actions Menu Component
 * An overlay menu that appears when rows are selected, using expandable tabs design
 */
"use client";

import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import {
  CheckCheck,
  Copy,
  Download,
  Edit,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import {
  type ComponentType,
  type CSSProperties,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useOnClickOutside } from "usehooks-ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  BulkActionCustomHandlerResult,
  BulkActionResult,
  BulkDeleteCustomHandlerResult,
} from "../../hooks/use-bulk-actions";
import { normalizeBulkActionResult } from "../../hooks/use-bulk-actions";
import { useTranslations } from "../../providers/table-provider";
import type { Row } from "../../tanstack";

export interface BulkActionContext<TData> {
  selectedRows: Row<TData>[];
  selectedOriginalRows: TData[];
  selectedCount: number;
}

export interface BulkActionConfirmConfig<TData> {
  cancelLabel?: string | ((ctx: BulkActionContext<TData>) => string);
  confirmLabel?: string | ((ctx: BulkActionContext<TData>) => string);
  description?: string | ((ctx: BulkActionContext<TData>) => string);
  title?: string | ((ctx: BulkActionContext<TData>) => string);
}

export type BulkActionVariant = "default" | "destructive";

// biome-ignore lint/suspicious/noConfusingVoidType: Bulk handlers may intentionally return void when the app owns feedback and follow-up behavior.
export type BulkActionHandlerResult = BulkActionResult | void;

export type BulkActionHandler<TData> = (
  ctx: BulkActionContext<TData>
) => Promise<BulkActionHandlerResult> | BulkActionHandlerResult;

export interface BulkAction<TData> {
  confirm?: BulkActionConfirmConfig<TData>;
  disabled?: boolean | ((ctx: BulkActionContext<TData>) => boolean);
  icon: ComponentType<{ className?: string; size?: number }>;
  id: string;
  label: string;
  onClick: BulkActionHandler<TData>;
  variant?: BulkActionVariant;
}

export type CustomBulkActionsInput<TData> =
  | BulkAction<TData>[]
  | ((ctx: BulkActionContext<TData>) => BulkAction<TData>[]);

/**
 * Props for the BulkActionsMenu component
 */
export interface BulkActionsMenuProps<TData> {
  /**
   * Array of selected rows
   */
  selectedRows: Row<TData>[];

  /**
   * Callback when bulk edit is triggered
   */
  onBulkEdit?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;

  /**
   * Callback when bulk delete is triggered
   */
  onBulkDelete?: (
    rows: Row<TData>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;

  /**
   * Callback when bulk copy is triggered
   */
  onBulkCopy?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;

  /**
   * Callback when bulk export is triggered
   */
  onBulkExport?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;

  /**
   * Custom actions rendered in the bulk actions menu after export and before delete.
   */
  customBulkActions?: CustomBulkActionsInput<TData>;

  /**
   * Callback used by custom actions that explicitly request selection clearing.
   */
  onClearSelection?: () => void;

  /**
   * Callback when menu is closed
   */
  onClose?: () => void;

  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Whether export action should be shown
   */
  showBulkExport?: boolean;

  /**
   * Whether bulk edit action should be shown
   */
  showBulkEdit?: boolean;

  /**
   * Whether bulk delete action should be shown
   */
  showBulkDelete?: boolean;

  /**
   * Controls whether the menu is anchored to the table or fixed to the viewport.
   */
  positionMode?: BulkActionsMenuPositionMode;

  /**
   * Whether the menu should show a cross-page select all action.
   */
  canSelectAll?: boolean;

  /**
   * Total number of rows that can be selected across pages.
   */
  selectAllCount?: number;

  /**
   * Callback to select all matching rows across pages.
   */
  onSelectAll?: () => Promise<void> | void;

  /**
   * Whether the cross-page selection is loading.
   */
  isSelectingAll?: boolean;

  /**
   * Additional offset from the viewport bottom when the menu is fixed.
   */
  viewportBottomOffset?: number;
}

export interface BuiltInBulkActionTab {
  disabled?: boolean;
  icon: ComponentType<{ className?: string; size?: number }>;
  id: MenuActionId;
  kind: "built-in";
  translationKey: string;
  translationParams?: Record<string, number | string>;
  variant: BulkActionVariant;
}

export interface CustomBulkActionTab<TData> {
  action: BulkAction<TData>;
  disabled: boolean;
  icon: ComponentType<{ className?: string; size?: number }>;
  id: string;
  kind: "custom";
  label: string;
  variant: BulkActionVariant;
}

export type BulkActionsMenuActionTab<TData> =
  | BuiltInBulkActionTab
  | CustomBulkActionTab<TData>;

interface BulkActionsMenuActionTabsOptions<TData> {
  canSelectAll: boolean;
  customBulkActions?: CustomBulkActionsInput<TData>;
  isSelectingAll: boolean;
  selectAllCount?: number;
  selectedRows: Row<TData>[];
  showBulkDelete: boolean;
  showBulkEdit: boolean;
  showBulkExport: boolean;
}

type MenuActionId = "copy" | "delete" | "edit" | "export" | "selectAll";
type ConfirmableMenuActionId = "copy" | "delete";
type ExecutableBulkActionId = Exclude<MenuActionId, "selectAll">;
export type BulkActionsMenuPositionMode = "anchored" | "fixed";

interface BulkMenuOutsideClickState {
  hoveredAction: string | null;
  isConfirmingAction: boolean;
  selectedAction: string | null;
  showConfirmation: boolean;
}

const DEFAULT_BULK_ACTION_RESULTS: Record<
  ExecutableBulkActionId,
  BulkActionResult
> = {
  copy: {
    clearSelection: false,
    closeMenu: true,
    success: true,
  },
  delete: {
    clearSelection: false,
    closeMenu: false,
    success: false,
  },
  edit: {
    clearSelection: false,
    closeMenu: true,
    success: true,
  },
  export: {
    clearSelection: false,
    closeMenu: true,
    success: true,
  },
};

const DEFAULT_CUSTOM_BULK_ACTION_RESULT: BulkActionResult = {
  clearSelection: false,
  closeMenu: true,
  success: true,
};

const DEFAULT_CUSTOM_BULK_ACTION_FAILURE_RESULT: BulkActionResult = {
  clearSelection: false,
  closeMenu: false,
  success: false,
};

// Animation variants.
const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isExpanded: boolean) => ({
    gap: isExpanded ? ".5rem" : 0,
    paddingLeft: isExpanded ? "1rem" : ".5rem",
    paddingRight: isExpanded ? "1rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = {
  delay: 0.1,
  type: "spring" as const,
  bounce: 0,
  duration: 0.6,
};

export function getBulkActionsMenuPositionMode(
  isTableBottomVisible: boolean
): BulkActionsMenuPositionMode {
  return isTableBottomVisible ? "anchored" : "fixed";
}

export function getBulkActionsMenuWrapperClassName({
  className,
  positionMode,
}: {
  className?: string;
  positionMode: BulkActionsMenuPositionMode;
}): string {
  return cn(
    "z-50 flex w-full justify-center",
    "fade-in-0 slide-in-from-bottom-2 pointer-events-none animate-in",
    "duration-300 ease-out",
    positionMode === "anchored" && "px-0",
    positionMode === "fixed" && "fixed inset-x-0 bottom-6 px-4",
    className
  );
}

export function getBulkActionsMenuWrapperStyle({
  positionMode,
  viewportBottomOffset,
}: {
  positionMode: BulkActionsMenuPositionMode;
  viewportBottomOffset?: number;
}): CSSProperties | undefined {
  if (positionMode !== "fixed" || viewportBottomOffset === undefined) {
    return;
  }

  return {
    bottom: viewportBottomOffset,
  };
}

export function shouldRenderBulkActionsMenu<TData>(
  selectedRows: Row<TData>[] | undefined
): boolean {
  return Boolean(selectedRows && selectedRows.length > 0);
}

export function createBulkActionContext<TData>(
  selectedRows: Row<TData>[]
): BulkActionContext<TData> {
  return {
    selectedRows,
    selectedOriginalRows: selectedRows.map((row) => row.original),
    selectedCount: selectedRows.length,
  };
}

const isValidBulkAction = <TData,>(
  value: unknown
): value is BulkAction<TData> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const action = value as Partial<BulkAction<TData>>;

  return (
    typeof action.id === "string" &&
    action.id.length > 0 &&
    typeof action.label === "string" &&
    action.label.length > 0 &&
    typeof action.icon === "function" &&
    typeof action.onClick === "function"
  );
};

export function resolveCustomBulkActions<TData>({
  context,
  customBulkActions,
}: {
  context: BulkActionContext<TData>;
  customBulkActions?: CustomBulkActionsInput<TData>;
}): BulkAction<TData>[] {
  if (!customBulkActions) {
    return [];
  }

  const resolvedActions =
    typeof customBulkActions === "function"
      ? customBulkActions(context)
      : customBulkActions;

  if (!Array.isArray(resolvedActions)) {
    return [];
  }

  return resolvedActions.filter(isValidBulkAction<TData>);
}

export function resolveBulkActionDisabled<TData>({
  action,
  context,
}: {
  action: BulkAction<TData>;
  context: BulkActionContext<TData>;
}): boolean {
  if (typeof action.disabled === "function") {
    return action.disabled(context);
  }

  return action.disabled === true;
}

export function buildBulkActionsMenuActionTabs<TData>({
  canSelectAll,
  customBulkActions,
  isSelectingAll,
  selectAllCount,
  selectedRows,
  showBulkDelete,
  showBulkEdit,
  showBulkExport,
}: BulkActionsMenuActionTabsOptions<TData>): BulkActionsMenuActionTab<TData>[] {
  const selectedCount = selectedRows.length;
  const context = createBulkActionContext(selectedRows);
  const customActionTabs = resolveCustomBulkActions({
    context,
    customBulkActions,
  }).map((action) => ({
    action,
    disabled: resolveBulkActionDisabled({ action, context }),
    icon: action.icon,
    id: action.id,
    kind: "custom" as const,
    label: action.label,
    variant: action.variant ?? "default",
  }));

  return [
    ...(canSelectAll
      ? [
          {
            id: "selectAll" as const,
            icon: isSelectingAll ? Loader2 : CheckCheck,
            kind: "built-in" as const,
            translationKey: "bulk.select_all",
            translationParams: {
              count: selectAllCount ?? selectedCount,
            },
            variant: "default" as const,
            disabled: isSelectingAll,
          },
        ]
      : []),
    ...(showBulkEdit
      ? [
          {
            id: "edit" as const,
            icon: Edit,
            kind: "built-in" as const,
            translationKey: "actions.edit",
            variant: "default" as const,
          },
        ]
      : []),
    {
      id: "copy" as const,
      icon: Copy,
      kind: "built-in" as const,
      translationKey: "actions.copy",
      variant: "default" as const,
    },
    ...(showBulkExport
      ? [
          {
            id: "export" as const,
            icon: Download,
            kind: "built-in" as const,
            translationKey: "actions.export",
            variant: "default" as const,
          },
        ]
      : []),
    ...customActionTabs,
    ...(showBulkDelete
      ? [
          {
            id: "delete" as const,
            icon: Trash2,
            kind: "built-in" as const,
            translationKey: "actions.delete",
            variant: "destructive" as const,
          },
        ]
      : []),
  ];
}

export async function executeCustomBulkAction<TData>({
  action,
  context,
}: {
  action: BulkAction<TData>;
  context: BulkActionContext<TData>;
}): Promise<BulkActionResult | undefined> {
  if (resolveBulkActionDisabled({ action, context })) {
    return;
  }

  try {
    const rawResult = await Promise.resolve(action.onClick(context));
    return normalizeBulkActionResult(
      rawResult,
      DEFAULT_CUSTOM_BULK_ACTION_RESULT
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Bulk action failed.";
    return {
      ...DEFAULT_CUSTOM_BULK_ACTION_FAILURE_RESULT,
      message,
    };
  }
}

export function applyCustomBulkActionResult({
  onClearSelection,
  onDismissMenu,
  result,
}: {
  onClearSelection?: () => void;
  onDismissMenu?: () => void;
  result: BulkActionResult;
}): void {
  if (result.clearSelection) {
    onClearSelection?.();
  }

  if (result.closeMenu) {
    onDismissMenu?.();
  }
}

function showBulkActionResultMessage(result: BulkActionResult): void {
  if (!result.message || result.message.trim().length === 0) {
    return;
  }

  if (result.success) {
    toast.success(result.message);
    return;
  }

  toast.error(result.message);
}

export function shouldIgnoreOutsideClickForBulkMenu(
  state: Pick<
    BulkMenuOutsideClickState,
    "isConfirmingAction" | "showConfirmation"
  >
): boolean {
  return state.showConfirmation || state.isConfirmingAction;
}

export function getBulkMenuStateAfterOutsideClick(
  state: BulkMenuOutsideClickState
): BulkMenuOutsideClickState {
  if (shouldIgnoreOutsideClickForBulkMenu(state)) {
    return state;
  }

  return {
    ...state,
    hoveredAction: null,
    selectedAction: null,
    showConfirmation: false,
  };
}

async function executeImmediateBulkAction<TData>({
  actionId,
  onBulkEdit,
  onBulkExport,
  selectedRows,
}: {
  actionId: "edit" | "export";
  onBulkEdit?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkExport?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  selectedRows: Row<TData>[];
}): Promise<BulkActionResult> {
  try {
    if (actionId === "edit") {
      const rawResult = await Promise.resolve(onBulkEdit?.(selectedRows));
      return normalizeBulkActionResult(
        rawResult,
        DEFAULT_BULK_ACTION_RESULTS[actionId]
      );
    }

    const rawResult = await Promise.resolve(onBulkExport?.(selectedRows));
    return normalizeBulkActionResult(
      rawResult,
      DEFAULT_BULK_ACTION_RESULTS[actionId]
    );
  } catch {
    return {
      ...DEFAULT_BULK_ACTION_RESULTS[actionId],
      closeMenu: false,
      success: false,
    };
  }
}

async function executeConfirmableBulkAction<TData>({
  action,
  onBulkCopy,
  onBulkDelete,
  selectedRows,
}: {
  action: ConfirmableMenuActionId;
  onBulkCopy?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkDelete?: (
    rows: Row<TData>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;
  selectedRows: Row<TData>[];
}): Promise<BulkActionResult> {
  try {
    if (action === "copy") {
      const rawResult = await Promise.resolve(onBulkCopy?.(selectedRows));
      return normalizeBulkActionResult(
        rawResult,
        DEFAULT_BULK_ACTION_RESULTS[action]
      );
    }

    const rawResult = await Promise.resolve(onBulkDelete?.(selectedRows));
    return normalizeBulkActionResult(
      rawResult,
      DEFAULT_BULK_ACTION_RESULTS[action]
    );
  } catch {
    return {
      ...DEFAULT_BULK_ACTION_RESULTS[action],
      closeMenu: false,
      success: false,
    };
  }
}

export async function executeConfirmableBulkActionWithLock<TData>({
  action,
  lockRef,
  onBulkCopy,
  onBulkDelete,
  selectedRows,
}: {
  action: ConfirmableMenuActionId;
  lockRef: { current: boolean };
  onBulkCopy?: (
    rows: Row<TData>[]
  ) => Promise<BulkActionCustomHandlerResult> | BulkActionCustomHandlerResult;
  onBulkDelete?: (
    rows: Row<TData>[]
  ) => Promise<BulkDeleteCustomHandlerResult> | BulkDeleteCustomHandlerResult;
  selectedRows: Row<TData>[];
}): Promise<BulkActionResult | undefined> {
  if (lockRef.current) {
    return;
  }

  lockRef.current = true;
  try {
    return await executeConfirmableBulkAction({
      action,
      onBulkCopy,
      onBulkDelete,
      selectedRows,
    });
  } finally {
    lockRef.current = false;
  }
}

/**
 * BulkActionsMenu Component
 *
 * Displays an overlay menu with expandable tabs for bulk actions
 * when multiple rows are selected in the data table
 */
export function BulkActionsMenu<TData>({
  selectedRows,
  onBulkEdit,
  onBulkDelete,
  onBulkCopy,
  onBulkExport,
  customBulkActions,
  onClearSelection,
  onClose,
  className,
  showBulkExport = true,
  showBulkEdit = true,
  showBulkDelete = true,
  positionMode = "anchored",
  canSelectAll = false,
  selectAllCount,
  onSelectAll,
  isSelectingAll = false,
  viewportBottomOffset,
}: BulkActionsMenuProps<TData>) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [dismissedSelectionKey, setDismissedSelectionKey] = useState<
    string | null
  >(null);
  const pendingActionRef = useRef<BulkActionsMenuActionTab<TData> | null>(null);
  const confirmationLockRef = useRef(false);
  const outsideClickRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslations();
  const showSelectAllAction = canSelectAll && typeof onSelectAll === "function";
  const selectedRowsKey = useMemo(
    () => selectedRows.map((row) => row.id).join("|"),
    [selectedRows]
  );
  const actionContext = useMemo(
    () => createBulkActionContext(selectedRows),
    [selectedRows]
  );
  const selectedCount = actionContext.selectedCount;
  const actionTabs = useMemo(
    () =>
      buildBulkActionsMenuActionTabs({
        canSelectAll: showSelectAllAction,
        customBulkActions,
        isSelectingAll,
        selectAllCount,
        selectedRows,
        showBulkDelete,
        showBulkEdit,
        showBulkExport,
      }),
    [
      customBulkActions,
      isSelectingAll,
      selectAllCount,
      selectedRows,
      showBulkDelete,
      showBulkEdit,
      showBulkExport,
      showSelectAllAction,
    ]
  );

  useOnClickOutside(outsideClickRef as RefObject<HTMLElement>, () => {
    const nextState = getBulkMenuStateAfterOutsideClick({
      hoveredAction,
      isConfirmingAction,
      selectedAction,
      showConfirmation,
    });

    setHoveredAction(nextState.hoveredAction);
    setSelectedAction(nextState.selectedAction);
    setShowConfirmation(nextState.showConfirmation);
  });

  if (
    !shouldRenderBulkActionsMenu(selectedRows) ||
    dismissedSelectionKey === selectedRowsKey
  ) {
    return null;
  }

  const dismissMenu = () => {
    setDismissedSelectionKey(selectedRowsKey);
  };

  const handleCustomActionResult = (result: BulkActionResult | undefined) => {
    if (!result) {
      return;
    }

    showBulkActionResultMessage(result);
    applyCustomBulkActionResult({
      result,
      onClearSelection: onClearSelection ?? onClose,
      onDismissMenu: dismissMenu,
    });
  };

  const handleTabClick = (tab: BulkActionsMenuActionTab<TData>) => {
    if (isConfirmingAction) {
      return;
    }

    if (tab.disabled) {
      return;
    }

    if (tab.kind === "custom") {
      if (tab.action.confirm) {
        pendingActionRef.current = tab;
        setSelectedAction(tab.id);
        setShowConfirmation(true);
        return;
      }

      executeCustomBulkAction({
        action: tab.action,
        context: actionContext,
      }).then(handleCustomActionResult);
      return;
    }

    if (tab.id === "selectAll") {
      if (!onSelectAll || isSelectingAll) {
        return;
      }

      Promise.resolve(onSelectAll()).catch(() => undefined);
      return;
    }

    if (tab.id === "edit" || tab.id === "export") {
      executeImmediateBulkAction({
        actionId: tab.id,
        onBulkEdit,
        onBulkExport,
        selectedRows,
      }).then((result) => {
        if (result.closeMenu) {
          onClose?.();
        }
      });
      return;
    }

    pendingActionRef.current = tab;
    setSelectedAction(tab.id);
    setShowConfirmation(true);
  };

  const handleConfirmAction = () => {
    const pendingAction = pendingActionRef.current;
    if (!pendingAction || confirmationLockRef.current || isConfirmingAction) {
      return;
    }

    setIsConfirmingAction(true);
    if (pendingAction.kind === "custom") {
      confirmationLockRef.current = true;
      executeCustomBulkAction({
        action: pendingAction.action,
        context: actionContext,
      })
        .then(handleCustomActionResult)
        .finally(() => {
          confirmationLockRef.current = false;
          pendingActionRef.current = null;
          setSelectedAction(null);
          setShowConfirmation(false);
          setIsConfirmingAction(false);
        });
      return;
    }

    if (pendingAction.id !== "copy" && pendingAction.id !== "delete") {
      pendingActionRef.current = null;
      setSelectedAction(null);
      setShowConfirmation(false);
      setIsConfirmingAction(false);
      return;
    }

    executeConfirmableBulkActionWithLock({
      action: pendingAction.id,
      lockRef: confirmationLockRef,
      onBulkCopy,
      onBulkDelete,
      selectedRows,
    })
      .then((result) => {
        if (result?.closeMenu) {
          onClose?.();
        }
      })
      .finally(() => {
        pendingActionRef.current = null;
        setSelectedAction(null);
        setShowConfirmation(false);
        setIsConfirmingAction(false);
      });
  };

  const handleCancel = () => {
    if (isConfirmingAction || confirmationLockRef.current) {
      return;
    }
    pendingActionRef.current = null;
    setSelectedAction(null);
    setShowConfirmation(false);
  };

  const handleClose = () => {
    if (isConfirmingAction || confirmationLockRef.current) {
      return;
    }
    pendingActionRef.current = null;
    setSelectedAction(null);
    setHoveredAction(null);
    setShowConfirmation(false);
    onClose?.();
  };

  const getSelectedAction = () => {
    return actionTabs.find((tab) => tab.id === selectedAction);
  };

  const getActionLabel = (tab: BulkActionsMenuActionTab<TData> | undefined) => {
    if (!tab) {
      return "";
    }

    return tab.kind === "custom"
      ? tab.label
      : t(tab.translationKey, tab.translationParams);
  };

  const resolveConfirmText = (
    value: string | ((ctx: BulkActionContext<TData>) => string) | undefined
  ) => {
    return typeof value === "function" ? value(actionContext) : value;
  };

  const getConfirmationTitle = () => {
    const currentAction = getSelectedAction();
    if (currentAction?.kind === "custom") {
      const customTitle = resolveConfirmText(
        currentAction.action.confirm?.title
      );
      if (customTitle) {
        return customTitle;
      }
    }

    return t("bulk.confirm_title", {
      action: getActionLabel(currentAction),
      count: selectedCount,
    });
  };

  const getConfirmationDescription = () => {
    const currentAction = getSelectedAction();
    if (currentAction?.kind === "custom") {
      const customDescription = resolveConfirmText(
        currentAction.action.confirm?.description
      );
      if (customDescription) {
        return customDescription;
      }
    }

    if (currentAction?.variant === "destructive") {
      return t("bulk.confirm_delete_description");
    }

    return t("bulk.confirm_copy_description", {
      count: selectedCount,
    });
  };

  const getCancelLabel = () => {
    const currentAction = getSelectedAction();
    if (currentAction?.kind === "custom") {
      const cancelLabel = resolveConfirmText(
        currentAction.action.confirm?.cancelLabel
      );
      if (cancelLabel) {
        return cancelLabel;
      }
    }

    return t("actions.cancel");
  };

  const getConfirmLabel = () => {
    const currentAction = getSelectedAction();
    if (isConfirmingAction) {
      return t("common.loading");
    }

    if (currentAction?.kind === "custom") {
      const confirmLabel = resolveConfirmText(
        currentAction.action.confirm?.confirmLabel
      );
      if (confirmLabel) {
        return confirmLabel;
      }
    }

    return t("actions.confirm");
  };

  const selectedActionTab = getSelectedAction();

  return (
    <LazyMotion features={domAnimation}>
      <div
        className={getBulkActionsMenuWrapperClassName({
          className,
          positionMode,
        })}
        style={getBulkActionsMenuWrapperStyle({
          positionMode,
          viewportBottomOffset,
        })}
      >
        <div className="pointer-events-auto flex flex-col items-center gap-4">
          {/* Confirmation dialog (consistent AlertDialog for copy/delete) */}
          <AlertDialog
            onOpenChange={(open) => {
              if (
                !(open || isConfirmingAction || confirmationLockRef.current)
              ) {
                handleCancel();
              }
            }}
            open={showConfirmation && !!selectedAction}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{getConfirmationTitle()}</AlertDialogTitle>
                <AlertDialogDescription>
                  {getConfirmationDescription()}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isConfirmingAction}
                  onClick={handleCancel}
                >
                  {getCancelLabel()}
                </AlertDialogCancel>
                <AlertDialogAction
                  className={
                    selectedActionTab?.variant === "destructive"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                  disabled={isConfirmingAction}
                  onClick={handleConfirmAction}
                >
                  {getConfirmLabel()}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Main menu with custom expandable tabs */}
          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-secondary/95 p-1 text-secondary-foreground shadow-xl backdrop-blur-md"
            ref={outsideClickRef}
          >
            {/* Count indicator */}
            <div className="flex items-center gap-2 px-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-medium text-secondary-foreground text-sm">
                {t("selection.rows", { count: selectedCount })}
              </span>
            </div>

            {/* Action tabs */}
            {actionTabs.map((tab) => {
              const Icon = tab.icon;
              const isExpanded =
                hoveredAction === tab.id || selectedAction === tab.id;

              return (
                <m.button
                  animate="animate"
                  className={cn(
                    "relative flex items-center rounded-xl px-4 py-2 font-medium text-sm transition-colors duration-300",
                    tab.disabled &&
                      (tab.kind === "built-in" && tab.id === "selectAll"
                        ? "cursor-wait opacity-70"
                        : "cursor-not-allowed opacity-50"),
                    tab.variant === "destructive"
                      ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                      : "text-secondary-foreground/70 hover:bg-background/80 hover:text-secondary-foreground"
                  )}
                  custom={isExpanded}
                  disabled={tab.disabled}
                  initial={false}
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  onMouseEnter={() => setHoveredAction(tab.id)}
                  onMouseLeave={() => setHoveredAction(null)}
                  transition={transition}
                  type="button"
                  variants={buttonVariants}
                >
                  <Icon
                    className={cn(
                      tab.kind === "built-in" &&
                        tab.id === "selectAll" &&
                        isSelectingAll &&
                        "animate-spin"
                    )}
                    size={20}
                  />
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <m.span
                        animate="animate"
                        className="overflow-hidden whitespace-nowrap"
                        exit="exit"
                        initial="initial"
                        transition={transition}
                        variants={spanVariants}
                      >
                        {getActionLabel(tab)}
                      </m.span>
                    )}
                  </AnimatePresence>
                </m.button>
              );
            })}

            {/* Separator */}
            <div
              aria-hidden="true"
              className="mx-1 h-[24px] w-[1.2px] bg-border/80"
            />

            {/* Close button */}
            <Button
              aria-label={t("bulk.close_menu")}
              className="h-8 w-8 p-0 text-secondary-foreground/70 hover:bg-background/80 hover:text-secondary-foreground"
              onClick={handleClose}
              size="sm"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}
