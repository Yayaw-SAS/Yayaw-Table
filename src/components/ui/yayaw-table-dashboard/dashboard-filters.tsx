"use client";

import { CalendarIcon, ChevronDown, X } from "lucide-react";
import { useId, useMemo } from "react";
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
  dashboardFilterColumn,
  dashboardFilterLabel,
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
  /** Id of the "Applies to …" text describing the control. */
  describedBy?: string;
  /** The filter's name in the dashboard's language. */
  name?: string;
}

/** Outside edit mode the filter's name leads its button, as a compact chip. */
function TriggerName({ editing, name }: FilterControlProps) {
  return editing ? null : (
    <span className="shrink-0 text-muted-foreground" data-filter-name="">
      {name}
    </span>
  );
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
function DateRangeControl(props: FilterControlProps) {
  const {
    describedBy,
    filter,
    label,
    locale,
    name,
    onChange,
    tables,
    translate,
  } = props;
  const text = useCalendarText(locale);
  const range = (filter.value ?? {}) as DashboardDateRange;
  const from = dashboardDay(range.start);
  const to = dashboardDay(range.end);
  const shown = dashboardDateRangeText(
    filter.value,
    locale,
    translate,
    dashboardFilterColumn(filter, tables)
  );
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            aria-describedby={describedBy}
            aria-label={`${name}: ${shown}`}
            className="h-8 min-w-56 max-w-full justify-start gap-2 px-2.5 font-normal"
            data-filter-trigger=""
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <CalendarIcon aria-hidden="true" className="text-muted-foreground" />
        <TriggerName {...props} />
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
function SelectControl(props: FilterControlProps) {
  const { describedBy, filter, label, name, onChange, tables } = props;
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
            aria-describedby={describedBy}
            aria-label={name}
            className="h-8 min-w-44 max-w-80 justify-start gap-1.5 px-2 font-normal"
            data-filter-trigger=""
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <TriggerName {...props} />
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
        <PopoverTitle className="sr-only">{name}</PopoverTitle>
        <fieldset
          aria-label={name}
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

/**
 * A filter: a compact button outside edit mode (its name inside, where it
 * applies read by screen readers); its name, remove button and targets
 * above and below it while editing.
 */
function DashboardFilterControl(props: FilterControlProps) {
  const { editing, filter, label, locale, onChange, onRemove, tables } = props;
  const targetsId = useId();
  const name = dashboardFilterLabel(filter, locale);
  const control = { ...props, describedBy: targetsId, name };
  return (
    <fieldset
      className={cn("flex min-w-0 flex-col", editing && "gap-1.5")}
      data-dashboard-filter={filter.id}
    >
      <legend
        className={cn(
          editing ? "mb-1.5 flex items-center gap-1 font-medium text-sm" : "sr-only"
        )}
      >
        {name}
        {editing && (
          <Button
            aria-label={label("removeFilter", { name })}
            onClick={onRemove}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </legend>
      <div className="flex flex-wrap items-center gap-1">
        {filter.type === "dateRange" ? (
          <DateRangeControl {...control} />
        ) : (
          <SelectControl {...control} />
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
      <p
        className={editing ? "text-muted-foreground text-xs" : "sr-only"}
        data-filter-targets=""
        id={targetsId}
      >
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
      className={cn(
        "flex flex-wrap",
        editing
          ? "items-end gap-x-6 gap-y-3 rounded-xl border bg-muted/40 p-3"
          : "items-center gap-2"
      )}
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
