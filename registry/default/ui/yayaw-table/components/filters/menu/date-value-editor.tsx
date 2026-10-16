"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import { useTableConfig } from "../../../hooks/use-table-config";
import {
  type CalendarDay,
  type CalendarDayRange,
  calendarDay,
  RELATIVE_DATE_UNITS,
  type RelativeDateUnit,
  relativeDateTokenOf,
  todayCalendarDay,
} from "../../../utils/date-filter-days";
import {
  addCalendarMonths,
  type CalendarMonth,
  calendarMonthTitle,
  calendarMonthWeeks,
  calendarWeekdays,
  calendarWeekStart,
  type DateRuleMode,
  dateRuleDays,
  dateRuleMode,
  type FilterMenuTextKey,
  filterDayText,
  filterPeriodSentence,
  pickRangeDay,
  RELATIVE_DATE_DIRECTIONS,
  type RelativeDateDirection,
  type RelativeDateParts,
  relativeDateParts,
  relativeDatePartsToken,
} from "../../../utils/filter-menu";
import { tableFilterContext } from "../../../utils/table-contracts";

export interface DateRuleValue {
  operator: string;
  values: unknown;
}

const NATIVE_SELECT =
  "h-8 min-w-0 rounded-md border bg-background px-2 text-sm";
const SEGMENT =
  "relative inline-flex h-7 min-w-0 flex-1 cursor-pointer select-none items-center justify-center truncate rounded-[calc(var(--radius-md)-2px)] px-2 text-muted-foreground text-xs transition-colors hover:text-foreground has-checked:bg-background has-checked:font-medium has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50 dark:has-checked:bg-input/60";
const MONTH_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

const DIRECTION_TEXT: Record<RelativeDateDirection, FilterMenuTextKey> = {
  this: "this",
  last: "lastOne",
  next: "nextOne",
  past: "past",
  coming: "coming",
};
const UNIT_TEXT: Record<RelativeDateUnit, FilterMenuTextKey> = {
  Days: "day",
  Weeks: "week",
  Months: "month",
  Years: "year",
};
const DEFAULT_PARTS: RelativeDateParts = {
  direction: "this",
  count: 1,
  unit: "Weeks",
};

const rolls = (direction: RelativeDateDirection) =>
  direction === "past" || direction === "coming";

/**
 * A month of days, as Notion shows a date filter: the rule's days
 * highlighted, today marked, and a click on a day picks it.
 */
