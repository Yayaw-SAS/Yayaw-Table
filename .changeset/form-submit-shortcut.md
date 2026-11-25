---
"yayaw-table-workspace": minor
---

Forms save with Cmd+Enter on macOS or Ctrl+Enter elsewhere, from any field, as their save button does, including from the search of a select whose options are open. Enter alone and other modifier combinations keep their usual behavior, and a form that cannot be saved yet (loading, load error, submission in progress) ignores the shortcut. In the Vue edition, Tab in a select's search now goes on to the next field (Shift+Tab back to the select) instead of leaving the form, as the React edition already did.
