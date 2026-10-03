---
"yayaw-table-workspace": minor
---

The record's activity in the edit form (React and Vue). When `details` supplies `activity` or `history`, editing a record shows the record view's **Details | Activity** tabs. The fields and footer sit on the first tab and stay mounted while the activity shows. The timeline on the second tab has the same undo buttons as the record view. After a successful undo, the table refreshes and the fields reload from the refreshed row. Creating, bulk editing and tables without an activity log keep the plain form.

The timeline is now one shared component (`RecordActivity`) used by both the record view and the form. A tab panel kept mounted while hidden stays hidden whatever its own display.
