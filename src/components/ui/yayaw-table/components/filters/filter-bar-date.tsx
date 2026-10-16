"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/src/components/ui/popover";
import { useTranslations } from "../../providers/table-provider";
import {
  isRelativeDateToken,
  RELATIVE_DATE_CHOICES,
  relativeDateFieldLabel,
  relativeDateLabel,
  todayCalendarDay,
} from "../../utils/date-filter-days";
import type { FilterBarColumn, FilterBarDateValue } from "../../utils/filter-bar";

const ANY = "";
const FIXED = "fixed";

/** The filter bar's period of a date column, kept as one advanced rule: it filters every display mode. */
export function FilterBarDate({ column, value, onChange }: {
  column: FilterBarColumn; value: FilterBarDateValue; onChange: (value: FilterBarDateValue) => void;
}) {
  const { t, locale } = useTranslations();
  const { token, from, to } = value;
  const custom = !token && Boolean(from || to);
  let summary = "";
  if (token) summary = relativeDateLabel(token, locale);
  else if (from && to) summary = `${from} – ${to}`;
  else if (from) summary = `≥ ${from}`;
  else if (to) summary = `≤ ${to}`;
  const choose = (choice: string) => {
    if (isRelativeDateToken(choice)) onChange({ token: choice });
    else if (choice === FIXED) onChange({ from: from ?? todayCalendarDay() });
    else onChange({});
  };
  return (
    <Popover>
      <PopoverTrigger render={<Button aria-label={column.header} className="h-8 max-w-full gap-2 px-3 font-normal text-xs leading-4" data-date-filter={column.id} type="button" variant="outline" />}>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{column.header}</span>
        {summary && <span className="rounded-sm bg-muted px-1.5 text-xs">{summary}</span>}
        <ChevronDown aria-hidden="true" className="size-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-1rem)] gap-2 p-3">
        <PopoverTitle className="font-medium text-sm">{column.header}</PopoverTitle>
        <label className="grid gap-1 text-sm">
          <span>{relativeDateFieldLabel("label", locale)}</span>
          <select className="h-8 rounded-md border bg-background px-2 text-sm" data-date-filter-period="" onChange={event => choose(event.target.value)} value={token ?? (custom ? FIXED : ANY)}>
            <option value={ANY}>{locale.toLowerCase().startsWith("fr") ? "Toutes les dates" : "Any date"}</option>
            {RELATIVE_DATE_CHOICES.map(choice => <option key={choice} value={choice}>{relativeDateLabel(choice, locale)}</option>)}
            <option value={FIXED}>{relativeDateFieldLabel("fixed", locale)}</option>
          </select>
        </label>
        {custom && <>
          <Input aria-label={t("filters.value")} data-date-filter-from="" onChange={event => onChange({ from: event.target.value || undefined, to })} type="date" value={from ?? ""} />
          <Input aria-label={t("filters.value_to")} data-date-filter-to="" onChange={event => onChange({ from, to: event.target.value || undefined })} type="date" value={to ?? ""} />
        </>}
        <Button disabled={!summary} onClick={() => onChange({})} type="button" variant="outline">{t("filters.clear")}</Button>
      </PopoverContent>
    </Popover>
  );
}
