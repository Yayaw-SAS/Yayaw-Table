"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { CalendarIcon, ChevronDown } from "lucide-react";
import {
  type ComponentProps,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";
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
  type ResolvedFormQuestion,
} from "../utils/form-view";
import { parseDateValue } from "../utils/value-format";

type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type FormDateFormat = ResolvedFormQuestion["dateFormat"];

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
  /** Earliest and latest days that can be picked (`YYYY-MM-DD`). */
  min?: string;
  max?: string;
  /**
   * Renders the calendar inside this element (absolutely positioned), for
   * pickers in a drawer whose focus trap would otherwise dismiss it.
   */
  portalContainer?: RefObject<HTMLElement | null> | null;
  /** The column's date format: the day shows as the table shows it. */
  format?: FormDateFormat;
  onChange: (value: string) => void;
}

const POPUP_CLASSES =
  "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 flex w-auto flex-col gap-0 rounded-md p-0 text-sm shadow-md ring-1 duration-100 z-50 origin-(--transform-origin) outline-hidden";

/** The calendar's popup: the shared popover, or one kept inside a drawer. */
function CalendarPopup({
  container,
  ...props
}: ComponentProps<typeof PopoverContent> & {
  container?: RefObject<HTMLElement | null> | null;
}) {
  if (!container) {
    return (
      <PopoverContent align="start" className="w-auto gap-0 p-0" {...props} />
    );
  }
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Positioner
        align="start"
        className="isolate z-50"
        collisionPadding={8}
        positionMethod="absolute"
        sideOffset={4}
      >
        <PopoverPrimitive.Popup
          className={POPUP_CLASSES}
          data-slot="popover-content"
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

/** Days outside `min`…`max` cannot be picked. */
const outside = (min?: string, max?: string) => {
  const before = min ? parseDateValue(min) : undefined;
  const after = max ? parseDateValue(max) : undefined;
  return [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];
};

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
  format,
  id,
  invalid,
  labelId,
  locale,
  max,
  min,
  onChange,
  placeholder,
  portalContainer,
  required,
  value,
}: FormDateFieldProps) {
  const [open, setOpen] = useState(false);
  const text = useCalendarText(locale);
  const shown = formDateDisplay(value, locale, format);
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
      <CalendarPopup
        container={portalContainer}
        initialFocus={dayToFocus}
        ref={calendar}
      >
        <Calendar
          className="[--cell-size:--spacing(8)]"
          defaultMonth={selected}
          disabled={outside(min, max)}
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
      </CalendarPopup>
    </Popover>
  );
}
