# Connectors (server)

YaYaw Table owns the logic of pushing table rows to an external tool: value
conversion, mapping, upsert planning, retries, rate limits and error
classification. The host application only provides what a library cannot:

| The host provides | Why |
| --- | --- |
| Credential storage | Tokens and service account keys are secrets. Store them encrypted, per organization or user, and never send them to the browser. |
| Authorization | Decide who may connect a destination and push which table to it, then check it on every call. |
| Server entry points | Call the connector functions from server actions, API routes or server handlers. |
| Workers | Run scheduled or large pushes in a background job, with the host's own retry and locking policy. |
| Row loading | Load the rows the user may see (the view's query) on the server, not from the client. |

The connectors are plain TypeScript with no framework or npm dependency. They
use `fetch` and Web Crypto (`crypto.subtle`), so they run in Node 20+, Bun,
Deno and edge runtimes. They are server-only: never import them in client
components.

## Install

Each connector is an optional registry item containing the shared
`connector-model.ts`, the shared `sync-engine.ts` and its provider module. The
React and Vue items ship the same files.

```bash
# React
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table-connector-notion.json
npx shadcn@latest add https://table.yayaw.app/r/yayaw-table-connector-google-sheets.json

# Vue
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue-connector-notion.json
npx shadcn-vue@latest add https://table.yayaw.app/r/yayaw-table-vue-connector-google-sheets.json
```

Files are installed under `components/ui/yayaw-table/connectors/` (React) or
`components/ui/yayaw-table-vue/connectors/` (Vue). Import each module directly;
there is no index file.

## Shared contract (`connector-model.ts`)

- `ConnectorColumn { id, header, type? }`: a table column. `type` is the table
  column type (`text`, `number`, `select`, `multiSelect`, `date`, `boolean`,
  `url`, `email`).
- `ConnectorRow { id, values }`: a stable row id and the values keyed by column
  id. `toConnectorRows(records, "id")` builds them from table records.
- `ConnectorMapping { keyProperty?, properties }`: column id to target field
  name (Notion). `keyProperty` defaults to `"Yayaw ID"`.
- `ConnectorPushResult { created, updated, skipped, failed, failures,
  warnings, warningCount, truncated }`. Rows without an id or with a repeated
  id are skipped with a warning; rows beyond `maxRows` set `truncated`. At most
  200 warnings and failures are listed; the counts keep going.
- `ConnectorError { code, details }` with `code` one of `unauthorized`,
  `forbidden`, `not_shared`, `api_disabled`, `not_found`, `rate_limited`,
  `provider_unavailable`, `invalid_request`, `invalid_target`,
  `invalid_mapping`, `invalid_credentials`, `aborted`. `details` only holds
  safe values (`status`, `serviceAccountEmail`). Provider error bodies can echo
  row data, so they are never included in errors.

Every function accepts `ConnectorOptions`: `fetch`, `sleep`, `now`, `signal`,
`timeoutMs`, `maxRetries` and `rateLimiter` (shared between operations using
the same credentials; by default each operation gets its own).

Retries: a 429 is retried honoring `Retry-After` (seconds or HTTP date, capped
at 30 seconds); 5xx, 409 and network failures are retried with exponential
backoff for idempotent requests only. Creating a Notion page or appending sheet
rows is retried only on 429, so an ambiguous failure never writes twice.

## Notion (`notion.ts`)

The host stores an internal integration token; the user shares each database
with the integration. Notion reports a database that is not shared as
`not_found`.

- `verifyNotionToken(token)` returns `{ botId, name, workspaceName }`.
- `listNotionDatabases(token)` follows search pagination.
- `getNotionDatabaseSchema(token, databaseIdOrUrl)` returns the properties with
  select and status options.
- `defaultNotionMapping(columns, schema)` maps columns to properties with the
  same normalized name and a compatible type, then fills the title property.
- `pushRowsToNotionDatabase({ token, databaseId, mapping, rows, maxRows })`
  upserts one page per row, keyed by the `Yayaw ID` property (title, text or
  number). Requests are spaced about three per second. A failing row is
  recorded in `failures`; a revoked token or missing capability stops the push
  with a `ConnectorError`. At most 5,000 rows per push.

Long text is split in 2,000-character rich text items without breaking emoji.
Ids are validated before they enter an API path.

## Google Sheets (`google-sheets.ts`)

The host stores a service account JSON key. The user shares each spreadsheet
with the service account email as an editor.

- `parseServiceAccountKey(json)` validates the key file (PKCS#8 private key,
  Google token endpoint) and returns the credentials.
- `verifyGoogleSheetsCredentials(credentials)` exchanges a signed RS256
  assertion for a token and returns the email to share spreadsheets with.
- `parseSpreadsheetId(urlOrId)` accepts a spreadsheet URL or id.
- `getSpreadsheet(credentials, urlOrId)` returns the title and grid tabs.
- `readHeaderRow(credentials, urlOrId, sheetTitle)` returns the first row.
- `pushRowsToSheet({ credentials, spreadsheetId, sheetTitle, columns, rows,
  keyColumn = "Yayaw ID", mode = "upsert", maxRows = 10000 })`. `upsert`
  reads the key column once, updates matching rows in place and appends the
  others in large batches. `replace` clears everything below the header and
  rewrites it. An empty header row is written; missing headers are added at
  its end and the user's own columns are never reordered. Values are sent
  `RAW`, so text starting with `=` is never evaluated.

A spreadsheet that is not shared raises `not_shared` with
`details.serviceAccountEmail`, so the interface can say "Share the sheet with
…". Access tokens are cached in memory per key until five minutes before
expiry; pass `tokenCache` to use a shared store.

## Host examples

### Next.js server action

```ts
"use server";
import { toConnectorRows } from "@/components/ui/yayaw-table/connectors/connector-model";
import {
  parseServiceAccountKey,
  pushRowsToSheet,
} from "@/components/ui/yayaw-table/connectors/google-sheets";
import { requireUser, loadConnection, loadViewRows } from "@/server/app";

export async function pushViewToSheet(input: {
  connectionId: string;
  viewId: string;
}) {
  const user = await requireUser();
  // Authorization: the user may use this connection and read this view.
  const connection = await loadConnection(user, input.connectionId);
  const { columns, records } = await loadViewRows(user, input.viewId);
  const result = await pushRowsToSheet({
    credentials: parseServiceAccountKey(connection.secret),
    spreadsheetId: connection.spreadsheetId,
    sheetTitle: connection.sheetTitle,
    columns: columns.map((column) => ({ id: column.id, header: column.label })),
    rows: toConnectorRows(records),
  });
  return { created: result.created, updated: result.updated, failed: result.failed };
}
```

Catch `ConnectorError` in the action to return its `code` (and
`details.serviceAccountEmail`) to the interface instead of an exception.

### Nuxt server route

```ts
// server/api/connections/[id]/notion-push.post.ts
import { toConnectorRows } from "~/components/ui/yayaw-table-vue/connectors/connector-model";
import {
  ConnectorError,
  pushRowsToNotionDatabase,
} from "~/components/ui/yayaw-table-vue/connectors/notion";

export default defineEventHandler(async (event) => {
  const user = await requireUserSession(event);
  const connection = await loadConnection(user, getRouterParam(event, "id"));
  const { viewId } = await readBody<{ viewId: string }>(event);
  const { records } = await loadViewRows(user, viewId);
  try {
    return await pushRowsToNotionDatabase({
      token: connection.secret,
      databaseId: connection.databaseId,
      mapping: connection.mapping,
      rows: toConnectorRows(records),
    });
  } catch (error) {
    if (error instanceof ConnectorError) {
      throw createError({ statusCode: 422, data: { code: error.code } });
    }
    throw error;
  }
});
```

### Scheduled pushes

Run scheduled pushes in the host's worker (a queue job, a cron handler): load
the schedule, re-check that its owner may still use the connection and the
view, load the rows on the server, call the same push function with the
worker's `AbortSignal`, and store the `ConnectorPushResult` for the run
history. Share one `createRateLimiter(334)` between concurrent Notion jobs
using the same token.

## Two-way sync (`sync-engine.ts`)

A push only writes the target. A sync also reads it, compares both sides with
what they held after the previous run, and writes each change to the other
side. The engine is pure: it never does I/O, never stores anything and never
logs. The host reads both sides, stores the sync state and runs the job.

### Model

- `SyncRecord { id, key?, values, updatedAt? }` is a record of either side.
  On the table side `id` is the row id. On the target side `id` is the
  remote id (a Notion page id, a sheet row's key, or `row:<number>` for a
  sheet row without a key) and `key` is the value of the key field
  ("Yayaw ID"), which holds the table row id. `values` are keyed by **column
  id** on both sides; the provider reads translate fields back through the
  mapping. A column missing from `values` is unknown on that side: it is
  neither compared nor written from it.
- `SyncMapping { keyField?, fields: { columnId, field, type? }[] }`. `type` is
  the table column type and drives normalization. `toSyncMapping(settings,
  columns)` builds it from the connector screen settings (`keyField` and
  `mapping` entries, `field: null` for skipped columns).
- `SyncLink { rowId, remoteId, tableHash, targetHash, baseValues?, syncedAt }`
  is what the host stores per linked row, in `SyncState { links, lastSyncAt? }`.
  Store one `SyncState` per destination and view (for example next to the
  view's Connect settings), as JSON.

`normalizeSyncValue(value, type)` gives the canonical form both sides are
compared on, so a round trip through Notion or Sheets never looks like a
change: empty values (`null`, blank text, `[]`) are `null`, except booleans,
where empty is `false` (a Notion checkbox or an empty cell has no unset
state); numbers parse from text (`" 1 200.50 "` is `1200.5`) and text that is
not a number stays text; dates keep date-only values and turn times with an
offset into UTC ISO text (`Date` objects and epoch milliseconds too); booleans
accept `true`/`false` and yes/no words (`oui`/`non` too); multi-selects become
sorted, unique, trimmed names from arrays or comma-separated text; select,
status, url and email are trimmed; other values are text. `hashSyncValues(values,
fields)` is a stable, order-independent fingerprint of the normalized values.

### Planning

`planSync({ direction, conflictRule, deletePolicy, mapping, tableRecords,
targetRecords, state, now })` returns a `SyncPlan`:

- `direction`: `two-way` merges; `push` makes the target mirror the table and
  `pull` makes the table mirror the target, for linked and new records. A
  direction never writes the other side, except the key field of a target
  record (see below).
- **Three-way merge per column.** With `baseValues` (the default,
  `storeBaseValues: true`), each column is compared with its value at the last
  sync: changed only in the table, it goes to the target; changed only in the
  target, it goes to the table; changed on both sides to different values, it
  is a conflict. Different columns changed on both sides merge without
  conflict. Without `baseValues`, the engine compares record hashes instead:
  a record changed on one side wins every differing column, and a record
  changed on both sides makes every differing column a conflict.
- `conflictRule`: `table-wins` (default), `target-wins`, or `latest-wins`,
  which compares `updatedAt` of both records and falls back to the table
  without both times or on a tie (Sheets rows have no edit time, so it acts as
  `table-wins` there). Every conflict is reported in `conflicts` with the
  table, target and base values and the winner.
- **Matching.** Linked records are found by `rowId` and `remoteId` (then by
  key, for a sheet row whose remote id became its key). Unlinked records are
  matched by key before anything is created, so an existing target record is
  adopted instead of duplicated; differing columns of an adopted record are
  conflicts. Records sharing a key (or an id) are reported in `duplicates` and
  left alone, never guessed; a linked record whose key became duplicated is
  not treated as deleted.
- `deletePolicy` for a linked record missing on one side: `ignore` keeps the
  link and does nothing, `flag` (default) keeps the link and reports it in
  `flagged`, `propagate` deletes the other side (`deleteInTarget` or
  `deleteInTable`) and drops the link. A deletion the direction cannot write
  is flagged. A kept link never recreates the deleted record; remove the link
  from the state to create it again.
- A target record without a key gets the table row id written to its key
  field (`setKeyInTarget`, and right after it is created in the table).
- `targetPartial: true` says that `targetRecords` only holds records changed
  since a time (Notion's `since`): a linked record that is missing is
  unchanged, not deleted.

`summarizeSyncPlan(plan)` returns the counts for a preview (`createInTarget`,
`updateInTarget`, `setKeyInTarget`, `createInTable`, `updateInTable`,
`deleteInTarget`, `deleteInTable`, `changes`, `conflicts`, `flagged`,
`duplicates`, `skipped`, `unchanged`). A plan with `changes: 0` has nothing to
write; running a sync twice gives such a plan the second time.

### Applying

`applySyncPlan(plan, { table, target }, { batchSize = 50, signal })` calls the
adapters in batches: creates and updates in the target, creates in the table
(with the key write-back), updates in the table, then deletions. An adapter
side has `create(items)`, `update(items)` and `delete(ids)`, each receiving a
batch of `SyncWrite { id?, key?, values }` (only the columns to write) and
returning one `{ ok: true, id? }` or `{ ok: false, code? }` per item, in
order. `create` returns the new id; the table adapter must return it.

A failing item is recorded in `failures` and the run goes on. An
authorization error (`unauthorized`, `forbidden`, `not_shared`,
`invalid_credentials`, `api_disabled`), a thrown fatal `ConnectorError` or the
signal stops the run (`result.stopped`). `result.state` only records what
succeeded: a failed pair keeps its previous link (or none), so the next run
plans it again, and an ambiguous create is adopted by key instead of
duplicated.

### Provider reads and sync targets

- Notion: `readNotionDatabase({ token, databaseId, mapping, since? })` reads
  every page (following pagination, only the mapped properties) as records
  with the page id, the key, `last_edited_time` as `updatedAt` and values
  converted back by `fromNotionPropertyValue`, symmetric with the push
  conversion. `since` filters on `last_edited_time` from the start of its
  minute (Notion's precision); pass `targetPartial: true` to `planSync` with
  it. `createNotionSyncTarget({ token, databaseId, mapping })` is the target
  adapter plus `read(since?)`: it creates pages keyed by "Yayaw ID", patches
  only the given properties and the key, and archives deleted pages (a page
  already gone counts as deleted).
- Google Sheets: `readSheetRows({ credentials, spreadsheetId, sheetTitle,
  mapping })` reads the tab once (numbers and booleans typed, dates as shown)
  and maps headers to columns (`sheetValuesToRecords` is the pure part). The
  remote id is the "Yayaw ID" cell, or `row:<number>` for a row without one;
  rows have no `updatedAt`. `createSheetSyncTarget(...)` appends new rows,
  updates rows found by key (or by row number while that row still has no
  key) writing only the given cells and the key, and deletes rows **by key
  only**, from the bottom up, in one request per 500 rows: row numbers shift
  when rows are deleted, so a row without a key is never deleted by number.
  Missing headers are added at the end of the header row.

### Running a sync in a worker

```ts
import {
  applySyncPlan,
  planSync,
  summarizeSyncPlan,
  toSyncMapping,
  type SyncRecord,
} from "@/components/ui/yayaw-table/connectors/sync-engine";
import { createNotionSyncTarget } from "@/components/ui/yayaw-table/connectors/notion";
import { loadConnection, loadViewRows, syncStates, tableRows } from "@/server/app";

export async function runNotionSync(job: {
  connectionId: string;
  viewId: string;
  ownerId: string;
  signal: AbortSignal;
}) {
  // Authorization: the owner may still use this connection and this view.
  const connection = await loadConnection(job.ownerId, job.connectionId);
  const { columns, records } = await loadViewRows(job.ownerId, job.viewId);
  const mapping = toSyncMapping(connection.settings, columns);
  const target = createNotionSyncTarget(
    { token: connection.secret, databaseId: connection.databaseId, mapping },
    { signal: job.signal }
  );
  const state = await syncStates.get(job.connectionId, job.viewId);

  // 1. Read both sides.
  const tableRecords: SyncRecord[] = records.map((record) => ({
    id: String(record.id),
    values: record,
    updatedAt: record.updatedAt,
  }));
  const targetRecords = await target.read();

  // 2. Plan (a preview can stop here with summarizeSyncPlan).
  const plan = planSync({
    direction: "two-way",
    conflictRule: "latest-wins",
    deletePolicy: "flag",
    mapping,
    tableRecords,
    targetRecords,
    state,
  });

  // 3. Apply through the target and the host's own table adapter.
  const result = await applySyncPlan(
    plan,
    { target, table: tableRows(job.ownerId, job.viewId) },
    { signal: job.signal }
  );

  // 4. Save the state, even after a partial failure.
  await syncStates.set(job.connectionId, job.viewId, result.state);
  return { summary: summarizeSyncPlan(plan), result };
}
```

The table adapter is the host's: `create` inserts rows (returning their ids),
`update` patches the given columns and `delete` removes rows, all with the
owner's permissions. Lock the destination and view while a sync runs, so two
runs never apply plans made from the same state.

### Preview and sync from the connector screen

The table's connector screen (a Connect destination's `connector`) offers
pull and two-way when the connector declares `directions` and `sync`. The
screen sends the settings (`direction`, `conflictRule`, `deletePolicy`,
`keyField`, `mapping`) to two host functions, which run the engine on the
server and return plain data:

```ts
"use server";
import {
  toSyncPreview,
  toSyncRunResult,
  type ConnectorSettings,
} from "@/components/ui/yayaw-table/utils/connector-flow";
import {
  applySyncPlan,
  planSync,
  toSyncMapping,
} from "@/components/ui/yayaw-table/connectors/sync-engine";

async function plan(settings: ConnectorSettings, viewId: string) {
  const user = await requireUser();
  const { columns, records, target, state } = await loadSyncInputs(user, settings, viewId);
  const mapping = toSyncMapping(settings, columns);
  return {
    target,
    records,
    plan: planSync({
      direction: settings.direction ?? "push",
      conflictRule: settings.conflictRule,
      deletePolicy: settings.deletePolicy,
      mapping,
      tableRecords: records.map((record) => ({ id: record.id, values: record })),
      targetRecords: await target.read(),
      state,
    }),
  };
}

export async function previewSync(settings: ConnectorSettings, viewId: string) {
  const { plan: planned, records } = await plan(settings, viewId);
  return toSyncPreview(planned, {
    rowLabel: (id) => records.find((record) => record.id === id)?.name,
  });
}

export async function runSync(settings: ConnectorSettings, viewId: string) {
  const { plan: planned, target } = await plan(settings, viewId);
  const result = await applySyncPlan(planned, { target, table: tableRows(viewId) });
  await syncStates.set(settings.targetId, viewId, result.state);
  return toSyncRunResult(result, planned);
}
```

Declare `conflictRules: ["table-wins", "target-wins"]` for a target without
edit times (Google Sheets), where "Latest edit wins" would behave as "Table
wins". Push keeps calling `push`. A scheduled run uses the saved settings, so
a schedule of a two-way connector runs a two-way sync.

### Conflict rules in code

The global `conflictRule` is one choice for every column. A host developer can
decide conflicts per column, in code, with three optional `planSync` inputs.
They are applied to each column changed on both sides in this order, and the
first one that decides wins: **`ownership` → `columnRules` →
`resolveConflict` → `conflictRule`**. Everything stays backward compatible: a
plan without them behaves exactly as before.

```ts
import {
  planSync,
  validateConflictConfig,
  type ConflictResolver,
} from "@/components/ui/yayaw-table/connectors/sync-engine";

const STATUS_ORDER = ["Draft", "Active", "Won", "Archived"];

/** Keeps the highest amount and never lets a status go backwards. */
const resolveConflict: ConflictResolver = (conflict) => {
  if (conflict.columnId === "amount") {
    const amounts = [conflict.tableValue, conflict.targetValue].map(Number);
    return { value: Math.max(...amounts) };
  }
  if (conflict.columnId === "status") {
    const rank = (value: unknown) => STATUS_ORDER.indexOf(String(value));
    return rank(conflict.tableValue) >= rank(conflict.targetValue)
      ? "table"
      : "target";
  }
  // No opinion: the global conflictRule decides.
  return undefined;
};

const rules = {
  // The CRM owns prices, the table owns the internal owner.
  ownership: { price: "target", owner: "table" },
  columnRules: { tags: "merge", notes: "manual" },
  resolveConflict,
} as const;

// Once, when the configuration is loaded.
const issues = validateConflictConfig(
  { ...rules, direction: "two-way" },
  mapping
);
if (issues.some((issue) => issue.severity === "error")) {
  throw new Error(issues.map((issue) => issue.message).join("\n"));
}

const plan = planSync({
  direction: "two-way",
  conflictRule: "table-wins",
  mapping,
  tableRecords,
  targetRecords,
  state,
  ...rules,
});
```

- **`ownership: Record<columnId, "table" | "target">`**: the owning side
  always wins that column. In two-way, a change made on the other side is
  drift: the owner's value is written back on the next sync and reported in
  `plan.overridden` (`{ columnId, owner, tableValue, targetValue,
  bothChanged }`), not in `conflicts`. A one-way sync never writes an owned
  column to its owner (a push leaves target-owned columns alone). Creations
  still write every mapped column.
- **`columnRules: Record<columnId, ConflictRule | "merge" | "manual">`**:
  `table-wins`, `target-wins` and `latest-wins` as for the global rule;
  `merge` unites list values (multi-selects, tags): items both sides kept or
  either side added, minus items of the base removed on either side, table
  items first, without repeats (`mergeSyncLists` is exported). On a column
  that is not a list, `merge` falls back to the next step (`resolveConflict`,
  then `conflictRule`). `manual` leaves the conflict to a person (below).
- **`resolveConflict(context)`** receives `{ columnId, field, tableValue,
  targetValue, baseValue, tableRecord, targetRecord, rowId, remoteId }`
  (canonical values, see `normalizeSyncValue`) and returns `"table"`,
  `"target"`, `{ value }` (written to both sides where it differs), `"skip"`
  (leave both sides as they are this run; asked again next run), `"manual"`,
  or `undefined` to defer to `conflictRule`. It must be **pure and
  synchronous**: it runs where `planSync` runs (your server or worker), never
  in the browser. A resolver that throws, or returns a promise or anything
  else, makes the conflict manual with `error: "resolver_failed"` or
  `"invalid_decision"` on the conflict.

Every conflict in `plan.conflicts` now carries `resolution` (`table`,
`target`, `merged`, `custom`, `manual`, `skipped`), `source` (`column`,
`resolver`, `rule`) and, for merged and custom values, `value`. `winner` is
kept for older readers and is only meaningful when `resolution` is a side.
`summarizeSyncPlan` adds `overridden` and `pendingConflicts` counts.

`validateConflictConfig(config, mapping)` returns `{ code, columnId?,
severity, message }[]`: `unknown_column`, `invalid_owner`, `invalid_rule`,
`invalid_resolver` and `owner_not_written` (an owner a one-way `direction`
never writes, e.g. `ownership: { price: "target" }` with a push) are errors;
`merge_not_list`, `rule_on_owned_column` (ownership always wins) and
`rules_unused` (column rules or a resolver with a one-way direction) are
warnings. `planSync` ignores what it flags instead of throwing.

#### Manual review

A `manual` conflict is not applied: both sides keep their value, the other
columns of the row still sync, and the conflict is stored in
`SyncState.pendingConflicts` (`{ rowId, remoteId, columnId, field,
tableValue, targetValue, baseValue, detectedAt }`). There is at most one per
row and column; it keeps its `detectedAt` while the values stay the same, is
replaced when either value changes, and disappears when both sides agree
again. It stays pending even if one side goes back to the base value, until a
person decides or the sides agree. A partial read (`targetPartial`) or a
blocked row keeps it as is.

`resolvePendingConflicts(state, resolutions, { mapping })` turns a person's
decisions (`{ rowId, columnId, choice: "table" | "target" | { value } }[]`)
into writes (`operations.updateInTable` / `updateInTarget`, one per row and
side) and the next state (conflicts removed, the chosen value stored as the
column's base, so the next sync sees both sides agree). Resolutions that match
no pending conflict are returned in `unmatched`. Apply the writes with
`applyConflictResolutions(plan, { table, target })`, which uses the same
adapters as `applySyncPlan`; a row whose write fails keeps its conflicts and
link.

```ts
// Worker: list and resolve the conflicts left to a person.
export async function listSyncConflicts(connectionId: string, viewId: string) {
  const state = await syncStates.get(connectionId, viewId);
  return toPendingConflicts(state.pendingConflicts, {
    rowLabel: (id) => titles.get(id),
  });
}

export async function resolveSyncConflicts(
  connectionId: string,
  viewId: string,
  resolutions: PendingConflictResolution[]
) {
  const { settings, columns, target } = await loadConnection(connectionId, viewId);
  const mapping = toSyncMapping(settings, columns);
  const state = await syncStates.get(connectionId, viewId);
  const plan = resolvePendingConflicts(state, resolutions, { mapping });
  const result = await applyConflictResolutions(plan, {
    table: tableRows(viewId),
    target,
  });
  await syncStates.set(connectionId, viewId, result.state);
  return toSyncRunResult(result);
}
```

#### Showing the rules in the connector screen

Functions never reach the browser. The connector declares what the screen
shows, and two optional host functions for manual review:

```ts
const connector = {
  // …targets, describe, push, preview, sync
  conflicts: {
    ownership: { price: "target" },
    columnRules: { tags: "merge", notes: "manual" },
    lock: true, // the conflict rule select is read-only
    allowManual: true, // default: offer the conflicts to resolve
  },
  listConflicts: (settings, context) => listSyncConflicts(settings.targetId, context.viewId),
  resolveConflicts: (resolutions, settings, context) =>
    resolveSyncConflicts(settings.targetId, context.viewId, resolutions),
};
```

- Under the conflict rule (two-way; under "Deleted records" for a pull, with
  ownership only), "Rules set by your app" lists `describeConflictRules`
  sentences: "Price: Spreadsheet is the source of truth", "Tags: merged",
  "Notes: decided by you", "Name: this table wins". With `lock: true` a lock
  icon and "Your app decides conflicts; these rules can’t be changed here."
  are shown and the conflict rule select is disabled (changes to it are
  ignored).
- The preview (`toSyncPreview` now maps `resolution`, `source`, `value`,
  `plan.overridden` and `plan.pendingConflicts`) labels each conflict "<side>
  wins", "Merged" (with the result), "Needs your decision", "Decided by your
  app" or "Left as is for now", lists "Kept from the side that owns them (N)"
  with "Owned by <side>", and notes "N conflicts will wait for your decision."
- With `listConflicts` and `resolveConflicts` (and `allowManual` not false),
  the screen lists the conflicts after the target is described, after a sync
  and after each resolution. "Conflicts to resolve (N)" opens a list: each
  conflict shows its row, column and both values formatted by column type
  (numbers and dates in the table's locale, yes/no, lists), with "Keep table
  value" and "Keep <target> value", plus "Keep all table values" and "Keep all
  <target> values". A resolution reloads the table.

Labels are English and French and overridable with `connector.<key>`
(`appRules`, `appRulesLocked`, `ruleOwnedTable`, `ruleOwnedTarget`,
`ruleMerge`, `ruleManual`, `ruleTableWins`, `ruleTargetWins`,
`ruleLatestWins`, `ownedBy`, `resolutionMerged`, `resolutionManual`,
`resolutionCustom`, `resolutionSkipped`, `resultValue`, `overridden`,
`moreOverridden`, `pendingNote`, `pendingNoteOne`, `conflictsToResolve`,
`conflictsHint`, `keepTable`, `keepTarget`, `keepAllTable`, `keepAllTarget`,
`noConflicts`, `resolvingConflicts`, `backToSettings`, `valueYes`,
`valueNo`).
