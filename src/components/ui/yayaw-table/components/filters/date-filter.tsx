/**
 * Date filter component
 * Provides filtering for date columns with various date operators and a day
 * picker. Values are calendar days (`YYYY-MM-DD`), never instants.
 */
"use client";

import { CalendarIcon, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import { Label } from "@/src/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useLocale, useTranslations } from "../../providers/table-provider";
import type { DateDisplayPreset } from "../../types/date-types";
import type { FilterOperators } from "../../types/filter-types";
import {
  DEFAULT_OPERATORS,
  FILTER_OPERATORS_LABELS,
} from "../../types/filter-types";
import { formatFilterValueForDisplay } from "../../utils/advanced-filters";
import {
  addCalendarDays,
  type CalendarDay,
  calendarDay,
  calendarDayToLocalDate,
  todayCalendarDay,
} from "../../utils/date-filter-days";
import {
  getTranslatedOperatorLabel,
  translateWithFallback,
} from "./i18n-utils";

/** One day, or `[first, last]` days for `between`, written `YYYY-MM-DD`. */
type DateFilterValue = CalendarDay | [CalendarDay, CalendarDay];

export interface DateFilterProps {
  /**
   * Current filter value: a `YYYY-MM-DD` day, or `[first, last]` days for
   * `between`. Older instants and `Date`s read as the viewer's days.
   */
  value: unknown;
  /** Current operator */
  operator: FilterOperators["date"];
  /** Available operators (defaults to all date operators) */
  operators?: readonly FilterOperators["date"][];
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Called with the picked day, or `[first, last]` days for `between` */
  onValueChange: (value: DateFilterValue) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators["date"]) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Date format for display */
  dateFormat?: string;
  /** Date display preset */
  dateDisplayPreset?: DateDisplayPreset;
  /** Fallback date display preset (table-level default) */
  fallbackDateDisplayPreset?: DateDisplayPreset;
  /** Render pickers inline instead of popover */
  inline?: boolean;
}

const fallbackDateRange = (): [CalendarDay, CalendarDay] => {
  const today = todayCalendarDay();
  return [today, today];
};

const CALENDAR_START_MONTH = new Date(1900, 0);
const CALENDAR_END_MONTH = new Date(2100, 11);
const CALENDAR_NAVIGATION_PROPS = {
  captionLayout: "dropdown" as const,
  startMonth: CALENDAR_START_MONTH,
  endMonth: CALENDAR_END_MONTH,
};

const normalizeBetweenDateValue = (
  value: unknown
): [CalendarDay, CalendarDay] | undefined => {
  if (!Array.isArray(value)) {
    const singleDay = calendarDay(value);
    return singleDay ? [singleDay, singleDay] : undefined;
  }

  const startDay = calendarDay(value[0]);
  const endDay = calendarDay(value[1] ?? value[0]);
  if (!(startDay && endDay)) {
    const day = startDay ?? endDay;
    return day ? [day, day] : undefined;
  }

  return startDay <= endDay ? [startDay, endDay] : [endDay, startDay];
};

/** The filter's day(s), whatever older shape the value has. */
const normalizeDateValue = (
  value: unknown,
  operator: FilterOperators["date"]
): DateFilterValue | undefined => {
  if (operator === "between") {
    return normalizeBetweenDateValue(value);
  }

  return calendarDay(Array.isArray(value) ? value[0] : value);
};

const getFallbackValue = (operator: FilterOperators["date"]): DateFilterValue =>
  operator === "between" ? fallbackDateRange() : todayCalendarDay();

const toDateRange = (
  normalizedValue: DateFilterValue | undefined
): [CalendarDay, CalendarDay] => {
  if (Array.isArray(normalizedValue)) {
    return normalizedValue;
  }

  if (normalizedValue) {
    return [normalizedValue, normalizedValue];
  }

  return fallbackDateRange();
};

/** The day picker works with local dates: a day is its local midnight. */
const pickerDate = (day: CalendarDay | undefined): Date | undefined =>
  day ? calendarDayToLocalDate(day) : undefined;

/** A picked local date as the day it shows. */
const pickedDay = (date: Date | undefined): CalendarDay | undefined =>
  date ? calendarDay(date) : undefined;

