---
"yayaw-table-workspace": patch
---

List view (React and Vue): the line title now keeps priority over its properties. On narrow screens a long property such as an email truncates first instead of squeezing the title to a few letters: the title keeps its natural width, properties shrink three times faster and never take more than 60% of the line. Start-aligned properties still follow the title.
