# Forms

Three kinds of forms share one conditions engine
(`utils/form-conditions.ts`, pure, usable on a server):

1. **Record forms** (create, edit, bulk edit) opened by the table.
2. **The Form view** (`form` display mode): a form that creates records.
3. **`YayawTableForm`**: the same form without table state, for public pages.

## Record forms

Without a registered form the table generates fields from the columns (see
the column types in [configuration](configuration.md#columns)). Register one
with `getFormConfig(formType, context)` returning a `FormConfig`
(`defineFormConfig()` types it). The form type is `form.createFormType`,
`form.editFormType` or `form.resolveEditFormType(row)`, else the `formType`
prop, else the table type.

`FormConfig`: `id`, `title` (string or `(mode, row) => string`),
`description`, `fields`, `rules`, `defaultValues`, `sections` or `blocks`,
`presentation`, `width`, `submitLabel`, `submitMode` (`"full"` or `"patch"`),
`loadInitialValues(row, context, signal)`, `schema` (zod), `transform(values,
context)`, `translations`.

- Field types: `text`, `textarea`, `number`, `switch`, `checkbox`, `date`,
  `select`, `multiSelect`, `radio`, `select-with-add-new`, `json`, `url`,
  `location`, `collection` (nested items, `collectionMode` `"inline"` or
  `"dialog"`), `tablePicker` (an embedded read-only table with single or
  multiple selection; its state stays out of the URL), `custom`,
  `dynamic-value` and `value-type`.
- Options: static `options`, `options(context)` returning a promise,
  `searchOptions(query, context, signal)`, `resolveOptions(values, context,
  signal)` for labels of stored values, `createOption(label, context, signal)`,
  `optionDependencies` (fields whose changes reload options) and
  `optionsScope` (change it with the tenant or permission scope, or options
  leak across scopes).
- Validation runs field `schema`s, then the form `schema`, then `transform`,
  then the action; `fieldErrors` returned by the action stay on their fields.
  Patch mode sends only changed fields, never hidden or disabled ones;
  `false`, `0`, `""`, `[]` and `null` are kept as values.
- `blocks` compose generated fields: `section` (1 to 3 columns), `field`,
  `content`, `actions` (callbacks get the values, `setFieldValue`,
  `validate`, `submit` and an `AbortSignal`) and framework-native `custom`
  blocks. Each field appears once; unknown ids are ignored.
- Bulk edit (`actions.bulkUpdate` without `onBulkEdit`): the user adds fields
  one by one; only those are sent. `bulkEdit: false` on a field excludes it
  (unique or unsafe fields). Conditions read the draft or the value every
  selected row shares; differing values never match.
- Field helpers: React `createDateField()`, `createLocationField()`,
  `createRadioField()`, `createCollectionField()`,
  `createTablePickerField()`; Vue also `createTextField()`,
  `createSelectField()`, `createNumberField()` and the other `create*Field`
  helpers.

## Conditions

A rule is `{ id, when, then }`:

```ts
const rules: FormRule[] = [
  {
    id: "hardware-details",
    when: { join: "and", items: [{ fieldId: "category", operator: "is", value: "hardware" }] },
    then: { action: "show", questionIds: ["serialNumber"] }, // record forms use fieldIds
  },
  {
    id: "budget-required",
    when: { join: "or", items: [{ fieldId: "budget", operator: "gt", value: 1000 }] },
    then: { action: "require", questionIds: ["justification"] },
  },
];
```

- `when` nests groups (`{ join, items }`). Operators: text `is`, `isNot`,
  `contains`, `notContains`, `startsWith`; number `eq`, `neq`, `lt`, `lte`,
  `gt`, `gte`, `between`; date `on`, `before`, `after`, `between`, `inLast`,
  `inNext`; select `is`, `isNot`, `isAnyOf`, `isNoneOf`; multi-select
  `containsAny`, `containsAll`, `containsNone`; checkbox `isChecked`,
  `isUnchecked`; `isEmpty` and `isNotEmpty` for all but checkboxes.
- `then.action`: `show` (the target stays hidden until a `show` rule
  matches), `hide` (wins), `require` (only while visible), `set` (writes
  `value`; configured in code, not in the editor).
- Hidden answers are cleared before other rules read them and are never
  submitted or validated.
- `evaluateForm()` returns `visible`, `hidden`, `required`, `setValues`;
  `validateRules()` reports unknown fields, operator and type mismatches,
  missing values, cycles and, in the steps layout, `require` or `set` rules
  reading a later question; `normalizeRules()` keeps the rules that can act.
- A field's legacy `hidden` flag or predicate keeps working (converted to a
  code-only rule).

## Form view

Offered when the table can create (`actions.create`, `allowCreate`);
`table.form: false` turns it off, `table.form: { … }` sets defaults, and each
saved view keeps its own settings (`FormViewSettings`):

- `title`, `description`, `submitLabel`, `successMessage`, `closedMessage`,
  `allowAnotherResponse`, `redirectUrl` (the host decides whether to follow
  it); texts are a string or one per language (`{ en: "Name", fr: "Nom" }`),
  with `defaultLocale` and `locales` (`table.form.locales`: the host's
  languages);
- `questions`: ordered `{ id, columnId, label?, help?, placeholder?,
  required?, optionLabels? }`, section breaks `{ id, kind: "section", title?,
  description? }`, consents `{ id, kind: "consent", text?, link?, version? }`
  (a required checkbox recorded in the response's `metadata.consents`) and
  hidden fields `{ id, kind: "hidden", source, columnId? }` (a URL parameter,
  the page, the referrer, the language or a fixed text); unset asks every
  eligible column;
- `rules` (on question ids), `layout` (`"page"` or `"steps"`, one question or
  one section per step), `review` (a final review step);
- `hiddenValues`: fixed values for columns not asked (for example
  `{ status: "new" }`);
- `editButton: false` hides "Edit form" above the form.

Eligible columns have a form editor (text, code, number, date, select, tag,
multi-select, boolean, URL, image and location) and are writable: a Form view
never asks columns flagged `form: false`, `readonly`, `readOnly`,
`editable: false`, `computed`, `system` or `hidden`, computed (`accessorFn`)
columns, nor metadata ids (`id`, `createdAt`, `updatedBy`…); `form: true`
opts a column in. When `getFormConfig` declares the create form, the Form
view asks only its fields (`formFields` in the renderer context). Unavailable
columns are listed in the form builder. A submission calls `actions.create`
with the fixed values, then the visible answers, with `set` values applied.
Numbers show the column's `numberFormat` once typed; dates are stored as
`YYYY-MM-DD`.

People edit a Form view in the form builder: "Edit form" above the form (or
View settings → Form, a summary) opens a near full-screen dialog with the
outline (drag or Alt + ↑ / ↓ to reorder, "Add"), a live preview in the
language and layout edited, and the selected item's properties with its
conditions. Edits stay in a draft until Save, which writes the view's settings
like any view setting; closing with unsaved changes asks first. On phones it
fills the screen with Questions, Preview and Properties tabs. The shared
controller is `FormBuilderController` (`utils/form-builder.ts`).

## Standalone form

```tsx
import { YayawTableForm } from "@/components/ui/yayaw-table/form/yayaw-table-form";
// Needs no QueryClient, nuqs or table provider.
<YayawTableForm columns={snapshot.columns} form={snapshot.form} onSubmit={submit} locale="fr" />
```

```ts
import YayawTableForm from "@/components/ui/yayaw-table-vue/form/YayawTableForm.vue";
// Also import "@/components/ui/yayaw-table-vue/styles.css" on a page that does not load the table.
```

Props: `columns`, `form`, `onSubmit(values, { context })` resolving
`{ ok: true }` or `{ errors, message }`, `validate`, `onSuccess({ values,
redirectUrl })`, `translations` or `translate`, `locale` (built-in English and
French), `context` (passed to `onSubmit` unchanged), `closed`, `extraFields`
(Vue `#extra-fields` slot) for a honeypot or captcha, controlled `value` and
`step` (React `onValueChange`, `onStepChange`; Vue `v-model:value`,
`v-model:step`) and `draftStorageKey` to resume from the browser's storage.

## Publishing a form

The table cannot serve pages. `actions.formLinks` (status, publish,
unpublish, setAcceptingResponses) adds "Share form" above a saved Form view;
the host serves the page and accepts the answers.

```ts
"use server";
import {
  acceptPublicFormResponse,
  buildPublicFormSnapshot,
  formLabel,
  type PublicFormSnapshot,
} from "@/components/ui/yayaw-table/utils/form-view";

// actions.formLinks.publish(viewId): the second argument (a browser-built snapshot) is ignored.
export async function publishForm(viewId: string) {
  const user = await requireUser();
  const view = await savedViews.get(user, viewId); // the view as stored on the server
  await assertCanPublish(user, view.tableId);
  const snapshot = buildPublicFormSnapshot({ view, columns: projectColumns }); // server columns only
  const slug = await publicForms.save(viewId, snapshot); // random, unguessable
  return { url: `https://app.example.com/f/${slug}` };
}

// The public page renders YayawTableForm with snapshot.form and snapshot.columns only.
export async function submitPublicForm(slug: string, answers: unknown, locale: string) {
  const snapshot: PublicFormSnapshot | null = await publicForms.accepting(slug);
  if (!snapshot) return { message: "This form is closed." };
  const result = acceptPublicFormResponse(snapshot, answers);
  if (!result.ok) {
    const errors = Object.fromEntries(
      Object.entries(result.errors).map(([columnId, code]) => [columnId, formLabel(code, locale)])
    );
    return { errors };
  }
  await projects.createFromPublicForm(slug, result.values); // service identity scoped to this table
  return { ok: true as const };
}
```

Security rules:

- Build snapshots only with `buildPublicFormSnapshot()` from the saved view
  and the server's own column list; `allowedColumnIds` narrows what a public
  response may fill. It keeps existing, creatable columns, checks fixed values
  against their column, and keeps rules and layout.
- Send `snapshot.form` and `snapshot.columns` to the browser; keep
  `hiddenValues` on the server.
- Re-validate every response with `acceptPublicFormResponse()`: it keeps the
  asked columns only, applies the rules (required if visible, hidden answers
  dropped, `set` values applied) and adds the fixed values.
- Treat the endpoint as public: rate limit, cap payload sizes, add a honeypot
  or captcha through `extraFields`, and never accept ids, owners or other
  columns from the request.
- Republishing is explicit ("Update public form"), so unsaved edits never go
  live; unpublishing and "Accept responses" must be enforced by the endpoint.
