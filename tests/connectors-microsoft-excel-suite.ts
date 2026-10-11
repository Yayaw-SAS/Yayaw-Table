import assert from "node:assert/strict";
import type * as Model from "../src/components/ui/yayaw-table/connectors/connector-model";
import type * as Excel from "../src/components/ui/yayaw-table/connectors/microsoft-excel";
import type * as Engine from "../src/components/ui/yayaw-table/connectors/sync-engine";
import {
  caught,
  fakeClock,
  fakeServer,
  json,
  type RecordedRequest,
} from "./connectors-fake-http";

type ExcelApi = Pick<typeof Model, "ConnectorError" | "toConnectorRows"> &
  Pick<typeof Engine, "planSync"> &
  Pick<
    typeof Excel,
    | "columnIndex"
    | "createExcelSyncTarget"
    | "excelSerialToIso"
    | "excelShareId"
    | "excelValuesToRecords"
    | "formatExcelWorkbookId"
    | "getExcelTargetSchema"
    | "getExcelWorkbook"
    | "listExcelWorkbooks"
    | "parseExcelWorkbookId"
    | "parseRangeAddress"
    | "prepareExcelSheet"
    | "pushRowsToExcel"
    | "readExcelRows"
    | "toExcelCell"
    | "verifyMicrosoftAccount"
  >;

const DRIVE_ID = "b!AbC-12_xyz";
const ITEM_ID = "01BYE5RZ6QN3ZWBTUFOFD3GSPGOHDJD36K";
const WORKBOOK_ID = `${DRIVE_ID}/${ITEM_ID}`;
const SHEET_ID = "{00000000-0001-0000-0000-000000000000}";
const SHARE_LINK =
  "https://acme.sharepoint.com/:x:/s/sales/EVwz1nqpu_lJm2aBqE1qXTMBQ";
const RANGE_PATH = /range\(address='([^']+)'\)(\/\w+)?$/;
const ITEM_PATH = /\/items\/[^/]+$/;
const CELL = /^([A-Z]+)?(\d+)?$/;

/** An in-memory worksheet: `grid[0]` is row 1, cells as Excel holds them. */
export interface Workbook {
  /** Answers PATCH requests instead of writing (to fail them). */
  onPatch?: (request: RecordedRequest) => Response | undefined;
  grid: unknown[][];
  name?: string;
}

const path = (request: RecordedRequest) =>
  decodeURIComponent(request.url.pathname);

function cell(address: string) {
  const match = CELL.exec(address);
  const letters = match?.[1] ?? "";
  let column = 0;
  for (const letter of letters) {
    column = column * 26 + (letter.charCodeAt(0) - 64);
  }
  return { column: letters ? column - 1 : -1, row: Number(match?.[2] ?? 0) };
}

