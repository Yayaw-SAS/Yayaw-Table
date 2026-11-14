---
"yayaw-table-workspace": patch
---

Bulk action feedback (delete, copy, edit, export, select all) now follows the table locale in React and Vue, with French copy and singular/plural forms. Hosts can override each message through `translations.bulk.feedback` (React) or `bulk.feedback.<key>` (Vue). The Vue edition now confirms a library-run bulk delete, as React does.
