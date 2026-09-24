---
"yayaw-table-workspace": minor
---

Form views are edited in a near full-screen form builder, in React and Vue, and forms no longer ask system or read-only columns.

- **Form builder**: "Edit form" above the Form view (or in View settings → Form, now a summary of the form) opens a dialog with the form's outline on the left (questions, sections, consents, hidden fields and the columns not asked; drag the grip or press Alt + ↑ / ↓ to reorder, "Add" for a column, a section, a consent or a hidden field), a live preview in the middle in the language and layout being edited (nothing is sent; "Show as closed" previews the closed message), and the selected item's properties on the right, a question's conditions included. The top bar has the layout, the languages ("Editing", "Add language"), the form's settings, "Share form" and Save. Changes stay in the builder until Save; closing with unsaved changes asks first. On phones the builder fills the screen with Questions, Preview and Properties tabs. A view's `editButton: false` hides "Edit form" above its form.
- **Columns a form may ask**: forms never ask columns a host flags `form: false`, `readonly`, `readOnly`, `editable: false`, `computed`, `system` or `hidden`, nor the metadata ids tables commonly carry (`id`, `createdAt`, `updatedBy`…); `form: true` opts a column in. When the host declares the table's create form (`getFormConfig`), forms ask only its fields (`formFields` in the renderer contexts). Saved questions on other columns are no longer asked, and public snapshots built on the server leave them out too.
- The side panel's conditions dialog is gone: conditions are edited in the builder's properties.
