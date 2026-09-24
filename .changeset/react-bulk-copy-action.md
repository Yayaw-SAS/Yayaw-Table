---
"yayaw-table-workspace": patch
---

React's bulk Copy calls the host's `actions.bulkCopy`, as Vue does.

- **Bulk Copy** (React): without `onBulkCopy`, Copy now sends the selected ids to `actions.bulkCopy(ids)` and refreshes the table after a success. It previously ignored that action and always copied the rows as JSON to the clipboard, so hosts that duplicate records server-side (like Vue users of the same host) got a clipboard copy instead. The JSON clipboard copy remains the fallback when neither `onBulkCopy` nor `actions.bulkCopy` exists; Vue hides Copy in that case.
