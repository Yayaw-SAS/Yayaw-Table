# Changelog

## 3.5.0

### Minor Changes

- 52dc04d: Add a Chart display mode to React and Vue as optional registry items (`yayaw-table-chart`, `yayaw-table-vue-chart`), like Notion charts: vertical and horizontal bars, line, donut and number. React renders with shadcn/ui charts (Recharts; the item lists the `chart` shadcn component and `recharts`), Vue with Unovis (`@unovis/vue`, `@unovis/ts`), both loaded only when a chart is shown and colored with the `--chart-1…5` tokens or the options' colors. Install the item, pass `displayModeRenderers={{ chart: chartRenderer }}` and add `"chart"` to `displayModes`.

  - Settings per view, saved with views and in the `<tableId>-chart` URL key: `type`, `xColumn` (+ `bucket`: day, week, month, quarter, year, and `weekStartsOn`), `metric` (count, sum, avg, min, max, countDistinct) and `metricColumn`, `seriesColumn` (stacked or grouped bars, one line per value) and `stacked`, `sort` (automatic, label, value, option order), `cumulative`, `hideEmpty`, `topN` (the rest become "Other"), `showDataLabels`, `showLegend`, `colors` (`options` or `palette`). `table.chart` sets table defaults; `table.chart: false` turns the mode off.
  - Server first: `actions.aggregate` receives `groupBy: [{ columnId, bucket? }]` (x axis, then series), `metrics`, `timeZone` and `weekStartsOn` beside the usual query (search, filters, advanced filters) and answers `{ groups: [{ keys, values }], truncated? }`; `calculations` is then empty. Hosts without `aggregate`, or answering only `results`, are aggregated in the browser over every row matching the query (capped, with a notice). The response type of `aggregate` now makes `results` optional and adds `groups`/`truncated`. The shared `utils/chart-model.ts` holds settings, bucketing in the column's time zone, the client aggregation (`aggregateChartRows`, usable as an in-memory host), sorting, cumulation, top N, labels, formats and EN/FR texts (`chart.<key>` overrides).
  - Clicking a bar, slice or point, or a group in the "Show as table" fallback, adds that group's rules to the view's advanced filters and opens the table (or the list). When the view's filters match any rule (OR), groups cannot be added and the chart says so.
  - `TableDisplayMode` gains `"chart"`: hosts with exhaustive `Record<TableDisplayMode, …>` tables add an entry. Renderer contexts gain `aggregate`, `advancedFilters` and `showRecords`.
  - React fixes found on the way: a table whose rows finished loading right after its filters changed could keep showing skeleton rows (the body read a loading ref one render late), and date-only advanced filter values from the URL are read as local days instead of UTC midnight (a day early west of Greenwich).