function corners(address: string) {
  const [start = "", end = start] = address.split(":");
  return { first: cell(start), last: cell(end) };
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "";

function usedAddress(grid: unknown[][]): string {
  let lastRow = 0;
  let lastColumn = 0;
  for (const [rowIndex, row] of grid.entries()) {
    for (const [columnIndex, value] of row.entries()) {
      if (!isEmpty(value)) {
        lastRow = Math.max(lastRow, rowIndex + 1);
        lastColumn = Math.max(lastColumn, columnIndex + 1);
      }
    }
  }
  if (lastRow === 0) {
    return "Data!A1";
  }
  const letter = String.fromCharCode(64 + lastColumn);
  return `Data!A1:${letter}${lastRow}`;
}

/** Excel stores text typed with a leading apostrophe as that text. */
const stored = (value: unknown) =>
  typeof value === "string" && value.startsWith("'") ? value.slice(1) : value;

function readRange(book: Workbook, address: string) {
  const { first, last } = corners(address);
  const values: unknown[][] = [];
  for (let row = first.row; row <= last.row; row += 1) {
    const cells: unknown[] = [];
    for (let column = first.column; column <= last.column; column += 1) {
      cells.push(book.grid[row - 1]?.[column] ?? "");
    }
    values.push(cells);
  }
  return values;
}

function writeRange(book: Workbook, address: string, values: unknown[][]) {
  const { first } = corners(address);
  for (const [offset, cells] of values.entries()) {
    const rowIndex = first.row - 1 + offset;
    while (book.grid.length <= rowIndex) {
      book.grid.push([]);
    }
    const row = book.grid[rowIndex] ?? [];
    for (const [columnOffset, value] of cells.entries()) {
      if (value !== null) {
        row[first.column + columnOffset] = stored(value);
      }
    }
    book.grid[rowIndex] = Array.from(row, (value) => value ?? "");
  }
}

function rangeRoute(book: Workbook, request: RecordedRequest): Response {
  const match = RANGE_PATH.exec(path(request));
  const address = match?.[1] ?? "";
  const action = match?.[2];
  if (action === "/delete") {
    const { first, last } = corners(address);
    book.grid.splice(first.row - 1, last.row - first.row + 1);
    return new Response(null, { status: 204 });
  }
  if (action === "/clear") {
    const { first, last } = corners(address);
    for (let row = first.row; row <= last.row; row += 1) {
      book.grid[row - 1] = [];
    }
    return json({});
  }
  if (request.method === "PATCH") {
    const failure = book.onPatch?.(request);
    if (failure) {
      return failure;
    }
    writeRange(book, address, (request.body as { values: unknown[][] }).values);
    return json({ address });
  }
  return json({ address, values: readRange(book, address) });
}

export function graphRoute(book: Workbook) {
  return (request: RecordedRequest): Response => {
    const target = path(request);
    if (target === "/v1.0/me") {
      return json({ id: "user-1", displayName: "Ada", mail: "ada@acme.test" });
    }
    if (target.includes("/shares/") || ITEM_PATH.test(target)) {
      return json({
        id: ITEM_ID,
        name: book.name ?? "Pipeline.xlsx",
        webUrl: SHARE_LINK,
        file: {},
        parentReference: { driveId: DRIVE_ID },
      });
    }
    if (target.endsWith("/workbook/worksheets")) {
      return json({
        value: [
          { id: "{hidden}", name: "Lists", position: 1, visibility: "Hidden" },
          { id: SHEET_ID, name: "Data", position: 0, visibility: "Visible" },
        ],
      });
    }
    if (target.endsWith("/usedRange(valuesOnly=true)")) {
      return json({ address: usedAddress(book.grid) });
    }
    return rangeRoute(book, request);
  };
}

export const writes = (requests: RecordedRequest[]) =>
  requests
    .filter((request) => request.method !== "GET")
    .map((request) => {
      const match = RANGE_PATH.exec(path(request));
      return `${request.method} ${match?.[1] ?? ""}${match?.[2] ?? ""}`;
    });

const mapping = {
  keyField: "Yayaw ID",
  fields: [
    { columnId: "name", field: "Name" },
    { columnId: "amount", field: "Amount", type: "number" },
    { columnId: "due", field: "Due", type: "date" },
  ],
};

export function connectorsMicrosoftExcelSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  api: ExcelApi
) {
  const setup = (book: Workbook) => {
    const server = fakeServer(graphRoute(book));
    const clock = fakeClock();
    return {
      server,
      runtime: { fetch: server.fetch, now: clock.now, sleep: clock.sleep },
    };
  };

  const isCode = (code: string) => (error: unknown) =>
    error instanceof api.ConnectorError && error.code === code;

  test("parses workbook ids, links and cell addresses", () => {
    assert.deepEqual(api.parseExcelWorkbookId(` ${WORKBOOK_ID} `), {
      driveId: DRIVE_ID,
      itemId: ITEM_ID,
    });
    assert.equal(
      api.formatExcelWorkbookId({ driveId: DRIVE_ID, itemId: ITEM_ID }),
      WORKBOOK_ID
    );
    for (const invalid of ["", "only-one", "a/b/c", "a/../b", "a b/c"]) {
      assert.throws(
        () => api.parseExcelWorkbookId(invalid),
        isCode("invalid_target")
      );
    }
    assert.equal(
      api.excelShareId("https://1drv.ms/x/s!AkL"),
      "u!aHR0cHM6Ly8xZHJ2Lm1zL3gvcyFBa0w"
    );
    assert.throws(
      () => api.excelShareId("http://1drv.ms/x/s!AkL"),
      isCode("invalid_target")
    );
    assert.equal(api.columnIndex("A"), 0);
    assert.equal(api.columnIndex("AA"), 26);
    assert.deepEqual(api.parseRangeAddress("'Q3 data'!B2:F40"), {
      firstColumn: 1,
      firstRow: 2,
      lastColumn: 5,
      lastRow: 40,
    });
    assert.deepEqual(api.parseRangeAddress("Data!A1"), {
      firstColumn: 0,
      firstRow: 1,
      lastColumn: 0,
      lastRow: 1,
    });
  });

  test("writes text as text: never a formula, a number or a date", () => {
    assert.deepEqual(api.toExcelCell("=HYPERLINK(1)"), {
      cell: "'=HYPERLINK(1)",
      truncated: false,
    });
    assert.equal(api.toExcelCell("0612").cell, "'0612");
    assert.equal(api.toExcelCell(12.5).cell, 12.5);
    assert.equal(api.toExcelCell(true).cell, true);
    assert.equal(api.toExcelCell(null).cell, "");
    const long = api.toExcelCell("x".repeat(40_000));
    assert.equal(long.truncated, true);
    assert.equal(String(long.cell).length, 32_768);
  });

  test("reads Excel date serials as ISO dates", () => {
    assert.equal(api.excelSerialToIso(45_000), "2023-03-15");
    assert.equal(api.excelSerialToIso(45_000.5), "2023-03-15T12:00:00.000Z");
    assert.equal(api.excelSerialToIso(Number.NaN), null);
  });

  test("opens a workbook from a sharing link and lists its worksheets", async () => {
    const { server, runtime } = setup({ grid: [] });
    const workbook = await api.getExcelWorkbook("token", SHARE_LINK, runtime);
    assert.equal(workbook.id, WORKBOOK_ID);
    assert.equal(workbook.name, "Pipeline.xlsx");
    assert.deepEqual(
      workbook.worksheets.map((sheet) => [sheet.name, sheet.visible]),
      [
        ["Data", true],
        ["Lists", false],
      ]
    );
    assert.ok(
      path(server.requests[0] as RecordedRequest).startsWith("/v1.0/shares/u!")
    );
    assert.equal(server.requests[0]?.headers.Authorization, "Bearer token");
  });

  test("refuses a file that is not an .xlsx workbook", async () => {
    const { runtime } = setup({ grid: [], name: "Notes.docx" });
    const error = await caught(() =>
      api.getExcelWorkbook("token", WORKBOOK_ID, runtime)
    );
    assert.ok(isCode("invalid_target")(error));
  });

  test("refreshes the token once after a 401", async () => {
    const calls: boolean[] = [];
    let first = true;
    const server = fakeServer((request) => {
      if (first) {
        first = false;
        return json({}, 401);
      }
      assert.equal(request.headers.Authorization, "Bearer fresh");
      return json({ id: "user-1", userPrincipalName: "ada@acme.test" });
    });
    const account = await api.verifyMicrosoftAccount(
      ({ forceRefresh }) => {
        calls.push(forceRefresh);
        return forceRefresh ? "fresh" : "stale";
      },
      { fetch: server.fetch }
    );
    assert.deepEqual(calls, [false, true]);
    assert.deepEqual(account, {
      id: "user-1",
      name: null,
      email: "ada@acme.test",
    });
  });

  test("lists workbooks across pages and never follows a foreign link", async () => {
    const page = (next?: string) =>
      json({
        value: [
          {
            id: ITEM_ID,
            name: "Pipeline.xlsx",
            parentReference: { driveId: DRIVE_ID },
          },
          {
            id: "x1",
            name: "Notes.docx",
            parentReference: { driveId: DRIVE_ID },
          },
        ],
        ...(next ? { "@odata.nextLink": next } : {}),
      });
    const pages = fakeServer((_request, index) =>
      index === 0
        ? page(
            "https://graph.microsoft.com/v1.0/me/drive/root/search?$skiptoken=2"
          )
        : page()
    );
    const workbooks = await api.listExcelWorkbooks("token", "pipe", {
      fetch: pages.fetch,
    });
    assert.equal(workbooks.length, 2);
    assert.equal(workbooks[0]?.id, WORKBOOK_ID);
    assert.ok(
      path(pages.requests[0] as RecordedRequest).includes("search(q='pipe')")
    );
    const foreign = fakeServer(() => page("https://evil.test/v1.0/steal"));
    const error = await caught(() =>
      api.listExcelWorkbooks("token", undefined, { fetch: foreign.fetch })
    );
    assert.ok(isCode("invalid_target")(error));
    assert.equal(foreign.requests.length, 1);
  });

  test("pushes into an empty worksheet: header first, then the rows", async () => {
    const book: Workbook = { grid: [] };
    const { server, runtime } = setup(book);
    const result = await api.pushRowsToExcel(
      {
        token: "token",
        workbookId: WORKBOOK_ID,
        columns: [
          { id: "name", header: "Name" },
          { id: "amount", header: "Amount" },
        ],
        rows: api.toConnectorRows([
          { id: "r1", name: "=cmd()", amount: 3 },
          { id: "r2", name: "Beta", amount: null },
        ]),
      },
      runtime
    );
    assert.equal(result.created, 2);
    assert.equal(result.sheetName, "Data");
    assert.deepEqual(result.addedHeaders, ["Yayaw ID", "Name", "Amount"]);
    assert.deepEqual(book.grid, [
      ["Yayaw ID", "Name", "Amount"],
      ["r1", "=cmd()", 3],
      ["r2", "Beta", ""],
    ]);
    assert.deepEqual(writes(server.requests), ["PATCH A1:C1", "PATCH A2:C3"]);
  });

  test("upserts: rewrites known rows in place and adds the others below", async () => {
    const book: Workbook = {
      grid: [
        ["Name", "Notes", "Yayaw ID"],
        ["Old A", "keep me", "r1"],
        ["Old B", "mine", "r2"],
        ["Mine", "user row", ""],
      ],
    };
    const { server, runtime } = setup(book);
    const result = await api.pushRowsToExcel(
      {
        token: "token",
        workbookId: WORKBOOK_ID,
        columns: [
          { id: "name", header: "Name" },
          { id: "amount", header: "Amount" },
        ],
        rows: api.toConnectorRows([
          { id: "r2", name: "New B", amount: 2 },
          { id: "r1", name: "New A", amount: 1 },
          { id: "r3", name: "C", amount: 3 },
        ]),
      },
      runtime
    );
    assert.deepEqual([result.updated, result.created], [2, 1]);
    assert.deepEqual(book.grid, [
      ["Name", "Notes", "Yayaw ID", "Amount"],
      ["New A", "keep me", "r1", 1],
      ["New B", "mine", "r2", 2],
      ["Mine", "user row", ""],
      ["C", "", "r3", 3],
    ]);
    // Consecutive updated rows go out in one write.
    assert.deepEqual(writes(server.requests), [
      "PATCH D1:D1",
      "PATCH A2:D3",
      "PATCH A5:D5",
    ]);
  });

  test("replace clears below the header and rewrites every row", async () => {
    const book: Workbook = {
      grid: [
        ["Yayaw ID", "Name"],
        ["old", "Old"],
        ["older", "Older"],
      ],
    };
    const { server, runtime } = setup(book);
    await api.pushRowsToExcel(
      {
        token: "token",
        workbookId: WORKBOOK_ID,
        mode: "replace",
        columns: [{ id: "name", header: "Name" }],
        rows: api.toConnectorRows([{ id: "n1", name: "New" }]),
      },
      runtime
    );
    assert.deepEqual(writes(server.requests), [
      "POST A2:B3/clear",
      "PATCH A2:B2",
    ]);
    assert.deepEqual(book.grid.slice(0, 2), [
      ["Yayaw ID", "Name"],
      ["n1", "New"],
    ]);
  });

  test("a failed update is reported and nothing is added after it", async () => {
    const book: Workbook = {
      grid: [
        ["Yayaw ID", "Name"],
        ["r1", "A"],
      ],
      onPatch: () => json({}, 400),
    };
    const { runtime } = setup(book);
    const result = await api.pushRowsToExcel(
      {
        token: "token",
        workbookId: WORKBOOK_ID,
        columns: [{ id: "name", header: "Name" }],
        rows: api.toConnectorRows([
          { id: "r1", name: "A2" },
          { id: "r2", name: "B" },
        ]),
      },
      runtime
    );
    assert.equal(result.failed, 2);
    assert.deepEqual(
      result.failures.map((failure) => [failure.code, failure.rows]),
      [
        ["invalid_request", 1],
        ["invalid_request", 1],
      ]
    );
  });

  test("reads a worksheet as sync records, dates from serials", async () => {
    const book: Workbook = {
      grid: [
        ["Yayaw ID", "Name", "Amount", "Due"],
        ["r1", "Alpha", 12, 45_000],
        ["", "Typed", "7", "2024-01-05"],
        [],
      ],
    };
    const { runtime } = setup(book);
    const records = await api.readExcelRows(
      { token: "token", workbookId: WORKBOOK_ID, mapping },
      runtime
    );
    assert.deepEqual(records, [
      {
        id: "r1",
        key: "r1",
        values: { name: "Alpha", amount: 12, due: "2023-03-15" },
      },
      { id: "row:3", values: { name: "Typed", amount: 7, due: "2024-01-05" } },
    ]);
  });

  test("a sync writes back, sets missing keys and deletes by key only", async () => {
    const book: Workbook = {
      grid: [
        ["Yayaw ID", "Name", "Amount"],
        ["r1", "A", 1],
        ["r2", "B", 2],
        ["r3", "C", 3],
        ["", "No key", 4],
      ],
    };
    const { server, runtime } = setup(book);
    const target = api.createExcelSyncTarget(
      { token: "token", workbookId: WORKBOOK_ID, mapping },
      runtime
    );
    const created = await target.create([
      { key: "r9", values: { name: "Z", amount: 9 } },
      { values: { name: "keyless" } },
    ]);
    assert.deepEqual(created, [
      { ok: true, id: "r9" },
      { ok: false, code: "invalid_request" },
    ]);
    const updated = await target.update([
      { id: "r1", values: { amount: 10 } },
      { id: "row:5", key: "r4", values: {} },
      { id: "gone", values: { amount: 0 } },
    ]);
    assert.deepEqual(updated, [
      { ok: true, id: "r1" },
      { ok: true, id: "r4" },
      { ok: false, code: "not_found" },
    ]);
    const deleted = await target.delete(["r3", "r2", "missing", "row:4"]);
    assert.deepEqual(deleted, [
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: false, code: "invalid_request" },
    ]);
    assert.deepEqual(book.grid, [
      ["Yayaw ID", "Name", "Amount", "Due"],
      ["r1", "A", 10],
      ["r4", "No key", 4],
      ["r9", "Z", 9],
    ]);
    // r2 and r3 are consecutive: one deletion.
    assert.deepEqual(
      writes(server.requests).filter((write) => write.endsWith("/delete")),
      ["POST 3:4/delete"]
    );
  });

  test("a two-way plan over a worksheet round trip has nothing to write", async () => {
    const book: Workbook = { grid: [] };
    const { runtime } = setup(book);
    const target = api.createExcelSyncTarget(
      { token: "token", workbookId: WORKBOOK_ID, mapping },
      runtime
    );
    const tableRecords = [
      {
        id: "r1",
        values: { name: "Alpha", amount: 1200.5, due: "2024-01-05" },
      },
    ];
    const first = api.planSync({
      direction: "two-way",
      mapping,
      tableRecords,
      targetRecords: await target.read(),
    });
    assert.equal(first.createInTarget.length, 1);
    await target.create(
      first.createInTarget.map((item) => ({
        key: item.rowId,
        values: item.values,
      }))
    );
    const second = api.planSync({
      direction: "two-way",
      mapping,
      tableRecords,
      targetRecords: await target.read(),
    });
    assert.equal(second.createInTarget.length, 0);
    assert.equal(second.updateInTarget.length, 0);
    assert.equal(second.updateInTable.length, 0);
  });

  test("prepares headers and reports the worksheet schema", async () => {
    const book: Workbook = {
      grid: [
        ["Name", "Amount"],
        ["A", 1],
      ],
    };
    const { runtime } = setup(book);
    const prepared = await api.prepareExcelSheet(
      {
        token: "token",
        workbookId: WORKBOOK_ID,
        fixes: [
          { kind: "create_field", field: "Yayaw ID", key: true },
          { kind: "create_field", field: "Amount", columnId: "amount" },
          { kind: "create_field", field: "Due", columnId: "due" },
        ],
      },
      runtime
    );
    assert.deepEqual(prepared.addedHeaders, ["Yayaw ID", "Due"]);
    const schema = await api.getExcelTargetSchema(
      { token: "token", workbookId: WORKBOOK_ID },
      runtime
    );
    assert.equal(schema.provider, "sheets");
    assert.deepEqual(
      schema.fields.map((field) => [field.name, field.type]),
      [
        ["Name", "text"],
        ["Amount", "number"],
        ["Yayaw ID", undefined],
        ["Due", undefined],
      ]
    );
    const records = api.excelValuesToRecords(book.grid, mapping);
    assert.deepEqual(records, [
      { id: "row:2", values: { name: "A", amount: 1, due: null } },
    ]);
  });
}
