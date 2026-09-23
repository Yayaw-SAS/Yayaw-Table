import assert from "node:assert/strict";
import type * as Sheets from "../src/components/ui/yayaw-table/connectors/google-sheets";
import type * as Notion from "../src/components/ui/yayaw-table/connectors/notion";
import type * as Schema from "../src/components/ui/yayaw-table/utils/connector-schema";
import {
  caught,
  fakeClock,
  fakeServer,
  json,
  type RecordedRequest,
} from "./connectors-fake-http";
import {
  generateTestKey,
  keyFile,
  kind,
  type SheetState,
  sheetsRoute,
  type TestKey,
} from "./connectors-google-sheets-suite";

type SchemaHealthApi = Pick<typeof Schema, "checkTargetSchema"> &
  Pick<
    typeof Notion,
    | "createNotionDatabase"
    | "getNotionDatabaseSchema"
    | "listNotionPages"
    | "notionTargetSchema"
    | "planNotionPrepare"
    | "prepareNotionDatabase"
    | "pushRowsToNotionDatabase"
    | "readNotionDatabase"
  > &
  Pick<
    typeof Sheets,
    | "createGoogleTokenCache"
    | "getSheetTargetSchema"
    | "parseServiceAccountKey"
    | "planSheetPrepare"
    | "prepareSheet"
    | "sheetTargetSchema"
    | "planSheetHeader"
    | "pushRowsToSheet"
    | "createSheetSyncTarget"
    | "sheetValuesToRecords"
  >;

const DATABASE_ID = "0123456789abcdef0123456789abcdef";
const DATABASE_DASHED = "01234567-89ab-cdef-0123-456789abcdef";
const PAGE_DASHED = "fedcba98-7654-3210-fedc-ba9876543210";
const SPREADSHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

interface Property {
  id: string;
  name: string;
  type: string;
  select?: { options: { name: string; color?: string }[] };
}

/** A database the fake Notion API serves and changes on PATCH. */
const drifted = (): Record<string, Property> => ({
  Name: { id: "title", name: "Name", type: "title" },
  Status: {
    id: "st",
    name: "Status",
    type: "select",
    select: { options: [{ name: "Active", color: "green" }] },
  },
  Cost: { id: "am", name: "Cost", type: "number" },
  Margin: { id: "mg", name: "Margin", type: "formula" },
  "Yayaw ID": { id: "key", name: "Yayaw ID", type: "rich_text" },
});

function notionServer(properties: Record<string, Property>) {
  const patches: unknown[] = [];
  const route = (request: RecordedRequest) => {
    const path = request.url.pathname;
    if (path !== `/v1/databases/${DATABASE_DASHED}`) {
      return json({ message: "unexpected" }, 404);
    }
    if (request.method === "PATCH") {
      const body = request.body as {
        properties: Record<string, Record<string, unknown>>;
      };
      patches.push(body);
      applyPatch(properties, body.properties);
    }
    return json({ id: DATABASE_DASHED, title: [], properties });
  };
  const server = fakeServer(route);
  const clock = fakeClock();
  return {
    server,
    patches,
    runtime: { fetch: server.fetch, now: clock.now, sleep: clock.sleep },
  };
}

/** Applies a PATCH as Notion does: new properties by name, option lists by id. */
function applyPatch(
  properties: Record<string, Property>,
  patch: Record<string, Record<string, unknown>>
) {
  for (const [key, config] of Object.entries(patch)) {
    const [type, value] = Object.entries(config)[0] ?? ["rich_text", {}];
    const existing = Object.values(properties).find(
      (property) => property.id === key || property.name === key
    );
    if (existing) {
      existing.select = value as Property["select"];
    } else {
      properties[key] = {
        id: `new-${key}`,
        name: key,
        type,
        ...(type === "select" ? { select: value as Property["select"] } : {}),
      };
    }
  }
}

const fixes: Notion.NotionSchemaFix[] = [
  { kind: "create_field", field: "Yayaw ID", type: "rich_text", key: true },
  {
    kind: "create_field",
    field: "Notes",
    type: "rich_text",
    columnId: "notes",
  },
  // An existing property is never changed, whatever its type.
  { kind: "create_field", field: "cost", type: "rich_text", columnId: "price" },
  {
    kind: "add_options",
    field: "Status",
    fieldId: "st",
    type: "select",
    options: [
      { name: "Active", color: "blue" },
      { name: "Blocked", color: "red" },
      { name: "Review" },
      { name: "a,b" },
    ],
  },
  // Options never go to a property of another type.
  {
    kind: "add_options",
    field: "Cost",
    type: "select",
    options: [{ name: "x" }],
  },
];

