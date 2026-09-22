---
"yayaw-table-workspace": patch
---

Stop wrapping colour tokens in `hsl()`. The design tokens are oklch, so
`hsl(var(--primary))` resolves to `hsl(oklch(…))`, which is invalid and dropped
by the browser: the Kanban active-card bar, the sticky actions and footer cell
borders, the table's selected-row bar and the filter shimmer, focus-ring and
value-highlight animations all rendered with no colour at all. Reference the
tokens directly and express alpha with `color-mix(in oklab, …)`.
