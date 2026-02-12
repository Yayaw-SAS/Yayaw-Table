/**
 * Date filter component
 * Provides filtering for date columns with various date operators and date picker
 */
"use client";

import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "../../providers/table-provider";
import type { FilterOperators } from "../../types/filter-types";
import {
  DEFAULT_OPERATORS,
  FILTER_OPERATORS_LABELS,
} from "../../types/filter-types";
import {
  getTranslatedOperatorLabel,
  translateWithFallback,
} from "./i18n-utils";

type DateFilterValue = Date | [Date, Date];

export interface DateFilterProps {
  /** Current filter value - single date or [start, end] for between */
  value: DateFilterValue;
  /** Current operator */
  operator: FilterOperators["date"];
  /** Available operators (defaults to all date operators) */
  operators?: readonly FilterOperators["date"][];
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Callback when the value changes */
  onValueChange: (value: Date | [Date, Date]) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators["date"]) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Date format for display */
  dateFormat?: string;
  /** Render pickers inline instead of popover */
  inline?: boolean;
}

const coerceDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return;
};

const fallbackSingleDate = (): Date => new Date();

const fallbackDateRange = (): [Date, Date] => {
  const today = new Date();
  return [today, today];
};

const normalizeBetweenDateValue = (
  value: unknown
): [Date, Date] | undefined => {
  if (!Array.isArray(value)) {
    const singleDate = coerceDate(value);
    return singleDate ? [singleDate, singleDate] : undefined;
  }

  const startDate = coerceDate(value[0]);
  const endDate = coerceDate(value[1] ?? value[0]);
  if (!(startDate && endDate)) {
    if (startDate) {
      return [startDate, startDate];
    }
    if (endDate) {
      return [endDate, endDate];
    }
    return;
  }

  return startDate.getTime() <= endDate.getTime()
    ? [startDate, endDate]
    : [endDate, startDate];
};

const normalizeDateValue = (
  value: unknown,
  operator: FilterOperators["date"]
): DateFilterValue | undefined => {
  if (operator === "between") {
    return normalizeBetweenDateValue(value);
  }

  return coerceDate(Array.isArray(value) ? value[0] : value);
};

const getFallbackValue = (
  operator: FilterOperators["date"]
): DateFilterValue =>
  operator === "between" ? fallbackDateRange() : fallbackSingleDate();

const toDateRange = (
  normalizedValue: DateFilterValue | undefined
): [Date, Date] => {
  if (Array.isArray(normalizedValue)) {
    return normalizedValue;
  }

  if (normalizedValue) {
    return [normalizedValue, normalizedValue];
  }

  return fallbackDateRange();
};

const formatDateForDisplayValue = (
  value: DateFilterValue | undefined,
  dateFormat: string
): string | undefined => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    return `${format(value[0], dateFormat)} - ${format(value[1], dateFormat)}`;
  }

  return format(value, dateFormat);
};

/**
 * Date filter component with operator selection and date picker
 */
