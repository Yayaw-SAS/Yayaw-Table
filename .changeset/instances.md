---
"yayaw-table-workspace": minor
---

Two instances of one table on a page (`instanceId`) no longer share state:

- Saved views: each instance starts from its own `initialViews`, active view and default view (`initialFavoriteViewId`, `initialActiveViewId`) instead of the first instance's, while both still list the table's saved views; a view saved, updated, deleted or moved in one instance shows in the other. Without `instanceId`, nothing changes.
- File tree: the open folder is kept under `<instanceId>-folder` instead of `<tableId>-folder`, so each instance opens and links its own folder.
