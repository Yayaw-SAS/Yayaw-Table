---
"yayaw-table-workspace": minor
---

A row click now opens the record view by default in React and Vue, in every display mode, with fields derived from the columns when `details` is not given. `enableRowClickEdit` / `rowClickMode: "edit"` still open the edit form, a row-link column still navigates, `rowClickMode: "none"` turns clicks off and `details={false}` removes the built-in record view. The display mode picker in the view menu is now a dropdown (touch drawers keep the buttons), and the Vue create button uses the React `add_an_item` key: both editions read "Add item" ("Ajouter" in French); hosts that translated `create` for this button should translate `add_an_item`.
