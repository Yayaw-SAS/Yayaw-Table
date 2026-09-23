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
`connector-model.ts` and its provider module. The React and Vue items ship the
same files.

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
