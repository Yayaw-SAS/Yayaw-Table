import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/connectors/connector-model";
import type * as Sheets from "../src/components/ui/yayaw-table/connectors/google-sheets";
import {
  caught,
  fakeClock,
  fakeServer,
  json,
  networkFailure,
  type RecordedRequest,
} from "./connectors-fake-http";

type SheetsApi = Pick<typeof Model, "ConnectorError" | "toConnectorRows"> &
  Pick<
    typeof Sheets,
    | "columnLetter"
    | "createGoogleTokenCache"
    | "getSpreadsheet"
    | "parseServiceAccountKey"
    | "parseSpreadsheetId"
    | "planSheetHeader"
    | "planSheetUpsert"
    | "pushRowsToSheet"
    | "readHeaderRow"
    | "signServiceAccountAssertion"
    | "verifyGoogleSheetsCredentials"
  >;

const SPREADSHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EMAIL = "sync@acme-project.iam.gserviceaccount.com";
const SECRET = "Confidential cell value";
const PEM_LINE = /.{1,64}/g;
const BASE64_UNSAFE = /[+/=]/;
const BASE64_URL_DASH = /-/g;
const BASE64_URL_UNDERSCORE = /_/g;

interface TestKey {
  pem: string;
  publicKey: CryptoKey;
}

let testKey: Promise<TestKey> | undefined;

async function generateTestKey(): Promise<TestKey> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
  const der = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey)
  );
  let binary = "";
  for (const byte of der) {
    binary += String.fromCharCode(byte);
  }
  const lines = btoa(binary).match(PEM_LINE) ?? [];
  return {
    pem: `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`,
    publicKey: pair.publicKey,
  };
}

const keyFile = (pem: string, extra: Record<string, unknown> = {}) => ({
  type: "service_account",
  project_id: "acme-project",
  private_key_id: "key-1",
  private_key: pem,
  client_email: EMAIL,
  token_uri: TOKEN_URL,
  ...extra,
});

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(
    value.replace(BASE64_URL_DASH, "+").replace(BASE64_URL_UNDERSCORE, "/")
  );
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (const [index, char] of [...binary].entries()) {
    bytes[index] = char.charCodeAt(0);
  }
  return bytes;
};

const decodeJson = (value: string): Record<string, unknown> =>
  JSON.parse(new TextDecoder().decode(fromBase64Url(value)));

interface SheetState {
  columnCount: number;
  header: string[];
  keys: string[];
  onAppend?: () => Response;
  onBatchUpdate?: () => Response;
  onSpreadsheet?: () => Response;
  rowCount: number;
}

const path = (request: RecordedRequest) =>
  decodeURIComponent(request.url.pathname);

