---
"yayaw-table-workspace": minor
---

Calendar events can show more than their title, in React and Vue. `calendar.cardColumnIds` lists the columns shown under the title, one line each, formatted as the table shows them (option labels, currencies, dates), and `calendar.showCardLabels` prefixes each line with its column label. Users choose both in the calendar's view settings ("Fields" and "Show labels", as on Kanban cards), and saved views keep them. Without `cardColumnIds`, events keep their one-line title.
