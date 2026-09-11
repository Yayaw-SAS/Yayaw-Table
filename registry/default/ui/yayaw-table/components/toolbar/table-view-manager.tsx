"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  CopyPlus,
  LayoutList,
  ListRestart,
  Save,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import {
  useTableActions as useProviderTableActions,
  useTranslations,
} from "../../providers/table-provider";
import { useTableStateSync } from "../../providers/table-state-sync-provider";
import type { TableDisplayMode } from "../../types/display-types";
import type {
  TableView,
  TableViewActions,
  TableViewConfig,
} from "../../types/view-types";
import { StackMenu, StackMenuView } from "../../ui-custom/stack-menu";
import { TableTooltip } from "../../utils/table-tooltip";
import { resolveInitialTableView } from "../../utils/table-view-favorite";
import {
  areTableViewConfigsEqual,
  normalizeTableViewConfig,
} from "../../utils/table-view-state";
import { createLocalTableViewActions } from "../../utils/table-view-storage";

export interface ViewMenuParts {
  trigger: ReactElement;
  selection: ReactNode;
  actions: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_VIEW_CONFIG: TableViewConfig = {};

interface DataTableViewManagerProps {
  enabled?: boolean;
  compact?: boolean;
  defaultViewConfig?: TableViewConfig;
  renderMenu?: (parts: ViewMenuParts) => ReactNode;
  defaultDensity?: TableViewConfig["density"];
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
    getFavorite: providedActions?.getFavorite ?? fallbackActions.getFavorite,
    setFavorite: providedActions?.setFavorite ?? fallbackActions.setFavorite,
    create: providedActions?.create ?? fallbackActions.create,
    delete: providedActions?.delete ?? fallbackActions.delete,
    list: providedActions?.list ?? fallbackActions.list,
    update: providedActions?.update ?? fallbackActions.update,
  };
}

function ViewStatusIcons({
  view,
  favoriteViewId,
  t,
}: {
  view?: TableView;
  favoriteViewId?: string | null;
  t: ReturnType<typeof useTranslations>["t"];
}) {
  return (
    <>
      {(view?.id ?? null) === favoriteViewId && (
        <Star
          aria-label={t("views.favorite")}
          className="size-4 shrink-0 fill-current"
          role="img"
        />
      )}
      {view?.isGlobal && (
        <Users
          aria-label={t("views.dialog.save.global")}
          className="size-4 shrink-0"
          role="img"
        />
      )}
    </>
  );
}

function ViewAction({
  label,
  description,
  disabled,
  icon,
  onClick,
  pressed,
  destructive = false,
  compact = false,
}: {
  label: string;
  description?: string;
  disabled?: boolean;
  pressed?: boolean;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  destructive?: boolean;
  compact?: boolean;
}) {
  return (
    <TableTooltip label={description || label}>
      <Button
        aria-disabled={disabled || undefined}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "h-auto min-h-9 w-full justify-start gap-2 px-2 py-2 text-left font-normal",
          disabled && "text-muted-foreground opacity-60",
          destructive && "text-destructive"
        )}
        onClick={() => {
          if (!disabled) {
            onClick();
          }
        }}
        type="button"
        variant="ghost"
      >
        {icon}
        <span className="min-w-0 whitespace-normal">
          {label}
          {compact && description ? (
            <span className="mt-0.5 block text-muted-foreground text-xs">
              {description}
            </span>
          ) : null}
        </span>
      </Button>
    </TableTooltip>
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
      <span className="font-medium">{t("views.dialog.save.global")}</span>
    </label>
  );
}

