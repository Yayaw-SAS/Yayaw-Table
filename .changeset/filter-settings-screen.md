---
"yayaw-table-workspace": minor
---

The filter column picker now lives in the view settings' Filter screen: the separate toolbar Filter button is gone, and column menus still open a rule's chip. The date rule editor is redesigned after Notion: a segmented Relative / Exact date / Date range choice, "This / Past / Next" and unit lists for relative periods, and a month calendar that shows the period and picks days. The density picker is a real segmented radio group with arrow-key navigation. The former filter components (`AdvancedFilterPanel`, `EnhancedFilterChip`, `FilterPresetsPanel`, `ModernAddFilterDropdown`, the per-type filters, `useFilterPresets`) are removed; saved views replace presets. React and Vue.
