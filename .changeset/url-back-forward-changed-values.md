---
"yayaw-table-workspace": patch
---

Vue sets only what the URL changed on back and forward, as React does, so the same query no longer loads the rows and the display modes again.

Reading the URL on back or forward set every value again, as new objects, even when the URL had not changed or only the column order had. The table then loaded its page again, and the File tree, Feed, Calendar, Chart and Map reloaded with the new rows: a File tree listed its root and every open folder again. A value now changes only when it differs from the current one, compared as JSON once read the way the table keeps it. On arrival the table still writes its whole state to the URL once.
