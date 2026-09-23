---
"yayaw-table-workspace": minor
---

Add a Calendar display mode to React and Vue as optional registry items (`yayaw-table-calendar`, `yayaw-table-vue-calendar`) rendered with FullCalendar: month, week and list layouts, drag to move a record, stretch to change its end, click a day to create a record on it. Install the item, pass `displayModeRenderers={{ calendar: calendarRenderer }}` and add `"calendar"` to `displayModes`; configure it with `table.calendar` (`dateColumn`, `endColumn`, `titleColumn`, `colorColumn`, `layout`, `weekStartsOn`, `showWeekends`, `allowDragUpdate`, `allowResize`, `allowCreate`). Settings are saved with views and in the `<tableId>-calendar` URL key; the visible range is sent to `list` as `scope: { kind: "dateRange" }`. The new `displayModeRenderers` prop lets any optional item render a display mode, and the create form accepts prefilled values.
