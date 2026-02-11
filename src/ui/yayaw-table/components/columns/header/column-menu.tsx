"use client";

import { flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import type { Column, Table } from "@tanstack/react-table";
import { useAtom, useSetAtom } from "jotai";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeOffIcon,
  FunnelIcon,
  GripVertical,
  MenuIcon,
} from "lucide-react";
import {
  createContext,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  columnDragEnabledAtom,
  tableMenuOpenFilterColumnIdAtom,
  tableMenuOpenToViewAtom,
} from "../../../atoms/table-atoms";
import { useDataTable } from "../../../hooks/use-data-table";
import { useOnClickOutside } from "../../../hooks/use-on-click-outside";
import { useTableConfig } from "../../../hooks/use-table-config";
import { useTableTranslations } from "../../../hooks/use-table-translations";

// Debug flag to help track sorting issues
const _DEBUG = false;

interface ColumnMenuProps<TData> {
  /**
   * Children elements to render inside the trigger
   */
  children?: ReactNode;

  /**
   * The column to show the menu for
   */
  column: Column<TData, unknown>;

  /**
   * The table instance
   */
  table: Table<TData>;

  /**
   * The ID of the table this column belongs to
   */
  tableId?: string;
}

// Create a stable context for translations
const TranslationsContext = createContext<
  ReturnType<typeof useTableTranslations>
>({} as ReturnType<typeof useTableTranslations>);

// Create a stable provider component to prevent unnecessary re-renders
const TranslationsProvider = memo(function TranslationsProviderComponent({
  children,
  translations,
}: {
  children: ReactNode;
  translations: ReturnType<typeof useTableTranslations>;
}) {
  return (
    <TranslationsContext.Provider value={translations}>
      {children}
    </TranslationsContext.Provider>
  );
});

// Memoized menu item component
const MenuItem = memo(function MenuItemComponent({
  disabled = false,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        disabled
          ? "cursor-not-allowed text-muted-foreground"
          : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="menuitem"
      tabIndex={0}
    >
      <div className="mr-2 h-3.5 w-3.5">{icon}</div>
      {label}
    </div>
  );
});

// Memoized sorting menu items
const SortingMenuItems = memo(function SortingMenuItemsComponent({
  canSort,
  onSort,
  sortDirection,
  translations,
}: {
  canSort: boolean;
  onSort: (desc: boolean) => void;
  sortDirection: "asc" | "desc" | false;
  translations: ReturnType<typeof useTableTranslations>;
}) {
  if (!canSort) {
    return null;
  }

  return (
    <>
      <MenuItem
        disabled={sortDirection === "asc"}
        icon={<ArrowUpIcon className="h-3.5 w-3.5" />}
        label={translations.columnSortAsc}
        onClick={() => onSort(false)}
      />
      <MenuItem
        disabled={sortDirection === "desc"}
        icon={<ArrowDownIcon className="h-3.5 w-3.5" />}
        label={translations.columnSortDesc}
        onClick={() => onSort(true)}
      />
    </>
  );
});

