---
"yayaw-table-workspace": patch
---

Resolve display modes from one registry shared by React and Vue. A link or saved view asking for a mode the table does not offer now shows the rendered fallback as the active mode in React, and falls back from Gantt in Vue when no planning session exists. Resetting a view also clears Gantt settings, and Vue shows translated English display-mode labels.
