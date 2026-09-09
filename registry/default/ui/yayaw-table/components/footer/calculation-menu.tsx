/**
 * Dropdown menu for selecting a column calculation type.
 * Mirrors Notion's column calculation picker with sub-menus:
 *   None | Count ▸ | Percent ▸ | More options ▸
 *
 * Also displays the current calculated value inline.
 */
"use client";

import { useAtom } from "jotai";
import { CalculatorIcon } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { columnCalculationsAtom } from "../../atoms/footer-atoms";
import {
  type UseTableTranslationsReturn,
  useTableTranslations,
} from "../../hooks/use-table-translations";
import type { TableAggregateResultValue } from "../../providers/table-provider";
import type { CalculationType } from "../../types/footer-types";
import { getCalculationGroups } from "../../types/footer-types";
import { TableTooltip } from "../../utils/table-tooltip";

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

  const handleSelect = useCallback(
    (type: CalculationType) => {
      setCalculations((prev) => ({
        ...prev,
        [columnId]: type,
      }));
    },
    [columnId, setCalculations]
  );

  const groups = useMemo(() => getCalculationGroups(columnType), [columnType]);

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

  return (
    <div
      className={cn(
        "group/footer-cell flex h-full w-full items-center",
        isNumberColumn && "justify-end"
      )}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <TableTooltip label={translations.calcCalculate}>
              <button
                aria-label={translations.calcCalculate}
                className={cn(
                  "flex h-full cursor-pointer rounded-sm px-1 py-0.5 text-xs transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  currentCalc === "none" && "items-center gap-1.5",
                  currentCalc !== "none" &&
                    "h-auto w-full min-w-0 flex-col items-start justify-center gap-0.5",
                  currentCalc !== "none" &&
                    isNumberColumn &&
                    "items-end text-right",
                  currentCalc === "none" && "text-muted-foreground",
                  currentCalc === "none" &&
                    !shouldShowEmptyLabel &&
                    "justify-center"
                )}
                type="button"
              >
                {currentCalc === "none" ? (
                  <>
                    <CalculatorIcon
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground",
                        !shouldShowEmptyLabel &&
                          "opacity-0 transition-opacity group-focus-within/footer-cell:opacity-100 group-hover/footer-cell:opacity-100"
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
                    <span className="max-w-full truncate font-medium text-[10px] text-muted-foreground leading-none">
                      {shortLabel}
                    </span>
                    <span
                      className={cn(
                        "max-w-full truncate font-medium text-foreground tabular-nums leading-none",
                        isNumberColumn && "font-mono"
                      )}
                    >
                      {resultLabel}
                    </span>
                  </>
                )}
              </button>
            </TableTooltip>
          }
        />
        <DropdownMenuContent
          align="start"
          className="w-auto min-w-40"
          side="top"
        >
          {groups.map((group) => {
            const groupLabel = getTranslation(
              translations,
              group.labelKey,
              group.key
            );
            if (group.key === "none") {
              return (
                <DropdownMenuRadioGroup key={group.key} value={currentCalc}>
                  <DropdownMenuRadioItem
                    closeOnClick
                    onClick={() => handleSelect("none")}
                    value="none"
                  >
                    {groupLabel}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              );
            }
            return (
              <DropdownMenuSub key={group.key}>
                <DropdownMenuSubTrigger>{groupLabel}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-auto min-w-44">
                  <DropdownMenuRadioGroup value={currentCalc}>
                    {group.items.map((item) => (
                      <DropdownMenuRadioItem
                        closeOnClick
                        key={item}
                        onClick={() => handleSelect(item)}
                        value={item}
                      >
                        {getTranslation(
                          translations,
                          CALC_LABEL_KEYS[item],
                          item
                        )}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const CalculationMenu = memo(CalculationMenuBase);