function ViewMenuActions({
  enabled,
  allowViewSave,
  activeView,
  compact,
  canUpdateActiveView,
  statusLabel,
  isActiveViewDirty,
  isMutating,
  canCreateView,
  canDeleteActiveView,
  viewParam,
  favoriteViewId,
  favoritePending,
  handleUpdateActiveView,
  openSaveDialog,
  handleToggleFavorite,
  resetDisabled,
  resetView,
  handleDeleteActiveView,
}: {
  enabled: boolean;
  allowViewSave: boolean;
  activeView: TableView | undefined;
  compact: boolean;
  canUpdateActiveView: boolean;
  statusLabel: string;
  isActiveViewDirty: boolean;
  isMutating: boolean;
  canCreateView: boolean;
  canDeleteActiveView: boolean;
  viewParam: string | null;
  favoriteViewId: string | null;
  favoritePending: boolean;
  handleUpdateActiveView: () => void | Promise<void>;
  openSaveDialog: () => void | Promise<void>;
  handleToggleFavorite: () => void | Promise<void>;
  resetDisabled: boolean;
  resetView: () => void | Promise<void>;
  handleDeleteActiveView: () => void | Promise<void>;
}) {
  const { t } = useTranslations();
  let favoriteLabel = "views.setFavorite";
  if ((activeView?.id ?? null) === favoriteViewId) {
    favoriteLabel = activeView ? "views.removeFavorite" : "views.favorite";
  }
  return (
    <div className="space-y-1 border-t p-2">
      {enabled && allowViewSave && activeView ? (
        <ViewAction
          compact={compact}
          description={canUpdateActiveView ? statusLabel : t("views.readOnly")}
          disabled={!(canUpdateActiveView && isActiveViewDirty) || isMutating}
          icon={<Save className="size-4 shrink-0" />}
          label={t("views.saveChanges")}
          onClick={handleUpdateActiveView}
        />
      ) : null}
      {canCreateView ? (
        <ViewAction
          disabled={isMutating}
          icon={<CopyPlus className="size-4 shrink-0" />}
          label={activeView ? t("views.saveAs") : t("views.saveCurrent")}
          onClick={openSaveDialog}
        />
      ) : null}
      {enabled && (!viewParam || activeView) ? (
        <ViewAction
          disabled={isMutating || favoritePending}
          icon={<Star className="size-4 shrink-0" />}
          label={t(favoriteLabel)}
          onClick={handleToggleFavorite}
          pressed={(activeView?.id ?? null) === favoriteViewId}
        />
      ) : null}
      <ViewAction
        compact={compact}
        description={t(
          activeView
            ? "views.resetSavedDescription"
            : "views.resetDefaultDescription"
        )}
        disabled={resetDisabled}
        icon={<ListRestart className="size-4 shrink-0" />}
        label={t("views.reset")}
        onClick={resetView}
      />
      {canDeleteActiveView ? (
        <ViewAction
          destructive
          disabled={isMutating}
          icon={<Trash2 className="size-4 shrink-0" />}
          label={t("views.delete")}
          onClick={handleDeleteActiveView}
        />
      ) : null}
    </div>
  );
}

function renderViewTrigger({
  t,
  enabled,
  compact,
  isLoading,
  currentViewLabel,
  isActiveViewDirty,
}: {
  t: ReturnType<typeof useTranslations>["t"];
  enabled: boolean;
  compact: boolean;
  isLoading: boolean;
  currentViewLabel: string;
  isActiveViewDirty: boolean;
}) {
  return (
    <Button
      aria-label={enabled ? t("views.current") : t("views.settings")}
      className={cn(
        "min-w-0 max-w-64 justify-between gap-2",
        compact ? "h-11 flex-1" : "h-8"
      )}
      disabled={enabled && isLoading}
      type="button"
      variant="outline"
    >
      <LayoutList aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">
        {enabled ? currentViewLabel : t("views.view")}
      </span>
      {enabled && isActiveViewDirty ? (
        <output
          aria-label={t("views.modified")}
          className="size-2 shrink-0 rounded-full bg-blue-500"
        />
      ) : null}
      <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
    </Button>
  );
}

