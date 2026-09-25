---
"yayaw-table-workspace": patch
---

React starts a table in its configured `columns.order`, as Vue does, and writes nothing to the URL until the user changes something.

- **The configured column order (React).** The table showed its columns in definition order and ignored `columns.order`. It now shows the listed columns first, in that order, then the others in definition order, with the selection column first and the actions column last. The Properties menu and the bulk export follow the same order.
- **Favorite and default views on arrival (React).** Right after mounting, the table wrote its column order to the URL (`<tableId>-order`). When `columns.order` differed from the definitions, that write looked like a change by the user, so the favorite or default view never applied. The table now writes its column order only once the user moves a column.
- **Back and forward (React)** show the column order each URL names. Before, the table wrote its previous order back to the URL.
- **Applying a saved view or hiding a column no longer remounts the React table.**
