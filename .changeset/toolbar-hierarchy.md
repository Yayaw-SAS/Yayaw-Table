---
"yayaw-table-workspace": minor
---

The toolbar now separates views from settings in React and Vue, so it stays compact whatever the number of views. On the left, the view switcher: tabs on wide screens (the default view is a tab from the start) with a "View actions" menu for save, save as, favorite, reset and delete; on touch layouts, a named trigger whose menu lists the views (scrollable, with a name filter beyond 7 views) and their actions. On the right, search (a button that opens the field on touch layouts), "View settings" (layout, density, properties, filter, sort, group, card settings) with a badge counting active filters and sorts, and the create button. Export and Share move into a "Data" section of the settings; application toolbar actions stay in the toolbar on wide screens and join that section on touch layouts, which removes the "Data actions" drawer. `toolbarActionsPlacement` no longer changes positions, since Export is no longer in the toolbar. The `views.settings` label becomes "View settings"; new keys: `views.viewActions`, `views.filterViews`, `menu.data` (Vue: `viewActions`, `filterViews`, `menu.data`).

In touch drawers the view settings read as one list: layout and density are rows showing their value that open a list of choices, like properties, filter, sort and group.
