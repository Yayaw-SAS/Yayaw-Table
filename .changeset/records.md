---
"yayaw-table-workspace": minor
---

Record details and deletions, in React and Vue:

- Typed delete confirmation: `table.deleteConfirmation: { type: "typed", match?: "title" | "column" | "text", column?, text?, bulkMatch?: "count" | "text", caseSensitive? }` keeps the row, bulk and record Delete buttons disabled until the user types the record's title, a column's value, a fixed word or the number of selected records. `details.deleteConfirmation` overrides it for the record view.
- Related lists: `details.sections` accepts `{ kind: "related", source, foreignKey, localKey?, columns, sort?, limit?, empty?, rows?, open?, add?, collapsed? }`. Records come from static `rows` or the host's `details.loadRelated(section, row, query)`, loaded once the section is open and visible; "Open" and "Add" call `details.onRelatedAction`.
- Host extensions: `details.renderField` and `details.renderSection` (React) and the `#detail-field` and `#record-section-<id>` slots (Vue) render host-defined fields and `{ kind: "custom" }` sections, e.g. custom fields stored in a JSON column.