function renderViewSelection({
  t,
  enabled,
  isMutating,
  viewParam,
  favoriteViewId,
  savedViews,
  handleSelectDefaultView,
  handleSelectView,
}: {
  t: ReturnType<typeof useTranslations>["t"];
  enabled: boolean;
  isMutating: boolean;
  viewParam: string | null;
  favoriteViewId: string | null;
  savedViews: TableView[];
  handleSelectDefaultView: () => void;
  handleSelectView: (view: TableView) => void;
}) {
  return enabled ? (
    <div className="space-y-1 border-b p-2">
      <Button
        className="w-full justify-start gap-2 font-normal"
        disabled={isMutating}
        onClick={handleSelectDefaultView}
        type="button"
        variant="ghost"
      >
        <Check
          aria-hidden="true"
          className={cn("size-4", viewParam && "invisible")}
        />
        <span className="min-w-0 flex-1 truncate text-left">
          {t("views.defaultView")}
        </span>
        <ViewStatusIcons favoriteViewId={favoriteViewId} t={t} />
      </Button>
      {savedViews.map((view) => (
        <Button
          aria-current={view.id === viewParam ? "true" : undefined}
          className="w-full justify-start gap-2 font-normal"
          disabled={isMutating}
          key={view.id}
          onClick={() => handleSelectView(view)}
          type="button"
          variant="ghost"
        >
          <Check
            aria-hidden="true"
            className={cn("size-4", view.id !== viewParam && "invisible")}
          />
          <span className="min-w-0 flex-1 truncate text-left">{view.name}</span>
          <ViewStatusIcons favoriteViewId={favoriteViewId} t={t} view={view} />
        </Button>
      ))}
    </div>
  ) : null;
}

