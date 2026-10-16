"use client";

import { CalendarDays, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { type FilterMenu, useFilterMenu } from "../../hooks/use-filter-menu";
import { useTableConfig } from "../../hooks/use-table-config";
import type { AdvancedFilterModel } from "../../types/filter-types";
import {
  relativeDateLabel,
  relativeDateTokenOf,
} from "../../utils/date-filter-days";
import { type FilterBarColumn, filterBarDateRuleId } from "../../utils/filter-bar";
import {
  filterOperatorLabel,
  filterPeriodDates,
  filterRuleComplete,
  filterRuleSummary,
} from "../../utils/filter-menu";
import { tableFilterContext } from "../../utils/table-contracts";
import { FILTER_POPOVER } from "./menu/filter-chip";
import { DateValueEditor } from "./menu/date-value-editor";

const OPERATORS = [
  "equals",
  "before",
  "after",
  "lessThanOrEqual",
  "greaterThanOrEqual",
];

/** The period's name and, for a relative one, its days today: "Oct 1 – Oct 31". */
function periodText(
  rule: AdvancedFilterModel,
  column: FilterBarColumn,
  menu: FilterMenu,
  context: ReturnType<typeof tableFilterContext>
): { active: boolean; label: string; days: string } {
  const { locale, translate, text } = menu;
  const active = filterRuleComplete(rule);
  if (!active) {
    return { active, label: text("anyDate"), days: "" };
  }
  const token = relativeDateTokenOf(rule.values);
  const days = token ? filterPeriodDates(token, locale, context) : "";
  if (token && rule.operator === "equals") {
    return { active, label: relativeDateLabel(token, locale, translate), days };
  }
  const label = filterRuleSummary(
    rule,
    { id: column.id, header: column.header, type: "date" },
    locale,
    translate
  ).value;
  return { active, label, days };
}

/**
 * A date column's period, always at hand: in the filter bar, or in the
 * toolbar (`table.toolbarDateFilter`) where it shows the period and its days
 * ("This month · Oct 1 – 31"). It is one advanced rule, so every display mode
 * filters by it, and its chip is this button.
 */
export function FilterBarDate({
  column,
  tableId,
  tableType,
  variant = "bar",
  compact = false,
  menu: given,
}: {
  column: FilterBarColumn;
  tableId: string;
  tableType: string;
  variant?: "bar" | "toolbar";
  compact?: boolean;
  menu?: FilterMenu;
}) {
  const own = useFilterMenu({ tableId, tableType });
  const menu = given ?? own;
  const { config } = useTableConfig(tableType);
  const { locale, translate, text } = menu;
  const id = filterBarDateRuleId(column.id);
  const rule =
    menu.rules.find((item) => item.id === id) ??
    ({
      id,
      columnId: column.id,
      type: "date",
      operator: "equals",
      values: undefined,
      isActive: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as unknown as AdvancedFilterModel);
  const { active, label, days } = periodText(
    rule,
    column,
    menu,
    tableFilterContext(config.table, locale)
  );
  const change = (next: { operator: string; values: unknown }) =>
    menu.update({
      ...rule,
      type: "date",
      operator: next.operator,
      values: next.values,
      isActive: true,
    } as AdvancedFilterModel);
  // Picking this column from the Filter button opens this period: the
  // toolbar's when the column is there, otherwise the filter bar's.
  const owner =
    variant === "toolbar" || config.table.toolbarDateFilter !== column.id;
  return (
    <Popover
      onOpenChange={(open) => menu.setPeriodOpen(open ? column.id : undefined)}
      open={owner && menu.periodOpen === column.id}
    >
      <PopoverTrigger
        render={
          <Button
            aria-label={`${column.header}: ${label}${days ? ` (${days})` : ""}`}
            className={cn(
              "max-w-full gap-2 font-normal",
              variant === "bar" && "h-8 px-3 text-xs",
              active &&
                "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
            )}
            data-active={active}
            data-date-filter={column.id}
            data-variant={variant}
            size={variant === "toolbar" && compact && !active ? "icon" : "default"}
            type="button"
            variant="outline"
          />
        }
      >
        <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
        {variant === "bar" && <span className="truncate">{column.header}</span>}
        {(variant === "bar" ? active : !compact || active) && (
          <span className="truncate" data-date-period-label="">
            {label}
          </span>
        )}
        {days && !compact && (
          <span className="text-xs opacity-75" data-date-period-days="">
            {days}
          </span>
        )}
        {variant === "bar" && (
          <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
        )}
      </PopoverTrigger>
      <PopoverContent
        align={variant === "toolbar" ? "end" : "start"}
        aria-label={column.header}
        className={FILTER_POPOVER}
      >
        <div className="grid gap-2" data-date-period-editor="">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-medium text-sm">{column.header}</span>
            <select
              aria-label={text("operator")}
              className="h-7 min-w-0 rounded-md border-0 bg-transparent px-1 text-muted-foreground text-sm hover:bg-muted"
              onChange={(event) =>
                change({ operator: event.target.value, values: rule.values })
              }
              value={rule.operator === "between" ? "equals" : rule.operator}
            >
              {OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {filterOperatorLabel("date", operator, locale, translate)}
                </option>
              ))}
            </select>
            {active && (
              <Button
                aria-label={text("anyDate")}
                className="ml-auto"
                data-date-period-clear=""
                onClick={() => menu.remove(id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
          <DateValueEditor
            menu={menu}
            onChange={change}
            operator={rule.operator}
            values={rule.values}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
