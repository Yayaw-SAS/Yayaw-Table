"use client";

import FullCalendar, {
  type DateClickInfo,
  type DatesSetInfo,
  type EventChangeInfo,
  type EventClickInfo,
  type EventDisplayInfo,
  type EventInput,
  useCalendarController,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import frLocale from "@fullcalendar/react/locales/fr";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import type { DisplayModeRenderContext } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import {
  addDays,
  type CalendarLayout,
  type CalendarViewSettings,
  calendarEvents,
  calendarMovePatch,
  calendarScope,
  daysBetween,
  resolveCalendarSettings,
} from "@/components/ui/yayaw-table/utils/calendar-model";
import {
  loadScopedRows,
  localDayKey,
} from "@/components/ui/yayaw-table/utils/scoped-rows";
import { tagAppearance } from "@/components/ui/yayaw-table/utils/tag-colors";
import { cn } from "@/lib/utils";
import "@/components/ui/yayaw-table/utils/tag-colors.css";

type RowRecord = Record<string, unknown>;

const VIEW_TYPES: Record<CalendarLayout, string> = {
  month: "dayGridMonth",
  week: "dayGridWeek",
  list: "listMonth",
};
const LAYOUT_LABELS: Record<CalendarLayout, string> = {
  month: "Month",
  week: "Week",
  list: "List",
};
const LAYOUTS = Object.keys(LAYOUT_LABELS) as CalendarLayout[];
const MAX_EVENTS_PER_DAY = 4;

/** The classic theme follows the host's shadcn tokens, light and dark. */
const THEME_STYLE = {
  "--fc-classic-button": "var(--secondary)",
  "--fc-classic-button-border": "var(--border)",
  "--fc-classic-button-strong": "var(--accent)",
  "--fc-classic-button-strong-border": "var(--border)",
  "--fc-classic-button-outline": "var(--ring)",
  "--fc-classic-button-foreground": "var(--secondary-foreground)",
  "--fc-classic-primary": "var(--primary)",
  "--fc-classic-primary-foreground": "var(--primary-foreground)",
  "--fc-classic-event": "transparent",
  "--fc-classic-event-contrast": "var(--foreground)",
  "--fc-classic-background-event": "var(--muted)",
  "--fc-classic-background-event-opacity": "100%",
  "--fc-classic-background-event-foreground-opacity": "60%",
  "--fc-classic-highlight":
    "color-mix(in oklab, var(--primary) 12%, transparent)",
  "--fc-classic-today": "color-mix(in oklab, var(--primary) 6%, transparent)",
  "--fc-classic-now": "var(--destructive)",
  "--fc-classic-small-dot-width": "8px",
  "--fc-classic-large-dot-width": "10px",
  "--fc-classic-background": "var(--background)",
  "--fc-classic-faint": "color-mix(in oklab, var(--muted) 40%, transparent)",
  "--fc-classic-muted": "var(--muted)",
  "--fc-classic-strong": "var(--accent)",
  "--fc-classic-foreground": "var(--foreground)",
  "--fc-classic-faint-foreground": "var(--muted-foreground)",
  "--fc-classic-muted-foreground": "var(--muted-foreground)",
  "--fc-classic-border": "var(--border)",
  "--fc-classic-strong-border": "var(--input)",
} as CSSProperties;

interface EventMeta {
  row: RowRecord;
  appearance?: ReturnType<typeof tagAppearance>;
}

function useCalendarRows(
  context: DisplayModeRenderContext,
  settings: CalendarViewSettings,
  range: { start: Date; end: Date } | undefined
) {
  const [rows, setRows] = useState<RowRecord[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string>();
  const { list, listParams, revision } = context;
  const pageRows = list ? undefined : context.rows;
  const { dateColumn, endColumn } = settings;
  // A new request after every mutation (`revision`) as well as query changes.
  const request = useMemo(
    () => ({ params: listParams, revision }),
    [listParams, revision]
  );
  useEffect(() => {
    if (!(range && dateColumn && request.revision >= 0)) {
      return;
    }
    const controller = new AbortController();
    const scope = calendarScope(
      { dateColumn, endColumn },
      range.start,
      range.end
    );
    loadScopedRows({
      list,
      rows: pageRows,
      params: request.params,
      scope,
      signal: controller.signal,
    })
      .then((result) => {
        setRows(result.rows);
        setTruncated(result.truncated);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => controller.abort();
  }, [dateColumn, endColumn, list, pageRows, range, request]);
  return { rows, setRows, truncated, error };
}

function EventContent({ info }: { info: EventDisplayInfo }) {
  const meta = info.event.extendedProps as unknown as EventMeta;
  const appearance = meta.appearance;
  return (
    <span
      className={cn(
        "yayaw-tag block w-full truncate px-1.5 py-0.5 text-xs",
        appearance?.colored
          ? appearance.className
          : "bg-secondary text-secondary-foreground",
        !appearance?.colored && "rounded-[0.35rem]"
      )}
      data-colored={appearance?.colored ? "true" : undefined}
      data-custom-color={appearance?.className ? "" : undefined}
      style={appearance?.style as CSSProperties | undefined}
      title={info.event.title}
    >
      {info.event.title}
    </span>
  );
}

function CalendarToolbar({
  context,
  layout,
  onLayout,
  controller,
  title,
}: {
  context: DisplayModeRenderContext;
  layout: CalendarLayout;
  onLayout: (layout: CalendarLayout) => void;
  controller: ReturnType<typeof useCalendarController>;
  title: string;
}) {
  const label = (key: string, fallback: string) =>
    context.translate(`views.calendar.${key}`, fallback);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <Button
          aria-label={label("previous", "Previous")}
          className="size-8"
          onClick={() => controller.prev()}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
        <Button
          className="h-8 font-normal text-xs"
          onClick={() => controller.today()}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("today", "Today")}
        </Button>
        <Button
          aria-label={label("next", "Next")}
          className="size-8"
          onClick={() => controller.next()}
          size="icon"
          type="button"
          variant="outline"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
        <h3 className="ml-2 font-medium text-sm capitalize" data-calendar-title>
          {title}
        </h3>
      </div>
      <fieldset className="flex items-center gap-1">
        <legend className="sr-only">{label("layout", "Layout")}</legend>
        {LAYOUTS.map((item) => (
          <Button
            aria-pressed={layout === item}
            className="h-8 font-normal text-xs"
            key={item}
            onClick={() => onLayout(item)}
            size="sm"
            type="button"
            variant={layout === item ? "secondary" : "ghost"}
          >
            {label(item, LAYOUT_LABELS[item])}
          </Button>
        ))}
      </fieldset>
    </div>
  );
}

/** Calendar display mode for YaYaw Table, rendered with FullCalendar. */
export function CalendarView({
  context,
}: {
  context: DisplayModeRenderContext;
}) {
  const settings = useMemo(
    () =>
      resolveCalendarSettings(
        context.columns,
        context.defaults as CalendarViewSettings,
        context.settings as CalendarViewSettings
      ),
    [context.columns, context.defaults, context.settings]
  );
  const controller = useCalendarController();
  const [range, setRange] = useState<{ start: Date; end: Date }>();
  const [title, setTitle] = useState("");
  const { rows, setRows, truncated, error } = useCalendarRows(
    context,
    settings,
    range
  );
  const colorColumn = context.columns.find(
    (column) => column.id === settings.colorColumn
  );
  const rowsById = useMemo(
    () => new Map(rows.map((row) => [context.getRowId(row), row])),
    [context, rows]
  );
  const events = useMemo<EventInput[]>(
    () =>
      calendarEvents(rows, settings, context.getRowId).map((event) => {
        const row = rowsById.get(event.id) ?? {};
        const editable = context.canEditRow(row);
        return {
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: true,
          startEditable: settings.allowDragUpdate && editable,
          durationEditable:
            settings.allowResize && Boolean(settings.endColumn) && editable,
          extendedProps: {
            row,
            appearance:
              event.colorValue === undefined
                ? undefined
                : tagAppearance(
                    event.colorValue,
                    colorColumn?.coloredTags ?? true,
                    colorColumn?.tagColorMap
                  ),
          } satisfies EventMeta,
        };
      }),
    [colorColumn, context, rows, rowsById, settings]
  );

  const layout = settings.layout;
  useEffect(() => {
    if (controller.view && controller.view.type !== VIEW_TYPES[layout]) {
      controller.changeView(VIEW_TYPES[layout]);
    }
  }, [controller, layout]);

  const moveEvent = async (info: EventChangeInfo) => {
    const row = rowsById.get(info.event.id);
    const start = localDayKey(info.event.start);
    if (!(row && start)) {
      info.revert();
      return;
    }
    const previousStart = localDayKey(info.oldEvent.start) ?? start;
    const previousEnd =
      localDayKey(info.oldEvent.end) ?? addDays(previousStart, 1);
    const end =
      localDayKey(info.event.end) ??
      addDays(start, daysBetween(previousStart, previousEnd));
    const patch = calendarMovePatch(row, settings, start, end);
    // Show the move at once; a failed save puts the event back.
    setRows((current) =>
      current.map((item) => (item === row ? { ...item, ...patch } : item))
    );
    if (!(await context.updateRow(row, patch))) {
      setRows((current) =>
        current.map((item) =>
          context.getRowId(item) === info.event.id ? row : item
        )
      );
      info.revert();
    }
  };

  const createOn = (info: DateClickInfo) => {
    if (!(settings.allowCreate && context.canCreate && settings.dateColumn)) {
      return;
    }
    const day = localDayKey(info.date);
    if (!day) {
      return;
    }
    context.createRow({
      [settings.dateColumn]: day,
      ...(settings.endColumn ? { [settings.endColumn]: day } : {}),
    });
  };

  if (!settings.dateColumn) {
    return (
      <output className="block rounded-md border p-6 text-muted-foreground text-sm">
        {context.translate(
          "views.calendar.noDateColumn",
          "Add a date column to show this table as a calendar."
        )}
      </output>
    );
  }

  return (
    <div className="grid gap-3" data-calendar-layout={layout}>
      <CalendarToolbar
        context={context}
        controller={controller}
        layout={layout}
        onLayout={(next) =>
          context.updateSettings({ ...context.settings, layout: next })
        }
        title={title}
      />
      {error ? (
        <div className="text-destructive text-sm" role="alert">
          {error}
        </div>
      ) : null}
      {truncated ? (
        <output className="block text-muted-foreground text-sm">
          {context.translate(
            "views.calendar.truncated",
            "Only part of the records are shown. Narrow the filters to see all of them."
          )}
        </output>
      ) : null}
      <div
        className="yayaw-calendar overflow-hidden rounded-md border text-sm"
        style={THEME_STYLE}
      >
        <FullCalendar
          borderless
          controller={controller}
          dateClick={createOn}
          datesSet={(info: DatesSetInfo) => {
            setRange((current) =>
              current?.start.getTime() === info.start.getTime() &&
              current.end.getTime() === info.end.getTime()
                ? current
                : { start: info.start, end: info.end }
            );
            setTitle(info.view.title);
          }}
          dayMaxEvents={MAX_EVENTS_PER_DAY}
          eventClass="yayaw-calendar-event"
          eventClick={(info: EventClickInfo) => {
            info.jsEvent.preventDefault();
            const row = rowsById.get(info.event.id);
            if (row) {
              context.openRow(
                row,
                info.jsEvent as unknown as MouseEvent<HTMLElement>
              );
            }
          }}
          eventContent={(info: EventDisplayInfo) => (
            <EventContent info={info} />
          )}
          eventDrop={moveEvent}
          eventResize={moveEvent}
          events={events}
          firstDay={settings.weekStartsOn}
          headerToolbar={false}
          height="auto"
          initialView={VIEW_TYPES[layout]}
          locale={context.locale.startsWith("fr") ? frLocale : context.locale}
          plugins={[
            classicThemePlugin,
            dayGridPlugin,
            listPlugin,
            interactionPlugin,
          ]}
          weekends={settings.showWeekends}
        />
      </div>
    </div>
  );
}