function DateRuleCalendar({
  days,
  locale,
  onPick,
  previousLabel,
  nextLabel,
  today,
  weekStartsOn,
}: {
  days: CalendarDayRange | undefined;
  locale?: string;
  onPick: (day: CalendarDay) => void;
  previousLabel: string;
  nextLabel: string;
  today: CalendarDay;
  weekStartsOn: number;
}) {
  const anchor = (days?.start ?? today).slice(0, 7);
  const [month, setMonth] = useState<CalendarMonth>(anchor);
  useEffect(() => setMonth(anchor), [anchor]);
  const title = calendarMonthTitle(month, locale);
  const inRange = (day: CalendarDay) =>
    Boolean(days && day >= days.start && day <= days.end);
  const isEdge = (day: CalendarDay) =>
    Boolean(days && (day === days.start || day === days.end));
  return (
    <div className="grid gap-1" data-date-calendar="">
      <div className="flex items-center justify-between gap-2 ps-1">
        <span className="font-medium text-sm capitalize" data-calendar-month="">
          {title}
        </span>
        <span className="flex items-center">
          <button
            aria-label={previousLabel}
            className={MONTH_BUTTON}
            data-calendar-previous=""
            onClick={() => setMonth(addCalendarMonths(month, -1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={nextLabel}
            className={MONTH_BUTTON}
            data-calendar-next=""
            onClick={() => setMonth(addCalendarMonths(month, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </span>
      </div>
      <table
        aria-label={title}
        className="w-full border-collapse text-sm"
        data-date-calendar=""
      >
        <thead>
          <tr>
            {calendarWeekdays(locale, weekStartsOn).map((name) => (
              <th
                className="h-7 font-normal text-muted-foreground text-xs"
                key={name}
                scope="col"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendarMonthWeeks(month, weekStartsOn).map((week) => (
            <tr key={week[0]}>
              {week.map((day) => (
                <td
                  className={cn(
                    "p-0 text-center",
                    inRange(day) && "bg-blue-50 dark:bg-blue-950/60",
                    day === days?.start && "rounded-s-md",
                    day === days?.end && "rounded-e-md"
                  )}
                  key={day}
                >
                  <button
                    aria-label={filterDayText(day, locale)}
                    aria-pressed={inRange(day)}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-md tabular-nums hover:bg-muted",
                      day.slice(0, 7) !== month && "text-muted-foreground/60",
                      day === today &&
                        "font-semibold text-red-600 dark:text-red-400",
                      isEdge(day) &&
                        "bg-blue-600 text-white hover:bg-blue-600 dark:bg-blue-500 dark:text-white"
                    )}
                    data-calendar-day={day}
                    data-today={day === today || undefined}
                    onClick={() => onPick(day)}
                    type="button"
                  >
                    {Number(day.slice(8))}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A date rule's days, as Notion picks them: relative to today with two lists
 * ("This" + "week", "Past" + 30 + "days"…), an exact day or two days, over a
 * calendar that highlights them. Each choice changes the rule at once.
 */
export function DateValueEditor({
  menu,
  operator,
  values,
  onChange,
}: {
  menu: FilterMenu;
  operator: string;
  values: unknown;
  onChange: (rule: DateRuleValue) => void;
}) {
  const { config } = useTableConfig(menu.tableType);
  const { locale, translate, text } = menu;
  const token = relativeDateTokenOf(values);
  const ruleMode = dateRuleMode({ id: "", columnId: "", operator, values });
  const fieldId = useId();
  const [mode, setMode] = useState<DateRuleMode>(ruleMode);
  useEffect(() => {
    if (ruleMode !== "relative" || token) {
      setMode(ruleMode);
    }
  }, [ruleMode, token]);
  const [parts, setParts] = useState<RelativeDateParts>(
    relativeDateParts(token) ?? DEFAULT_PARTS
  );
  useEffect(() => {
    const next = relativeDateParts(token);
    if (next) {
      setParts(next);
    }
  }, [token]);
  // The second click of a range ends it.
  const [rangePending, setRangePending] = useState(false);
  const context = tableFilterContext(config.table, locale);
  const today = todayCalendarDay(config.table.timeZone);
  /** Two days only make sense for "is": the other operators compare with one. */
  const canRange = operator === "equals" || operator === "between";
  const pickOperator = operator === "between" ? "equals" : operator;
  const applyParts = (next: RelativeDateParts) => {
    setParts(next);
    const value = relativeDatePartsToken(next);
    if (value) {
      onChange({ operator: pickOperator, values: value });
    }
  };
  const day = (index: number): string => {
    const list = Array.isArray(values) ? values : [values];
    return token ? "" : (calendarDay(list[index]) ?? "");
  };
  const changeMode = (next: DateRuleMode) => {
    setMode(next);
    setRangePending(false);
    if (next === "relative") {
      // The lists name no period until one is chosen.
      return;
    }
    if (next === "range") {
      onChange({
        operator: "between",
        values: [day(0) || today, day(1) || day(0) || today],
      });
    } else {
      onChange({ operator: pickOperator, values: day(0) || today });
    }
  };
  const changeDay = (index: number, value: string) => {
    if (mode === "range") {
      const next = [day(0), day(1)];
      next[index] = value;
      onChange({ operator: "between", values: next });
    } else {
      onChange({ operator: pickOperator, values: value || undefined });
    }
  };
  const pickDay = (picked: CalendarDay) => {
    if (mode === "range") {
      onChange({
        operator: "between",
        values: pickRangeDay([day(0), day(1)], picked, rangePending),
      });
      setRangePending(!rangePending);
      return;
    }
    // A day picked on a relative rule makes it exact, as in Notion.
    setMode("exact");
    onChange({ operator: pickOperator, values: picked });
  };
  let sentence = filterPeriodSentence(
    token ?? (Array.isArray(values) ? undefined : values),
    locale,
    translate,
    context
  );
  if (mode === "range" && day(0) && day(1)) {
    sentence = text("period")
      .replace("{start}", filterDayText(day(0), locale))
      .replace("{end}", filterDayText(day(1), locale));
  }
  const modes: DateRuleMode[] = canRange
    ? ["relative", "exact", "range"]
    : ["relative", "exact"];
  return (
    <div className="grid gap-2" data-date-value-editor="">
      <fieldset className="m-0 min-w-0 border-0 p-0" data-date-mode="">
        <legend className="sr-only">{text("value")}</legend>
        <div className="flex w-full rounded-md border bg-muted/60 p-0.5">
          {modes.map((item) => (
            <label className={SEGMENT} key={item}>
              <input
                checked={mode === item}
                className="sr-only"
                data-date-mode-option={item}
                name={`${fieldId}-mode`}
                onChange={() => changeMode(item)}
                type="radio"
                value={item}
              />
              {text(item)}
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "relative" && (
        <div
          className={cn(
            "grid gap-1.5",
            token && rolls(parts.direction)
              ? "grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)]"
              : "grid-cols-2"
          )}
          data-relative-date-parts=""
        >
          <select
            aria-label={text("relative")}
            className={NATIVE_SELECT}
            data-relative-direction=""
            onChange={(event) =>
              applyParts({
                ...parts,
                direction: event.target.value as RelativeDateDirection,
              })
            }
            value={token ? parts.direction : ""}
          >
            {!token && (
              <option disabled value="">
                {text("choose")}
              </option>
            )}
            {RELATIVE_DATE_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {text(DIRECTION_TEXT[direction])}
              </option>
            ))}
          </select>
          {token && rolls(parts.direction) && (
            <Input
              aria-label={text("value")}
              className="h-8"
              data-rolling-count=""
              inputMode="numeric"
              max={3660}
              min={1}
              onBlur={() => applyParts(parts)}
              onChange={(event) =>
                setParts({ ...parts, count: Number(event.target.value) })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyParts(parts);
                }
              }}
              type="number"
              value={parts.count || ""}
            />
          )}
          <select
            aria-label={text("unit")}
            className={NATIVE_SELECT}
            data-relative-unit=""
            onChange={(event) =>
              applyParts({
                ...parts,
                unit: event.target.value as RelativeDateUnit,
              })
            }
            value={parts.unit}
          >
            {RELATIVE_DATE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {text(rolls(parts.direction) ? unit : UNIT_TEXT[unit])}
              </option>
            ))}
          </select>
        </div>
      )}
      {mode === "exact" && (
        <Input
          aria-label={text("exact")}
          data-date-exact=""
          onChange={(event) => changeDay(0, event.target.value)}
          type="date"
          value={day(0)}
        />
      )}
      {mode === "range" && (
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1].map((index) => (
            <Input
              {...{ [index ? "data-date-to" : "data-date-from"]: "" }}
              aria-label={text(index ? "to" : "from")}
              key={index}
              onChange={(event) => changeDay(index, event.target.value)}
              type="date"
              value={day(index)}
            />
          ))}
        </div>
      )}
      <DateRuleCalendar
        days={dateRuleDays(values, context)}
        locale={locale}
        nextLabel={text("nextMonth")}
        onPick={pickDay}
        previousLabel={text("previousMonth")}
        today={today}
        weekStartsOn={calendarWeekStart(context)}
      />
      <output className="border-t pt-2 text-muted-foreground text-xs">
        {mode === "relative" && token
          ? `${sentence} · ${text("relativeHint")}`
          : sentence}
      </output>
    </div>
  );
}
