/**
 * Dropdown menu for selecting a column calculation type.
 * Mirrors Notion's column calculation picker with sub-menus:
 *   None | Count ▸ | Percent ▸ | More options ▸
 *
 * Also displays the current calculated value inline.
 */
"use client";

import { flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { useAtom } from "jotai";
import {
  CalculatorIcon,
  CheckIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { columnCalculationsAtom } from "../../atoms/footer-atoms";
import {
  useTableTranslations,
  type UseTableTranslationsReturn,
} from "../../hooks/use-table-translations";
import type { TableAggregateResultValue } from "../../providers/table-provider";
import type { CalculationType } from "../../types/footer-types";
import { getCalculationGroups } from "../../types/footer-types";

interface CalculationMenuProps {
  columnId: string;
  columnType?: string;
  defaultCalculation?: CalculationType;
  isNumberColumn?: boolean;
  isResultLoading?: boolean;
  result?: TableAggregateResultValue;
  showEmptyLabel?: boolean;
  tableId: string;
  tableType: string;
}

const CALC_LABEL_KEYS: Record<CalculationType, string> = {
  none: "calcNone",
  count_all: "calcCountAll",
  count_values: "calcCountValues",
  count_unique: "calcCountUnique",
  count_empty: "calcCountEmpty",
  count_not_empty: "calcCountNotEmpty",
  count_true: "calcCountTrue",
  count_false: "calcCountFalse",
  percent_empty: "calcPercentEmpty",
  percent_not_empty: "calcPercentNotEmpty",
  percent_true: "calcPercentTrue",
  percent_false: "calcPercentFalse",
  sum: "calcSum",
  average: "calcAverage",
  median: "calcMedian",
  min: "calcMin",
  max: "calcMax",
  range: "calcRange",
};

const getTranslation = (
  translations: UseTableTranslationsReturn,
  key: string,
  fallback: string
): string =>
  (translations as unknown as Record<string, string>)[key] || fallback;

const floatingMiddleware = [offset(4), flip(), shift({ padding: 8 })];

const SUBMENU_CLOSE_DELAY = 150;

const SubMenu = memo(function SubMenuComponent({
  active,
  items,
  label,
  onSelect,
  translations,
}: {
  active: CalculationType;
  items: CalculationType[];
  label: string;
  onSelect: (type: CalculationType) => void;
  translations: ReturnType<typeof useTableTranslations>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const floating = useFloating({
    middleware: [offset(2), flip(), shift({ padding: 8 })],
    placement: "right-start",
  });

  useEffect(() => {
    if (triggerRef.current) {
      floating.refs.setReference(triggerRef.current);
    }
  }, [floating.refs]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const el = subMenuRef.current;
    if (el) {
      floating.refs.setFloating(el);
      queueMicrotask(() => {
        floating.update();
      });
    }
  }, [isOpen, floating.refs, floating.update]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, SUBMENU_CLOSE_DELAY);
  }, [cancelClose]);

  const handleTriggerEnter = useCallback(() => {
    cancelClose();
    setIsOpen(true);
  }, [cancelClose]);

  const handleTriggerLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const handleSubmenuEnter = useCallback(() => {
    cancelClose();
  }, [cancelClose]);

  const handleSubmenuLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  const hasActiveChild = items.includes(active);

  return (
    <div
      onFocus={handleTriggerEnter}
      onBlur={handleTriggerLeave}
      onMouseEnter={handleTriggerEnter}
      onMouseLeave={handleTriggerLeave}
      ref={triggerRef}
      role="menuitem"
      tabIndex={0}
      className={cn(
        "flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        hasActiveChild && "text-accent-foreground"
      )}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }
      }}
    >
      <span>{label}</span>
      <ChevronRightIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />

      {isOpen &&
        createPortal(
          <div
            className="z-[60]"
            data-calculation-menu-portal="true"
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
            ref={subMenuRef}
            role="menu"
            style={floating.floatingStyles}
          >
            <div className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
              {items.map((item) => {
                const labelKey = CALC_LABEL_KEYS[item];
                const itemLabel = getTranslation(translations, labelKey, item);
                const isActive = active === item;
                return (
                  <div
                    className={cn(
                      "flex cursor-pointer select-none items-center justify-between gap-6 rounded-sm px-2 py-1.5 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent/50"
                    )}
                    key={item}
                    onClick={() => {
                      onSelect(item);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(item);
                      }
                    }}
                    role="menuitem"
                    tabIndex={0}
                  >
                    <span>{itemLabel}</span>
                    {isActive && <CheckIcon className="h-3.5 w-3.5" />}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

function CalculationMenuBase({
  columnId,
  columnType,
  defaultCalculation,
  isNumberColumn = false,
  isResultLoading = false,
  result,
  showEmptyLabel = false,
  tableId,
  tableType,
}: CalculationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const translations = useTableTranslations(tableType);
  const [calculations, setCalculations] = useAtom(
    columnCalculationsAtom(tableId)
  );

  // undefined → user hasn't touched it → use defaultCalculation
  // "none"   → user explicitly chose "none"
  // other    → user explicitly chose a calculation
  const userChoice = calculations[columnId];
  const currentCalc: CalculationType =
    userChoice ?? defaultCalculation ?? "none";

  const floating = useFloating({
    middleware: floatingMiddleware,
    placement: "top-start",
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest("[data-calculation-menu-portal='true']")
      ) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (triggerRef.current) {
      floating.refs.setReference(triggerRef.current);
    }
  }, [floating.refs]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const el = menuRef.current;
    if (el) {
      floating.refs.setFloating(el);
      queueMicrotask(() => {
        floating.update();
      });
    }
  }, [isOpen, floating.refs, floating.update]);

  const handleSelect = useCallback(
    (type: CalculationType) => {
      setCalculations((prev) => ({
        ...prev,
        [columnId]: type,
      }));
      setIsOpen(false);
    },
    [columnId, setCalculations]
  );

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const groups = useMemo(
    () => getCalculationGroups(columnType),
    [columnType]
  );

  const shortLabel = useMemo(() => {
    const labelKey = CALC_LABEL_KEYS[currentCalc];
    return labelKey
      ? getTranslation(translations, labelKey, currentCalc)
      : currentCalc;
  }, [currentCalc, translations]);

  const resultLabel = useMemo(() => {
    if (currentCalc === "none") {
      return "";
    }
    if (isResultLoading) {
      return "…";
    }
    return result?.label ?? "—";
  }, [currentCalc, isResultLoading, result]);
  const shouldShowEmptyLabel = currentCalc === "none" && showEmptyLabel;

  const menuContent = useMemo(() => {
    if (!isOpen) {
      return null;
    }

    return (
      <div
        className="z-50"
        data-calculation-menu-portal="true"
        ref={menuRef}
        style={floating.floatingStyles}
      >
        <div className="rounded-md border bg-popover p-1 text-popover-foreground shadow-md min-w-[160px]">
          {groups.map((group) => {
            const groupLabel = getTranslation(
              translations,
              group.labelKey,
              group.key
            );

            if (group.key === "none") {
              const isActive = currentCalc === "none";
              return (
                <div
                  className={cn(
                    "flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent/50"
                  )}
                  key={group.key}
                  onClick={() => {
                    handleSelect("none");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect("none");
                    }
                  }}
                  role="menuitem"
                  tabIndex={0}
                >
                  <span>{groupLabel}</span>
                  {isActive && <CheckIcon className="h-3.5 w-3.5" />}
                </div>
              );
            }

            return (
              <SubMenu
                active={currentCalc}
                items={group.items}
                key={group.key}
                label={groupLabel}
                onSelect={handleSelect}
                translations={translations}
              />
            );
          })}
        </div>
      </div>
    );
  }, [isOpen, floating.floatingStyles, groups, translations, currentCalc, handleSelect]);

  return (
    <div
      className={cn(
        "group/footer-cell flex h-full w-full items-center",
        isNumberColumn && "justify-end"
      )}
      ref={triggerRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={translations.calcCalculate}
        className={cn(
          "flex h-full cursor-pointer rounded-sm px-1 py-0.5 text-xs transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          currentCalc === "none" && "items-center gap-1.5",
          currentCalc !== "none" &&
            "h-auto min-w-0 w-full flex-col items-start justify-center gap-0.5",
          currentCalc !== "none" && isNumberColumn && "items-end text-right",
          currentCalc === "none" && "text-muted-foreground",
          currentCalc === "none" && !shouldShowEmptyLabel && "justify-center"
        )}
        onClick={handleToggle}
        title={currentCalc === "none" ? translations.calcCalculate : undefined}
        type="button"
      >
        {currentCalc === "none" ? (
          <>
            <CalculatorIcon
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground",
                !shouldShowEmptyLabel &&
                  "opacity-0 transition-opacity group-hover/footer-cell:opacity-100"
              )}
            />
            {shouldShowEmptyLabel && (
              <span className="text-muted-foreground">
                {translations.calcCalculate}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="max-w-full truncate text-muted-foreground text-[10px] font-medium leading-none">
              {shortLabel}
            </span>
            <span
              className={cn(
                "max-w-full truncate font-medium tabular-nums text-foreground leading-none",
                isNumberColumn && "font-mono"
              )}
            >
              {resultLabel}
            </span>
          </>
        )}
      </button>
      {menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}

export const CalculationMenu = memo(CalculationMenuBase);