export function DataTableViewManager({
  enabled = true,
  compact = false,
  defaultViewConfig = EMPTY_VIEW_CONFIG,
  renderMenu,
  defaultDensity = "medium",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSharedView, setIsSharedView] = useState(false);
  const [viewName, setViewName] = useState("");
  const [dialogError, setDialogError] = useState<string>();
  const [inlineError, setInlineError] = useState<string>();
  const [isMutating, setIsMutating] = useState(false);
  const hasAppliedInitialViewRef = useRef(false);
  const deletedViewIds = useRef(new Set<string>());
  const shouldSyncUrl = useTableStateSync();
  const { applyViewConfig, getCurrentViewConfig, viewParam, setViewParam } =
    useTableUrlState({
      defaultDensity,
      defaultDisplayMode,
      defaultPageSize: defaultViewConfig.pageSize,
      tableId,
    });
  const viewQueryKey = useMemo(
    () => ["tableViews", tableId, tableType],
    [tableId, tableType]
  );

  const {
    data: savedViews = [],
    isLoading,
    isFetching,
  } = useQuery({
    // Empty bootstrap data must still load persisted local or remote views.
    enabled,
    initialData: initialViews.length > 0 ? initialViews : undefined,
    queryFn: async () => {
      const result = await viewActions.list({ tableId, tableType });
      if ("error" in result && typeof result.error === "string") {
        throw new Error(result.error);
      }
      return [
        ...new Map(
          [...initialViews, ...(result.data ?? [])]
            .filter((view) => !deletedViewIds.current.has(view.id))
            .map((view) => [view.id, view])
        ).values(),
      ];
    },
    queryKey: viewQueryKey,
    staleTime: 5000,
  });

  const favoriteQueryKey = useMemo(
    () => ["tableViewFavorite", tableId, tableType],
    [tableId, tableType]
  );
  const favoriteQuery = useQuery({
    enabled,
    queryKey: favoriteQueryKey,
    queryFn: async () => {
      const result = await viewActions.getFavorite({ tableId, tableType });
      if (!(result.success && result.data) || result.error) {
        throw new Error(result.error || t("views.favoriteError"));
      }
      return result.data;
    },
    retry: false,
  });
  // An inaccessible favorite has the same UI fallback as an absent preference.
  const favoriteViewId =
    savedViews.find((view) => view.id === favoriteQuery.data?.viewId)?.id ??
    null;

  const resolveView = useCallback(
    (input: TableViewConfig) =>
      normalizeTableViewConfig({
        displayMode: defaultDisplayMode ?? "table",
        pageSize: 10,
        ...defaultViewConfig,
        grouping: input.kanban?.groupBy ? [input.kanban.groupBy] : [],
        ...input,
        density: input.density ?? defaultDensity,
        footerCalculationsVisible:
          input.footerCalculationsVisible ??
          defaultViewConfig.footerCalculationsVisible ??
          true,
      }),
    [defaultDensity, defaultDisplayMode, defaultViewConfig]
  );
  const currentConfig = useMemo(
    () => resolveView(getCurrentViewConfig()),
    [getCurrentViewConfig, resolveView]
  );
  // Save requests capture a snapshot; edits made while awaiting the server remain local.
  const latestConfig = useRef(currentConfig);
  latestConfig.current = currentConfig;
  const activeView = useMemo(
    () => savedViews.find((view) => view.id === viewParam),
    [savedViews, viewParam]
  );
  const isActiveViewDirty = Boolean(
    activeView &&
      !areTableViewConfigsEqual(currentConfig, resolveView(activeView.config))
  );
  const canUpdateActiveView = Boolean(
    enabled &&
      allowViewSave &&
      activeView &&
      !activeView.isSystem &&
      viewActions.update
  );
  const canDeleteActiveView = Boolean(
    enabled &&
      allowViewSave &&
      activeView &&
      !activeView.isSystem &&
      viewActions.delete
  );
  const canCreateView = enabled && allowViewSave && Boolean(viewActions.create);
  const canShareView = canCreateView && allowViewSharing;
  const currentViewLabel = getCurrentViewLabel({
    activeView,
    fallbackDefaultLabel: t("views.defaultView"),
    fallbackTemporaryLabel: t("views.temporary_view"),
    viewParam,
  });
  const initialConfigRef = useRef(currentConfig);
  const hasInitialUrlState = shouldSyncUrl && hasTableUrlState(tableId);
  const canApplyInitialView =
    enabled &&
    !hasAppliedInitialViewRef.current &&
    !viewParam &&
    !hasInitialUrlState;
  const preferredInitialViewId = resolveInitialTableView(
    savedViews,
    initialActiveViewId,
    favoriteViewId
  )?.id;

  useEffect(() => {
    if (
      isFetching ||
      isLoading ||
      favoriteQuery.isFetching ||
      favoriteQuery.isPending ||
      hasAppliedInitialViewRef.current
    ) {
      return;
    }

    // Defaults are an arrival preference, never a response to later user edits.
    hasAppliedInitialViewRef.current = true;
    if (
      !(
        canApplyInitialView &&
        areTableViewConfigsEqual(initialConfigRef.current, currentConfig)
      )
    ) {
      return;
    }
    const initialView = savedViews.find(
      (view) => view.id === preferredInitialViewId
    );
    if (!initialView) {
      return;
    }

    applyViewConfig(resolveView(initialView.config), {
      viewId: initialView.id,
    });
  }, [
    applyViewConfig,
    canApplyInitialView,
    currentConfig,
    favoriteQuery.isPending,
    favoriteQuery.isFetching,
    isLoading,
    isFetching,
    preferredInitialViewId,
    resolveView,
    savedViews,
  ]);

  const refreshViews = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: viewQueryKey,
    });
  }, [queryClient, viewQueryKey]);

  const handleSelectDefaultView = useCallback(() => {
    hasAppliedInitialViewRef.current = true;
    setInlineError(undefined);
    applyViewConfig(resolveView(defaultViewConfig));
    setMenuOpen(false);
  }, [applyViewConfig, defaultViewConfig, resolveView]);

  const handleSelectView = useCallback(
    (view: TableView) => {
      hasAppliedInitialViewRef.current = true;
      setInlineError(undefined);
      applyViewConfig(resolveView(view.config), { viewId: view.id });
      setMenuOpen(false);
    },
    [applyViewConfig, resolveView]
  );

  const handleToggleFavorite = async (): Promise<void> => {
    if ((!activeView && viewParam) || isMutating || favoriteQuery.isPending) {
      return;
    }
    const viewId =
      activeView && activeView.id !== favoriteViewId ? activeView.id : null;
    // The built-in default represents no personal override; its filled star is stable.
    if (!activeView && favoriteViewId === null && !favoriteQuery.error) {
      return;
    }
    setIsMutating(true);
    setInlineError(undefined);
    try {
      // A stale preference refetch must not replace the result of this write.
      await queryClient.cancelQueries({ queryKey: favoriteQueryKey });
      const result = await viewActions.setFavorite(viewId, {
        tableId,
        tableType,
      });
      if (!result.success || result.error) {
        throw new Error(result.error || t("views.favoriteError"));
      }
      queryClient.setQueryData(favoriteQueryKey, result.data ?? { viewId });
    } catch (error) {
      setInlineError(getViewErrorMessage(error, t("views.favoriteError")));
    } finally {
      setIsMutating(false);
    }
  };

  const openSaveDialog = useCallback(() => {
    if (!canCreateView) {
      return;
    }

    setDialogError(undefined);
    setIsSharedView(false);
    setViewName("");
    setMenuOpen(false);
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
      if (!(result.success && result.data)) {
        setDialogError(result.error || t("views.notifications.error.create"));
        return;
      }

      if (areTableViewConfigsEqual(latestConfig.current, currentConfig)) {
        applyViewConfig(resolveView(result.data.config), {
          viewId: result.data.id,
        });
      } else {
        setViewParam(result.data.id);
      }
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
    resolveView,
    setViewParam,
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
      if (!(result.success && result.data)) {
        setInlineError(result.error || t("views.notifications.error.update"));
        return;
      }

      if (areTableViewConfigsEqual(latestConfig.current, currentConfig)) {
        applyViewConfig(resolveView(result.data.config), {
          viewId: result.data.id,
        });
      } else {
        setViewParam(result.data.id);
      }
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
    resolveView,
    setViewParam,
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

      deletedViewIds.current.add(activeView.id);
      applyViewConfig(resolveView(defaultViewConfig));
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
    applyViewConfig,
    resolveView,
    defaultViewConfig,
    refreshViews,
    tableId,
    tableType,
    t,
    viewActions,
  ]);

  const resetView = () => {
    applyViewConfig(resolveView(activeView?.config ?? defaultViewConfig), {
      viewId: activeView?.id,
    });
  };
  const resetDisabled =
    isMutating ||
    (activeView
      ? !isActiveViewDirty
      : areTableViewConfigsEqual(
          currentConfig,
          resolveView(defaultViewConfig)
        ));
  const statusLabel = isActiveViewDirty
    ? t("views.modified")
    : t("views.upToDate");
  const parts: ViewMenuParts = {
    open: menuOpen,
    onOpenChange: setMenuOpen,
    trigger: renderViewTrigger({
      t,
      enabled,
      compact,
      isLoading,
      currentViewLabel,
      isActiveViewDirty,
    }),
    selection: renderViewSelection({
      t,
      enabled,
      isMutating,
      viewParam,
      favoriteViewId,
      savedViews,
      handleSelectDefaultView,
      handleSelectView,
    }),
    actions: (
      <ViewMenuActions
        activeView={activeView}
        allowViewSave={allowViewSave}
        canCreateView={canCreateView}
        canDeleteActiveView={canDeleteActiveView}
        canUpdateActiveView={canUpdateActiveView}
        compact={compact}
        enabled={enabled}
        favoritePending={favoriteQuery.isPending}
        favoriteViewId={favoriteViewId}
        handleDeleteActiveView={handleDeleteActiveView}
        handleToggleFavorite={handleToggleFavorite}
        handleUpdateActiveView={handleUpdateActiveView}
        isActiveViewDirty={isActiveViewDirty}
        isMutating={isMutating}
        openSaveDialog={openSaveDialog}
        resetDisabled={resetDisabled}
        resetView={resetView}
        statusLabel={statusLabel}
        viewParam={viewParam}
      />
    ),
  };
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        compact && "flex-1",
        className
      )}
    >
      {renderMenu ? (
        renderMenu(parts)
      ) : (
        <StackMenu
          asDropdown
          compact={compact}
          onOpenChange={setMenuOpen}
          open={menuOpen}
          trigger={parts.trigger}
        >
          <StackMenuView name="main" title={t("views.settings")}>
            {parts.selection}
            {parts.actions}
          </StackMenuView>
        </StackMenu>
      )}

      {(inlineError || favoriteQuery.error) && (
        <p className="max-w-[20rem] text-destructive text-xs" role="alert">
          {inlineError ||
            getViewErrorMessage(favoriteQuery.error, t("views.favoriteError"))}
        </p>
      )}

      <Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen}>
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
              <label className="font-medium" htmlFor="table-view-name">
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
