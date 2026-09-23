---
"yayaw-table-workspace": patch
---

Vue now follows the host's shadcn theme: its colors, borders, inputs, ring and radius read the shadcn CSS variables (`--background`, `--muted`, `--border`, `--input`, `--primary`, `--radius`…), falling back to shadcn's neutral theme. Controls, badges, table header, checkboxes, the selection column, the view trigger, the header title and font smoothing now match React, and Vue shows React's default table description ("Manage your …") when none is configured.