- 8165529: Keep connector targets healthy, additive and backward compatible. The new shared `utils/connector-schema.ts` (both editions, pure, safe on the server) holds the type compatibility matrix per direction (`typeCompatibility`: `ok`, `coerce`, `no`, `unsupported`, `read_only`), field resolution by stable id, then name, then shifted sheet position (`resolveMappedField`, `upgradeMapping`), and `checkTargetSchema({ columns, mapping, keyField, targetSchema, direction })`, which reports `missing_field`, `deleted_field`, `renamed_field`, `incompatible_type`, `coercible_type`, `unsupported_type`, `read_only_field`, `missing_options`, `missing_key`, `key_wrong_type`, `duplicate_mapping` and `title_unmapped` as blocking, fixable or warning issues with additive `fixes`; `schemaBlocksRun(report)` tells a worker to pause a schedule instead of failing row by row.

  Mapping entries gain optional `fieldId` and `fieldIndex`, settings `keyFieldId` and `keyFieldIndex`, `ConnectorMapping` `propertyIds` and `keyPropertyId`, `SyncField` `fieldId` and `SyncMapping` `keyFieldId`: Notion pushes, reads and sync targets find properties by id first, so a renamed property keeps its column; name-only mappings keep working and gain ids on their next save. Notion adds `notionTargetSchema`, `prepareNotionDatabase` (creates missing properties with the right type, "Yayaw ID" as text, and missing select and multi-select options with the table's colors in one PATCH; never deletes, renames or retypes), `planNotionPrepare`, `listNotionPages`, `createNotionDatabase` and `planNotionDatabase`, and reads formulas, created and edited times and unique ids. Google Sheets adds `sheetTargetSchema` and `getSheetTargetSchema` (header positions and sampled types), `prepareSheet` and `planSheetPrepare` (missing headers at the end, key first; never reorders or deletes). Sheet writes (`pushRowsToSheet` with `fieldIndexes` and `keyColumnIndex`, `createSheetSyncTarget`, `readSheetRows`, `prepareSheet`) find a renamed header at its saved position (`fieldIndex`, shifted like the key column, when the header there is mapped by nothing else) and write it in place instead of adding the old header again; when that position is unusable they write nothing and throw the new `field_missing` error code, which the check reports as a blocking `field_missing` issue (`resolveSheetColumns`, `planSheetHeader` hints).

  The React and Vue connector screens check the target on open and on every mapping change (from `describe`'s fields, or the connector's optional `checkSchema`), show "Target check" with issues grouped by severity, "Update mapping" for renamed fields, "Prepare Notion database" / "Prepare sheet" with a confirmation of the changes (the connector's optional `prepareTarget`), and disable Send, Sync and Preview with the reason while an issue blocks. Mapping choices list fields a column cannot fill as disabled with the reason (read-only, not supported yet, doesn't fit, used by another column), the Notion page title is the first row, the target list has "Refresh list", `help.missingTarget` and, with the optional `createTarget`, "Create one from this table’s columns…". `ConnectorField` gains `id` and `index`, `ConnectorSchema` `provider`, `ConnectorColumn` `options`, and choice options an optional `disabled` (React `ViewSettingField`, Vue settings panel and `TableSelect`). Labels are English and French, overridable with `connector.<key>`.

- 6278725: Form settings: the conditions of a question are edited in "Edit conditions", a centered dialog (a bottom drawer on phones) with room for the rules, while the side panel keeps the summary and the button. Each condition is a card that stacks question, comparison and value in narrow containers and lines them up when there is room; comparisons use short complete labels ("is", "is not", "before", "between", "in the last"…, overridable with `form.cmp*`); values use the table's controls (option tags, calendar, number input); a nested group is an indented card with an All/Any segmented control; problems are linked to the control they concern. Same behavior in React and Vue.

### Patch Changes

- 0487e69: Form sharing imports `buttonVariants` from the shadcn `button` component instead of a file that only exists in this repository, so installs of the registry item compile.

## 3.4.0

### Minor Changes

- c2cb50c: Add conditional logic and a step-by-step layout to forms, in React and Vue.

  A shared conditions engine (`utils/form-conditions.ts`, synced to Vue) evaluates rules `{ id, when, then }`: `when` is an AND/OR group of conditions (nested groups allowed) with operators per type (text: is, is not, contains, does not contain, starts with, empty; number: = ≠ < ≤ > ≥, between, empty; date: on, before, after, between, in the last/next N days, empty; select: is, is not, is any of, is none of; multi-select: contains any/all/none; checkbox: checked/unchecked), `then` shows, hides, requires or sets questions (`questionIds`) or fields (`fieldIds`). `evaluateForm` returns visible and required ids and `set` values; hidden answers never satisfy other conditions. `validateRules` reports unknown fields, operator/type mismatches, missing values, cycles and, in steps, `require`/`set` rules reading a later question; `normalizeRules` drops broken rules with their reason.

  - **Form view** (`form.rules`): per-question rule editor in Form settings ("Show this question when…", question/comparison/value rows, All/Any, one nested group, inline problems) with summaries such as "Shown when Category is Hardware and Budget > 1000". Hidden answers are removed from the response; `acceptPublicFormResponse` applies the same rules on the server (required if visible, hidden answers ignored, `set` values applied).
  - **Steps layout** (`form.layout: "steps"`, optional `form.review`): one question per step, or one per section with the new section breaks (`{ id, kind: "section", title, description }` in `questions`), built on the shadcn Questionnaire (React: the `questionnaire` shadcn component, Base UI flavour, is now a registry dependency with its `@shadcn/react` package; Vue: a copy of the shadcn-vue Questionnaire). Progress text, Back/Next, Skip on optional steps, Enter for Next, conditional steps skipped, a review step with "Change" links; the table's own question controls are kept. `YayawTableForm` gains controlled answers and step (`value`/`onValueChange`, `step`/`onStepChange`; Vue `v-model:value`, `v-model:step`) and `draftStorageKey` to resume from the browser's storage.
  - **Record create/edit and bulk forms** (`FormConfig.rules`, fields' `fieldIds`): hidden fields are not validated nor submitted, `require` rules make fields required, `set` rules write values. The existing `hidden` flag/predicate of fields keeps working: it is converted to a rule when the form loads. In bulk edit, conditions read the draft or the value every selected row shares; a value that differs is treated as not matching, with a note under the field and in the "Add a field" picker.
  - **Public links (security)**: `formLinks.publish(viewId)` — hosts build the snapshot on their server with the new `buildPublicFormSnapshot({ view, columns, allowedColumnIds? })` (existing, creatable and allowed columns only; fixed values checked against column types and options; rules and layout included). The browser-built snapshot is still passed as a deprecated second argument for older hosts, which must ignore it.
  - **Vue record forms** now use the same controls as React and the Form view: the table's dropdown with a "Choose…" placeholder, a popover calendar in the table's language (React record forms move from the native date input to the same calendar), switches, checkbox lists and radio groups.

  EN/FR labels are overridable with `form.<key>` translations. Public API: `evaluateForm`, `normalizeRules`, `validateRules`, `buildPublicFormSnapshot`, `evaluateFormView` and the rule types are exported by both editions.

- 75f64c0: Add a Form display mode to React and Vue, like Notion forms: the view shows a form that creates a record in the table. Per view (saved with views and in the `<tableId>-form` URL key): title, description, which columns are asked and their order (up/down buttons), per question a label, help text, placeholder and required flag, fixed values for columns not asked (e.g. `status: "Draft"`), the submit label, success message, "Submit another response" and a redirect URL the host may follow. Columns without a form editor (JSON, custom, computed) are listed as unavailable. Validation comes from the column types (numbers, dates, URLs, options) and required questions; errors are linked with `aria-describedby` and focus moves to the first invalid question. The mode is offered when the table can create records; `table.form: false` turns it off and `table.form: { … }` sets defaults. Labels are English and French, overridable with `form.<key>` translations. Questions use the table's own controls in both editions: select and multi-select options shown as the column's tags, a date picker that reads in the form's language, numbers shown with the column's `numberFormat` once typed, and a switch for yes/no columns. The form is a centered card with the table's empty-state style for "sent" and "closed".

  The same form ships as a standalone component for public routes, without table state or providers: React `YayawTableForm` (`form/yayaw-table-form.tsx`) and Vue `YayawTableForm.vue`, with `columns`, `form`, `onSubmit`, optional `validate`, `onSuccess`, `translations`, `locale`, `context` and `extraFields` (Vue `extra-fields` slot) for the host's spam protection. `formSettingsFromView(view)` reads a saved Form view; `publicFormSnapshot(view, columns)` keeps only what a public page needs and `acceptPublicFormResponse(snapshot, input)` re-validates responses on the host's server. The optional `actions.formLinks` (`status`, `publish`, `unpublish`, `setAcceptingResponses`) adds a "Share form" button above the form, opening a popover (a drawer on phones): publish to the web, copy or open the link, stop accepting responses, and update the public form after edits. Renderer contexts gain `coloredTags`, and public snapshots keep each asked column's `displayVariant`, `coloredTags` and `numberFormat`.

  `TableDisplayMode` gains `"form"`: hosts with exhaustive `Record<TableDisplayMode, …>` maps add an entry.

- a928acb: Add conflict rules in code to two-way sync, additive and backward compatible. `planSync` takes optional `ownership` (a column always comes from one side; changes on the other side are written back and reported in `plan.overridden`; one-way syncs never write a column to its owner), `columnRules` (`table-wins`, `target-wins`, `latest-wins`, `merge` for list values such as multi-selects, `manual`) and a pure, synchronous `resolveConflict(context)` returning a side, `{ value }`, `"skip"`, `"manual"` or `undefined`, applied in that order before `conflictRule`; a throwing resolver makes the conflict manual. Conflicts carry `resolution`, `source` and `value`. Manual conflicts are not applied and wait in `SyncState.pendingConflicts` (one per row and column, replaced when values change, dropped when both sides agree); `resolvePendingConflicts` and `applyConflictResolutions` settle them, and `validateConflictConfig` checks a configuration against the mapping and direction. `summarizeSyncPlan` adds `overridden` and `pendingConflicts`.

  Connectors may declare `conflicts` (`ownership`, `columnRules`, `lock`, `allowManual`) and the optional `listConflicts` and `resolveConflicts` host functions. The React and Vue connector screens show "Rules set by your app" (read-only conflict rule with a lock when `lock` is set), label preview conflicts "Owned by …", "Merged", "Needs your decision", and offer "Conflicts to resolve (N)" with "Keep table value" / "Keep <target> value" per conflict and bulk actions. `toSyncPreview` maps the new plan fields and `toPendingConflicts` names pending conflicts. Labels are English and French, overridable with `connector.<key>`. `SyncPreviewConflict.resolution` is widened and `SyncPreviewConflictLine` gains `winner` and `result`: code that switches exhaustively on `resolution` handles the new values.

### Patch Changes

- 2e9c537: Vue: the create and edit form keeps a compact footer. The generic form grid overrode the record surface's column layout and split the height between the fields and the footer, stretching Cancel and Save.

## 3.3.0

### Minor Changes

- 1fedffc: Add a Calendar display mode to React and Vue as optional registry items (`yayaw-table-calendar`, `yayaw-table-vue-calendar`) rendered with FullCalendar: month, week and list layouts, drag to move a record, stretch to change its end, click a day to create a record on it. Install the item, pass `displayModeRenderers={{ calendar: calendarRenderer }}` and add `"calendar"` to `displayModes`; configure it with `table.calendar` (`dateColumn`, `endColumn`, `titleColumn`, `colorColumn`, `layout`, `weekStartsOn`, `showWeekends`, `allowDragUpdate`, `allowResize`, `allowCreate`). Settings are saved with views and in the `<tableId>-calendar` URL key; the visible range is sent to `list` as `scope: { kind: "dateRange" }`. The new `displayModeRenderers` prop lets any optional item render a display mode, and the create form accepts prefilled values.
- 7ff2a91: Connect destinations can be scheduled, in React and Vue. A destination that declares `schedule: { frequencies?, load, save, status? }` gets a clock button on its Connect row (the row itself still runs it now) that opens its schedule for the current view: frequency (Manual, Automatic on change, Hourly, Daily, Weekly, Monthly), minute of the hour, time, day of the week (in the locale's week order), day of the month or last day, optional start date and time zone (the browser's by default). The screen previews the next run in that time zone, daylight saving included, shows the host's last run status, and offers Save, Cancel and Run now. The table only edits the settings; the host stores them per view and runs them. The shared `schedule-model.ts` (`nextScheduleRun`, `normalizeScheduleSettings`, `describeSchedule`) ships in both registries with built-in English and French labels, overridable with `schedule.<key>` translations. `table.schedule: false` hides scheduling.
- 1223e43: Connect destinations can declare a `connector` and get the table's own push screens, in React and Vue, with no provider-specific code in the table. The host provides `targets`, optional `allowTargetInput` (e.g. a pasted link), `describe` (the target's fields), `modes`, `load`/`save` (settings per view) and `push` (its server function); the table shows one screen in the Data menu: target and child (a spreadsheet's tab), each column of the view mapped to a target field by name (accents and case ignored, type-compatible fields first, new fields when the target allows them, or Don't send), visible or all columns, the key field ("Yayaw ID" by default), Upsert or Replace, all records or the selection, then Send with a busy state and a result (created, updated, skipped, failed, first failures, warnings, truncation) offering Done and Send again. Errors show inline, `not_shared` naming the account to share with. On phones the long selects open as choice lists in the drawer. The shared `connector-flow.ts` (`defaultConnectorMapping`, `validateConnectorSettings`, `describePushResult`, `connectorErrorMessage`, `toConnectorMapping`, `createConnectorFlow`) ships in both registries with built-in English and French labels, overridable with `connector.<key>` translations. `table.connectors: false` keeps today's behaviour (the row runs the destination); `run` is now optional for destinations that declare `connector`.
- c4f2521: Optional server connectors for Notion and Google Sheets, shipped as framework-agnostic registry items for React (`yayaw-table-connector-notion`, `yayaw-table-connector-google-sheets`) and Vue (`yayaw-table-vue-connector-notion`, `yayaw-table-vue-connector-google-sheets`). They share `connector-model.ts` (columns, rows, mapping, push result, typed `ConnectorError` codes and an HTTP helper with Retry-After, backoff and per-operation rate limiting) and run in Node 20+, Bun, Deno and edge runtimes through `fetch` and Web Crypto. Notion upserts pages keyed by a "Yayaw ID" property; Google Sheets signs service account assertions with `crypto.subtle` and upserts or replaces rows in a tab without reordering the user's columns. The table items do not include them, and the host keeps credential storage, authorization and workers (see `docs/connectors.md`).
- 1f95cb8: Two-way sync between a table and Notion or Google Sheets, in the optional connector items of React and Vue. The new framework-agnostic `sync-engine.ts` (shipped in every connector item) plans a run from the records of both sides and the per-row `SyncState` the host stores: `push`, `pull` or `two-way`, a per-column three-way merge with conflict rules (`table-wins`, `target-wins`, `latest-wins`), delete policies (`ignore`, `flag`, `propagate`), adoption of existing target records by the "Yayaw ID" key and reported duplicates. `normalizeSyncValue` and `hashSyncValues` keep round trips through Notion and Sheets from looking like changes. `applySyncPlan` writes in batches through adapters, records per-item failures, stops on authorization errors, and returns a state that only holds successful changes so failures are retried next run. The Notion module adds `readNotionDatabase` (pagination, `since` filter, `last_edited_time`) and `createNotionSyncTarget`; the Google Sheets module adds `readSheetRows` and `createSheetSyncTarget` (rows found by key, deletions by key from the bottom up). No UI yet; see `docs/connectors.md`.
- 01c3fde: Sync in the connector screens, in React and Vue. A Connect connector can declare `directions` (`push`, `pull`, `two-way`; default push only), `conflictRules`, `preview` and `sync`: the screen then shows a "Direction" choice (Send to / Import from / Keep both in sync), maps each target field to a table column for pull and two-way (with a sample value and a conversion badge), and asks for the conflict rule (two-way: this table wins, the target wins, latest edit wins) and what to do with deleted records (only flag, ignore, delete on the other side with a confirmation). "Preview changes" shows what will be created, updated and deleted on each side, flagged records, duplicate keys and the first conflicts with both values and the winner; "Sync now" runs it (after a preview when records would be deleted), shows the result and reloads the table. Push keeps calling `push` as before. Data › Import lists connectors that can pull ("From Notion") and opens them preset to pull, and a connector's schedule summary names its direction ("· Keep in sync"). `toSyncPreview` and `toSyncRunResult` turn the server sync engine's plan and result into what `preview` and `sync` return. `table.sync: false` keeps push only. English and French labels, overridable with `connector.<key>`.
- 54fca67: Data gets its own toolbar button (database icon), next to View settings, in React and Vue: its menu lists Export ›, Connect › and Share ›, with the same screens as before, and on touch layouts the application toolbar actions. View settings now hold presentation only. The bulk bar's Export opens the Export screen of this menu. "Sync" is renamed "Connect": destinations use `kind: "connect"` (`"sync"` and `"export"` are still accepted) and the translation key is `destinations.connect` ("Connect" / "Connecter").
- fa20123: Custom export and share destinations in React and Vue: declare `destinations` in the table actions (`{ id, label, kind: "export" | "share", icon?, hidden?, requiresSelection?, run(context) }`) and they appear in the View settings "Data" section, after the CSV export or the share link. `run` receives the view's query in the `list` shape (search, filters, active advanced filters and their combination, sorting), the view id, the visible columns in order, the selected row ids, the view's link and `loadRows()` for every matching record — so a webhook, an n8n workflow or a connector can fetch the data server-side. One destination runs at a time with a busy state; its `message` shows as a success toast and a thrown error as an error toast. New `table.share: false` hides the built-in share link.
- c4def20: Data › Import, in React and Vue: a new "Import" row in the Data menu (between Export and Connect) whenever the table can create or update rows (`table.import: false` hides it). Pick a CSV file (drop zone or file picker, UTF-8 or Windows-1252) or paste CSV text; the separator (comma, semicolon, tab or vertical bar) is detected and can be changed, and the first row can be marked as data. Each source field is matched to a table column by header or id (accents and case ignored, same type first, then by its values), with a sample value, a badge counting values that won't convert, an "Ignore" choice, "Match existing records by" and a preview of the first rows as they will be written, invalid cells highlighted. Values convert per column type: numbers with decimal commas, grouping, currencies and percents; ISO, day-first or month-first (detected per column) and Excel dates; yes/no/oui/non/1/0/x checkboxes; select options by value or label; links, emails and JSON; required columns. The review shows how many rows will be added, updated or have errors (keys repeated in the file are errors) with "Skip rows with errors"; Import shows progress and the result, then refreshes the table. Rows are written through the host's optional `actions.import.importRows` (server-side bulk, in batches) or the table's `create` and `update`; `actions.import.lookup`, `sources` (for Notion or Google Sheets imports later), `allowNewOptions`, `batchSize` and `csv` are optional. The shared `import-model.ts` and `import-flow.ts` ship in both registries with English and French labels, overridable with `import.<key>` translations. The column-mapping screen is a reusable component (`ColumnMapping`) that the Connect push screen now uses too, with its matcher shared in `field-matching.ts`.
- 8e6cdab: Export opens a screen in View settings → Data, in React and Vue: format (CSV, PDF through the print dialog, Excel when `actions.exportFile` is provided), records (all in the view or the selection), columns (visible in order or all), values (as displayed — currency, dates, option labels — or raw) and the file name (table, saved view and day by default). With `actions.exportFile(request)` the server builds the file from the view's query (`list` shape), the chosen columns and options, and returns a download link or a Blob; otherwise the browser writes the CSV (UTF-8 with BOM) or prints a paginated table. `table.exportFormats` limits the formats offered; `onExport` still replaces the CSV file. File names drop accents.

  The Data section now reads Export ›, Sync › and Share ›: destinations of kind `"sync"` (formerly `"export"`, still accepted) open under Sync, and share destinations under Share after the built-in "Copy link" (Share stays a direct action without them).

  Bulk export opens the same Export screen with the selected records chosen (a custom `onBulkExport` still takes over; without the Export screen it still writes a CSV). React: a secondary toolbar table instance no longer overwrites the selected rows seen by toolbar actions.

- 6f94990: Add List view options in React and Vue, in `table.list` and saved with views: `wrap` (title on several lines), `showActions` (row actions menu), `propertyAlign` (`"end"` or `"start"`, after the title), `maxProperties`, and `mobileMaxProperties` for screens narrower than 768px. The List settings panel offers each of them.
- 2914ccb: Add a List display mode to React and Vue: one compact line per record with a title, chosen properties and the row actions, grouped by the table's first grouping level. Enable it with `displayModes: [..., "list"]` and configure it with `table.list` (`titleColumn`, `cardColumnIds`, `showCardLabels`); the settings are saved with views and in the `<tableId>-list` URL key.
- 7338ab7: Add a per-view manual order in React and Vue. With `table.manualOrder: true` and an `actions.reorder` handler, the sort menu offers "Manual order", saved with the view like any sort. List requests then carry the `__manual` sort and the active `viewId` (`null` for the default view), so the host applies that view's own order. In the List view, lines move with a drag handle (pointer events: mouse, touch and pen) or with Alt+Arrow keys, within their group; each move calls `reorder({ viewId, id, previousId, nextId })` and never edits the records.
- 065ea32: A row click now opens the record view by default in React and Vue, in every display mode, with fields derived from the columns when `details` is not given. `enableRowClickEdit` / `rowClickMode: "edit"` still open the edit form, a row-link column still navigates, `rowClickMode: "none"` turns clicks off and `details={false}` removes the built-in record view. The display mode picker in the view menu is now a dropdown (touch drawers keep the buttons), and the Vue create button uses the React `add_an_item` key: both editions read "Add item" ("Ajouter" in French); hosts that translated `create` for this button should translate `add_an_item`.
- 90b698f: Add `loadScopedRows` to React and Vue for views that need every row of a window rather than one page. List actions may receive an optional `scope` (for example `{ kind: "dateRange", field, endField?, from, to }`) and answer `meta.scope: "applied"` when they filtered by it; otherwise rows are filtered locally. Results are capped and report truncation.
- 65c99d3: The toolbar now separates views from settings in React and Vue, so it stays compact whatever the number of views. On the left, the view switcher: tabs on wide screens (the default view is a tab from the start) with a "View actions" menu for save, save as, favorite, reset and delete; on touch layouts, a named trigger whose menu lists the views (scrollable, with a name filter beyond 7 views) and their actions. On the right, search (a button that opens the field on touch layouts), "View settings" (layout, density, properties, filter, sort, group, card settings) with a badge counting active filters and sorts, and the create button. Export and Share move into a "Data" section of the settings; application toolbar actions stay in the toolbar on wide screens and join that section on touch layouts, which removes the "Data actions" drawer. `toolbarActionsPlacement` no longer changes positions, since Export is no longer in the toolbar. The `views.settings` label becomes "View settings"; new keys: `views.viewActions`, `views.filterViews`, `menu.data` (Vue: `viewActions`, `filterViews`, `menu.data`).

  In touch drawers the view settings read as one list: layout and density are rows showing their value that open a list of choices, like properties, filter, sort and group.

- 3abd1dc: Share number and date formatting between React and Vue. Number columns accept `numberFormat` with `style` (`decimal`, `currency`, `percent`, `compact`, `unit`), `currency`/`currencyDisplay`, `unit`/`unitDisplay`, fixed or bounded decimals, custom separators, `prefix`/`suffix`, `signDisplay`, accounting `negative: "parentheses"`, `percentBase`, and a progress `display: "bar"` against `max`; the earlier React presets and Vue options keep working. Date columns offer all 17 presets in both editions, plus `timeZone` and `hour12`; `"relative"` is localized. React now reads date-only values such as "2026-09-10" as local calendar days, fixing dates shown one day early west of UTC.
- cb46353: Saved views now show as tabs in React and Vue as soon as a table has one: the default view first, each tab with the icon of its layout and a dot when modified, extra views under "More" (the active view always stays visible) and a "+" that saves a new view with a chosen layout. The view menu trigger becomes a settings button next to the tabs; touch layouts keep the menu. Configure with `table.viewTabs` (`false` to keep the menu only, `{ maxVisible }`, default 4). The save dialog also offers the layout of the new view. New translation keys: `views.tabs`, `views.more`, `views.newView`, `views.dialog.save.layout` (Vue: `viewTabs`, `moreViews`, `newView`, `viewLayout`).

  The calendar toolbar now uses the table toolbar's sizes (32px controls, small text) in both editions.

### Patch Changes

- 90b698f: Resolve display modes from one registry shared by React and Vue. A link or saved view asking for a mode the table does not offer now shows the rendered fallback as the active mode in React, and falls back from Gantt in Vue when no planning session exists. Resetting a view also clears Gantt settings, and Vue shows translated English display-mode labels.
- 243509c: Handle per-mode settings generically. The display mode registry now declares which modes keep their settings through a shared normalizer (the List for now); saved views, URLs (`<tableId>-<mode>`), table config types and table state loop over the registry in React and Vue instead of wiring each mode by hand. Existing URL keys and saved views are unchanged.
- 7338ab7: The List view follows the table density (XS to 2XL): line height and padding use the same scale as table rows, and the density control is offered in List mode in React and Vue.
- 90b698f: Bring React to parity with Vue on sorting and filter combination. The React sort menu now adds each clicked column as a further sort (clicking again reverses it, then removes it) and numbers the sort priority; the advanced filter panel offers the same "Match all / any condition" choice as Vue once two rules exist. The Gantt "today" marker now uses the user's calendar day instead of the UTC day.
- e4f6a4e: Align the Vue look with React and fix three behavior differences. Vue now uses React's compact search with an icon, table headers with column separators and hover-revealed column menus, shared checkbox styling, bordered Kanban board and lanes with property chips, and a bordered gallery panel with an image placeholder. React no longer shows Create, Edit, Delete or Duplicate without the matching action, and drops the empty row-actions column, as Vue did; Vue Kanban cards show every property by default, as React did. Both editions say "Default view" and "Filter".
- 84dcac5: Finer Vue parity with React: buttons use the theme radius and 8px icon gap, the view trigger its 10px padding, inputs and checkboxes are transparent in light mode (input tint only in dark mode, as shadcn), header labels are regular weight, the table inherits the page font, numbers use proportional digits, and checkboxes match the shadcn checked and partial states and positions. The search field matches React's icon position, text inset and themed placeholder, and cells use a 20px line height.
- ba5ef3f: Vue now follows the host's shadcn theme: its colors, borders, inputs, ring and radius read the shadcn CSS variables (`--background`, `--muted`, `--border`, `--input`, `--primary`, `--radius`…), falling back to shadcn's neutral theme. Controls, badges, table header, checkboxes, the selection column, the view trigger, the header title and font smoothing now match React, and Vue shows React's default table description ("Manage your …") when none is configured.

## 3.2.0

### Minor Changes

- 692de11: Add read-oriented server Kanban lanes with global counts, independent cursor pagination, cancellation and retries in React and Vue. Add controlled custom native filter renderers for application-specific date and relation controls.

## 3.1.1

### Patch Changes

- 60e6b9f: Stop wrapping colour tokens in `hsl()`. The design tokens are oklch, so
  `hsl(var(--primary))` resolves to `hsl(oklch(…))`, which is invalid and dropped
  by the browser: the Kanban active-card bar, the sticky actions and footer cell
  borders, the table's selected-row bar and the filter shimmer, focus-ring and
  value-highlight animations all rendered with no colour at all. Reference the
  tokens directly and express alpha with `color-mix(in oklab, …)`.
- 60e6b9f: Read planning config from a flat catalogue entry. `getTableConfig` may return the behaviour nested
  under `table` or flat at the top level, and `resolveTableCatalogueConfig` has always accepted both,
  but the provider's planning derivation only read the nested shape and fell back to the default table
  config for the flat one. A flat entry therefore lost its `planning` and `gantt` mapping, built no
  planning session, and had the Gantt withheld from its view menu even though it was configured and
  listed in `displayModes`.

## 3.1.0

### Minor Changes

- 3c65c90: Add opt-in automatic page sizing with `table.enableAutoPageSize` in React and Vue. The table's page-size selector can fit rows to the available viewport, react to density and window-size changes, and return to numeric sizes. Pagination remains reachable for a single page when enabled. Gallery and Kanban keep numeric pagination; URLs and saved views continue to store the effective numeric size.
- 3ea9289: Add optional native Gantt planning to React and Vue, with shared civil-date scheduling, configurable hierarchy and calendar rules, cross-source dependencies, and atomic revision-checked preview/apply actions. Include accessible dependency editing, planning-aware table and record edits, saved Gantt views, and executable memory adapters.
- 7450b32: Unify React and Vue record surfaces with a shared responsive presentation option, drawer defaults on desktop and mobile, and uninterrupted view-to-edit transitions.
- fc26386: Add `table.defaultAutoPageSize` to start table views in automatic viewport pagination in React and Vue while preserving manual numeric choices within the active view.
- 457b8ec: Use Shadcn Empty states and offer filter recovery in React and Vue.

  Filtered empty results include a Clear filters action that preserves presentation and the selected view. Custom copy and visibility apply consistently in table, Kanban, and Gallery; loading and failed requests no longer show empty card states. React consumers updating copied files manually must add the Shadcn `empty` component; Vue includes the Empty parts and standalone styles in its registry.

- bacb67f: Add a personal favorite view in React and Vue, restored on arrival with local persistence or optional server preference actions, and document organization sharing responsibilities.
- b24c4bf: Render the Gantt timeline with a native component in each edition, so it reaches its table the way
  Kanban and Gallery do: the table's own selection and title cells in the left column, row click through
  to the record details, the loading overlay and the bulk-actions anchor. React gains
  `components/gantt-view.tsx` and Vue `components/planning/GanttView.vue`, both computing rows,
  virtualization geometry, bar placement, dependency paths, header cells and every date edit from a new
  shared `planning/timeline` model. The shared DOM renderer keeps only the planning dialog, which needs
  no table state. A task from another source, or one outside the table's current page, still renders
  without cells rather than disappearing.
- 7bdfd54: Let a Gantt work from the table's own data like Kanban and Gallery. `createRowsPlanningAdapter`
  derives the planning graph from the existing `list` action and saves date and hierarchy edits through
  the existing `update` action, and React and Vue wire it automatically when `gantt.startColumn` and
  `gantt.endColumn` are mapped and no `actions.planning` adapter is supplied. Add `gantt.parentColumn`
  and `gantt.calendarColumn`, share one preview/apply transaction core between adapters, route every
  timeline, dialog and settings label through `views.gantt.*` with the built-in vocabulary as fallback,
  replace the planning row controls with design-system buttons and translated names, and withhold the
  Gantt display mode when no planning graph can be built.
- ebd8d9e: Add an icon-only density selector beside toolbar filters with S, M, L and XL, and make S more compact in React and Vue.
- adf1d7e: Add equivalent React and Vue gallery media viewers with image/video/audio/PDF previews, separate record information actions, muted hover video, native playback, navigation, and accessible focus restoration. Add S/M/L preview height independently of card width, neutral or colored tags, and content-sized action menus.

  Support modified gallery selection and scoped Ctrl/Cmd+A across matching pages. Connect Ctrl/Cmd+Z to existing record activity and onRevertActivity, including deleted records supplied through details.history and grouped compensating events through transactionId. Applications retain responsibility for persistence, permissions and reversible deletion. Add video record fields and custom rowActions in both editions.

  Vue now defaults to the same wide gallery ratio and colored tags as React. Set aspectRatio: "square" and coloredTags: false explicitly to preserve its previous appearance. Runtime media callbacks stay out of saved views; previewSize is persisted.

  Show a localized success notification after complete activity undo, with full-sentence `details.labels.undoSuccess` overrides shared by shortcuts and record activity. Exclude runtime gallery callbacks from both frameworks’ saved views.

  Connect Ctrl/Cmd+D to the existing permitted row duplication action, including selection of returned copies, partial failure handling, and localized singular/plural feedback.

- ebd15ce: Pass original row context to React and Vue update and delete actions so hosts can enforce optimistic concurrency independently of the submitted field patch.
- 8ef1329: Add an optional filter bar for catalogue option and boolean columns in React and Vue. The bar uses native column-filter state, searchable multi-selection with filter icons, and the same controls in Options. Showing or hiding the bar preserves filters and saved views.
- 4a530b9: Add configurable read-only record details in React and Vue with typed fields, update metadata, append-only activity, reversible changes, and confirmed deletion.
- 299abc8: Add Shift-click range selection in React and Vue to row checkboxes when multi-row selection is enabled.
- e3ef46d: Drive generated forms, inline editors and filter defaults from one shared column-type contract in React and Vue. Preserve typed option identities and labels, render all dynamic cell types, and add lossless JSON form editing with validation and retryable drafts. Calendar inline edits now emit date-only strings in both editions, matching generated date forms; applications using React inline date schemas should accept `YYYY-MM-DD` values.
- 9d6ddfd: Add independent host-resolved `canEdit` and `canDelete` permissions on saved views in React and Vue. Shared read-only views remain selectable, copyable and eligible as personal favorites. Hosts must continue enforcing authorization in their persistence actions.
- 55447fb: Add XS and 2XL and align all six row densities with Tailwind's spacing scale: 28, 32, 40, 48, 56 and 64px before borders. XS preserves the previous compact S appearance; existing density configuration values remain supported with smoother spacing.

  Use consistent accessible tooltips for table controls, including density, saved views, row actions and column dragging, in React and Vue.

- c6f803f: Keep Create last and primary, persist saved-view density, and compose generated forms with responsive blocks, custom content and asynchronous actions in React and Vue.
- 4babf11: Add `onOpenDetails` in React and Vue so the native View action and row activation can open an application-owned record route or drawer. The callback takes precedence over built-in details and also enables View for read-only tables.
- d455088: Route Vue table operation feedback through the application Sonner toaster, matching React without inserting a status block into the table. Vue consumers must mount one vue-sonner or Shadcn Sonner Toaster at the application root; existing outlets are reused.
- 8b6cf42: Unify React and Vue responsive view menus. Desktop keeps one toolbar row with explicit data actions; mobile and constrained containers use view, create and a labelled data-action panel. View settings adapt to Table, Kanban and Gallery, with direct density and mode controls, accessible scrolling panels, and preserved inactive presentation settings.

  Use normalized saved-view comparisons for the modified indicator and save availability. Add optional `footerCalculationsVisible` snapshots, restore saved or initial settings with Reset view, preserve drafts after persistence failures, and keep favorites independent of write permission. Share the current URL with native mobile sharing and clipboard fallback. Existing filter-only reset flags retain their behavior inside Filters.

  Keep view panels mounted during React query refreshes, use content-sized Shadcn scroll areas, and restore empty grouping without importing an inactive Kanban lane. Preserve utility-column order and native table-cell layout in grouped results. Make the runnable previews apply the complete query and demonstrate actual onBulkEdit writes in both frameworks.

  Keep advanced numeric filter drafts stable until Enter or confirmation, including zero, negative decimals and ranges. Remove stale delayed input callbacks, implicit numeric bounds and nested filter cards. Keep new Vue rules out of query state until applied and expose advanced filters in its runnable example.

  Keep the mobile panel header fixed while focusing numeric inputs and anchor Vue column menus correctly when composed with tooltips.

  Present display mode and density as matching labelled button rows, with equal-width choices and the same selected state in React and Vue.

  Replace bulk field checklists with a searchable property picker and flat editor rows in React and Vue. Preserve partial patches, schema-aware explicit clears, permission checks and failed-row retries. Keep the target count visible on the apply button and actions accessible in the mobile bottom panel. Use record IDs for bulk persistence and map successful results back to their table selection IDs.

### Patch Changes

- 3ca7067: Release from CI instead of by hand. A new **Version and publish** workflow keeps a
  `chore: release vX.Y.Z` pull request current whenever changesets are pending, and tags the
  merged version once `main` carries a described version with no tag. The decision lives in
  `.github/scripts/release-plan.mjs` with its own tests, an existing tag is never republished,
  and the bump still reaches `main` through a reviewed pull request because Pages refuses to
  publish a direct push.
- b977f6f: Use Shadcn dropdown menus for React and Vue footer calculations, with keyboard navigation, selected indicators, and translated Vue labels.
- 21ac4bb: Align grouped row headings, accessor labels, nested record counts, and selection in React and Vue. Preserve leaf cell values and avoid aggregating category IDs in group headings.
- cfa6de2: Align Vue Kanban and Gallery controls with Shadcn-style Reka UI selects, property menus, and checkboxes while preserving saved settings and selection behavior.
- b03b434: Let saved-view labels inherit the dialog font size so compact themes keep the sharing option aligned with the form.
- 2c62022: Align React and Vue toolbar controls at 32px high with 12px regular text, 16px action icons, 12px dropdown chevrons, and square icon buttons. Keep row density independent from toolbar sizing. Fit Table, Kanban, and Gallery buttons inside their segmented frame so hover and selected backgrounds stay centered, preserving keyboard navigation and translated tooltips.

  Refresh the local Shadcn Base Vega Button styles and Tooltip from the official registry, retaining the shared button-variants export and local import aliases. Bring the Vue standalone Button styles and Reka Tooltip composition in line with the official Shadcn Vue Vega sources, including focus states, tooltip arrows, and composed-trigger forwarding.

- d1c888e: Unify Gallery, Kanban and Gantt settings with standard selection controls, one responsive drawer on mobile and scrolling only when needed. Keep density and display choices at normal font weight and align the Share button with other toolbar actions. Move Gantt presentation settings into View settings and present planning dialogs as bottom sheets on mobile.
- 3fe7385: Allow choosing the built-in default view with the favorite star in React and Vue. Clearing the personal favorite marks the default row and toolbar star, while shared/system views remain favoriteable without write permission.
- acd49e5: Align the Vue search toolbar spacing to 16px above and below the controls.
- 570e0f4: Place the optional filter bar above the standard view, search and Options controls in React and Vue, preserving the title and consistent section spacing.
- cfaad15: Ignore equivalent React table-state writes to keep row menus and generated forms stable during refreshes.
- 1008884: Fix React row action and bulk menus flickering by stabilizing controlled table state and column callbacks.
- fd9d305: Document the integrated React and Vue Gantt previews alongside the existing live documentation examples.
- c73b2b9: Refine the shared React and Vue Gantt with a compact toolbar, neutral grid and summary bars, pastel tasks, page icons, a current-date marker, responsive task column and theme-aware planning dialogs. Preserve accessible editing, dependency previews and saved view behavior.
- b060549: Count measured row heights for automatic pagination and keep a stable capacity across variable-height server pages in React and Vue.
- 95ca55d: Load saved views when no initial views are provided.
- 6d9fe3a: Apply React advanced filters to the table instance ID instead of the configuration catalogue key. Tables with distinct `tableId` and `tableType` now filter their own data and saved views, with URL synchronization enabled or disabled.
- 8adf5fd: Fix the copied stack menu import so registry consumers can resolve the responsive view panel after installation.
- db0cabe: Match Vue modal and drawer form backdrops to React with a 10% black overlay and theme-aware 4px background blur.
- d7d6914: Keep automatic pagination stable when shorter content changes the intrinsic table width on a later page. Use the container width for layout identity in React and Vue.
- 02c5ee6: Keep automatic pagination on the selected page when variable column widths change header wrapping. Header/footer measurements affect fit without raising the viewport capacity ceiling in React and Vue.
- 027adef: Align historical filter button heights with saved-view controls across table densities.
- 7814432: Keep inline multi-select choices in a searchable overlay without expanding rows.
  Flush and acknowledge edits before dismissing in React and Vue, retain failed
  drafts for retry, and preserve dismissal requests made during autosave.

  Align removable chips, search, keyboard navigation, density-aware editor heights,
  save-delay/pending feedback, and regular toolbar button typography across editions.

- 58cbfc1: Keep the React URL-state hook's client directive before its Gantt imports so copied registry files compile in Next.js. Vue's equivalent URL-state behavior is unchanged.

## 3.0.0

### Major Changes

- 0749493: Migrate the React and Vue editions to TanStack Table 9.2.4 with matched explicit feature registration. Existing saved views and URLs retain their `left`/`right` pinning format, while consumers must support ESM, target ES2022, and update custom TanStack integrations to version 9.

### Minor Changes

- a017e6f: Add opt-in, accessible column resizing to the React and Vue tables. Resized widths persist in saved views and shareable URLs, while individual columns can remain fixed.

## 2.0.0

### Major Changes

- c4bdd56: Complete the public behavioral parity pass for React and Vue. Both editions now
  share defaults, filter reset semantics, controlled query-persistent selection,
  toolbar actions, column filter/pin/reorder controls, card pagination and empty
  states, and isolated non-URL state. Add the declarative React table picker and
  accessible Vue column and Kanban movement controls. `showResetFilters` now clears
  filters in Vue like React; use the Options reset command to restore presentation
  defaults.

### Minor Changes

- e241eaf: Add opt-in showResetFilters toolbar icon to clear column and advanced filters, global search, and pagination while preserving table presentation and discarding pending filter edits.
- d5e4b86: Add date and radio form field primitives, render text input types, and honor textarea presentation options.
- 8ad796d: Add declarative form sections for grouping existing form fields without custom React renderers.
- 914e88e: Add a declarative Vue table-picker form field with native search, filters,
  sorting, pagination, saved views, and controlled row selection. Selected values
  survive table query changes, support typed IDs, and require no custom form
  renderer.
- fd7e5f1: Align React and Vue list/filter/view contracts and add shared conformance fixtures. React catalogue forms now support generated column fields, conditional fields, asynchronous initialization and options, patch submissions, declarative collections, and a built-in bulk editor with partial-failure retries. Vue cards now paginate, share grouping with the toolbar, render custom cells, and roll back rejected Kanban moves; inline editing honors its debounce. Vue saved views support defaults, system views, dirty state, and recoverable errors. Add the cross-framework `showClearFilters` option while preserving legacy reset behavior. Exclude development tests from the React registry.
- 78ff405: Add native accessible Vue column menus for sorting, hiding and left/right pinning, replacing placeholder diamond glyphs. Column capabilities and mandatory utility-column locks determine the available controls, including the new per-column `enablePinning` permission.

  Allow catalogues to declare toolbar actions, translations, advanced-filter visibility, URL synchronization and server-search debounce defaults. Existing explicit component props retain precedence, including empty toolbar actions and false boolean overrides.

- 9a5e6b9: Generate Vue bulk-edit forms from each table's existing catalogue, with explicit field selection, field validation, per-row permissions, frozen targets, and safe partial-failure retries. Keep consumer callbacks and the JSON editor available for compatibility. Protect selection/actions column locks across saved views and URL state, and align pinned calculation footers. Regenerate the Vue registry distribution with these behaviors.
- 1890621: Fix Vue form draft isolation, asynchronous validation, parsed submissions, nested collection errors, custom field bindings, and catalogue-backed inline editing with rollback on failed updates. Add scoped asynchronous option search and creation, initial-value loading, opt-in patch submission, per-row form selection, translated fields, and isolated collection dialogs. Use Reka UI dialog primitives for portalling, keyboard focus, dismissal, and focus restoration, and include the dependency in the Vue registry.
- 02d85c7: Add the complete Vue 3 edition of YaYaw Table, including the standalone package, shadcn-vue registry artifact, interactive demo, tests, and documentation.
- 17b3003: Bring the Vue toolbar, row actions, and floating bulk actions to React feature parity, including icon mode and permission-aware rendering.
- b2e55f5: Add the optional Vue toolbar filter-reset shortcut through `table.showResetFilters`, matching the React API. Clear search, column filters, advanced filters and pagination without changing presentation or saved-view selection, and provide accessible English/French labels.

### Patch Changes

- 854237b: Allow table configs to use the native JSON and string column renderers.
- 31db5a3: Add a multi-select form field for editing array values from finite option sets.
- d735201: Render multi-select tag values as separate badges instead of a single comma-joined badge.
- b912225: Fix Vue exports across all filtered pages, preserve cross-page selection in React and Vue, and refresh the active page after mutations.
- 74a3561: Align the Vue saved-view manager with React: a compact current-view dropdown, save/add icon buttons, a save dialog, and contextual deletion. Preserve explicit empty grouping so saving or reloading a table view cannot activate its configured Kanban lanes. Restore partial views against catalogue defaults, preserve URL overrides and edits made during asynchronous persistence, pass table context to view actions, and expose recoverable localized errors. Keep legacy Vue translations and local-storage views compatible.
- 3c7125c: Make the Vue toolbar reset shortcut invoke the same handler as the Options menu
  reset. Both clear column and advanced filters, restore configured default sorting
  and column visibility, and remove grouping. They preserve search and unrelated
  presentation state, and use the same `reset` translation for their label and tooltip.
- 1a0e0f2: Fix Vue typed filter editing and keyboard menus, align local-date filtering, and verify shared form and bulk contracts.
- cbe6738: Fix the Vue Options icon being compressed in icon-only toolbars. Keep nested
  Options button spacing at the same CSS specificity as direct toolbar actions so
  the existing icon-only padding rule applies, including when a counter is shown.
  Labeled toolbar buttons retain their existing spacing.
- 597095c: Make declarative table-picker fields inherit the parent table locale and resolved translations by default.
- eb56cb9: Unify table, Kanban, and gallery grouping state.
- 0ac9b33: Fix Vue bulk action callback handling, JSON patch validation, asynchronous locking, and partial-delete refreshes while preserving failed or newly selected rows.
- 39a6fcd: Add the missing Vue column drag-and-drop feature gate and persistent user toggle to match the React table behavior. Publish the maintained Vue example with the registry GitHub Pages site.

## 1.3.0

### Minor Changes

- aef7d4f: Add gallery card buttons to open URL columns and edit rows through the catalogue form.
- abbc7c8: Add a URL-backed Gallery display mode with image columns, gallery toolbar settings, saved-view support, and local product demo media.
- 89f9d16: Add configurable table display modes with a URL-backed Kanban view that can be stored in saved views.
- 49d7ecf: Store Kanban lane, title, property, and label settings in URL-backed saved views.
- 46e984c: Use the Kibo UI Kanban primitives for the table Kanban display mode and render card properties without visible labels by default.
- 7890d9a: Add a saved views manager for YaYaw Table with URL-backed view snapshots and a database-ready view actions contract.
- 3b56a05: Add saved view permissions for saving views and sharing them with a team.

### Patch Changes

- 3e830b7: Honor row interaction permission flags consistently in Kanban and Gallery cards.
- c34a48d: Render unlabeled Kanban and Gallery card properties in a compact two-column grid.
- 16072dd: Align Gallery link buttons with row-link navigation callbacks and update Kanban/Gallery documentation before release.
- 270c85b: Hide custom toolbar actions that require footer calculations when footer calculations are disabled.
- aff6472: Expose Kanban lane grouping in the toolbar by reusing the existing grouping picker.
- 15599eb: Hide stacked grouping controls in single-level group pickers and simplify the Kanban grouping trigger label.

## 1.2.0

### Minor Changes

- f67365e: Add reusable dashboard table UX primitives for layout presets, empty states, active rows, row click modes, and initial data hydration.

### Patch Changes

- 1c1fec0: Fix table initial data hydration so server-paginated tables do not reuse first-page rows after pagination, filtering, search, sorting, or page-size changes.
- 97941be: Fix selection column body cell alignment so row checkboxes stay horizontally aligned with the select-all header checkbox.
- 37e57b1: Apply layout preset defaults inside defineTableConfig before explicit table overrides so nested configs receive the same admin, catalog, and preview defaults as flat provider configs.

## 1.1.1

### Patch Changes

- Document the server-first initial data table options in English and French.

## 1.1.0

### Minor Changes

- Add initial server data options for tables so consumers can hydrate rows, page counts, and row counts before the client query refreshes.

### Patch Changes

- 1459b52: Improve light, dark, and system theme support for the table and site theme picker.

## 1.0.0

### Major Changes

- Promote YaYaw Table to the first stable Shadcn registry release. Versioned registry snapshots now publish under `public/r/v1.0.0/`, with the moving latest registry still available at `/r/yayaw-table.json`.

### Minor Changes

- 76e5936: Add an opt-in catalogue form modal layout with configurable width while keeping the right-side drawer as the default.
- 141a46f: Add a typed `customBulkActions` API for rendering selected-row actions inside the bulk actions menu.
- 4e4468c: Hide pagination controls when the known total fits on one page and remove the legacy direct `DataTablePagination` export. Consumers should use the main `DataTable` API; direct `DataTablePagination` imports are no longer supported.
- 3e9d369: Add a native collection form field for controlled array editing, including row actions, validation, nested collection support, documentation, and tests.
- c02bda4: Add first-class polymorphic table support by separating table ids, table config types, and form config types. Form configs now receive row/value context for dynamic fields, edit forms can resolve their form type per row, toolbar actions receive selected-row context, and standard row actions support row-aware guards.

### Patch Changes

- 767d53c: Restore table config normalization for nested `defineTableConfig` consumers, preserving table options, sort state, translations, and row-aware guards in registry installs.
- b217953: Keep the date-filter calendar internal to the YaYaw Table registry so installs do not overwrite the host app's shadcn calendar component.
- d8e9f57: Disable footer column calculations by default so tables opt in with `enableCalculations: true`.
- 340109b: Avoid `DrawerClose asChild` in the registry form drawer so shadcn base-style transforms do not emit invalid Vaul `render` props.
- 4047011: Fix registry compatibility with react-day-picker v10, restore backward-compatible translation keys for existing consumers, and avoid relying on DialogClose render props in the catalogue form modal.
- 30fee24: Avoid pinning YaYaw Table registry dependencies so updates do not downgrade consumer package ranges.

## 0.3.0

### Minor Changes

- Release the polished French homepage copy and metadata.

## 0.2.0

### Minor Changes

- ae3ce5c: Add Shadcn CLI v4 registry support with optional base and font items, root URL content negotiation, and documented inspection workflows.

### Patch Changes

- c90106b: Add Changesets-based versioning and immutable Shadcn registry release snapshots.

## Unreleased

### Added

- Added Changesets-based SemVer workflow for YaYaw Table registry releases.
- Added immutable Shadcn registry snapshots under `public/r/vX.Y.Z/`.
- Added release verification for version tags and registry snapshots.

### Fixed

- Fixed bulk action confirmation no-op for copy/delete when outside-click events fired while the dialog portal was open.
- Bulk confirm execution is now lock-protected to prevent duplicate handler execution.
- Outside clicks no longer reset the pending bulk action while confirmation is open.

### Changed

- Standardized bulk action result handling around an explicit result object:
  - `success`
  - `closeMenu`
  - `clearSelection`
  - `message?`
- Added stronger runtime guardrails around QueryClient usage to prevent silent cache isolation.

### BREAKING CHANGES

1. **Implicit internal QueryClient removed**

   - YaYaw Table no longer creates a default QueryClient.
   - You must provide a shared `QueryClientProvider` (recommended) or pass a shared `queryClient` explicitly.

2. **Duplicate QueryClient detection**

   - If `queryClient` prop and provider client are both present but different instances, YaYaw Table throws an explicit error.

3. **Bulk callback contract normalization**
   - Legacy return values are still normalized, but explicit `BulkActionResult` is now the recommended contract for deterministic behavior.

### How to migrate in 5 minutes

1. Create a single app-level `QueryClient`.
2. Wrap your app/page with `QueryClientProvider`.
3. Make sure all invalidations target `["tableData", tableId]`.
4. Remove assumptions about internal QueryClient fallback.
5. Update bulk callbacks to return explicit `BulkActionResult`.
