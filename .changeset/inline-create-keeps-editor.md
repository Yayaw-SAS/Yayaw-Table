---
"yayaw-table-workspace": patch
---

An inline multi-select stays open while its `createOption` runs: moving the focus to a form the host opens from `createOption` no longer commits and closes the editor, which aborted the creation. Once the option is added, the search field takes the focus back.