/** Schema check, "Prepare" and new targets on the server, for both editions' copies. */
export function connectorsSchemaHealthSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  api: SchemaHealthApi
) {
  test("Notion: prepare creates missing properties and options in one PATCH, and nothing else", async () => {
    const properties = drifted();
    Reflect.deleteProperty(properties, "Yayaw ID");
    const { server, patches, runtime } = notionServer(properties);
    const result = await api.prepareNotionDatabase(
      { token: "secret_x", databaseId: DATABASE_ID, fixes },
      runtime
    );
    assert.deepEqual(
      server.requests.map((request) => request.method),
      ["GET", "PATCH"]
    );
    assert.deepEqual(patches, [
      {
        properties: {
          "Yayaw ID": { rich_text: {} },
          Notes: { rich_text: {} },
          // Every existing option is sent back with its color: nothing is removed.
          st: {
            select: {
              options: [
                { name: "Active", color: "green" },
                { name: "Blocked", color: "red" },
                { name: "Review" },
              ],
            },
          },
        },
      },
    ]);
    assert.deepEqual(result, {
      applied: [
        {
          kind: "create_field",
          field: "Yayaw ID",
          type: "rich_text",
          key: true,
        },
        {
          kind: "create_field",
          field: "Notes",
          type: "rich_text",
          columnId: "notes",
        },
        {
          kind: "add_options",
          field: "Status",
          fieldId: "st",
          type: "select",
          options: [{ name: "Blocked", color: "red" }, { name: "Review" }],
        },
      ],
      skipped: [
        { field: "Status", option: "a,b", reason: "invalid_option" },
        { field: "Cost", reason: "property_missing" },
      ],
    });
    // Idempotent: the second run reads the database and writes nothing.
    const again = await api.prepareNotionDatabase(
      { token: "secret_x", databaseId: DATABASE_ID, fixes },
      runtime
    );
    assert.deepEqual(again.applied, []);
    assert.equal(patches.length, 1);
    assert.deepEqual(
      server.requests.map((request) => request.method),
      ["GET", "PATCH", "GET"]
    );
  });

  test("Notion: the plan never renames, retypes or deletes a property", () => {
    const schema = {
      id: DATABASE_DASHED,
      title: "Projects",
      url: null,
      properties: [
        { id: "am", name: "Cost", type: "number" },
        {
          id: "st",
          name: "Status",
          type: "status",
          options: [{ name: "Active" }],
        },
      ],
    };
    const plan = api.planNotionPrepare(schema, [
      { kind: "create_field", field: "Cost", type: "select" },
      {
        kind: "add_options",
        field: "Status",
        fieldId: "st",
        type: "select",
        options: [{ name: "Done" }],
      },
      { kind: "create_field", field: "Owner", type: "people" },
    ]);
    assert.deepEqual(plan.properties, {});
    assert.deepEqual(plan.applied, []);
    assert.deepEqual(
      plan.skipped.map((item) => item.reason),
      ["property_missing", "unsupported_property_type"]
    );
  });

  test("Notion: a check on a fresh schema reports the drift", async () => {
    const properties = drifted();
    Reflect.deleteProperty(properties, "Yayaw ID");
    const { runtime } = notionServer(properties);
    const schema = await api.getNotionDatabaseSchema(
      "secret_x",
      DATABASE_ID,
      runtime
    );
    const report = api.checkTargetSchema({
      columns: [
        { id: "name", header: "Name", type: "text" },
        {
          id: "status",
          header: "Status",
          type: "select",
          options: ["Active", "Blocked"],
        },
        { id: "price", header: "Price", type: "number" },
      ],
      mapping: [
        { columnId: "name", field: "Name", fieldId: "title" },
        { columnId: "status", field: "Status", fieldId: "st" },
        { columnId: "price", field: "Price", fieldId: "am" },
      ],
      targetSchema: api.notionTargetSchema(schema),
      direction: "push",
    });
    assert.deepEqual(
      report.issues.map((issue) => `${issue.severity}:${issue.code}`),
      [
        "fixable:missing_options",
        "fixable:missing_key",
        "warning:renamed_field",
      ]
    );
  });

  test("Notion: a push follows a renamed property by its id", async () => {
    const properties = drifted();
    const created: unknown[] = [];
    const server = fakeServer((request) => {
      const path = request.url.pathname;
      if (request.method === "GET") {
        return json({ id: DATABASE_DASHED, title: [], properties });
      }
      if (path.endsWith("/query")) {
        return json({ results: [], has_more: false });
      }
      created.push(request.body);
      return json({ id: PAGE_DASHED });
    });
    const clock = fakeClock();
    const result = await api.pushRowsToNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: {
          keyProperty: "Yayaw ID",
          properties: { name: "Name", price: "Price" },
          propertyIds: { price: "am" },
        },
        rows: [{ id: "1", values: { name: "Launch", price: 12 } }],
      },
      { fetch: server.fetch, now: clock.now, sleep: clock.sleep }
    );
    assert.equal(result.created, 1);
    assert.equal(result.warningCount, 0);
    const body = created[0] as { properties: Record<string, unknown> };
    assert.deepEqual(body.properties.Cost, { number: 12 });
    assert.equal(body.properties.Price, undefined);
  });

  test("Notion: a pull reads formulas, created times and unique ids", async () => {
    const properties = {
      ...drifted(),
      Created: { id: "ct", name: "Created", type: "created_time" },
      Ref: { id: "rf", name: "Ref", type: "unique_id" },
    };
    const server = fakeServer((request) => {
      if (request.method === "GET") {
        return json({ id: DATABASE_DASHED, title: [], properties });
      }
      return json({
        has_more: false,
        results: [
          {
            id: PAGE_DASHED,
            properties: {
              "Yayaw ID": { rich_text: [{ plain_text: "1" }] },
              Margin: { formula: { type: "number", number: 0.25 } },
              Created: { created_time: "2026-09-01T10:00:00.000Z" },
              Ref: { unique_id: { prefix: "PRJ", number: 12 } },
            },
          },
        ],
      });
    });
    const clock = fakeClock();
    const records = await api.readNotionDatabase(
      {
        token: "secret_x",
        databaseId: DATABASE_ID,
        mapping: {
          keyField: "Yayaw ID",
          fields: [
            { columnId: "margin", field: "Margin", type: "number" },
            { columnId: "created", field: "Created", type: "date" },
            { columnId: "ref", field: "Ref" },
          ],
        },
      },
      { fetch: server.fetch, now: clock.now, sleep: clock.sleep }
    );
    assert.deepEqual(records[0]?.values, {
      margin: 0.25,
      created: "2026-09-01T10:00:00.000Z",
      ref: "PRJ-12",
    });
  });

  test("Notion: a new database from the table's columns, and its parents", async () => {
    const requests: RecordedRequest[] = [];
    const server = fakeServer((request) => {
      requests.push(request);
      if (request.url.pathname === "/v1/search") {
        return json({
          has_more: false,
          results: [
            {
              object: "page",
              id: PAGE_DASHED,
              url: "https://www.notion.so/home",
              properties: {
                title: { type: "title", title: [{ plain_text: "Team home" }] },
              },
            },
            { object: "database", id: DATABASE_DASHED },
          ],
        });
      }
      const body = request.body as {
        properties: Record<string, Record<string, unknown>>;
      };
      return json({
        id: DATABASE_DASHED,
        title: [{ plain_text: "Roadmap" }],
        url: "https://www.notion.so/roadmap",
        properties: Object.fromEntries(
          Object.entries(body.properties).map(([name, config], index) => [
            name,
            { id: `p${index}`, name, type: Object.keys(config)[0] },
          ])
        ),
      });
    });
    const clock = fakeClock();
    const runtime = { fetch: server.fetch, now: clock.now, sleep: clock.sleep };
    assert.deepEqual(await api.listNotionPages("secret_x", runtime), [
      {
        id: PAGE_DASHED,
        title: "Team home",
        url: "https://www.notion.so/home",
      },
    ]);
    const created = await api.createNotionDatabase(
      {
        token: "secret_x",
        parentPageId: PAGE_DASHED,
        title: "Roadmap",
        columns: [
          { id: "price", header: "Price", type: "number" },
          { id: "name", header: "Name", type: "text" },
          {
            id: "status",
            header: "Status",
            type: "select",
            options: [{ name: "Active", color: "green" }, { name: "a,b" }],
          },
          { id: "copy", header: "name", type: "text" },
        ],
      },
      runtime
    );
    const body = requests.at(-1)?.body as {
      parent: unknown;
      properties: Record<string, unknown>;
    };
    assert.deepEqual(body.parent, { type: "page_id", page_id: PAGE_DASHED });
    assert.deepEqual(body.properties, {
      "Yayaw ID": { rich_text: {} },
      Name: { title: {} },
      Price: { number: {} },
      Status: { select: { options: [{ name: "Active", color: "green" }] } },
    });
    assert.deepEqual(created.mapping, {
      keyProperty: "Yayaw ID",
      keyPropertyId: "p0",
      properties: { name: "Name", price: "Price", status: "Status" },
      propertyIds: { name: "p1", price: "p2", status: "p3" },
    });
    // Creating is never retried after an ambiguous failure.
    const failing = fakeServer(() => json({}, 500));
    const error = await caught(() =>
      api.createNotionDatabase(
        {
          token: "secret_x",
          parentPageId: PAGE_DASHED,
          title: "X",
          columns: [],
        },
        { fetch: failing.fetch, now: clock.now, sleep: clock.sleep }
      )
    );
    assert.equal((error as { code?: string }).code, "provider_unavailable");
    assert.equal(failing.requests.length, 1);
  });

  test("Sheets: sampled types and positions for the check", () => {
    const schema = api.sheetTargetSchema([
      ["Yayaw ID", "Amount", "", "Due", "Done", "Notes"],
      ["a", 12, "x", "2026-09-01", true, "hello"],
      ["b", 3.5, "", "9/2/2026", false, 4],
      ["c", null, "", "", "", ""],
    ]);
    assert.equal(schema.provider, "sheets");
    assert.deepEqual(
      schema.fields.map((field) => [field.name, field.index, field.type]),
      [
        ["Yayaw ID", 0, "text"],
        ["Amount", 1, "number"],
        ["Due", 3, "date"],
        ["Done", 4, "boolean"],
        ["Notes", 5, "text"],
      ]
    );
    // A text column holding numbers is only a warning in a sheet.
    const report = api.checkTargetSchema({
      columns: [
        { id: "amount", header: "Amount", type: "date" },
        { id: "due", header: "Due", type: "date" },
      ],
      mapping: [
        { columnId: "amount", field: "Amount" },
        { columnId: "due", field: "Due date", fieldIndex: 3 },
      ],
      keyFieldIndex: 0,
      targetSchema: schema,
      direction: "two-way",
    });
    assert.deepEqual(
      report.issues.map(
        (issue) => `${issue.severity}:${issue.code}:${issue.columnId}`
      ),
      ["warning:incompatible_type:amount", "warning:renamed_field:due"]
    );
    assert.deepEqual(
      api.planSheetPrepare(
        ["Name", "Due"],
        [
          { kind: "create_field", field: "Due" },
          { kind: "add_options", field: "Status" },
          { kind: "create_field", field: " Notes " },
          { kind: "create_field", field: "Yayaw ID", key: true },
          { kind: "create_field", field: "Notes" },
        ]
      ),
      ["Yayaw ID", "Notes"]
    );
  });

  let testKey: Promise<TestKey> | undefined;
  const sheetSetup = async (state: Partial<SheetState>) => {
    testKey ??= generateTestKey();
    const key = await testKey;
    const sheet: SheetState = {
      header: [],
      keys: [],
      rowCount: 1000,
      columnCount: 26,
      ...state,
    };
    const server = fakeServer(sheetsRoute(sheet));
    const clock = fakeClock();
    return {
      server,
      credentials: api.parseServiceAccountKey(JSON.stringify(keyFile(key.pem))),
      runtime: {
        fetch: server.fetch,
        now: clock.now,
        sleep: clock.sleep,
        tokenCache: api.createGoogleTokenCache(),
      },
    };
  };

  test("Sheets: prepare adds missing headers at the end, key first, and is idempotent", async () => {
    const { server, credentials, runtime } = await sheetSetup({
      header: ["Name", "Amount"],
      columnCount: 2,
    });
    const sheetFixes = [
      { kind: "create_field" as const, field: "Due" },
      { kind: "create_field" as const, field: "Yayaw ID", key: true },
      { kind: "create_field" as const, field: "Name" },
      { kind: "add_options" as const, field: "Amount" },
    ];
    const result = await api.prepareSheet(
      {
        credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        fixes: sheetFixes,
      },
      runtime
    );
    assert.deepEqual(result, {
      applied: [
        { kind: "create_field", field: "Due" },
        { kind: "create_field", field: "Yayaw ID", key: true },
      ],
      addedHeaders: ["Yayaw ID", "Due"],
    });
    const writes = server.requests.filter((request) =>
      kind(request).includes("batchUpdate")
    );
    assert.deepEqual(
      writes.map((request) => request.body),
      [
        {
          requests: [
            {
              appendDimension: { sheetId: 7, dimension: "COLUMNS", length: 2 },
            },
          ],
        },
        {
          valueInputOption: "RAW",
          includeValuesInResponse: false,
          data: [
            {
              range: "'Data'!C1:D1",
              majorDimension: "ROWS",
              values: [["Yayaw ID", "Due"]],
            },
          ],
        },
      ]
    );
    // The header now has them: nothing is written the second time.
    const ready = await sheetSetup({
      header: ["Name", "Amount", "Yayaw ID", "Due"],
      columnCount: 4,
    });
    const again = await api.prepareSheet(
      {
        credentials: ready.credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        fixes: sheetFixes,
      },
      ready.runtime
    );
    assert.deepEqual(again, { applied: [], addedHeaders: [] });
    assert.equal(
      ready.server.requests.filter((request) =>
        kind(request).includes("batchUpdate")
      ).length,
      0
    );
  });

  test("Sheets: the schema is read from the header and the first rows", async () => {
    const { credentials, runtime, server } = await sheetSetup({
      header: ["Yayaw ID", "Amount"],
      grid: [
        ["Yayaw ID", "Amount"],
        ["a", 12],
      ],
    });
    const schema = await api.getSheetTargetSchema(
      { credentials, spreadsheetId: SPREADSHEET_ID, sheetTitle: "Data" },
      runtime
    );
    assert.deepEqual(
      schema.fields.map((field) => [field.name, field.type]),
      [
        ["Yayaw ID", "text"],
        ["Amount", "number"],
      ]
    );
    const read = server.requests.find((request) => kind(request) === "read");
    assert.ok(
      decodeURIComponent(read?.url.pathname ?? "").endsWith("'Data'!1:21")
    );
  });

  // "Due" was saved at column C (key in A) and renamed "Due date" in the sheet.
  const renamedHeader = ["Yayaw ID", "Name", "Due date"];
  const ambiguousHeader = ["Yayaw ID", "Name"];
  const writes = (requests: RecordedRequest[]) =>
    requests.filter((request) =>
      ["append", "batchUpdate", "valuesbatchUpdate"].includes(kind(request))
    );
  const isFieldMissing = (error: unknown) =>
    (error as { code?: string }).code === "field_missing";

  test("Sheets: a renamed header is resolved by its saved position, never added again", () => {
    const plan = api.planSheetHeader(
      [" Notes ", ...renamedHeader],
      "Yayaw ID",
      [
        { id: "name", header: "Name" },
        { id: "due", header: "Due" },
      ],
      // The key moved from A to B: saved positions move with it.
      { indexes: { due: 2 }, keyIndex: 0 }
    );
    assert.deepEqual(plan.added, []);
    assert.equal(plan.indexes.get("due"), 3);
    // Without a saved position, a missing header is still a new one.
    assert.deepEqual(
      api.planSheetHeader(renamedHeader, "Yayaw ID", [
        { id: "due", header: "Due" },
      ]).added,
      ["Due"]
    );
    assert.throws(
      () =>
        api.planSheetHeader(
          ambiguousHeader,
          "Yayaw ID",
          [{ id: "due", header: "Due" }],
          { indexes: { due: 2 }, keyIndex: 0 }
        ),
      isFieldMissing
    );
    // The header there is mapped by another column: ambiguous too.
    assert.throws(
      () =>
        api.planSheetHeader(
          renamedHeader,
          "Yayaw ID",
          [
            { id: "name", header: "Name" },
            { id: "due", header: "Due" },
          ],
          { indexes: { due: 1 }, keyIndex: 0 }
        ),
      isFieldMissing
    );
    const records = api.sheetValuesToRecords(
      [renamedHeader, ["a", "Launch", "2026-09-01"]],
      {
        keyField: "Yayaw ID",
        keyFieldIndex: 0,
        fields: [
          { columnId: "due", field: "Due", fieldIndex: 2, type: "date" },
        ],
      }
    );
    assert.deepEqual(records[0]?.values, { due: "2026-09-01" });
  });

  test("Sheets: a push writes a renamed header's column in place; an ambiguous one writes nothing", async () => {
    const renamed = await sheetSetup({
      header: renamedHeader,
      columnCount: 3,
    });
    const result = await api.pushRowsToSheet(
      {
        credentials: renamed.credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        columns: [{ id: "due", header: "Due" }],
        fieldIndexes: { due: 2 },
        keyColumnIndex: 0,
        rows: [{ id: "1", values: { due: "2026-09-01" } }],
      },
      renamed.runtime
    );
    assert.equal(result.created, 1);
    assert.deepEqual(result.addedHeaders, []);
    assert.deepEqual(
      writes(renamed.server.requests).map((request) => [
        kind(request),
        request.body,
      ]),
      [
        [
          "append",
          { majorDimension: "ROWS", values: [["1", null, "2026-09-01"]] },
        ],
      ]
    );

    const ambiguous = await sheetSetup({
      header: ambiguousHeader,
      columnCount: 2,
    });
    const error = await caught(() =>
      api.pushRowsToSheet(
        {
          credentials: ambiguous.credentials,
          spreadsheetId: SPREADSHEET_ID,
          sheetTitle: "Data",
          columns: [{ id: "due", header: "Due" }],
          fieldIndexes: { due: 2 },
          keyColumnIndex: 0,
          rows: [{ id: "1", values: { due: "2026-09-01" } }],
        },
        ambiguous.runtime
      )
    );
    assert.ok(isFieldMissing(error));
    assert.deepEqual(writes(ambiguous.server.requests), []);
  });

  test("Sheets: sync writes and prepare follow a renamed header; an ambiguous one is blocked", async () => {
    const mapping = {
      keyField: "Yayaw ID",
      keyFieldIndex: 0,
      fields: [{ columnId: "due", field: "Due", fieldIndex: 2, type: "date" }],
    };
    const renamed = await sheetSetup({ header: renamedHeader, columnCount: 3 });
    const target = api.createSheetSyncTarget(
      {
        credentials: renamed.credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        mapping,
      },
      renamed.runtime
    );
    assert.deepEqual(
      await target.create([{ key: "1", values: { due: "2026-09-01" } }]),
      [{ ok: true, id: "1" }]
    );
    assert.deepEqual(
      writes(renamed.server.requests).map((request) => request.body),
      [{ majorDimension: "ROWS", values: [["1", null, "2026-09-01"]] }]
    );
    const prepared = await api.prepareSheet(
      {
        credentials: renamed.credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        keyColumnIndex: 0,
        fixes: [{ kind: "create_field", field: "Due", fieldIndex: 2 }],
      },
      renamed.runtime
    );
    assert.deepEqual(prepared, { applied: [], addedHeaders: [] });

    const ambiguous = await sheetSetup({
      header: ambiguousHeader,
      columnCount: 2,
    });
    const blocked = api.createSheetSyncTarget(
      {
        credentials: ambiguous.credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        mapping,
      },
      ambiguous.runtime
    );
    assert.ok(
      isFieldMissing(
        await caught(() =>
          blocked.create([{ key: "1", values: { due: "2026-09-01" } }])
        )
      )
    );
    assert.ok(
      isFieldMissing(
        await caught(() =>
          api.prepareSheet(
            {
              credentials: ambiguous.credentials,
              spreadsheetId: SPREADSHEET_ID,
              sheetTitle: "Data",
              keyColumnIndex: 0,
              fixes: [{ kind: "create_field", field: "Due", fieldIndex: 2 }],
            },
            ambiguous.runtime
          )
        )
      )
    );
    assert.deepEqual(writes(ambiguous.server.requests), []);
  });
}
