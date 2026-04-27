/**
 * Bulk Actions Menu Component
 * An overlay menu that appears when rows are selected, using expandable tabs design
 */
"use client";

import type { Row } from "@tanstack/react-table";
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
import { type CSSProperties, useRef, useState } from "react";
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

// Configuration pour les tabs d'actions
interface ActionTab {
  id: MenuActionId;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  translationKey: string;
  translationParams?: Record<string, number | string>;
  variant: "default" | "destructive";
  disabled?: boolean;
}

type MenuActionId = "copy" | "delete" | "edit" | "export" | "selectAll";
type ConfirmableMenuActionId = "copy" | "delete";
export type BulkActionsMenuPositionMode = "anchored" | "fixed";

interface BulkMenuOutsideClickState {
  hoveredAction: string | null;
  isConfirmingAction: boolean;
  selectedAction: ConfirmableMenuActionId | null;
  showConfirmation: boolean;
}

const DEFAULT_BULK_ACTION_RESULTS: Record<MenuActionId, BulkActionResult> = {
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

// Variants pour les animations
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
  const [selectedAction, setSelectedAction] =
    useState<ConfirmableMenuActionId | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const pendingActionRef = useRef<ConfirmableMenuActionId | null>(null);
  const confirmationLockRef = useRef(false);
  const outsideClickRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslations();
  const showSelectAllAction = canSelectAll && typeof onSelectAll === "function";
  const selectedCount = selectedRows.length;

  // Action visibility is driven by explicit props.
  const actionTabs: ActionTab[] = [
    ...(showSelectAllAction
      ? [
          {
            id: "selectAll" as const,
            icon: isSelectingAll ? Loader2 : CheckCheck,
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
            translationKey: "actions.edit",
            variant: "default" as const,
          },
        ]
      : []),
    {
      id: "copy" as const,
      icon: Copy,
      translationKey: "actions.copy",
      variant: "default",
    },
    ...(showBulkExport
      ? [
          {
            id: "export" as const,
            icon: Download,
            translationKey: "actions.export",
            variant: "default" as const,
          },
        ]
      : []),
    ...(showBulkDelete
      ? [
          {
            id: "delete" as const,
            icon: Trash2,
            translationKey: "actions.delete",
            variant: "destructive" as const,
          },
        ]
      : []),
  ];

  useOnClickOutside(outsideClickRef as React.RefObject<HTMLElement>, () => {
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

  // Don't render if no rows are selected
  if (!selectedRows || selectedRows.length === 0) {
    return null;
  }

  const handleTabClick = (actionId: MenuActionId) => {
    if (isConfirmingAction) {
      return;
    }

    if (actionId === "selectAll") {
      if (!onSelectAll || isSelectingAll) {
        return;
      }

      Promise.resolve(onSelectAll()).catch(() => undefined);
      return;
    }

    if (actionId === "edit" || actionId === "export") {
      executeImmediateBulkAction({
        actionId,
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

    pendingActionRef.current = actionId;
    setSelectedAction(actionId);
    setShowConfirmation(true);
  };

  const handleConfirmAction = () => {
    const pendingAction = pendingActionRef.current;
    if (!pendingAction || confirmationLockRef.current || isConfirmingAction) {
      return;
    }

    setIsConfirmingAction(true);
    executeConfirmableBulkActionWithLock({
      action: pendingAction,
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

  // deprecated: button variant now handled by AlertDialogAction styling

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
                <AlertDialogTitle>
                  {t("bulk.confirm_title", {
                    action: t(getSelectedAction()?.translationKey || ""),
                    count: selectedCount,
                  })}
                </AlertDialogTitle>
                {selectedAction === "delete" ? (
                  <AlertDialogDescription>
                    {t("bulk.confirm_delete_description")}
                  </AlertDialogDescription>
                ) : (
                  <AlertDialogDescription>
                    {t("bulk.confirm_copy_description", {
                      count: selectedCount,
                    })}
                  </AlertDialogDescription>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isConfirmingAction}
                  onClick={handleCancel}
                >
                  {t("actions.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className={
                    selectedAction === "delete"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                  disabled={isConfirmingAction}
                  onClick={handleConfirmAction}
                >
                  {isConfirmingAction
                    ? t("common.loading")
                    : t("actions.confirm")}
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
                    tab.disabled && "cursor-wait opacity-70",
                    tab.variant === "destructive"
                      ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                      : "text-secondary-foreground/70 hover:bg-background/80 hover:text-secondary-foreground"
                  )}
                  custom={isExpanded}
                  disabled={tab.disabled}
                  initial={false}
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  onMouseEnter={() => setHoveredAction(tab.id)}
                  onMouseLeave={() => setHoveredAction(null)}
                  transition={transition}
                  type="button"
                  variants={buttonVariants}
                >
                  <Icon
                    className={cn(
                      tab.id === "selectAll" && isSelectingAll && "animate-spin"
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
                        {t(tab.translationKey, tab.translationParams)}
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