// Memoized menu trigger
const MenuTrigger = memo(function MenuTriggerComponent({
  children,
  onClick,
  translations,
}: {
  children?: ReactNode;
  onClick: () => void;
  translations: ReturnType<typeof useTableTranslations>;
}) {
  if (children) {
    return (
      <Button
        aria-label={translations.toggleColumns}
        className="h-full w-full justify-start rounded-none px-2 font-normal hover:bg-accent hover:text-accent-foreground focus-visible:ring-0"
        onClick={onClick}
        type="button"
        variant="ghost"
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      aria-label={translations.toggleColumns}
      className="h-8 w-8 p-2"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <MenuIcon className="h-4 w-4" />
    </Button>
  );
});

// Memoize floating-ui middleware to prevent recreation
const floatingMiddleware = [offset(4), flip(), shift()];

// Memoized floating options
const floatingOptions = {
  middleware: floatingMiddleware,
  placement: "bottom-end" as const,
};

/**
 * Column menu component that provides options for sorting, filtering, and visibility
 */
function ColumnMenuBase<TData>({
  children,
  column,
  table,
  tableId = "default-table",
}: ColumnMenuProps<TData>) {
  const [isOpen, setIsOpen] = useState(false);
  const translations = useTableTranslations(tableId);

  // Always call useFloating but only use it when needed
  const floating = useFloating(floatingOptions);

  // Use refs to avoid recreating elements
  const referenceRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside
  useOnClickOutside(
    [referenceRef as RefObject<HTMLElement>, menuRef as RefObject<HTMLElement>],
    () => {
      if (isOpen) {
        setIsOpen(false);
      }
    }
  );

  // Set reference ref so floating-ui has the trigger position (reference is inside sortable header)
  useEffect(() => {
    if (referenceRef.current) {
      floating.refs.setReference(referenceRef.current);
    }
  }, [floating.refs]);

  // When menu opens: set floating ref and recalc position (menu is portaled to body to avoid sortable transform)
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const floatingEl = menuRef.current;
    if (floatingEl) {
      floating.refs.setFloating(floatingEl);
      queueMicrotask(() => {
        floating.update();
      });
    }
  }, [isOpen, floating.refs, floating.update]);

  const setSorting = useDataTable({
    tableId,
    tableType: tableId,
  }).setSorting;

  // Memoize column capabilities to prevent unnecessary recalculations
  const columnCapabilities = useMemo(
    () => ({
      canFilter: column.getCanFilter(),
      canHide: column.getCanHide(),
      canSort: column.getCanSort(),
      isVisible: column.getIsVisible(),
      sortDirection: column.getIsSorted(),
    }),
    [column]
  );

  const { canFilter, canHide, canSort, isVisible, sortDirection } =
    columnCapabilities;
  const [isDragEnabled, setIsDragEnabled] = useAtom(
    columnDragEnabledAtom(tableId)
  );
  const setTableMenuOpenToView = useSetAtom(tableMenuOpenToViewAtom(tableId));
  const setTableMenuOpenFilterColumnId = useSetAtom(
    tableMenuOpenFilterColumnIdAtom(tableId)
  );
  const { config } = useTableConfig(tableId);
  const dndFeatureEnabled = config?.table?.enableColumnDnd !== false;

  // Memoize handlers to prevent recreation
  const handleSort = useCallback(
    (desc: boolean) => {
      const sortingObj = [{ desc, id: column.id }];
      queueMicrotask(() => {
        table.setSorting(sortingObj);
        setSorting(sortingObj);
      });
      setIsOpen(false);
    },
    [column.id, setSorting, table]
  );

  const handleToggleVisibility = useCallback(() => {
    column.toggleVisibility(!isVisible);
    setIsOpen(false);
  }, [column, isVisible]);

  const handleToggleDrag = useCallback(() => {
    setIsDragEnabled(!isDragEnabled);
    setIsOpen(false);
  }, [isDragEnabled, setIsDragEnabled]);

  // Memoize trigger component
  const trigger = useMemo(
    () => (
      <div className="h-full w-full" ref={referenceRef}>
        <MenuTrigger
          onClick={() => setIsOpen(!isOpen)}
          translations={translations}
        >
          {children}
        </MenuTrigger>
      </div>
    ),
    [children, isOpen, translations]
  );

  // Memoize menu items to prevent recreation
  const menuItems = useMemo(() => {
    if (!isOpen) {
      return null;
    }

    return (
      <div className="z-50" ref={menuRef} style={floating.floatingStyles}>
        <div className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          <div className="text-sm">
            <SortingMenuItems
              canSort={canSort}
              onSort={handleSort}
              sortDirection={sortDirection}
              translations={translations}
            />

            {canFilter && (
              <MenuItem
                icon={<FunnelIcon className="size-3.5" />}
                label={translations.columnFilter}
                onClick={() => {
                  setTableMenuOpenToView("filters");
                  setTableMenuOpenFilterColumnId(column.id);
                  setIsOpen(false);
                }}
              />
            )}

            {canHide && (
              <MenuItem
                icon={<EyeOffIcon className="h-3.5 w-3.5" />}
                label={translations.columnHide}
                onClick={handleToggleVisibility}
              />
            )}

            {dndFeatureEnabled && (
              <div className="mt-1 border-t pt-1">
                <MenuItem
                  icon={<GripVertical className="h-3.5 w-3.5" />}
                  label={
                    translations.columnReorder + (isDragEnabled ? " ✓" : "")
                  }
                  onClick={handleToggleDrag}
                />
                {!isDragEnabled && (
                  <div className="px-2 py-1 text-muted-foreground text-xs">
                    Enable to drag columns in header and here
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    isOpen,
    floating.floatingStyles,
    canSort,
    handleSort,
    sortDirection,
    translations,
    canFilter,
    canHide,
    handleToggleVisibility,
    handleToggleDrag,
    isDragEnabled,
    dndFeatureEnabled,
    setTableMenuOpenToView,
    setTableMenuOpenFilterColumnId,
    column.id,
  ]);

  return (
    <TranslationsProvider translations={translations}>
      <div className="h-full w-full">
        {trigger}
        {menuItems && createPortal(menuItems, document.body)}
      </div>
    </TranslationsProvider>
  );
}

// Memoize with strict prop comparison
export const ColumnMenu = memo(ColumnMenuBase, (prevProps, nextProps) => {
  if (prevProps.column.id !== nextProps.column.id) {
    return false;
  }
  if (prevProps.tableId !== nextProps.tableId) {
    return false;
  }
  if (prevProps.children !== nextProps.children) {
    return false;
  }
  if (prevProps.table !== nextProps.table) {
    return false;
  }
  if (
    prevProps.column.getCanFilter() !== nextProps.column.getCanFilter() ||
    prevProps.column.getCanHide() !== nextProps.column.getCanHide() ||
    prevProps.column.getCanSort() !== nextProps.column.getCanSort() ||
    prevProps.column.getIsVisible() !== nextProps.column.getIsVisible() ||
    prevProps.column.getIsSorted() !== nextProps.column.getIsSorted()
  ) {
    return false;
  }
  return true;
}) as typeof ColumnMenuBase;