export function DateFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.date,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  dateFormat = "PPP",
  inline = false,
}: DateFilterProps) {
  const { t } = useTranslations();
  const [internalValue, setInternalValue] = useState<DateFilterValue>(
    () => normalizeDateValue(value, operator) ?? getFallbackValue(operator)
  );
  const [isOpen, setIsOpen] = useState(false);

  // Sync internal value with prop
  useEffect(() => {
    setInternalValue(
      normalizeDateValue(value, operator) ?? getFallbackValue(operator)
    );
  }, [value, operator]);

  // Handle value change
  const handleValueChange = useCallback(
    (newValue: Date | [Date, Date]) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Check if this operator needs a value input
  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isBetween = operator === "between";
  const normalizedInternalValue = normalizeDateValue(internalValue, operator);
  const currentSingleValue = Array.isArray(normalizedInternalValue)
    ? normalizedInternalValue[0]
    : normalizedInternalValue;
  const currentRangeValue = toDateRange(normalizedInternalValue);

  // Handle single date selection
  const handleSingleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        handleValueChange(date);
        setIsOpen(false);
      }
    },
    [handleValueChange]
  );

  // Handle date range selection
  const handleDateRangeSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      if (range?.from && range?.to) {
        handleValueChange([range.from, range.to]);
        setIsOpen(false);
      } else if (range?.from) {
        // If only start date is selected, set end date to same date
        handleValueChange([range.from, range.from]);
      }
    },
    [handleValueChange]
  );

  // Format date for display
  const formatDateForDisplay = useCallback(
    (date: DateFilterValue | undefined) => {
      return formatDateForDisplayValue(date, dateFormat) ?? t("filters.value");
    },
    [dateFormat, t]
  );

  return (
    <div className="space-y-3">
      {label && <Label className="font-medium text-sm">{label}</Label>}

      <div className="flex flex-col gap-3">
        {/* Operator selector */}
        {showOperator && (
          <Select
            disabled={disabled}
            onValueChange={(selectedValue) =>
              onOperatorChange(selectedValue as FilterOperators["date"])
            }
            value={operator}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("filters.select_operator")}>
                {getTranslatedOperatorLabel(
                  t,
                  operator,
                  FILTER_OPERATORS_LABELS.date[operator]
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {getTranslatedOperatorLabel(
                    t,
                    op,
                    FILTER_OPERATORS_LABELS.date[op]
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date picker */}
        {needsValue &&
          (inline ? (
            <div className="mr-auto w-fit rounded-md border p-2">
              {isBetween ? (
                <Calendar
                  className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                  disabled={disabled}
                  initialFocus
                  mode="range"
                  onSelect={handleDateRangeSelect}
                  required
                  selected={{
                    from: currentRangeValue[0],
                    to: currentRangeValue[1],
                  }}
                />
              ) : (
                <Calendar
                  className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                  disabled={disabled}
                  initialFocus
                  mode="single"
                  onSelect={handleSingleDateSelect}
                  selected={currentSingleValue}
                />
              )}
            </div>
          ) : (
            <Popover onOpenChange={setIsOpen} open={isOpen}>
              <PopoverTrigger>
                <Button
                  aria-expanded={isOpen}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !internalValue && "text-muted-foreground"
                  )}
                  disabled={disabled}
                  type="button"
                  variant="outline"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">
                    {normalizedInternalValue ? (
                      formatDateForDisplay(normalizedInternalValue)
                    ) : (
                      <span>
                        {isBetween ? t("filters.value") : t("filters.value")}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-0">
                {isBetween ? (
                  <div className="space-y-2 p-2">
                    <DateRangeShortcuts
                      disabled={disabled}
                      onSelect={(range) => {
                        handleValueChange(range);
                        setIsOpen(false);
                      }}
                    />
                    <div className="rounded-md border">
                      <Calendar
                        className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                        disabled={disabled}
                        initialFocus
                        mode="range"
                        onSelect={handleDateRangeSelect}
                        required
                        selected={{
                          from: currentRangeValue[0],
                          to: currentRangeValue[1],
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-2">
                    <div className="rounded-md border">
                      <Calendar
                        className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                        disabled={disabled}
                        initialFocus
                        mode="single"
                        onSelect={handleSingleDateSelect}
                        selected={currentSingleValue}
                      />
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ))}

        {/* Info text for operators that don't need values */}
        {!needsValue && (
          <div className="text-muted-foreground text-sm italic">
            {operator === "isEmpty"
              ? t("filters.operators.empty")
              : t("filters.operators.not_empty")}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact date filter for use in filter chips
 */
export function CompactDateFilter({
  value,
  operator,
  onValueChange,
  disabled = false,
  dateFormat = "PP",
}: Pick<
  DateFilterProps,
  "value" | "operator" | "onValueChange" | "disabled" | "dateFormat"
>) {
  const { t } = useTranslations();
  const [internalValue, setInternalValue] = useState<DateFilterValue>(
    () => normalizeDateValue(value, operator) ?? getFallbackValue(operator)
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInternalValue(
      normalizeDateValue(value, operator) ?? getFallbackValue(operator)
    );
  }, [value, operator]);

  const handleValueChange = useCallback(
    (newValue: Date | [Date, Date]) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  const handleSingleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        handleValueChange(date);
        setIsOpen(false);
      }
    },
    [handleValueChange]
  );

  const handleDateRangeSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      if (range?.from && range?.to) {
        handleValueChange([range.from, range.to]);
      } else if (range?.from) {
        handleValueChange([range.from, range.from]);
      }
    },
    [handleValueChange]
  );

  const formatDateForDisplay = useCallback(
    (date: DateFilterValue | undefined) => {
      return formatDateForDisplayValue(date, dateFormat) ?? t("filters.value");
    },
    [dateFormat, t]
  );

  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isBetween = operator === "between";

  if (!needsValue) {
    return (
      <span className="text-muted-foreground text-xs">
        {operator === "isEmpty"
          ? t("filters.operators.empty")
          : t("filters.operators.not_empty")}
      </span>
    );
  }

  const normalizedInternalValue = normalizeDateValue(internalValue, operator);
  const currentSingleValue = Array.isArray(normalizedInternalValue)
    ? normalizedInternalValue[0]
    : normalizedInternalValue;
  const currentRangeValue = toDateRange(normalizedInternalValue);

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger>
        <Button
          className={cn(
            "h-6 justify-start px-2 font-normal text-xs",
            !internalValue && "text-muted-foreground"
          )}
          disabled={disabled}
          size="sm"
          type="button"
          variant="ghost"
        >
          <CalendarIcon className="mr-1 h-3 w-3" />
          {normalizedInternalValue
            ? formatDateForDisplay(normalizedInternalValue)
            : t("filters.value")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {isBetween ? (
          <Calendar
            disabled={disabled}
            initialFocus
            mode="range"
            onSelect={handleDateRangeSelect}
            required
            selected={{ from: currentRangeValue[0], to: currentRangeValue[1] }}
          />
        ) : (
          <Calendar
            disabled={disabled}
            initialFocus
            mode="single"
            onSelect={handleSingleDateSelect}
            selected={currentSingleValue}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Date range shortcuts for common date ranges
 */
export function DateRangeShortcuts({
  onSelect,
  disabled = false,
}: {
  onSelect: (range: [Date, Date]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslations();
  const shortcuts = [
    {
      label: translateWithFallback(t, "filters.date_shortcuts.today", "Today"),
      getValue: () => {
        const today = new Date();
        return [today, today] as [Date, Date];
      },
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.yesterday",
        "Yesterday"
      ),
      getValue: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return [yesterday, yesterday] as [Date, Date];
      },
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.last_7_days",
        "Last 7 days"
      ),
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        return [start, end] as [Date, Date];
      },
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.last_30_days",
        "Last 30 days"
      ),
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        return [start, end] as [Date, Date];
      },
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.this_month",
        "This month"
      ),
      getValue: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return [start, end] as [Date, Date];
      },
    },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {shortcuts.map((shortcut) => (
        <Button
          className="h-6 px-2 text-xs"
          disabled={disabled}
          key={shortcut.label}
          onClick={() => onSelect(shortcut.getValue())}
          size="sm"
          type="button"
          variant="outline"
        >
          {shortcut.label}
        </Button>
      ))}
    </div>
  );
}
