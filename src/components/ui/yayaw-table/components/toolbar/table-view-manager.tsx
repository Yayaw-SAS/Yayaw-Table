"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  LayoutList,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Input } from "@/src/components/ui/input";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import {
  useTableActions as useProviderTableActions,
  useTranslations,
} from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";
import type {
  TableView,
  TableViewActions,
  TableViewConfig,
} from "../../types/view-types";
import { createLocalTableViewActions } from "../../utils/table-view-storage";
import { areTableViewConfigsEqual } from "../../utils/table-view-state";

interface DataTableViewManagerProps {
  allowViewSave?: boolean;
  allowViewSharing?: boolean;
  className?: string;
  defaultDisplayMode?: TableDisplayMode;
  initialActiveViewId?: string;
  initialViews?: TableView[];
  tableId: string;
  tableType: string;
}

function getViewErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getCurrentViewLabel({
  activeView,
  fallbackDefaultLabel,
  fallbackTemporaryLabel,
  viewParam,
}: {
  activeView?: TableView;
  fallbackDefaultLabel: string;
  fallbackTemporaryLabel: string;
  viewParam: null | string;
}): string {
  if (activeView) {
    return activeView.name;
  }

  if (viewParam) {
    return fallbackTemporaryLabel;
  }

  return fallbackDefaultLabel;
}

function hasTableUrlState(tableId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.has("view")) {
    return true;
  }

  for (const key of searchParams.keys()) {
    if (key.startsWith(`${tableId}-`)) {
      return true;
    }
  }

  return false;
}

function mergeViewActions({
  fallbackActions,
  providedActions,
}: {
  fallbackActions: Required<TableViewActions>;
  providedActions?: TableViewActions;
}): Required<TableViewActions> {
  return {
    create: providedActions?.create ?? fallbackActions.create,
    delete: providedActions?.delete ?? fallbackActions.delete,
    list: providedActions?.list ?? fallbackActions.list,
    update: providedActions?.update ?? fallbackActions.update,
  };
}

interface ViewWriteMenuItemsProps {
  canCreateView: boolean;
  canDeleteActiveView: boolean;
  onDeleteActiveView: () => Promise<void>;
  onOpenSaveDialog: () => void;
  t: ReturnType<typeof useTranslations>["t"];
}

function ViewWriteMenuItems({
  canCreateView,
  canDeleteActiveView,
  onDeleteActiveView,
  onOpenSaveDialog,
  t,
}: ViewWriteMenuItemsProps) {
  if (!(canCreateView || canDeleteActiveView)) {
    return null;
  }

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {canCreateView && (
          <DropdownMenuItem onClick={onOpenSaveDialog}>
            <Plus className="h-4 w-4" />
            <span>{t("views.saveAs")}</span>
          </DropdownMenuItem>
        )}
        {canDeleteActiveView && (
          <DropdownMenuItem
            onClick={() => {
              onDeleteActiveView().catch(() => {
                /* Error state is handled by the mutation branch. */
              });
            }}
            variant="destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span>{t("views.delete")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuGroup>
    </>
  );
}

interface ViewWriteButtonsProps {
  allowViewSave: boolean;
  canCreateView: boolean;
  canUpdateActiveView: boolean;
  isActiveViewDirty: boolean;
  isMutating: boolean;
  onOpenSaveDialog: () => void;
  onUpdateActiveView: () => Promise<void>;
  t: ReturnType<typeof useTranslations>["t"];
}

function ViewWriteButtons({
  allowViewSave,
  canCreateView,
  canUpdateActiveView,
  isActiveViewDirty,
  isMutating,
  onOpenSaveDialog,
  onUpdateActiveView,
  t,
}: ViewWriteButtonsProps) {
  if (!allowViewSave) {
    return null;
  }

  return (
    <>
      <Button
        aria-label={t("views.saveChanges")}
        className="h-8 w-8 shrink-0"
        disabled={!canUpdateActiveView || !isActiveViewDirty || isMutating}
        onClick={() => {
          onUpdateActiveView().catch(() => {
            /* Error state is handled by the mutation branch. */
          });
        }}
        size="icon-sm"
        title={t("views.saveChangesTooltip")}
        type="button"
        variant={isActiveViewDirty ? "default" : "outline"}
      >
        <Save className="h-4 w-4" />
      </Button>

      <Button
        aria-label={t("views.add_view")}
        className="h-8 w-8 shrink-0"
        disabled={isMutating || !canCreateView}
        onClick={onOpenSaveDialog}
        size="icon-sm"
        title={t("views.add_view")}
        type="button"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </>
  );
}

interface ViewShareOptionProps {
  canShareView: boolean;
  isSharedView: boolean;
  onSharedViewChange: (value: boolean) => void;
  t: ReturnType<typeof useTranslations>["t"];
}

function ViewShareOption({
  canShareView,
  isSharedView,
  onSharedViewChange,
  t,
}: ViewShareOptionProps) {
  if (!canShareView) {
    return null;
  }

  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
      htmlFor="table-view-shared"
    >
      <Checkbox
        checked={isSharedView}
        id="table-view-shared"
        onCheckedChange={(value) => {
          onSharedViewChange(Boolean(value));
        }}
      />
      <span className="font-medium text-sm">
        {t("views.dialog.save.global")}
      </span>
    </label>
  );
}