/** The picked day(s) as the column shows days: the date part of its format. */
const formatDateForDisplayValue = ({
  value,
  dateDisplayPreset,
  fallbackDateDisplayPreset,
  dateFormat,
  locale,
}: {
  value: DateFilterValue | undefined;
  dateDisplayPreset?: DateDisplayPreset;
  fallbackDateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  locale?: string;
}): string | undefined => {
  if (!value) {
    return;
  }
  return (
    formatFilterValueForDisplay(
      "date",
      Array.isArray(value) ? "between" : "equals",
      value,
      undefined,
      { dateDisplayPreset, fallbackDateDisplayPreset, dateFormat, locale }
    ) || undefined
  );
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
  dateFormat,
  dateDisplayPreset,
  fallbackDateDisplayPreset,
  inline = false,
}: DateFilterProps) {
  const { t } = useTranslations();
  const locale = useLocale();
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
    (newValue: DateFilterValue) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Check if this operator needs a value input
  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isBetween = operator === "between";
  const normalizedInternalValue = normalizeDateValue(internalValue, operator);
  const currentSingleValue = pickerDate(
    Array.isArray(normalizedInternalValue)
      ? normalizedInternalValue[0]
      : normalizedInternalValue
  );
  const currentRangeValue = toDateRange(normalizedInternalValue);
  const currentRangeSelection = {
    from: pickerDate(currentRangeValue[0]),
    to: pickerDate(currentRangeValue[1]),
  };

  // Handle single date selection
  const handleSingleDateSelect = useCallback(
    (date: Date | undefined) => {
      const day = pickedDay(date);
      if (day) {
        handleValueChange(day);
        setIsOpen(false);
      }
    },
    [handleValueChange]
  );

  // Handle date range selection
  const handleDateRangeSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      const from = pickedDay(range?.from);
      const to = pickedDay(range?.to);
      if (from && to) {
        handleValueChange([from, to]);
        setIsOpen(false);
      } else if (from) {
        // If only start date is selected, set end date to same date
        handleValueChange([from, from]);
      }
    },
    [handleValueChange]
  );

  // Format date for display
  const formatDisplayValue = useCallback(
    (date: DateFilterValue | undefined) => {
      return (
        formatDateForDisplayValue({
          value: date,
          dateDisplayPreset,
          fallbackDateDisplayPreset,
          dateFormat,
          locale,
        }) ?? t("filters.value")
      );
    },
    [dateDisplayPreset, fallbackDateDisplayPreset, dateFormat, locale, t]
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
                  {...CALENDAR_NAVIGATION_PROPS}
                  className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                  disabled={disabled}
                  autoFocus
                  mode="range"
                  onSelect={handleDateRangeSelect}
                  required
                  selected={currentRangeSelection}
                />
              ) : (
                <Calendar
                  {...CALENDAR_NAVIGATION_PROPS}
                  className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                  disabled={disabled}
                  autoFocus
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
                      formatDisplayValue(normalizedInternalValue)
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
                        {...CALENDAR_NAVIGATION_PROPS}
                        className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                        disabled={disabled}
                        autoFocus
                        mode="range"
                        onSelect={handleDateRangeSelect}
                        required
                        selected={currentRangeSelection}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-2">
                    <div className="rounded-md border">
                      <Calendar
                        {...CALENDAR_NAVIGATION_PROPS}
                        className="[--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
                        disabled={disabled}
                        autoFocus
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
  dateFormat,
  dateDisplayPreset,
  fallbackDateDisplayPreset,
}: Pick<
  DateFilterProps,
  | "value"
  | "operator"
  | "onValueChange"
  | "disabled"
  | "dateFormat"
  | "dateDisplayPreset"
  | "fallbackDateDisplayPreset"
>) {
  const { t } = useTranslations();
  const locale = useLocale();
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
    (newValue: DateFilterValue) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  const handleSingleDateSelect = useCallback(
    (date: Date | undefined) => {
      const day = pickedDay(date);
      if (day) {
        handleValueChange(day);
        setIsOpen(false);
      }
    },
    [handleValueChange]
  );

  const handleDateRangeSelect = useCallback(
    (range: { from?: Date; to?: Date } | undefined) => {
      const from = pickedDay(range?.from);
      const to = pickedDay(range?.to);
      if (from && to) {
        handleValueChange([from, to]);
      } else if (from) {
        handleValueChange([from, from]);
      }
    },
    [handleValueChange]
  );

  const formatDisplayValue = useCallback(
    (date: DateFilterValue | undefined) => {
      return (
        formatDateForDisplayValue({
          value: date,
          dateDisplayPreset,
          fallbackDateDisplayPreset,
          dateFormat,
          locale,
        }) ?? t("filters.value")
      );
    },
    [dateDisplayPreset, fallbackDateDisplayPreset, dateFormat, locale, t]
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
  const currentSingleValue = pickerDate(
    Array.isArray(normalizedInternalValue)
      ? normalizedInternalValue[0]
      : normalizedInternalValue
  );
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
            ? formatDisplayValue(normalizedInternalValue)
            : t("filters.value")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {isBetween ? (
          <Calendar
            {...CALENDAR_NAVIGATION_PROPS}
            disabled={disabled}
            autoFocus
            mode="range"
            onSelect={handleDateRangeSelect}
            required
            selected={{
              from: pickerDate(currentRangeValue[0]),
              to: pickerDate(currentRangeValue[1]),
            }}
          />
        ) : (
          <Calendar
            {...CALENDAR_NAVIGATION_PROPS}
            disabled={disabled}
            autoFocus
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
  onSelect: (range: [CalendarDay, CalendarDay]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslations();
  // Shortcuts pick the viewer's days when clicked; the rule keeps those days.
  const shortcuts = [
    {
      label: translateWithFallback(t, "filters.date_shortcuts.today", "Today"),
      getValue: (today: CalendarDay): [CalendarDay, CalendarDay] => [
        today,
        today,
      ],
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.yesterday",
        "Yesterday"
      ),
      getValue: (today: CalendarDay): [CalendarDay, CalendarDay] => {
        const yesterday = addCalendarDays(today, -1);
        return [yesterday, yesterday];
      },
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.last_7_days",
        "Last 7 days"
      ),
      getValue: (today: CalendarDay): [CalendarDay, CalendarDay] => [
        addCalendarDays(today, -6),
        today,
      ],
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.last_30_days",
        "Last 30 days"
      ),
      getValue: (today: CalendarDay): [CalendarDay, CalendarDay] => [
        addCalendarDays(today, -29),
        today,
      ],
    },
    {
      label: translateWithFallback(
        t,
        "filters.date_shortcuts.this_month",
        "This month"
      ),
      getValue: (today: CalendarDay): [CalendarDay, CalendarDay] => {
        const first = `${today.slice(0, 7)}-01`;
        // 31 days after the first of a month is always in the next month.
        const nextFirst = `${addCalendarDays(first, 31).slice(0, 7)}-01`;
        return [first, addCalendarDays(nextFirst, -1)];
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
          onClick={() => onSelect(shortcut.getValue(todayCalendarDay()))}
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
