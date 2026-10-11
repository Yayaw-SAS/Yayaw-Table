---
"yayaw-table-workspace": minor
---

Kanban lanes per view: `kanban.lanes` keeps the lane order and hidden lanes of each grouping column (`{ "status": { "order": ["won", "lead"], "hidden": ["lost"] } }`). Saved views carry it, so switching views switches lanes; `table.kanban.lanes` sets the default. The Kanban settings show, hide, reorder and reset the lanes, and server boards arrange their lanes the same way. React and Vue.

Initials avatars: `avatar` (`true` or `{ nameColumn, imageColumn, shape }`) shows initials with a stable color where a record has no image, on image columns (table cells and card properties), before Kanban and List titles (with the record's image when it has one), and on Gallery cards without an image. Decorative beside a shown name, labelled with the name in cells. React and Vue.
