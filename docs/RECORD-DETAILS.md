# Record details

`RecordDetails` is a read-only record surface for React and Vue. Add `details`
to `DataTable` to enable the row's **View** action. A row activation also opens
the record; explicit `edit`, `link`, and `none` row-click modes keep their existing
behavior. Set `rowClickMode: "activate"` to make consultation the primary flow.

The content supports `presentation: "drawer" | "modal" | "inline"` and an optional
CSS `width`. Inline content can live in any page, split pane, or application-owned
container. Presentation is independent of the existing edit form configuration.

## Configuration

```ts
const details: RecordDetailsConfig = {
  presentation: "drawer",
  title: row => String(row.name),
  updatedAt: row => row.updatedAt as string,
  updatedBy: row => row.updatedBy as string,
  activity: row => row.audit as DetailActivity[],
  sections: [{
    id: "overview",
    title: "Overview",
    fields: [
      { id: "name", label: "Name", type: "text" },
      { id: "budget", label: "Budget", type: "number",
        numberFormat: { style: "currency", currency: "EUR" } },
      { id: "active", label: "Active", type: "boolean" },
    ],
  }],
};
```

Omit `sections` to derive the detail fields from column definitions, including
accessors, types, and option labels. Detail sections are independent of table
column visibility. Explicit sections can include fields that are absent from the
table and can omit fields with `hidden`. A field can use `accessorKey` (including
dot paths) or `getValue`. Only displayed fields appear in before/after diffs.
Use an explicit projection for sensitive records; hiding a table column is not
an authorization policy.

The renderer supports all data-bearing table types and every built-in form type:
text/string, multiline text, number, boolean/checkbox/switch, date/date-time,
select/radio/tag/multi-select/select-with-add-new, relation/table picker, image,
URL/email/telephone, collection, files, code/JSON, dynamic values, and custom
fields. Passwords are masked. Zero, false, and missing values remain distinct.
Relation values can be objects with `label`/`name`, or IDs resolved through the
field's `options`. Fetch remote options in the host before passing the projection.
Files use `{ name, url }` objects. Collections preserve every item's data.

Vue supports `#detail-<field-id>="{ row, value, field }"` slots, including when
using `DataTable`. Standalone React supports `renderField(field, value, row)`;
return `undefined` to use the standard renderer. Pass `locale` and optional
`details.labels` to localize the surface; English and French labels are included.

## Actions and presentation

```tsx
<DataTable {...tableProps} details={details} onRevertActivity={revertActivity} />

// Standalone React: mount with a stable record key.
<RecordDetails key={row.id} row={row} config={{ ...details, presentation: "inline" }}
  onClose={close} onEdit={openEditor} onDelete={deleteRecord}
  onDeleted={refreshList} onRevertActivity={revertActivity} onReverted={reloadRecord} />
```

```vue
<DataTable :details="details" :on-revert-activity="revertActivity" v-bind="tableProps" />

<!-- Standalone Vue uses the same configuration and keeps edit orchestration in the host. -->
<RecordDetails :key="row.id" :row="row" :config="details"
  :can-edit="canEdit" :can-delete="canDelete" :on-delete="deleteRecord"
  :on-revert-activity="revertActivity" @close="close" @edit="openEditor"
  @deleted="refreshList" @reverted="reloadRecord" />
```

In a table, Edit opens the existing catalogue form. Edit and Delete require the
corresponding action handler and table/row permissions. Delete opens an accessible
confirmation modal naming the record, initially focuses Cancel, prevents duplicate
requests, and keeps errors visible for retry. It closes the record only after a
successful mutation. List refresh failures must not repeat an acknowledged delete.

## Append-only activity and undo

Activity belongs to the host application. Supply full, authorized, up-to-date audit
data; the component does not infer authors or manufacture history. Load the record
and its history before mounting a standalone view, or update the parent row as data
arrives. Renderers themselves do not fetch or persist data.

```ts
const event: DetailActivity = {
  id: "change-42",
  actor: { name: "Camille Martin" },
  at: "2026-09-09T08:42:00Z",
  action: "updated the budget",
  changes: [{ field: "budget", before: 12000, after: 15000 }],
};
```

Providing `onRevertActivity(row, event)` enables **Undo this change**. It returns
`{ success: boolean, error?: string }`. `details.canRevert(event, row)` can further
restrict availability. `reversible: false` disables undo for a particular event.
Creation events without field changes and undo events are not offered undo.

Undo must be a server-side operation that checks authorization and the current
record version, restores the values, and appends a new audit event in the same
transaction. It must preserve the original event. A new event references it using
`reverts: originalEvent.id`, names the authenticated actor, and records the inverse
before/after changes. Refresh the canonical row and audit log before resolving the
handler (or in `onReverted` / `@reverted`). Do not derive the authenticated actor
from client input or delete the original audit line.

The UI marks the original event **Undone**, blocks repeats and pending concurrent
actions, and disables undo if a newer supplied event changed the same fields. The
server must still reject stale or conflicting requests, including changes absent
from the client's log. A failed undo leaves the record and event intact and shows
the error beside that event. A successful callback without a refreshed audit log
cannot show the new event: the application must supply it.

## Interactive example

Run `bun run vue:dev` and open `/?example=record-details` (the deployed demo uses
`/vue-example/?example=record-details`). It includes 30 fields, every current
data-bearing table type, all form field types, three presentation modes, and
fictional audit entries. Edit, Delete, Reset, and Undo operate only on in-memory
demo rows. Undo appends a new entry and rejects repeat or conflicting operations.
The sample URLs are illustrative; attachment links do not host real documents.

Shared fixtures live in `examples/record-details.ts`. The shared display and audit
contracts live under `src/components/ui/yayaw-table/utils/record-details.ts`; run
`bun run registry:sync` to update the Vue copy and generated registry files.