export function DataTableViewManager({
  allowViewSave = true,
  allowViewSharing = false,
  className,
  defaultDisplayMode,
  initialActiveViewId,
  initialViews = [],
  tableId,
  tableType,
}: DataTableViewManagerProps) {
  const { t } = useTranslations();
  const getTableActions = useProviderTableActions();
  const tableActions = useMemo(
    () => getTableActions?.(tableType),
    [getTableActions, tableType]
  );
  const fallbackViewActions = useMemo(() => createLocalTableViewActions(), []);
  const viewActions = useMemo(
    () =>
      mergeViewActions({
        fallbackActions: fallbackViewActions,
        providedActions: tableActions?.views,
      }),
    [fallbackViewActions, tableActions?.views]
  );
  const queryClient = useQueryClient();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [viewName, setViewName] = useState("");
  const [dialogError, setDialogError] = useState<string>();
  const [inlineError, setInlineError] = useState<string>();
  const [isMutating, setIsMutating] = useState(false);
  const hasAppliedInitialViewRef = useRef(false);
  const {
    applyViewConfig,
    getCurrentViewConfig,
    resetUrlState,
    viewParam,
  } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const viewQueryKey = useMemo(
    () => ["tableViews", tableId, tableType],
    [tableId, tableType]
  );

  const { data: savedViews = [], isLoading } = useQuery({
    initialData: initialViews,
    queryFn: async () => {
      const result = await viewActions.list({ tableId, tableType });
      return result.data;
    },
    queryKey: viewQueryKey,
    staleTime: 5000,
  });

  const currentConfig = useMemo(
    () => getCurrentViewConfig(),
    [getCurrentViewConfig]
  );
  const activeView = useMemo(
    () => savedViews.find((view) => view.id === viewParam),
    [savedViews, viewParam]
  );
  const isActiveViewDirty = Boolean(
    activeView && !areTableViewConfigsEqual(currentConfig, activeView.config)
  );
  const canUpdateActiveView = Boolean(
    allowViewSave && activeView && !activeView.isSystem && viewActions.update
  );
  const canDeleteActiveView = Boolean(
    allowViewSave && activeView && !activeView.isSystem && viewActions.delete
  );
  const canCreateView = allowViewSave && Boolean(viewActions.create);
  const canShareView = canCreateView && allowViewSharing;
  const currentViewLabel = getCurrentViewLabel({
    activeView,
    fallbackDefaultLabel: t("views.defaultView"),
    fallbackTemporaryLabel: t("views.temporary_view"),
    viewParam,
  });
  const hasInitialUrlState = hasTableUrlState(tableId);
  const canApplyInitialView =
    !hasAppliedInitialViewRef.current && !viewParam && !hasInitialUrlState;
  const preferredInitialViewId =
    initialActiveViewId ?? savedViews.find((view) => view.isDefault)?.id;

  useEffect(() => {
    if (!(preferredInitialViewId && canApplyInitialView)) {
      return;
    }

    const initialView = savedViews.find((view) => view.id === preferredInitialViewId);
    if (!initialView) {
      return;
    }

    hasAppliedInitialViewRef.current = true;
    applyViewConfig(initialView.config, { viewId: initialView.id });
  }, [
    applyViewConfig,
    canApplyInitialView,
    preferredInitialViewId,
    savedViews,
  ]);

  const refreshViews = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: viewQueryKey,
    });
  }, [queryClient, viewQueryKey]);

  const handleSelectDefaultView = useCallback(() => {
    setInlineError(undefined);
    resetUrlState();
  }, [resetUrlState]);

  const handleSelectView = useCallback(
    (view: TableView) => {
      setInlineError(undefined);
      applyViewConfig(view.config, { viewId: view.id });
    },
    [applyViewConfig]
  );

  const openSaveDialog = useCallback(() => {
    if (!canCreateView) {
      return;
    }

    setDialogError(undefined);
    setIsSharedView(false);
    setViewName("");
    setIsSaveDialogOpen(true);
  }, [canCreateView]);

  const handleCreateView = useCallback(async () => {
    const trimmedName = viewName.trim();
    if (!trimmedName) {
      setDialogError(t("views.dialog.save.namePlaceholder"));
      return;
    }

    setIsMutating(true);
    setDialogError(undefined);
    try {
      const result = await viewActions.create({
        config: currentConfig,
        isGlobal: canShareView ? isSharedView : false,
        name: trimmedName,
        tableId,
        tableType,
      });
      if (!result.success || !result.data) {
        setDialogError(result.error || t("views.notifications.error.create"));
        return;
      }

      applyViewConfig(result.data.config, { viewId: result.data.id });
      await refreshViews();
      setIsSaveDialogOpen(false);
      setViewName("");
      toast.success(t("views.notifications.created"));
    } catch (error) {
      setDialogError(
        getViewErrorMessage(error, t("views.notifications.error.create"))
      );
    } finally {
      setIsMutating(false);
    }
  }, [
    applyViewConfig,
    canShareView,
    currentConfig,
    isSharedView,
    refreshViews,
    tableId,
    tableType,
    t,
    viewActions,
    viewName,
  ]);

  const handleUpdateActiveView = useCallback(async () => {
    if (!(activeView && canUpdateActiveView)) {
      return;
    }

    setIsMutating(true);
    setInlineError(undefined);
    try {
      const result = await viewActions.update(activeView.id, {
        config: currentConfig,
        name: activeView.name,
        tableId,
        tableType,
      });
      if (!result.success || !result.data) {
        setInlineError(result.error || t("views.notifications.error.update"));
        return;
      }

      applyViewConfig(result.data.config, { viewId: result.data.id });
      await refreshViews();
      toast.success(t("views.notifications.updated"));
    } catch (error) {
      setInlineError(
        getViewErrorMessage(error, t("views.notifications.error.update"))
      );
    } finally {
      setIsMutating(false);
    }
  }, [
    activeView,
    applyViewConfig,
    canUpdateActiveView,
    currentConfig,
    refreshViews,
    tableId,
    tableType,
    t,
    viewActions,
  ]);

  const handleDeleteActiveView = useCallback(async () => {
    if (!(activeView && canDeleteActiveView)) {
      return;
    }

    setIsMutating(true);
    setInlineError(undefined);
    try {
      const result = await viewActions.delete(activeView.id, {
        tableId,
        tableType,
      });
      if (!result.success) {
        setInlineError(result.error || t("views.notifications.error.delete"));
        return;
      }

      resetUrlState();
      await refreshViews();
      toast.success(t("views.notifications.deleted"));
    } catch (error) {
      setInlineError(
        getViewErrorMessage(error, t("views.notifications.error.delete"))
      );
    } finally {
      setIsMutating(false);
    }
  }, [
    activeView,
    canDeleteActiveView,
    refreshViews,
    resetUrlState,
    tableId,
    tableType,
    t,
    viewActions,
  ]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t("views.current")}
                className="h-8 min-w-0 max-w-[16rem] justify-between gap-2 px-3"
                disabled={isLoading}
                size="sm"
                type="button"
                variant="outline"
              >
                <LayoutList className="h-4 w-4 shrink-0" />
                <span className="truncate">{currentViewLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-64">
            <DropdownMenuGroup>
              <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                {t("views.title")}
              </div>
              <DropdownMenuItem onClick={handleSelectDefaultView}>
                {viewParam ? (
                  <span className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>{t("views.defaultView")}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {savedViews.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => {
                    handleSelectView(view);
                  }}
                >
                  {view.id === viewParam ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{view.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <ViewWriteMenuItems
              canCreateView={canCreateView}
              canDeleteActiveView={canDeleteActiveView}
              onDeleteActiveView={handleDeleteActiveView}
              onOpenSaveDialog={openSaveDialog}
              t={t}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        <ViewWriteButtons
          allowViewSave={allowViewSave}
          canCreateView={canCreateView}
          canUpdateActiveView={canUpdateActiveView}
          isActiveViewDirty={isActiveViewDirty}
          isMutating={isMutating}
          onOpenSaveDialog={openSaveDialog}
          onUpdateActiveView={handleUpdateActiveView}
          t={t}
        />
      </div>

      {inlineError && (
        <p className="max-w-[20rem] truncate text-destructive text-xs">
          {inlineError}
        </p>
      )}

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("views.dialog.save.title")}</DialogTitle>
            <DialogDescription>
              {t("views.dialog.save.description")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateView().catch(() => {
                /* Error state is handled by the mutation branch. */
              });
            }}
          >
            <div className="space-y-2">
              <label className="font-medium text-sm" htmlFor="table-view-name">
                {t("views.dialog.save.name")}
              </label>
              <Input
                autoFocus
                id="table-view-name"
                onChange={(event) => {
                  setViewName(event.target.value);
                }}
                placeholder={t("views.dialog.save.namePlaceholder")}
                value={viewName}
              />
              {dialogError && (
                <p className="text-destructive text-sm">{dialogError}</p>
              )}
            </div>
            <ViewShareOption
              canShareView={canShareView}
              isSharedView={isSharedView}
              onSharedViewChange={setIsSharedView}
              t={t}
            />
            <DialogFooter>
              <Button
                disabled={isMutating}
                onClick={() => {
                  setIsSaveDialogOpen(false);
                }}
                type="button"
                variant="outline"
              >
                {t("actions.cancel")}
              </Button>
              <Button disabled={isMutating} type="submit">
                {isMutating
                  ? t("views.dialog.save.saving")
                  : t("views.dialog.save.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
