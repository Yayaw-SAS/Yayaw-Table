"use client";

import { CalendarIcon, ChevronDown, X } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { formWeekStart } from "@/src/components/ui/yayaw-table/utils/form-view";
import { tagAppearance } from "@/src/components/ui/yayaw-table/utils/tag-colors";
import "@/src/components/ui/yayaw-table/utils/tag-colors.css";
import {
  type DashboardDateRange,
  type DashboardFilter,
  type DashboardFilterOption,
  type DashboardTableInfo,
  type DashboardTranslate,
  dashboardDateRangeText,
  dashboardDay,
  dashboardDayValue,
  dashboardFilterColoredTags,
  dashboardFilterOptions,
  dashboardFilterTargetsLabel,
  isDashboardFilterActive,
} from "./dashboard-model";
import type { DashboardLabel } from "./dashboard-widget";

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface FilterControlProps {
  filter: DashboardFilter;
  tables: Record<string, DashboardTableInfo>;
  editing: boolean;
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  onChange: (value: DashboardDateRange | string[] | undefined) => void;
  onRemove: () => void;
}

/** Month captions, weekdays and day names in the dashboard's language. */
function useCalendarText(locale: string) {
  return useMemo(() => {
    const month = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const day = new Intl.DateTimeFormat(locale, { dateStyle: "full" });
    return {
      formatters: {
        formatCaption: (date: Date) => month.format(date),
        formatWeekdayName: (date: Date) => weekday.format(date),
      },
      labels: { labelDayButton: (date: Date) => day.format(date) },
    };
  }, [locale]);
}

/** The Form view's popover calendar, picking a range of days. */
function DateRangeControl({
  filter,
  label,
  locale,
  onChange,
  translate,
}: FilterControlProps) {
  const text = useCalendarText(locale);
  const range = (filter.value ?? {}) as DashboardDateRange;
  const from = dashboardDay(range.start);
  const to = dashboardDay(range.end);
  const shown = dashboardDateRangeText(filter.value, locale, translate);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={`${filter.label}: ${shown}`}
            className="h-8 min-w-56 justify-start gap-2 px-2.5 font-normal"
            data-filter-trigger=""
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <CalendarIcon aria-hidden="true" className="text-muted-foreground" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !(from || to) && "text-muted-foreground"
          )}
          data-filter-value=""
        >
          {shown}
        </span>
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto gap-0 p-0"
        data-dashboard-filter-popup={filter.id}
      >
        <Calendar
          className="[--cell-size:--spacing(8)]"
          defaultMonth={from ?? to}
          formatters={text.formatters}
          labels={text.labels}
          lang={locale}
          mode="range"
          onSelect={(next) =>
            onChange({
              start: next?.from ? dashboardDayValue(next.from) : undefined,
              end: next?.to ? dashboardDayValue(next.to) : undefined,
            })
          }
          selected={from || to ? { from, to } : undefined}
          weekStartsOn={formWeekStart(locale) as WeekStart}
        />
        {from || to ? (
          <div className="flex justify-end border-t p-2">
            <Button
              onClick={() => onChange(undefined)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {label("clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** An option as the table shows it: a tag. */
function OptionTag({
  colored,
  option,
}: {
  colored: boolean;
  option: DashboardFilterOption;
}) {
  const appearance = tagAppearance(option.value, colored);
  return (
    <span
      className={cn(
        "yayaw-tag inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs",
        appearance.className
      )}
      data-colored={appearance.colored}
      data-custom-color={appearance.className ? "" : undefined}
      style={appearance.style}
    >
      {option.label}
    </span>
  );
}

/** The library's option dropdown: "All" or the chosen options, shown as tags. */
function SelectControl({ filter, label, onChange, tables }: FilterControlProps) {
  const values = Array.isArray(filter.value) ? filter.value : [];
  const options = dashboardFilterOptions(filter, tables);
  const colored = dashboardFilterColoredTags(filter, tables);
  const chosen = options.filter((option) => values.includes(option.value));
  const toggle = (value: string) => {
    const next = values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
    onChange(next.length ? next : undefined);
  };
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-label={filter.label}
            className="h-8 min-w-44 max-w-80 justify-start gap-1.5 px-2 font-normal"
            data-filter-trigger=""
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <span
          className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
          data-filter-value=""
        >
          {chosen.length ? (
            chosen.map((option) => (
              <OptionTag colored={colored} key={option.value} option={option} />
            ))
          ) : (
            <span className="px-0.5">{label("any")}</span>
          )}
        </span>
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 gap-1 p-1"
        data-dashboard-filter-popup={filter.id}
      >
        <PopoverTitle className="sr-only">{filter.label}</PopoverTitle>
        <fieldset
          aria-label={filter.label}
          className="m-0 grid max-h-64 min-w-0 gap-0.5 overflow-auto border-0 p-0"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent">
            <input
              checked={values.length === 0}
              onChange={() => onChange(undefined)}
              type="checkbox"
            />
            <span>{label("any")}</span>
          </label>
          {options.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              key={option.value}
            >
              <input
                aria-label={option.label}
                checked={values.includes(option.value)}
                onChange={() => toggle(option.value)}
                type="checkbox"
              />
              <OptionTag colored={colored} option={option} />
            </label>
          ))}
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}

function DashboardFilterControl(props: FilterControlProps) {
  const { editing, filter, label, onChange, onRemove, tables } = props;
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-1.5"
      data-dashboard-filter={filter.id}
    >
      <legend className="mb-1.5 flex items-center gap-1 font-medium text-sm">
        {filter.label}
        {editing && (
          <Button
            aria-label={label("removeFilter", { name: filter.label })}
            onClick={onRemove}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {filter.type === "dateRange" ? (
          <DateRangeControl {...props} />
        ) : (
          <SelectControl {...props} />
        )}
        {isDashboardFilterActive(filter) && (
          <Button
            onClick={() => onChange(undefined)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {label("clear")}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs" data-filter-targets="">
        {label("appliesTo", {
          targets: dashboardFilterTargetsLabel(filter, tables),
        })}
      </p>
    </fieldset>
  );
}

/** The dashboard's filters; each joins the widgets it targets. */
export function DashboardFilterBar({
  editing,
  filters,
  label,
  locale,
  onAddFilter,
  onChange,
  onRemove,
  tables,
  translate,
}: {
  editing: boolean;
  filters: DashboardFilter[];
  label: DashboardLabel;
  locale: string;
  translate: DashboardTranslate;
  onAddFilter: () => void;
  onChange: (
    filterId: string,
    value: DashboardDateRange | string[] | undefined
  ) => void;
  onRemove: (filterId: string) => void;
  tables: Record<string, DashboardTableInfo>;
}) {
  if (!(filters.length || editing)) {
    return null;
  }
  return (
    <section
      aria-label={label("filters")}
      className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border bg-muted/40 p-3"
      data-dashboard-filters=""
    >
      {filters.map((filter) => (
        <DashboardFilterControl
          editing={editing}
          filter={filter}
          key={filter.id}
          label={label}
          locale={locale}
          onChange={(value) => onChange(filter.id, value)}
          onRemove={() => onRemove(filter.id)}
          tables={tables}
          translate={translate}
        />
      ))}
      {editing && (
        <Button onClick={onAddFilter} size="sm" type="button" variant="outline">
          {label("addFilter")}
        </Button>
      )}
    </section>
  );
}