function spreadsheetResponse(state: SheetState) {
  return json({
    spreadsheetId: SPREADSHEET_ID,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`,
    properties: { title: "Pipeline" },
    sheets: [
      {
        properties: {
          sheetId: 9,
          title: "Chart",
          index: 1,
          sheetType: "OBJECT",
        },
      },
      {
        properties: {
          sheetId: 7,
          title: "Data",
          index: 0,
          sheetType: "GRID",
          gridProperties: {
            rowCount: state.rowCount,
            columnCount: state.columnCount,
          },
        },
      },
    ],
  });
}

function valuesResponse(state: SheetState, request: RecordedRequest) {
  return path(request).endsWith("!1:1")
    ? json({ values: state.header.length > 0 ? [state.header] : [] })
    : json({ values: state.keys.length > 0 ? [state.keys] : [] });
}

function sheetsRoute(state: SheetState) {
  let tokens = 0;
  return (request: RecordedRequest): Response => {
    const target = path(request);
    if (request.url.href === TOKEN_URL) {
      tokens += 1;
      return json({ access_token: `token-${tokens}`, expires_in: 3600 });
    }
    if (target.endsWith(":append")) {
      return state.onAppend?.() ?? json({});
    }
    if (target.endsWith("values:batchUpdate")) {
      return state.onBatchUpdate?.() ?? json({});
    }
    if (target.endsWith(":batchUpdate") || target.endsWith(":clear")) {
      return json({});
    }
    if (target.includes("/values/")) {
      return valuesResponse(state, request);
    }
    return state.onSpreadsheet?.() ?? spreadsheetResponse(state);
  };
}

const kind = (request: RecordedRequest): string => {
  const target = path(request);
  if (request.url.href === TOKEN_URL) {
    return "token";
  }
  for (const suffix of [":append", "values:batchUpdate", ":batchUpdate"]) {
    if (target.endsWith(suffix)) {
      return suffix.replace(":", "");
    }
  }
  if (target.endsWith(":clear")) {
    return "clear";
  }
  return target.includes("/values/") ? "read" : "spreadsheet";
};

const columns = [
  { id: "name", header: "Name" },
  { id: "amount", header: "Amount" },
  { id: "tags", header: "Tags" },
];

export function connectorsGoogleSheetsSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  api: SheetsApi
) {
  const setup = async (state: Partial<SheetState> = {}) => {
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
      key,
      sheet,
      server,
      clock,
      credentials: api.parseServiceAccountKey(JSON.stringify(keyFile(key.pem))),
      runtime: {
        fetch: server.fetch,
        now: clock.now,
        sleep: clock.sleep,
        tokenCache: api.createGoogleTokenCache(),
      },
    };
  };

  const isCode = (code: string) => (error: unknown) =>
    error instanceof api.ConnectorError && error.code === code;

  test("parses a service account key file", async () => {
    const { key } = await setup();
    const credentials = api.parseServiceAccountKey(keyFile(key.pem));
    assert.equal(credentials.clientEmail, EMAIL);
    assert.equal(credentials.privateKeyId, "key-1");
    assert.equal(credentials.tokenUri, TOKEN_URL);
    const invalid = [
      "not json",
      JSON.stringify(keyFile(key.pem, { type: "authorized_user" })),
      JSON.stringify(keyFile(key.pem, { client_email: "nobody" })),
      JSON.stringify(
        keyFile(key.pem, { token_uri: "https://attacker.example/token" })
      ),
      JSON.stringify(
        keyFile(
          "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----"
        )
      ),
    ];
    for (const input of invalid) {
      assert.throws(
        () => api.parseServiceAccountKey(input),
        isCode("invalid_credentials")
      );
    }
  });

  test("parses spreadsheet ids from URLs and refuses other characters", () => {
    assert.equal(api.parseSpreadsheetId(SPREADSHEET_ID), SPREADSHEET_ID);
    assert.equal(
      api.parseSpreadsheetId(
        ` https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=0 `
      ),
      SPREADSHEET_ID
    );
    for (const value of [
      "../../drive/v3/files",
      `${SPREADSHEET_ID}?alt=media`,
      "short",
      "https://docs.google.com/document/d/abc/edit",
    ]) {
      assert.throws(
        () => api.parseSpreadsheetId(value),
        isCode("invalid_target")
      );
    }
  });

  test("signs an RS256 assertion verifiable with the public key", async () => {
    const { credentials, key } = await setup();
    const jwt = await api.signServiceAccountAssertion(
      credentials,
      1_700_000_000
    );
    const [header = "", claims = "", signature = ""] = jwt.split(".");
    assert.deepEqual(decodeJson(header), {
      alg: "RS256",
      typ: "JWT",
      kid: "key-1",
    });
    assert.deepEqual(decodeJson(claims), {
      iss: EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: TOKEN_URL,
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    assert.equal(BASE64_UNSAFE.test(signature), false);
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key.publicKey,
      fromBase64Url(signature),
      new TextEncoder().encode(`${header}.${claims}`)
    );
    assert.equal(verified, true);
  });

  test("exchanges the assertion and caches the token until near expiry", async () => {
    const { credentials, runtime, server, clock } = await setup();
    const verified = await api.verifyGoogleSheetsCredentials(
      credentials,
      runtime
    );
    assert.equal(verified.clientEmail, EMAIL);
    const [exchange] = server.requests;
    assert.equal(exchange?.method, "POST");
    const form = new URLSearchParams(String(exchange?.body));
    assert.equal(
      form.get("grant_type"),
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    );
    assert.equal(form.get("assertion")?.split(".").length, 3);

    await api.getSpreadsheet(credentials, SPREADSHEET_ID, runtime);
    await api.getSpreadsheet(credentials, SPREADSHEET_ID, runtime);
    const tokenRequests = () =>
      server.requests.filter((request) => kind(request) === "token").length;
    assert.equal(tokenRequests(), 1);
    const reads = server.requests.filter(
      (request) => kind(request) === "spreadsheet"
    );
    assert.equal(reads[1]?.headers.Authorization, "Bearer token-1");

    clock.time += 56 * 60_000;
    await api.getSpreadsheet(credentials, SPREADSHEET_ID, runtime);
    assert.equal(tokenRequests(), 2);
  });

  test("gets a new token once when a cached one is revoked", async () => {
    const { credentials, runtime, server, sheet } = await setup();
    await api.verifyGoogleSheetsCredentials(credentials, runtime);
    let rejected = false;
    sheet.onSpreadsheet = () => {
      if (rejected) {
        return spreadsheetResponse(sheet);
      }
      rejected = true;
      return json({}, 401);
    };
    const spreadsheet = await api.getSpreadsheet(
      credentials,
      SPREADSHEET_ID,
      runtime
    );
    assert.deepEqual(
      spreadsheet.sheets.map((tab) => tab.title),
      ["Data"]
    );
    assert.equal(spreadsheet.title, "Pipeline");
    assert.deepEqual(server.requests.map(kind), [
      "token",
      "spreadsheet",
      "token",
      "spreadsheet",
    ]);
  });

  test("reports an unshared spreadsheet with the account to share it with", async () => {
    const { credentials, runtime, sheet } = await setup();
    sheet.onSpreadsheet = () =>
      json(
        { error: { code: 403, message: SECRET, status: "PERMISSION_DENIED" } },
        403
      );
    const error = await caught(() =>
      api.readHeaderRow(credentials, SPREADSHEET_ID, "Data", runtime)
    );
    assert.ok(error instanceof api.ConnectorError);
    assert.equal(error.code, "not_shared");
    assert.equal(error.details.serviceAccountEmail, EMAIL);
    assert.equal(
      `${error.message} ${JSON.stringify(error)}`.includes(SECRET),
      false
    );

    sheet.onSpreadsheet = () =>
      json(
        {
          error: { details: [{ reason: "SERVICE_DISABLED" }], message: SECRET },
        },
        403
      );
    assert.equal(
      (
        (await caught(() =>
          api.getSpreadsheet(credentials, SPREADSHEET_ID, runtime)
        )) as { code?: string }
      ).code,
      "api_disabled"
    );
  });

  test("refuses credentials Google rejects", async () => {
    const { credentials, runtime } = await setup();
    const server = fakeServer(() => json({ error: "invalid_grant" }, 400));
    const error = await caught(() =>
      api.verifyGoogleSheetsCredentials(credentials, {
        ...runtime,
        fetch: server.fetch,
      })
    );
    assert.ok(isCode("invalid_credentials")(error));
  });

  test("reads the header row without trailing empty cells", async () => {
    const { credentials, runtime, server } = await setup({
      header: [" Yayaw ID", "Name", "", ""],
    });
    assert.deepEqual(
      await api.readHeaderRow(credentials, SPREADSHEET_ID, "Data", runtime),
      ["Yayaw ID", "Name"]
    );
    const read = server.requests.find((request) => kind(request) === "read");
    assert.equal(
      path(read as RecordedRequest).endsWith("/values/'Data'!1:1"),
      true
    );
    const error = await caught(() =>
      api.readHeaderRow(credentials, SPREADSHEET_ID, "Missing", runtime)
    );
    assert.ok(isCode("invalid_target")(error));
  });

  test("plans headers without reordering the user's columns", () => {
    const plan = api.planSheetHeader(
      ["Notes", "Name", "Yayaw ID"],
      "Yayaw ID",
      columns
    );
    assert.deepEqual(plan.header, [
      "Notes",
      "Name",
      "Yayaw ID",
      "Amount",
      "Tags",
    ]);
    assert.deepEqual(plan.added, ["Amount", "Tags"]);
    assert.equal(plan.keyIndex, 2);
    assert.deepEqual(
      [...plan.indexes],
      [
        ["name", 1],
        ["amount", 3],
        ["tags", 4],
      ]
    );
    assert.deepEqual(api.planSheetHeader([], "Yayaw ID", columns).header, [
      "Yayaw ID",
      "Name",
      "Amount",
      "Tags",
    ]);
    assert.throws(
      () => api.planSheetHeader([], "Name", [{ id: "name", header: "Name" }]),
      isCode("invalid_mapping")
    );
    assert.equal(api.columnLetter(27), "AB");
  });

  test("plans updates for known keys and appends for new ones", () => {
    const plan = api.planSheetUpsert(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      ["b", "", "a", "b", 12]
    );
    assert.deepEqual(plan.updates, [
      { row: { id: "a" }, rowNumber: 4 },
      { row: { id: "b" }, rowNumber: 2 },
    ]);
    assert.deepEqual(plan.appends, [{ id: "c" }]);
    assert.equal(plan.duplicateSheetKeys, 1);
  });

  test("upserts rows: updates in place, appends new ones, extends the header", async () => {
    const { credentials, runtime, server } = await setup({
      header: ["Notes", "Yayaw ID", "Name"],
      keys: ["r1", "", "r2"],
      columnCount: 3,
    });
    const result = await api.pushRowsToSheet(
      {
        credentials,
        spreadsheetId: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`,
        sheetTitle: "Data",
        columns,
        rows: api.toConnectorRows([
          { id: "r2", name: "Beta", amount: 2, tags: ["x", "y"] },
          { id: "r1", name: "=HYPERLINK()", amount: 1.5, tags: [] },
          { id: "r3", name: "New", amount: null, tags: "z" },
        ]),
      },
      runtime
    );
    assert.deepEqual(
      [result.updated, result.created, result.failed, result.skipped],
      [2, 1, 0, 0]
    );
    assert.deepEqual(result.addedHeaders, ["Amount", "Tags"]);
    assert.deepEqual(server.requests.map(kind), [
      "token",
      "spreadsheet",
      "read",
      "batchUpdate",
      "read",
      "valuesbatchUpdate",
      "append",
    ]);
    const grow = server.requests[3]?.body as { requests: unknown[] };
    assert.deepEqual(grow.requests, [
      { appendDimension: { sheetId: 7, dimension: "COLUMNS", length: 2 } },
    ]);
    const keyRead = server.requests[4] as RecordedRequest;
    assert.equal(path(keyRead).endsWith("/values/'Data'!B2:B"), true);
    const update = server.requests[5]?.body as {
      data: { range: string; values: unknown[][] }[];
      valueInputOption: string;
    };
    assert.equal(update.valueInputOption, "RAW");
    assert.deepEqual(update.data, [
      {
        range: "'Data'!D1:E1",
        majorDimension: "ROWS",
        values: [["Amount", "Tags"]],
      },
      {
        range: "'Data'!A4:E4",
        majorDimension: "ROWS",
        values: [[null, "r2", "Beta", 2, "x, y"]],
      },
      {
        range: "'Data'!A2:E2",
        majorDimension: "ROWS",
        values: [[null, "r1", "=HYPERLINK()", 1.5, ""]],
      },
    ]);
    const append = server.requests[6] as RecordedRequest;
    assert.equal(append.url.searchParams.get("valueInputOption"), "RAW");
    assert.equal(
      append.url.searchParams.get("insertDataOption"),
      "INSERT_ROWS"
    );
    assert.deepEqual((append.body as { values: unknown[] }).values, [
      [null, "r3", "New", "", "z"],
    ]);
  });

  test("writes the header of an empty sheet before appending", async () => {
    const { credentials, runtime, server } = await setup();
    const result = await api.pushRowsToSheet(
      {
        credentials,
        spreadsheetId: SPREADSHEET_ID,
        columns,
        rows: api.toConnectorRows([{ id: "r1", name: "A", amount: 1 }]),
      },
      runtime
    );
    assert.equal(result.created, 1);
    assert.equal(result.sheetTitle, "Data");
    assert.deepEqual(server.requests.map(kind), [
      "token",
      "spreadsheet",
      "read",
      "valuesbatchUpdate",
      "append",
    ]);
    const header = server.requests[3]?.body as {
      data: { range: string; values: unknown[][] }[];
    };
    assert.deepEqual(header.data[0]?.values, [
      ["Yayaw ID", "Name", "Amount", "Tags"],
    ]);
    assert.equal(header.data[0]?.range, "'Data'!A1:D1");
  });

  test("replace clears below the header and rewrites every row", async () => {
    const { credentials, runtime, server } = await setup({
      header: ["Yayaw ID", "Name", "Amount", "Tags"],
      keys: ["old"],
      rowCount: 2,
      columnCount: 4,
    });
    const result = await api.pushRowsToSheet(
      {
        credentials,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: "Data",
        mode: "replace",
        columns,
        rows: api.toConnectorRows([
          { id: "a", name: "A" },
          { id: "b", name: "B" },
          { id: "c", name: "C" },
        ]),
      },
      runtime
    );
    assert.equal(result.created, 3);
    assert.deepEqual(server.requests.map(kind), [
      "token",
      "spreadsheet",
      "read",
      "clear",
      "batchUpdate",
      "valuesbatchUpdate",
    ]);
    assert.equal(
      path(server.requests[3] as RecordedRequest).endsWith(
        "/values/'Data'!A2:D:clear"
      ),
      true
    );
    assert.deepEqual(
      (server.requests[4]?.body as { requests: unknown[] }).requests,
      [{ appendDimension: { sheetId: 7, dimension: "ROWS", length: 2 } }]
    );
    const write = server.requests[5]?.body as {
      data: { range: string; values: unknown[][] }[];
    };
    assert.equal(write.data[0]?.range, "'Data'!A2:D4");
    assert.deepEqual(
      write.data[0]?.values.map((row) => row[0]),
      ["a", "b", "c"]
    );
  });

  test("respects maxRows and never retries an ambiguous append", async () => {
    const { credentials, runtime, server, sheet } = await setup({
      header: ["Yayaw ID", "Name", "Amount", "Tags"],
    });
    let batchAttempts = 0;
    sheet.onBatchUpdate = () => {
      batchAttempts += 1;
      return batchAttempts === 1 ? json({}, 503) : json({});
    };
    sheet.onAppend = networkFailure;
    const result = await api.pushRowsToSheet(
      {
        credentials,
        spreadsheetId: SPREADSHEET_ID,
        columns,
        maxRows: 2,
        rows: api.toConnectorRows([{ id: "a" }, { id: "b" }, { id: "c" }]),
      },
      runtime
    );
    assert.equal(result.truncated, true);
    assert.equal(result.created, 0);
    assert.equal(result.failed, 2);
    assert.deepEqual(result.failures, [
      { code: "provider_unavailable", rows: 2 },
    ]);
    assert.equal(
      server.requests.filter((request) => kind(request) === "append").length,
      1
    );
    assert.equal(batchAttempts, 0);

    sheet.keys = ["a"];
    sheet.onAppend = undefined;
    const retried = await api.pushRowsToSheet(
      {
        credentials,
        spreadsheetId: SPREADSHEET_ID,
        columns,
        rows: api.toConnectorRows([{ id: "a", name: "A" }]),
      },
      runtime
    );
    assert.equal(retried.updated, 1);
    assert.equal(batchAttempts, 2);
  });
}
