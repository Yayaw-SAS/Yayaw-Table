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
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import type {
  BulkDeleteActionExecutionResult,
  BulkDeleteCustomHandlerResult,
} from "../../hooks/use-bulk-actions";
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
  onBulkEdit?: (rows: Row<TData>[]) => Promise<void> | void;

  /**
   * Callback when bulk delete is triggered
   */
  onBulkDelete?: (
    rows: Row<TData>[]
  ) =>
    | Promise<
        | boolean
        | BulkDeleteActionExecutionResult
        | BulkDeleteCustomHandlerResult
      >
    | boolean
    | BulkDeleteActionExecutionResult
    | BulkDeleteCustomHandlerResult;

  /**
   * Callback when bulk copy is triggered
   */
  onBulkCopy?: (rows: Row<TData>[]) => Promise<void> | void;

  /**
   * Callback when bulk export is triggered
   */
  onBulkExport?: (rows: Row<TData>[]) => void | Promise<void>;

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
  id: string;
  icon: React.ComponentType<{ size?: number }>;
  translationKey: string;
  variant: "default" | "destructive";
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function shouldCloseBulkActionsMenuAfterDelete(
  deleteResult: unknown
): boolean {
  if (typeof deleteResult === "boolean") {
    return deleteResult;
  }

  if (!isRecord(deleteResult)) {
    return false;
  }

  if (typeof deleteResult.closeMenu === "boolean") {
    return deleteResult.closeMenu;
  }

  if (typeof deleteResult.success === "boolean") {
    return deleteResult.success;
  }

  return false;
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
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const outsideClickRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslations();

  // Only show actions that have handlers. Edit is shown when onBulkEdit is provided.
  const actionTabs: ActionTab[] = [
    ...(onBulkEdit
      ? [
          {
            id: "edit",
            icon: Edit,
            translationKey: "actions.edit",
            variant: "default" as const,
          },
        ]
      : []),
    {
      id: "copy",
      icon: Copy,
      translationKey: "actions.copy",
      variant: "default",
    },
    ...(showBulkExport
      ? [
          {
            id: "export",
            icon: Download,
            translationKey: "actions.export",
            variant: "default" as const,
          },
        ]
      : []),
    {
      id: "delete",
      icon: Trash2,
      translationKey: "actions.delete",
      variant: "destructive",
    },
  ];

  useOnClickOutside(outsideClickRef as React.RefObject<HTMLElement>, () => {
    setSelectedAction(null);
    setHoveredAction(null);
    setShowConfirmation(false);
  });

  // Don't render if no rows are selected
  if (!selectedRows || selectedRows.length === 0) {
    return null;
  }

  const selectedCount = selectedRows.length;

  const handleTabClick = (actionId: string) => {
    // Pour l'édition, ouvrir directement le formulaire sans confirmation
    if (actionId === "edit") {
      Promise.resolve(onBulkEdit?.(selectedRows)).finally(() => {
        onClose?.();
      });
      return;
    }

    if (actionId === "export") {
      Promise.resolve(onBulkExport?.(selectedRows)).finally(() => {
        onClose?.();
      });
      return;
    }

    // Pour les autres actions, afficher la confirmation
    setSelectedAction(actionId);
    setShowConfirmation(true);
  };

  const handleConfirmAction = () => {
    if (!selectedAction) {
      return;
    }

    // Execute action based on ID
    switch (selectedAction) {
      case "copy":
        Promise.resolve(onBulkCopy?.(selectedRows)).finally(() => {
          setSelectedAction(null);
          setShowConfirmation(false);
          onClose?.();
        });
        break;
      case "delete":
        Promise.resolve(onBulkDelete?.(selectedRows))
          .then((result) => {
            setSelectedAction(null);
            setShowConfirmation(false);

            if (shouldCloseBulkActionsMenuAfterDelete(result)) {
              onClose?.();
            }
          })
          .catch(() => {
            setSelectedAction(null);
            setShowConfirmation(false);
          });
        break;
      default:
        setSelectedAction(null);
        setShowConfirmation(false);
        onClose?.();
        break;
    }
  };

  const handleCancel = () => {
    setSelectedAction(null);
    setShowConfirmation(false);
  };

  const handleClose = () => {
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
            if (!open) {
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
              <AlertDialogCancel onClick={handleCancel}>
                {t("actions.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                className={
                  selectedAction === "delete"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                onClick={handleConfirmAction}
              >
                {t("actions.confirm")}
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
