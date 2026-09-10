---
"yayaw-table-workspace": patch
---

Align React and Vue toolbar controls at 32px high with 12px regular text, 16px action icons, 12px dropdown chevrons, and square icon buttons. Keep row density independent from toolbar sizing. Fit Table, Kanban, and Gallery buttons inside their segmented frame so hover and selected backgrounds stay centered, preserving keyboard navigation and translated tooltips.

Refresh the local Shadcn Base Vega Button styles and Tooltip from the official registry, retaining the shared button-variants export and local import aliases. Bring the Vue standalone Button styles and Reka Tooltip composition in line with the official Shadcn Vue Vega sources, including focus states, tooltip arrows, and composed-trigger forwarding.
