"use client";

import { CalendarIcon, ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "../components/filters/calendar";
import {
  formDateAnswer,
  formDateDisplay,
  formWeekStart,
} from "../utils/form-view";
import { parseDateValue } from "../utils/value-format";

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface FormDateFieldProps {
  /** Id of the trigger, so the question's label points at it. */
  id: string;
  /** Id of the question label; the trigger is named by it and its date. */
  labelId: string;
  value: string;
  locale: string;
  placeholder: string;
  clearLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}

/** Captions, weekdays and day names in the form's language. */
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
      labels: {
        labelDayButton: (date: Date) => day.format(date),
      },
    };
  }, [locale]);
}

/** A date question: a button showing the date in the form's language, and a calendar. */
export function FormDateField({
  clearLabel,
  describedBy,
  disabled,
  id,
  invalid,
  labelId,
  locale,
  onChange,
  placeholder,
  required,
  value,
}: FormDateFieldProps) {
  const [open, setOpen] = useState(false);
  const text = useCalendarText(locale);
  const shown = formDateDisplay(value, locale);
  const selected = shown ? parseDateValue(value) : undefined;
  const valueId = `${id}-value`;
  const calendar = useRef<HTMLDivElement>(null);
  // Open on the picked day, or today, so arrow keys move through the month.
  const dayToFocus = () =>
    calendar.current?.querySelector<HTMLElement>(
      '[data-selected="true"] button, [data-today="true"] button'
    ) ?? true;
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-describedby={describedBy}
            aria-invalid={invalid ? true : undefined}
            aria-labelledby={`${labelId} ${valueId}`}
            aria-required={required || undefined}
            className="w-full justify-start gap-2 px-2.5 font-normal"
            data-form-focus
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        <CalendarIcon aria-hidden="true" className="text-muted-foreground" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !shown && "text-muted-foreground"
          )}
          id={valueId}
        >
          {shown ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto gap-0 p-0"
        initialFocus={dayToFocus}
        ref={calendar}
      >
        <Calendar
          className="[--cell-size:--spacing(8)]"
          defaultMonth={selected}
          formatters={text.formatters}
          labels={text.labels}
          lang={locale}
          mode="single"
          onSelect={(date) => pick(date ? formDateAnswer(date) : "")}
          selected={selected}
          weekStartsOn={formWeekStart(locale) as WeekStart}
        />
        {shown ? (
          <div className="flex justify-end border-t p-2">
            <Button
              onClick={() => pick("")}
              size="sm"
              type="button"
              variant="ghost"
            >
              {clearLabel}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
