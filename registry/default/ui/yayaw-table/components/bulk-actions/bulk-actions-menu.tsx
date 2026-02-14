/**
 * Bulk Actions Menu Component
 * An overlay menu that appears when rows are selected, using expandable tabs design
 */
"use client";

import type { Row } from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Download, Edit, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
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
}

// Configuration pour les tabs d'actions
interface ActionTab {
  id: MenuActionId;
  icon: React.ComponentType<{ size?: number }>;
  translationKey: string;
  variant: "default" | "destructive";
}

type MenuActionId = "copy" | "delete" | "edit" | "export";
type ConfirmableMenuActionId = "copy" | "delete";

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

  // Only show actions that have handlers. Edit is shown when onBulkEdit is provided.
  const actionTabs: ActionTab[] = [
    ...(onBulkEdit
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
    {
      id: "delete" as const,
      icon: Trash2,
      translationKey: "actions.delete",
      variant: "destructive",
    },
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

  const selectedCount = selectedRows.length;

  const handleTabClick = (actionId: MenuActionId) => {
    if (isConfirmingAction) {
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
    <div
      className={cn(
        "fixed bottom-10 left-1/2 z-50 -translate-x-1/2 transform",
        "fade-in-0 slide-in-from-bottom-2 animate-in",
        "duration-300 ease-out",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-4">
        {/* Confirmation dialog (consistent AlertDialog for copy/delete) */}
        <AlertDialog
          onOpenChange={(open) => {
            if (!(open || isConfirmingAction || confirmationLockRef.current)) {
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
          className="flex flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-1 shadow-lg backdrop-blur-sm"
          ref={outsideClickRef}
        >
          {/* Count indicator */}
          <div className="flex items-center gap-2 px-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="font-medium text-foreground text-sm">
              {t("selection.rows", { count: selectedCount })}
            </span>
          </div>

          {/* Action tabs */}
          {actionTabs.map((tab) => {
            const Icon = tab.icon;
            const isExpanded =
              hoveredAction === tab.id || selectedAction === tab.id;

            return (
              <motion.button
                animate="animate"
                className={cn(
                  "relative flex items-center rounded-xl px-4 py-2 font-medium text-sm transition-colors duration-300",
                  tab.variant === "destructive"
                    ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                custom={isExpanded}
                initial={false}
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                onMouseEnter={() => setHoveredAction(tab.id)}
                onMouseLeave={() => setHoveredAction(null)}
                transition={transition}
                type="button"
                variants={buttonVariants}
              >
                <Icon size={20} />
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.span
                      animate="animate"
                      className="overflow-hidden whitespace-nowrap"
                      exit="exit"
                      initial="initial"
                      transition={transition}
                      variants={spanVariants}
                    >
                      {t(tab.translationKey)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}

          {/* Separator */}
          <div
            aria-hidden="true"
            className="mx-1 h-[24px] w-[1.2px] bg-border"
          />

          {/* Close button */}
          <Button
            aria-label={t("bulk.close_menu")}
            className="h-8 w-8 p-0 hover:bg-muted"
            onClick={handleClose}
            size="sm"
            variant="ghost"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
