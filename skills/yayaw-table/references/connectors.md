# Connectors

The Notion and Google Sheets connectors are server modules, identical in both
editions: `connector-model.ts` (columns, rows, mapping, push results, typed
errors, HTTP with retries and rate limits), `sync-engine.ts` (two-way sync,
pure) and one provider module. They use `fetch` and Web Crypto only (Node 20+,
Bun, Deno, edge runtimes). **Never import them in client code**; import each
module directly (there is no index):

- React: `components/ui/yayaw-table/connectors/notion.ts`,
  `components/ui/yayaw-table/connectors/google-sheets.ts`,
  `components/ui/yayaw-table/connectors/sync-engine.ts`,
  `components/ui/yayaw-table/connectors/connector-model.ts`
- Vue: the same files in `components/ui/yayaw-table-vue/connectors/`.

The table's own screens (Data › Connect, the connector screen, schedules) are
driven by the host's `destinations` (see
[server contracts](server-contracts.md#destinations-connectors-and-schedules));
this page is about the server side. Full reference:
[connectors](https://github.com/Yayaw-SAS/Yayaw-Table/blob/main/docs/connectors.md).

## What the host provides

| Duty | How |
| --- | --- |
| Credentials | Store Notion integration tokens and Google service account keys encrypted, per organization or user; never send them to the browser. |
| Authorization | Decide who may connect a destination and push or sync which table, and check it on every call and every scheduled run. |
| Row loading | Load the rows of the view's query on the server with the user's permissions; do not accept rows from the browser. |
| Entry points | Server actions, API routes or handlers that call the connector functions and return plain data. |
| Sync state | One `SyncState` per destination and view (JSON), saved after every run, even a partial one. |
| Workers and locks | Scheduled and large runs in a background job, with your retry policy; one run at a time per destination and view. |

## Push

- Notion: the user shares the database with the integration (unshared
  databases report `not_found`). `verifyNotionToken()`,
  `listNotionDatabases()`, `getNotionDatabaseSchema()`,
  `defaultNotionMapping()`, then `pushRowsToNotionDatabase({ token,
  databaseId, mapping, rows })`: one page per row, upserted by the "Yayaw ID"
  property, about three requests per second, at most 5,000 rows.
- Google Sheets: the user shares the spreadsheet with the service account
  (unshared sheets raise `not_shared` with `details.serviceAccountEmail`).
  `parseServiceAccountKey()`, `verifyGoogleSheetsCredentials()`,
  `parseSpreadsheetId()`, `getSpreadsheet()`, then `pushRowsToSheet({
  credentials, spreadsheetId, sheetTitle, columns, rows, mode })`: `upsert`
  by the key column or `replace`; values are written raw, so text starting
  with `=` is never evaluated; the user's own columns are never reordered.
- Rows come from `toConnectorRows()`. Failures are `ConnectorError`s (import
  it from `connector-model.ts`) with a `code` (`unauthorized`, `forbidden`,
  `not_shared`, `api_disabled`, `not_found`, `rate_limited`,
  `provider_unavailable`, `invalid_request`, `invalid_target`,
  `invalid_mapping`, `invalid_credentials`, `aborted`) and safe `details`
  only; return the code to the interface rather than the exception.
- Every function takes `ConnectorOptions` (`fetch`, `signal`, `timeoutMs`,
  `maxRetries`, `rateLimiter`…); share one `createRateLimiter()` between
  concurrent Notion jobs using the same token.

## Two-way sync

The engine never does I/O: the host reads both sides, stores the state and
runs the job.

```ts
import {
  applySyncPlan,
  planSync,
  summarizeSyncPlan,
  toSyncMapping,
  type SyncRecord,
} from "@/components/ui/yayaw-table/connectors/sync-engine";
import { createNotionSyncTarget } from "@/components/ui/yayaw-table/connectors/notion";

export async function runNotionSync(job: { connectionId: string; viewId: string; ownerId: string; signal: AbortSignal }) {
  const connection = await loadConnection(job.ownerId, job.connectionId); // re-authorize the owner
  const { columns, records } = await loadViewRows(job.ownerId, job.viewId); // server-side query
  const mapping = toSyncMapping(connection.settings, columns);
  const target = createNotionSyncTarget(
    { token: connection.secret, databaseId: connection.databaseId, mapping },
    { signal: job.signal }
  );
  const state = await syncStates.get(job.connectionId, job.viewId);
  const tableRecords: SyncRecord[] = records.map((record) => ({ id: String(record.id), values: record, updatedAt: record.updatedAt }));
  const plan = planSync({
    direction: "two-way",
    conflictRule: "latest-wins",
    deletePolicy: "flag",
    mapping,
    tableRecords,
    targetRecords: await target.read(),
    state,
  });
  const result = await applySyncPlan(plan, { target, table: tableAdapter(job.ownerId, job.viewId) }, { signal: job.signal });
  await syncStates.set(job.connectionId, job.viewId, result.state); // also after partial failures
  return { summary: summarizeSyncPlan(plan), result };
}
```

- `direction`: `push`, `pull` or `two-way`. Each column merges three-way
  against its value at the last sync (`baseValues`); a column changed on both
  sides to different values is a conflict.
- `conflictRule`: `table-wins` (default), `target-wins`, `latest-wins`
  (compares `updatedAt`; Sheets rows have none, so offer only the first two
  for sheets with `connector.conflictRules`).
- Per-column decisions in code, applied in this order before `conflictRule`:
  `ownership` (a side always wins that column), `columnRules`
  (`table-wins`, `target-wins`, `latest-wins`, `merge` for lists, `manual`)
  and `resolveConflict(context)`, which must be pure and synchronous. Check a
  configuration once with `validateConflictConfig()`.
- `manual` conflicts wait in `SyncState.pendingConflicts`; settle them with
  `resolvePendingConflicts()` and `applyConflictResolutions()`, and show
  them through `connector.listConflicts` and `connector.resolveConflicts`
  (`toPendingConflicts()` formats them).
- `deletePolicy`: `flag` (default, report), `ignore` or `propagate` (delete
  on the other side; the screen asks for a preview and a confirmation).
- Matching: linked records by ids, unlinked ones adopted by the key field
  ("Yayaw ID") before anything is created; duplicate keys are reported, never
  guessed. A column never synced before fills the empty side instead of
  clearing it.
- The table adapter is yours: `create(items)` (return the new ids),
  `update(items)` and `delete(ids)`, per-item results, with the owner's
  permissions. Authorization errors or the `signal` stop the run; the
  returned state records only what succeeded, so the next run retries.
- `normalizeSyncValue()` and `hashSyncValues()` keep round trips (Notion
  rich text, sheet cells, dates, booleans, lists, places as "lat, lng" text)
  from looking like changes.

For the connector screen, return plain data from `connector.preview`
(`toSyncPreview(plan, { rowLabel })`) and `connector.sync`
(`toSyncRunResult(result, plan)`), both from `utils/connector-flow.ts`.

## Target health

`checkTargetSchema({ columns, mapping, keyField, keyFieldId, keyFieldIndex,
targetSchema, direction })` in `utils/connector-schema.ts` (pure) reports
blocking, fixable and warning issues (missing, deleted or renamed fields,
incompatible or read-only types, missing options or key, duplicate mappings,
an unmapped Notion title, a sheet header that disappeared); the target schema
comes from `notionTargetSchema()` or `getSheetTargetSchema()`.
`prepareNotionDatabase()` and `prepareSheet()` apply the fixable issues
additively (they never delete, rename or retype). Fields are resolved by
Notion property id or saved sheet position before their name, so renames keep
working. A scheduled worker checks first and pauses the schedule when
`schemaBlocksRun()` says so, instead of failing row by row.
