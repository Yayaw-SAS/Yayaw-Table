"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/src/components/ui/input";
import type { FilterMenu } from "../../../hooks/use-filter-menu";
import { useTableConfig } from "../../../hooks/use-table-config";
import {
  calendarDay,
  RELATIVE_DATE_UNITS,
  type RelativeDateToken,
  type RelativeDateUnit,
  relativeDateLabel,
  relativeDateTokenOf,
  todayCalendarDay,
} from "../../../utils/date-filter-days";
import {
  DATE_PRESET_ROWS,
  type DateRuleMode,
  dateRuleMode,
  filterDayText,
  filterPeriodSentence,
  type RollingDate,
  rollingDateOf,
  rollingDateToken,
} from "../../../utils/filter-menu";
import { tableFilterContext } from "../../../utils/table-contracts";

export interface DateRuleValue {
  operator: string;
  values: unknown;
}

const SEGMENT =
  "min-w-0 truncate rounded-[5px] px-2 py-1 text-muted-foreground text-xs transition-colors aria-pressed:bg-background aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:shadow-xs";
const CHOICE =
  "min-w-0 rounded-md border border-transparent px-2 py-1.5 text-start text-sm leading-tight hover:bg-muted aria-pressed:border-blue-200 aria-pressed:bg-blue-50 aria-pressed:text-blue-700 dark:aria-pressed:border-blue-900 dark:aria-pressed:bg-blue-950 dark:aria-pressed:text-blue-300";
const NATIVE_SELECT =
  "h-8 min-w-0 rounded-md border bg-background px-2 text-sm";

/**
 * A date rule's days, as Notion picks them: relative choices first (today,
 * this week, the last 30 days…), a rolling period of any length, an exact
 * day, or two days. Each choice changes the rule at once.
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
  const [rolling, setRolling] = useState<RollingDate>(
    rollingDateOf(token) ?? { direction: "last", count: 30, unit: "Days" }
  );
  useEffect(() => {
    const parts = rollingDateOf(token);
    if (parts) {
      setRolling(parts);
    }
  }, [token]);
  /** Two days only make sense for "is": the other operators compare with one. */
  const canRange = operator === "equals" || operator === "between";
  const pickOperator = operator === "between" ? "equals" : operator;
  const pick = (value: RelativeDateToken) =>
    onChange({ operator: pickOperator, values: value });
  const applyRolling = (next: RollingDate) => {
    setRolling(next);
    const value = rollingDateToken({
      ...next,
      count: Math.max(1, Number(next.count) || 1),
    });
    if (value) {
      pick(value);
    }
  };
  const day = (index: number): string => {
    const list = Array.isArray(values) ? values : [values];
    return token ? "" : (calendarDay(list[index]) ?? "");
  };
  const changeMode = (next: DateRuleMode) => {
    setMode(next);
    if (next === "relative") {
      return;
    }
    const today = todayCalendarDay(config.table.timeZone);
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
  let sentence = filterPeriodSentence(
    token ?? (Array.isArray(values) ? undefined : values),
    locale,
    translate,
    tableFilterContext(config.table, locale)
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
      <fieldset
        aria-label={text("value")}
        className="m-0 grid min-w-0 grid-flow-col gap-0.5 rounded-md border-0 bg-muted p-0.5"
      >
        {modes.map((item) => (
          <button
            aria-pressed={mode === item}
            className={SEGMENT}
            key={item}
            onClick={() => changeMode(item)}
            type="button"
          >
            {text(item)}
          </button>
        ))}
      </fieldset>
      {mode === "relative" && (
        <>
          <fieldset
            aria-label={text("relative")}
            className="m-0 grid min-w-0 grid-cols-3 gap-0.5 border-0 p-0"
          >
            {DATE_PRESET_ROWS.flat().map((choice) => (
              <button
                aria-pressed={token === choice}
                className={CHOICE}
                data-relative-date={choice}
                key={choice}
                onClick={() => pick(choice)}
                type="button"
              >
                {relativeDateLabel(choice, locale, translate)}
              </button>
            ))}
          </fieldset>
          <form
            aria-label={text("custom")}
            className="grid grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              applyRolling(rolling);
            }}
          >
            <select
              aria-label={text("custom")}
              className={NATIVE_SELECT}
              data-rolling-direction=""
              onChange={(event) =>
                applyRolling({
                  ...rolling,
                  direction: event.target.value as RollingDate["direction"],
                })
              }
              value={rolling.direction}
            >
              <option value="last">{text("last")}</option>
              <option value="next">{text("next")}</option>
            </select>
            <Input
              aria-label={text("value")}
              className="h-8"
              data-rolling-count=""
              inputMode="numeric"
              max={3660}
              min={1}
              onBlur={() => applyRolling(rolling)}
              onChange={(event) =>
                setRolling({ ...rolling, count: Number(event.target.value) })
              }
              type="number"
              value={rolling.count || ""}
            />
            <select
              aria-label={text("value")}
              className={NATIVE_SELECT}
              data-rolling-unit=""
              onChange={(event) =>
                applyRolling({
                  ...rolling,
                  unit: event.target.value as RelativeDateUnit,
                })
              }
              value={rolling.unit}
            >
              {RELATIVE_DATE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {text(unit)}
                </option>
              ))}
            </select>
          </form>
        </>
      )}
      {mode === "exact" && (
        <label className="grid gap-1 text-sm" htmlFor={`${fieldId}-exact`}>
          <span className="text-muted-foreground text-xs">{text("value")}</span>
          <Input
            data-date-exact=""
            id={`${fieldId}-exact`}
            onChange={(event) => changeDay(0, event.target.value)}
            type="date"
            value={day(0)}
          />
        </label>
      )}
      {mode === "range" && (
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1].map((index) => (
            <label
              className="grid min-w-0 gap-1 text-sm"
              htmlFor={`${fieldId}-${index}`}
              key={index}
            >
              <span className="text-muted-foreground text-xs">
                {text(index ? "to" : "from")}
              </span>
              <Input
                {...{ [index ? "data-date-to" : "data-date-from"]: "" }}
                id={`${fieldId}-${index}`}
                onChange={(event) => changeDay(index, event.target.value)}
                type="date"
                value={day(index)}
              />
            </label>
          ))}
        </div>
      )}
      <output className={cn("text-muted-foreground text-xs")}>{sentence}</output>
    </div>
  );
}
