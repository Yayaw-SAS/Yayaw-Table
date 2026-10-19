/**
 * Microsoft Excel connector: an `.xlsx` workbook stored in OneDrive or
 * SharePoint, read and written through the Microsoft Graph workbook API.
 *
 * The host owns the Microsoft sign-in (OAuth authorization code flow with the
 * `MICROSOFT_EXCEL_SCOPES`), stores the refresh token and hands this module an
 * access token, or a function returning one: after a 401 the function is
 * called once more with `forceRefresh: true`. The module only talks to the
 * fixed Graph origin. Provider errors are reduced to typed codes: their bodies
 * can echo cell values, so they are never read.
 *
 * A worksheet is a grid like a Google Sheets tab, so the header, upsert,
 * record and schema planning is the pure planning of `google-sheets.ts`.
 *
 * Server-only: call it from the host's server actions, routes or workers.
 */
import {
  acceptRows,
  addFailure,
  addWarning,
  type ConnectorColumn,
  ConnectorError,
  type ConnectorOptions,
  type ConnectorPushResult,
  type ConnectorRow,
  createConnectorHttp,
  createPushResult,
  DEFAULT_CONNECTOR_KEY,
  isFatalConnectorError,
  type RetryPolicy,
  safeSliceEnd,
} from "./connector-model";
import {
  columnLetter,
  planSheetHeader,
  planSheetPrepare,
  planSheetUpsert,
  resolveSheetColumns,
  type SheetColumnHints,
  type SheetHeaderPlan,
  type SheetSchemaField,
  type SheetSchemaFix,
  sheetTargetSchema,
  sheetValuesToRecords,
  toSheetCell,
} from "./google-sheets";
import {
  SHEET_ROW_ID_PREFIX,
  type SyncItemResult,
  type SyncMapping,
  type SyncRecord,
  type SyncSideAdapter,
  type SyncWrite,
} from "./sync-engine";

export const MICROSOFT_GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0";
/**
 * Delegated scopes the host asks for when the user signs in with Microsoft:
 * `Files.ReadWrite.All` reaches the workbooks the user can open in OneDrive
 * and SharePoint, `offline_access` returns a refresh token.
 */
export const MICROSOFT_EXCEL_SCOPES = [
  "offline_access",
  "User.Read",
  "Files.ReadWrite.All",
] as const;
export const DEFAULT_EXCEL_KEY_COLUMN = DEFAULT_CONNECTOR_KEY;
/** Default row limit of one push. */
export const DEFAULT_EXCEL_MAX_ROWS = 10_000;
/** Excel refuses more than 32,767 characters in one cell. */
export const MAX_EXCEL_CELL_LENGTH = 32_767;

const GRAPH_ORIGIN = "https://graph.microsoft.com";
const GRAPH_PATH_PREFIX = "/v1.0/";
const GRAPH_MIN_INTERVAL_MS = 200;
const GRAPH_MAX_RETRIES = 5;
// Graph throttles per user and per workbook; without Retry-After, wait long
// enough for the window to move (2, 4, 8, 16, 30 seconds).
const RATE_LIMIT_BASE_MS = 2000;
// One write request stays far below Graph's 4 MB request limit.
const MAX_CELLS_PER_WRITE = 10_000;
const MAX_ROWS_PER_WRITE = 1000;
const FIRST_DATA_ROW = 2;
const MAX_LISTED_WORKBOOKS = 1000;
const SCHEMA_SAMPLE_ROWS = 20;
const MILLISECONDS_PER_DAY = 86_400_000;
// Day 0 of Excel's 1900 date system, after its 1900 leap year bug.
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const EXCEL_EXTENSION = /\.xlsx$/i;
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const GRAPH_ID = /^[A-Za-z0-9!_.-]{1,512}$/;
const WORKSHEET_ID = /^[^/\\?#]{1,256}$/;
const HTTPS_URL = /^https:\/\//i;
const CELL_ADDRESS = /^\$?([A-Z]{1,3})\$?(\d{1,7})$/;
const ALPHABET_SIZE = 26;
const LETTER_OFFSET = 64; // "A" is 1
const BASE64_PLUS = /\+/g;
const BASE64_SLASH = /\//g;
const BASE64_PADDING = /[=]+$/;

// Credentials ------------------------------------------------------------------

/**
 * Returns a Microsoft Graph access token. `forceRefresh` is true after Graph
 * refused the previous one: the host refreshes it with its refresh token.
 */
export type MicrosoftAccessTokenProvider = (request: {
  forceRefresh: boolean;
}) => string | Promise<string>;

/** An access token, or a function the host refreshes it with. */
export type MicrosoftGraphToken = string | MicrosoftAccessTokenProvider;

export type MicrosoftExcelOptions = ConnectorOptions;

// Client -------------------------------------------------------------------------

interface GraphRequest {
  body?: unknown;
  method: "GET" | "PATCH" | "POST";
  /** A path under the Graph base URL, or an absolute `@odata.nextLink`. */
  path: string;
  query?: Record<string, string>;
  retry?: RetryPolicy;
}

interface GraphClient {
  request<T>(request: GraphRequest): Promise<T>;
}

function graphUrl(request: GraphRequest): string {
  const target = new URL(
    HTTPS_URL.test(request.path)
      ? request.path
      : `${MICROSOFT_GRAPH_API_BASE_URL}${request.path}`
  );
  for (const [name, value] of Object.entries(request.query ?? {})) {
    target.searchParams.set(name, value);
  }
  // Every id and address is validated or encoded before it reaches the path;
  // this keeps a mistake (or a foreign next link) from ever leaving Graph.
  if (
    target.origin !== GRAPH_ORIGIN ||
    !target.pathname.startsWith(GRAPH_PATH_PREFIX)
  ) {
    throw new ConnectorError("invalid_target");
  }
  return target.toString();
}

async function tokenOf(
  token: MicrosoftGraphToken,
  forceRefresh: boolean
): Promise<string> {
  const value =
    typeof token === "string" ? token : await token({ forceRefresh });
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConnectorError("invalid_credentials");
  }
  return value;
}

function createGraphClient(
  token: MicrosoftGraphToken,
  options: MicrosoftExcelOptions = {}
): GraphClient {
  const http = createConnectorHttp(
    {
      maxRetries: GRAPH_MAX_RETRIES,
      minIntervalMs: GRAPH_MIN_INTERVAL_MS,
      rateLimitBaseMs: RATE_LIMIT_BASE_MS,
    },
    options
  );

  const send = <T>(request: GraphRequest, accessToken: string) =>
    http.request<T>({
      url: graphUrl(request),
      method: request.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      retry: request.retry,
    });

  async function request<T>(request: GraphRequest): Promise<T> {
    try {
      return await send<T>(request, await tokenOf(token, false));
    } catch (error) {
      const expired =
        error instanceof ConnectorError && error.code === "unauthorized";
      if (!expired || typeof token === "string") {
        throw error;
      }
    }
    // An access token can expire between two calls: refresh it once.
    return await send<T>(request, await tokenOf(token, true));
  }

  return { request };
}

// Addressing ---------------------------------------------------------------------

/** Where a workbook lives: its drive and its drive item. */
export interface ExcelWorkbookRef {
  driveId: string;
  itemId: string;
}

/** The single-string form of a workbook reference, `<driveId>/<itemId>`. */
export function formatExcelWorkbookId(ref: ExcelWorkbookRef): string {
  return `${ref.driveId}/${ref.itemId}`;
}

/**
 * The drive and item of a `<driveId>/<itemId>` workbook id. Throws
 * `invalid_target` unless both only use Graph's id characters. Sharing URLs
 * are resolved by `getExcelWorkbook`.
 */
export function parseExcelWorkbookId(workbookId: string): ExcelWorkbookRef {
  const [driveId = "", itemId = "", ...rest] = workbookId.trim().split("/");
  if (rest.length > 0 || !GRAPH_ID.test(driveId) || !GRAPH_ID.test(itemId)) {
    throw new ConnectorError("invalid_target");
  }
  return { driveId, itemId };
}

function base64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(BASE64_PLUS, "-")
    .replace(BASE64_SLASH, "_")
    .replace(BASE64_PADDING, "");
}

/** The Graph share id of a OneDrive or SharePoint link (`u!<base64url>`). */
export function excelShareId(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new ConnectorError("invalid_target");
  }
  if (parsed.protocol !== "https:") {
    throw new ConnectorError("invalid_target");
  }
  return `u!${base64Url(parsed.toString())}`;
}

/** `A` is 0, `B` is 1, … `AA` is 26. */
export function columnIndex(letters: string): number {
  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * ALPHABET_SIZE + (letter.charCodeAt(0) - LETTER_OFFSET);
  }
  return index - 1;
}

/** A cell reference (`B7`) as a zero-based column and a one-based row. */
function parseCell(cell: string): { column: number; row: number } | null {
  const match = CELL_ADDRESS.exec(cell.trim().toUpperCase());
  if (!match) {
    return null;
  }
  return { column: columnIndex(match[1] ?? "A"), row: Number(match[2]) };
}

/** The corners of a range address (`'Q3 data'!B2:F40`, `Data!A1`). */
export function parseRangeAddress(address: string): {
  firstColumn: number;
  firstRow: number;
  lastColumn: number;
  lastRow: number;
} | null {
  const local = address.slice(address.lastIndexOf("!") + 1);
  const [start = "", end = start] = local.split(":");
  const first = parseCell(start);
  const last = parseCell(end);
  if (!(first && last)) {
    return null;
  }
  return {
    firstColumn: first.column,
    firstRow: first.row,
    lastColumn: last.column,
    lastRow: last.row,
  };
}

const workbookPath = (ref: ExcelWorkbookRef) =>
  `/drives/${encodeURIComponent(ref.driveId)}/items/${encodeURIComponent(ref.itemId)}/workbook`;

const worksheetPath = (ref: ExcelWorkbookRef, worksheetId: string) => {
  if (!WORKSHEET_ID.test(worksheetId)) {
    throw new ConnectorError("invalid_target");
  }
  return `${workbookPath(ref)}/worksheets/${encodeURIComponent(worksheetId)}`;
};

// Verification and discovery -----------------------------------------------------

export interface MicrosoftAccount {
  email: string | null;
  id: string;
  name: string | null;
}

const stringOr = <T>(value: unknown, fallback: T): string | T =>
  typeof value === "string" && value !== "" ? value : fallback;

/** Proves the token works and returns the signed-in Microsoft account. */
export async function verifyMicrosoftAccount(
  token: MicrosoftGraphToken,
  options?: MicrosoftExcelOptions
): Promise<MicrosoftAccount> {
  const me = await createGraphClient(token, options).request<{
    displayName?: unknown;
    id?: unknown;
    mail?: unknown;
    userPrincipalName?: unknown;
  }>({
    method: "GET",
    path: "/me",
    query: { $select: "id,displayName,mail,userPrincipalName" },
  });
  if (typeof me.id !== "string") {
    throw new ConnectorError("provider_unavailable");
  }
  return {
    id: me.id,
    name: stringOr(me.displayName, null),
    email: stringOr(me.mail, stringOr(me.userPrincipalName, null)),
  };
}

export interface ExcelWorksheet {
  id: string;
  name: string;
  position: number;
  visible: boolean;
}

export interface ExcelWorkbook extends ExcelWorkbookRef {
  /** `<driveId>/<itemId>`, the id to store and pass back. */
  id: string;
  name: string;
  url: string | null;
  worksheets: ExcelWorksheet[];
}

export interface ExcelWorkbookSummary extends ExcelWorkbookRef {
  id: string;
  modifiedAt: string | null;
  name: string;
  url: string | null;
}

interface DriveItemResponse {
  file?: { mimeType?: unknown };
  id?: unknown;
  lastModifiedDateTime?: unknown;
  name?: unknown;
  parentReference?: { driveId?: unknown };
  webUrl?: unknown;
}

const DRIVE_ITEM_FIELDS =
  "id,name,webUrl,file,parentReference,lastModifiedDateTime";

/** A drive item that is an `.xlsx` workbook, or null. */
function workbookSummary(item: DriveItemResponse): ExcelWorkbookSummary | null {
  const driveId = item.parentReference?.driveId;
  const isWorkbook =
    typeof item.name === "string" &&
    (EXCEL_EXTENSION.test(item.name) ||
      item.file?.mimeType === EXCEL_MIME_TYPE);
  if (
    !isWorkbook ||
    typeof item.id !== "string" ||
    typeof driveId !== "string" ||
    !GRAPH_ID.test(item.id) ||
    !GRAPH_ID.test(driveId)
  ) {
    return null;
  }
  return {
    driveId,
    itemId: item.id,
    id: formatExcelWorkbookId({ driveId, itemId: item.id }),
    name: String(item.name),
    url: stringOr(item.webUrl, null),
    modifiedAt: stringOr(item.lastModifiedDateTime, null),
  };
}

/**
 * The `.xlsx` workbooks of the signed-in user's OneDrive whose name matches
 * `query` (all of them by default), following pagination up to 1,000.
 * Workbooks of a SharePoint site are opened by their link instead.
 */
export async function listExcelWorkbooks(
  token: MicrosoftGraphToken,
  query = ".xlsx",
  options?: MicrosoftExcelOptions
): Promise<ExcelWorkbookSummary[]> {
  const client = createGraphClient(token, options);
  const text = query.trim() || ".xlsx";
  const workbooks: ExcelWorkbookSummary[] = [];
  let next: GraphRequest | null = {
    method: "GET",
    path: `/me/drive/root/search(q='${encodeURIComponent(text.replaceAll("'", "''"))}')`,
    query: { $select: DRIVE_ITEM_FIELDS, $top: "200" },
  };
  while (next && workbooks.length < MAX_LISTED_WORKBOOKS) {
    // Pages are sequential: each one names the next.
    const page: { "@odata.nextLink"?: unknown; value?: DriveItemResponse[] } =
      await client.request(next);
    for (const item of page.value ?? []) {
      const summary = workbookSummary(item);
      if (summary) {
        workbooks.push(summary);
      }
    }
    const link = page["@odata.nextLink"];
    next = typeof link === "string" ? { method: "GET", path: link } : null;
  }
  return workbooks.slice(0, MAX_LISTED_WORKBOOKS);
}

/** The drive item of a workbook id, or of a sharing link through `/shares`. */
function driveItemPath(workbook: string): string {
  if (HTTPS_URL.test(workbook.trim())) {
    return `/shares/${excelShareId(workbook)}/driveItem`;
  }
  const ref = parseExcelWorkbookId(workbook);
  return `/drives/${encodeURIComponent(ref.driveId)}/items/${encodeURIComponent(ref.itemId)}`;
}

async function readWorkbook(
  client: GraphClient,
  workbook: string
): Promise<ExcelWorkbook> {
  const summary = workbookSummary(
    await client.request<DriveItemResponse>({
      method: "GET",
      path: driveItemPath(workbook),
      query: { $select: DRIVE_ITEM_FIELDS },
    })
  );
  if (!summary) {
    throw new ConnectorError("invalid_target");
  }
  const response = await client.request<{
    value?: {
      id?: unknown;
      name?: unknown;
      position?: unknown;
      visibility?: unknown;
    }[];
  }>({
    method: "GET",
    path: `${workbookPath(summary)}/worksheets`,
    query: { $select: "id,name,position,visibility" },
  });
  const worksheets = (response.value ?? []).flatMap((sheet, index) =>
    typeof sheet.id === "string" && typeof sheet.name === "string"
      ? [
          {
            id: sheet.id,
            name: sheet.name,
            position:
              typeof sheet.position === "number" ? sheet.position : index,
            visible:
              sheet.visibility === undefined || sheet.visibility === "Visible",
          },
        ]
      : []
  );
  return {
    ...summary,
    worksheets: worksheets.sort(
      (left, right) => left.position - right.position
    ),
  };
}

/**
 * A workbook's name and worksheets, from a `<driveId>/<itemId>` id or a
 * OneDrive or SharePoint link to the file. Throws `invalid_target` for a file
 * that is not an `.xlsx` workbook.
 */
export async function getExcelWorkbook(
  token: MicrosoftGraphToken,
  workbook: string,
  options?: MicrosoftExcelOptions
): Promise<ExcelWorkbook> {
  return await readWorkbook(createGraphClient(token, options), workbook);
}

function requireWorksheet(
  workbook: ExcelWorkbook,
  sheetName: string | undefined
): ExcelWorksheet {
  const sheet =
    sheetName === undefined
      ? (workbook.worksheets.find((item) => item.visible) ??
        workbook.worksheets[0])
      : workbook.worksheets.find((item) => item.name === sheetName);
  if (!sheet) {
    throw new ConnectorError("invalid_target");
  }
  return sheet;
}

// Cells ----------------------------------------------------------------------------

export type ExcelCell = string | number | boolean | null;

/**
 * A table value as an Excel cell: numbers and booleans stay typed, other
 * values become text of at most 32,767 characters. Excel reads written text
 * the way it reads typing, so non-empty text gets a leading apostrophe (the
 * quote prefix): it is stored as text and never turned into a formula, a
 * number or a date.
 */
export function toExcelCell(value: unknown): {
  cell: Exclude<ExcelCell, null>;
  truncated: boolean;
} {
  const { cell } = toSheetCell(value);
  if (typeof cell !== "string" || cell === "") {
    return { cell, truncated: false };
  }
  if (cell.length <= MAX_EXCEL_CELL_LENGTH) {
    return { cell: `'${cell}`, truncated: false };
  }
  return {
    cell: `'${cell.slice(0, safeSliceEnd(cell, 0, MAX_EXCEL_CELL_LENGTH))}`,
    truncated: true,
  };
}

/**
 * An Excel date serial (days since 1899-12-30) as ISO text: date-only for a
 * whole day, UTC time otherwise (Excel times carry no zone).
 */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) {
    return null;
  }
  const iso = new Date(
    EXCEL_EPOCH_MS + serial * MILLISECONDS_PER_DAY
  ).toISOString();
  return Number.isInteger(serial) ? iso.slice(0, "YYYY-MM-DD".length) : iso;
}

const cellText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

// Worksheet context ------------------------------------------------------------------

interface SheetContext {
  client: GraphClient;
  ref: ExcelWorkbookRef;
  sheet: ExcelWorksheet;
  sheetPath: string;
}

interface UsedRange {
  /** One-based last row holding a value, 0 for an empty worksheet. */
  lastRow: number;
  /** Width of the used area from column A, 0 for an empty worksheet. */
  width: number;
}

async function openSheet(
  client: GraphClient,
  input: { sheetName?: string; workbookId: string }
): Promise<SheetContext> {
  const workbook = await readWorkbook(client, input.workbookId);
  const sheet = requireWorksheet(workbook, input.sheetName);
  return {
    client,
    ref: workbook,
    sheet,
    sheetPath: worksheetPath(workbook, sheet.id),
  };
}

const rangePath = (context: SheetContext, address: string) =>
  `${context.sheetPath}/range(address='${address}')`;

async function readUsedRange(context: SheetContext): Promise<UsedRange> {
  const response = await context.client.request<{ address?: unknown }>({
    method: "GET",
    path: `${context.sheetPath}/usedRange(valuesOnly=true)`,
    query: { $select: "address" },
  });
  const corners =
    typeof response.address === "string"
      ? parseRangeAddress(response.address)
      : null;
  if (!corners) {
    return { lastRow: 0, width: 0 };
  }
  return { lastRow: corners.lastRow, width: corners.lastColumn + 1 };
}

async function readValues(
  context: SheetContext,
  address: string
): Promise<unknown[][]> {
  const response = await context.client.request<{ values?: unknown[][] }>({
    method: "GET",
    path: rangePath(context, address),
    query: { $select: "values" },
  });
  return response.values ?? [];
}

async function readHeader(
  context: SheetContext,
  used: UsedRange
): Promise<string[]> {
  if (used.width === 0) {
    return [];
  }
  const values = await readValues(
    context,
    `A1:${columnLetter(used.width - 1)}1`
  );
  const header = (values[0] ?? []).map(cellText);
  while (header.length > 0 && header.at(-1) === "") {
    header.pop();
  }
  return header;
}

async function readKeyColumn(
  context: SheetContext,
  keyIndex: number,
  used: UsedRange
): Promise<unknown[]> {
  if (used.lastRow < FIRST_DATA_ROW) {
    return [];
  }
  const letter = columnLetter(keyIndex);
  const values = await readValues(
    context,
    `${letter}${FIRST_DATA_ROW}:${letter}${used.lastRow}`
  );
  return values.map((row) => row[0] ?? null);
}

/** Every value from A1 to the end of the used area, typed as Excel holds it. */
async function readGrid(context: SheetContext): Promise<unknown[][]> {
  const used = await readUsedRange(context);
  if (used.width === 0) {
    return [];
  }
  return await readValues(
    context,
    `A1:${columnLetter(used.width - 1)}${used.lastRow}`
  );
}

/** Writes a block of rows at a fixed address: safe to retry. */
async function writeBlock(
  context: SheetContext,
  firstRow: number,
  values: ExcelCell[][]
) {
  const width = values[0]?.length ?? 0;
  if (values.length === 0 || width === 0) {
    return;
  }
  const lastRow = firstRow + values.length - 1;
  await context.client.request({
    method: "PATCH",
    path: rangePath(
      context,
      `A${firstRow}:${columnLetter(width - 1)}${lastRow}`
    ),
    body: { values },
  });
}

async function writeHeader(context: SheetContext, plan: SheetHeaderPlan) {
  if (plan.added.length === 0) {
    return;
  }
  const first = plan.header.length - plan.added.length;
  await context.client.request({
    method: "PATCH",
    path: rangePath(
      context,
      `${columnLetter(first)}1:${columnLetter(plan.header.length - 1)}1`
    ),
    body: { values: [plan.added.map((name) => toExcelCell(name).cell)] },
  });
}

const chunkSize = (width: number) =>
  Math.max(
    1,
    Math.min(MAX_ROWS_PER_WRITE, Math.floor(MAX_CELLS_PER_WRITE / width))
  );

function chunks<T>(items: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

/**
 * Groups rows by consecutive row numbers, each group at most `size` rows, so
 * every group is one rectangular write.
 */
function consecutiveRuns<T extends { rowNumber: number }>(
  items: readonly T[],
  size: number
): T[][] {
  const sorted = [...items].sort(
    (left, right) => left.rowNumber - right.rowNumber
  );
  const runs: T[][] = [];
  let run: T[] = [];
  for (const item of sorted) {
    const previous = run.at(-1);
    const continues =
      previous !== undefined &&
      item.rowNumber === previous.rowNumber + 1 &&
      run.length < size;
    if (!continues && run.length > 0) {
      runs.push(run);
      run = [];
    }
    run.push(item);
  }
  if (run.length > 0) {
    runs.push(run);
  }
  return runs;
}

// Push ---------------------------------------------------------------------------

export type ExcelPushMode = "replace" | "upsert";

export interface ExcelPushInput {
  /** Columns in the order new headers are added. */
  columns: readonly ConnectorColumn[];
  /**
   * Saved header positions by column id (the mapping's `fieldIndex`): a
   * header renamed in the worksheet keeps receiving its column.
   */
  fieldIndexes?: Readonly<Record<string, number>>;
  /** Header of the column holding row ids, "ID" by default. */
  keyColumn?: string;
  /** Saved position of the key column (`keyFieldIndex`). */
  keyColumnIndex?: number;
  /** Rows written at most; the others mark the result as truncated. */
  maxRows?: number;
  /**
   * `upsert` (default) updates rows whose id is in the worksheet and adds the
   * others below the last used row; `replace` clears everything below the
   * header and writes again.
   */
  mode?: ExcelPushMode;
  rows: readonly ConnectorRow[];
  /** Worksheet name; the first visible worksheet by default. */
  sheetName?: string;
  token: MicrosoftGraphToken;
  /** `<driveId>/<itemId>` or a OneDrive or SharePoint link to the file. */
  workbookId: string;
}

export interface ExcelPushResult extends ConnectorPushResult {
  /** Headers added at the end of the header row. */
  addedHeaders: string[];
  sheetName: string;
  workbookId: string;
}

/**
 * Cells for one row across the whole header. Columns that are not pushed
 * stay `null`, which Excel leaves untouched, so the user's own columns keep
 * their values on update.
 */
function rowCells(
  plan: SheetHeaderPlan,
  row: ConnectorRow,
  result: ConnectorPushResult
): ExcelCell[] {
  const cells = Array.from(
    { length: plan.header.length },
    (): ExcelCell => null
  );
  cells[plan.keyIndex] = toExcelCell(row.id).cell;
  for (const [columnId, index] of plan.indexes) {
    const { cell, truncated } = toExcelCell(row.values[columnId]);
    cells[index] = cell;
    if (truncated) {
      addWarning(result, {
        rowId: row.id,
        columnId,
        reason: "value_truncated",
      });
    }
  }
  return cells;
}

interface WriteStep {
  rows: number;
  run: () => Promise<unknown>;
}

/**
 * Runs writes in order. A failure that would repeat for every write stops the
 * push with its error; another one records the rows left unwritten.
 */
async function writeInOrder(
  steps: readonly WriteStep[],
  result: ConnectorPushResult,
  onWritten: (rows: number) => void
): Promise<boolean> {
  for (const [index, step] of steps.entries()) {
    try {
      // Writes are ordered: Graph serializes writes to one workbook anyway.
      await step.run();
      onWritten(step.rows);
    } catch (error) {
      if (
        !(error instanceof ConnectorError) ||
        isFatalConnectorError(error.code)
      ) {
        throw error;
      }
      const rows = steps
        .slice(index)
        .reduce((total, remaining) => total + remaining.rows, 0);
      addFailure(result, { code: error.code, rows });
      return false;
    }
  }
  return true;
}

function appendSteps(
  context: SheetContext,
  plan: SheetHeaderPlan,
  rows: readonly ConnectorRow[],
  firstRow: number,
  result: ConnectorPushResult
): WriteStep[] {
  let nextRow = firstRow;
  return chunks(rows, chunkSize(plan.header.length)).map((chunk) => {
    const start = nextRow;
    nextRow += chunk.length;
    return {
      rows: chunk.length,
      run: () =>
        writeBlock(
          context,
          start,
          chunk.map((row) => rowCells(plan, row, result))
        ),
    };
  });
}

async function upsertRows(
  context: SheetContext,
  plan: SheetHeaderPlan,
  used: UsedRange,
  rows: readonly ConnectorRow[],
  result: ConnectorPushResult
) {
  // A key column added by this push has no keys to read yet.
  const keyAdded = plan.added.includes(plan.header[plan.keyIndex] ?? "");
  const sheetKeys = keyAdded
    ? []
    : await readKeyColumn(context, plan.keyIndex, used);
  const upsert = planSheetUpsert(rows, sheetKeys);
  if (upsert.duplicateSheetKeys > 0) {
    addWarning(result, { reason: "duplicate_target_key" });
  }
  const updateSteps: WriteStep[] = consecutiveRuns(
    upsert.updates,
    chunkSize(plan.header.length)
  ).map((run) => ({
    rows: run.length,
    run: () =>
      writeBlock(
        context,
        run[0]?.rowNumber ?? FIRST_DATA_ROW,
        run.map(({ row }) => rowCells(plan, row, result))
      ),
  }));
  const updated = await writeInOrder(updateSteps, result, (count) => {
    result.updated += count;
  });
  if (!updated) {
    if (upsert.appends.length > 0) {
      // Adding rows after a failed update could misplace them; report them.
      addFailure(result, {
        code: result.failures.at(-1)?.code ?? "provider_unavailable",
        rows: upsert.appends.length,
      });
    }
    return;
  }
  const firstFree = Math.max(used.lastRow, 1) + 1;
  await writeInOrder(
    appendSteps(context, plan, upsert.appends, firstFree, result),
    result,
    (count) => {
      result.created += count;
    }
  );
}

async function replaceRows(
  context: SheetContext,
  plan: SheetHeaderPlan,
  used: UsedRange,
  rows: readonly ConnectorRow[],
  result: ConnectorPushResult
) {
  if (used.lastRow >= FIRST_DATA_ROW) {
    const width = Math.max(plan.header.length, used.width);
    await context.client.request({
      method: "POST",
      path: `${rangePath(
        context,
        `A${FIRST_DATA_ROW}:${columnLetter(width - 1)}${used.lastRow}`
      )}/clear`,
      body: { applyTo: "Contents" },
    });
  }
  await writeInOrder(
    appendSteps(context, plan, rows, FIRST_DATA_ROW, result),
    result,
    (count) => {
      result.created += count;
    }
  );
}

/**
 * Writes rows to one worksheet of a workbook, keyed by `keyColumn` ("Yayaw
 * ID" by default). The header row is written when empty; missing headers are
 * added at its end and the user's columns are never reordered. `upsert` reads
 * the key column once, rewrites matching rows in place (consecutive rows in
 * one request) and writes the others below the last used row; `replace`
 * clears everything below the header and writes the rows again. Every write
 * goes to a fixed address, so a retried write never lands twice.
 *
 * Throws a `ConnectorError` when nothing can be written; a failure midway is
 * recorded in `failures`.
 */
export async function pushRowsToExcel(
  input: ExcelPushInput,
  options?: MicrosoftExcelOptions
): Promise<ExcelPushResult> {
  const context = await openSheet(
    createGraphClient(input.token, options),
    input
  );
  const used = await readUsedRange(context);
  const plan = planSheetHeader(
    await readHeader(context, used),
    (input.keyColumn ?? DEFAULT_EXCEL_KEY_COLUMN).trim(),
    input.columns,
    { indexes: input.fieldIndexes, keyIndex: input.keyColumnIndex }
  );
  const result: ExcelPushResult = {
    ...createPushResult(),
    addedHeaders: plan.added,
    sheetName: context.sheet.name,
    workbookId: formatExcelWorkbookId(context.ref),
  };
  const rows = acceptRows(
    input.rows,
    { maxRows: input.maxRows ?? DEFAULT_EXCEL_MAX_ROWS },
    result
  );
  await writeHeader(context, plan);
  if (input.mode === "replace") {
    await replaceRows(context, plan, used, rows, result);
  } else {
    await upsertRows(context, plan, used, rows, result);
  }
  return result;
}

// Read and sync ------------------------------------------------------------------

export interface ExcelSyncInput {
  /** Mapped columns (headers and column types) and the key column. */
  mapping: SyncMapping;
  /** Worksheet name; the first visible worksheet by default. */
  sheetName?: string;
  token: MicrosoftGraphToken;
  /** `<driveId>/<itemId>` or a OneDrive or SharePoint link to the file. */
  workbookId: string;
}

const keyColumnOf = (mapping: SyncMapping) =>
  (mapping.keyField ?? DEFAULT_EXCEL_KEY_COLUMN).trim();

const sheetHintsOf = (mapping: SyncMapping): SheetColumnHints => ({
  indexes: Object.fromEntries(
    mapping.fields.flatMap((field) =>
      field.fieldIndex === undefined ? [] : [[field.columnId, field.fieldIndex]]
    )
  ),
  keyIndex: mapping.keyFieldIndex,
});

const DATE_COLUMN_TYPES = new Set(["date", "datetime"]);

/**
 * Sync records from the values of a worksheet, header row first (see
 * `sheetValuesToRecords`). Excel holds dates as day serials: a number in a
 * date column is read as a date, never as epoch milliseconds.
 */
export function excelValuesToRecords(
  grid: readonly (readonly unknown[] | undefined)[],
  mapping: SyncMapping
): SyncRecord[] {
  const header = (grid[0] ?? []).map(cellText);
  const { indexes } = resolveSheetColumns(
    header,
    keyColumnOf(mapping),
    mapping.fields.map((field) => ({
      id: field.columnId,
      header: field.field,
    })),
    sheetHintsOf(mapping)
  );
  const dateIndexes = new Set(
    mapping.fields.flatMap((field) => {
      const index = indexes.get(field.columnId);
      return index !== undefined && DATE_COLUMN_TYPES.has(field.type ?? "")
        ? [index]
        : [];
    })
  );
  const converted =
    dateIndexes.size === 0
      ? grid
      : grid.map((row, rowIndex) =>
          rowIndex === 0 || !row
            ? row
            : row.map((cell, index) =>
                typeof cell === "number" && dateIndexes.has(index)
                  ? excelSerialToIso(cell)
                  : cell
              )
        );
  return sheetValuesToRecords(converted, mapping);
}

/**
 * Reads a worksheet as sync records (see `excelValuesToRecords`). Graph has
 * no per-row edit time, so records have no `updatedAt`.
 */
export async function readExcelRows(
  input: ExcelSyncInput,
  options?: MicrosoftExcelOptions
): Promise<SyncRecord[]> {
  const context = await openSheet(
    createGraphClient(input.token, options),
    input
  );
  return excelValuesToRecords(await readGrid(context), input.mapping);
}

interface SheetWrite {
  context: SheetContext;
  plan: SheetHeaderPlan;
  used: UsedRange;
}

/** Opens the worksheet and adds missing headers first. */
async function prepareSheetWrite(
  client: GraphClient,
  input: ExcelSyncInput
): Promise<SheetWrite> {
  const context = await openSheet(client, input);
  const used = await readUsedRange(context);
  // A renamed header is written in place; an ambiguous one stops before any write.
  const plan = planSheetHeader(
    await readHeader(context, used),
    keyColumnOf(input.mapping),
    input.mapping.fields.map((field) => ({
      id: field.columnId,
      header: field.field,
    })),
    sheetHintsOf(input.mapping)
  );
  await writeHeader(context, plan);
  return { context, plan, used };
}

/**
 * Cells of one sync write across the whole header: the key and the columns
 * in `values`; the others stay `null`, which Excel leaves untouched.
 */
function syncCells(plan: SheetHeaderPlan, item: SyncWrite): ExcelCell[] {
  const cells = Array.from(
    { length: plan.header.length },
    (): ExcelCell => null
  );
  if (item.key !== undefined) {
    cells[plan.keyIndex] = toExcelCell(item.key).cell;
  }
  for (const [columnId, index] of plan.indexes) {
    if (Object.hasOwn(item.values, columnId)) {
      cells[index] = toExcelCell(item.values[columnId]).cell;
    }
  }
  return cells;
}

type RowLocator = (id: string) => number | undefined;

/**
 * Finds a row by its key, or by `row:<number>` while that row still has no
 * key and is inside the used area.
 */
function rowLocator(keys: readonly unknown[], lastRow: number): RowLocator {
  const byKey = new Map<string, number>();
  for (const [index, value] of keys.entries()) {
    const key = cellText(value);
    if (key && !byKey.has(key)) {
      byKey.set(key, index + FIRST_DATA_ROW);
    }
  }
  return (id) => {
    const found = byKey.get(id);
    if (found !== undefined || !id.startsWith(SHEET_ROW_ID_PREFIX)) {
      return found;
    }
    const row = Number(id.slice(SHEET_ROW_ID_PREFIX.length));
    const valid =
      Number.isInteger(row) &&
      row >= FIRST_DATA_ROW &&
      row <= lastRow &&
      cellText(keys[row - FIRST_DATA_ROW]) === "";
    return valid ? row : undefined;
  };
}

async function readRowLocator(write: SheetWrite): Promise<RowLocator> {
  const { context, plan, used } = write;
  const keyAdded = plan.added.includes(plan.header[plan.keyIndex] ?? "");
  const keys = keyAdded
    ? []
    : await readKeyColumn(context, plan.keyIndex, used);
  return rowLocator(keys, used.lastRow);
}

const failedResults = (count: number): SyncItemResult[] =>
  Array.from({ length: count }, () => ({ ok: false, code: "failed" }) as const);

interface PendingRow {
  cells: ExcelCell[];
  id?: string;
  index: number;
  rowNumber: number;
}

/**
 * Writes rows run by run. A run that fails fails its items; a failure that
 * would repeat for every run stops with its error.
 */
async function writeRuns(
  write: SheetWrite,
  pending: readonly PendingRow[],
  results: SyncItemResult[]
) {
  for (const run of consecutiveRuns(
    pending,
    chunkSize(write.plan.header.length)
  )) {
    try {
      // Runs are ordered: Graph serializes writes to one workbook anyway.
      await writeBlock(
        write.context,
        run[0]?.rowNumber ?? FIRST_DATA_ROW,
        run.map((item) => item.cells)
      );
      for (const item of run) {
        results[item.index] = item.id
          ? { ok: true, id: item.id }
          : { ok: true };
      }
    } catch (error) {
      if (
        !(error instanceof ConnectorError) ||
        isFatalConnectorError(error.code)
      ) {
        throw error;
      }
      for (const item of run) {
        results[item.index] = { ok: false, code: error.code };
      }
    }
  }
}

async function createExcelRows(
  write: SheetWrite,
  items: readonly SyncWrite[]
): Promise<SyncItemResult[]> {
  const results = failedResults(items.length);
  const pending: PendingRow[] = [];
  let nextRow = Math.max(write.used.lastRow, 1) + 1;
  for (const [index, item] of items.entries()) {
    if (item.key) {
      pending.push({
        index,
        id: item.key,
        rowNumber: nextRow,
        cells: syncCells(write.plan, item),
      });
      nextRow += 1;
    } else {
      results[index] = { ok: false, code: "invalid_request" };
    }
  }
  await writeRuns(write, pending, results);
  return results;
}

async function updateExcelRows(
  write: SheetWrite,
  items: readonly SyncWrite[]
): Promise<SyncItemResult[]> {
  const locate = await readRowLocator(write);
  const results = failedResults(items.length);
  const pending: PendingRow[] = [];
  for (const [index, item] of items.entries()) {
    const rowNumber = locate(item.id ?? "");
    if (rowNumber === undefined) {
      results[index] = { ok: false, code: "not_found" };
    } else {
      pending.push({
        index,
        // A row that gets its key is found by that key from now on.
        id: item.key || item.id,
        rowNumber,
        cells: syncCells(write.plan, item),
      });
    }
  }
  await writeRuns(write, pending, results);
  return results;
}

/**
 * Deletes rows by number, consecutive rows in one request, from the bottom
 * up, so each deletion leaves the rows above in place. `rows` maps each row
 * number to the indexes of the ids it answers.
 */
async function deleteRuns(
  context: SheetContext,
  rows: ReadonlyMap<number, readonly number[]>,
  results: SyncItemResult[]
) {
  const runs = consecutiveRuns(
    [...rows.keys()].map((rowNumber) => ({ rowNumber })),
    Number.POSITIVE_INFINITY
  ).reverse();
  for (const run of runs) {
    const first = run[0]?.rowNumber ?? FIRST_DATA_ROW;
    const last = run.at(-1)?.rowNumber ?? first;
    const indexes = run.flatMap((item) => rows.get(item.rowNumber) ?? []);
    try {
      // Deleting shifts rows: retried only on 429, it must never run twice.
      await context.client.request({
        method: "POST",
        path: `${rangePath(context, `${first}:${last}`)}/delete`,
        body: { shift: "Up" },
        retry: "rate_limit_only",
      });
      for (const index of indexes) {
        results[index] = { ok: true };
      }
    } catch (error) {
      if (
        !(error instanceof ConnectorError) ||
        isFatalConnectorError(error.code)
      ) {
        throw error;
      }
      for (const index of indexes) {
        results[index] = { ok: false, code: error.code };
      }
    }
  }
}

async function deleteExcelRows(
  client: GraphClient,
  input: ExcelSyncInput,
  ids: readonly string[]
): Promise<SyncItemResult[]> {
  const context = await openSheet(client, input);
  const used = await readUsedRange(context);
  const keyIndex = (await readHeader(context, used)).indexOf(
    keyColumnOf(input.mapping)
  );
  const keys =
    keyIndex >= 0 ? await readKeyColumn(context, keyIndex, used) : [];
  const locate = rowLocator(keys, 0);
  const results = failedResults(ids.length);
  const rows = new Map<number, number[]>();
  for (const [index, id] of ids.entries()) {
    const row = locate(id);
    // Rows are only deleted by key: a row number can shift. A key that is no
    // longer in the worksheet is already deleted.
    if (id.startsWith(SHEET_ROW_ID_PREFIX) && row === undefined) {
      results[index] = { ok: false, code: "invalid_request" };
    } else if (row === undefined) {
      results[index] = { ok: true };
    } else {
      rows.set(row, [...(rows.get(row) ?? []), index]);
    }
  }
  await deleteRuns(context, rows, results);
  return results;
}

export interface ExcelSyncTarget extends Required<SyncSideAdapter> {
  read(): Promise<SyncRecord[]>;
}

/**
 * The target adapter of `applySyncPlan` for one worksheet, sharing one
 * client: `read` returns the rows, `create` writes new rows keyed by "Yayaw
 * ID" below the last used row, `update` writes the given columns and the key
 * of rows found by key (or by `row:<number>` for a row without a key yet),
 * and `delete` removes rows found by key, from the bottom up, consecutive
 * rows in one request. Missing headers are added at the end of the header
 * row before writing.
 */
export function createExcelSyncTarget(
  input: ExcelSyncInput,
  options?: MicrosoftExcelOptions
): ExcelSyncTarget {
  const client = createGraphClient(input.token, options);
  return {
    read: async () =>
      excelValuesToRecords(
        await readGrid(await openSheet(client, input)),
        input.mapping
      ),
    create: async (items) =>
      await createExcelRows(await prepareSheetWrite(client, input), items),
    update: async (items) =>
      await updateExcelRows(await prepareSheetWrite(client, input), items),
    delete: async (ids) => await deleteExcelRows(client, input, ids),
  };
}

// Schema health --------------------------------------------------------------------

/**
 * Reads a worksheet's header and first rows as the shared `checkTargetSchema`
 * takes it (provider "sheets": a worksheet is a grid like a tab).
 */
export async function getExcelTargetSchema(
  input: Omit<ExcelSyncInput, "mapping">,
  options?: MicrosoftExcelOptions
): Promise<{ provider: "sheets"; fields: SheetSchemaField[] }> {
  const context = await openSheet(
    createGraphClient(input.token, options),
    input
  );
  const used = await readUsedRange(context);
  if (used.width === 0) {
    return sheetTargetSchema([]);
  }
  const lastRow = Math.min(used.lastRow, SCHEMA_SAMPLE_ROWS + 1);
  return sheetTargetSchema(
    await readValues(context, `A1:${columnLetter(used.width - 1)}${lastRow}`)
  );
}

export interface ExcelPrepareInput {
  fixes: readonly SheetSchemaFix[];
  /** Key header ("ID" by default) and its saved position, to shift saved positions. */
  keyColumn?: string;
  keyColumnIndex?: number;
  /** Worksheet name; the first visible worksheet by default. */
  sheetName?: string;
  token: MicrosoftGraphToken;
  workbookId: string;
}

/**
 * Makes a worksheet ready for the table: adds the missing headers (the
 * "ID" key first) at the end of the header row. It never reorders,
 * renames or deletes a column, and only writes the header row. Idempotent:
 * `applied` is empty when nothing was missing.
 */
export async function prepareExcelSheet(
  input: ExcelPrepareInput,
  options?: MicrosoftExcelOptions
): Promise<{ applied: SheetSchemaFix[]; addedHeaders: string[] }> {
  const context = await openSheet(
    createGraphClient(input.token, options),
    input
  );
  const header = await readHeader(context, await readUsedRange(context));
  const added = planSheetPrepare(header, input.fixes, input);
  if (added.length === 0) {
    return { applied: [], addedHeaders: [] };
  }
  await writeHeader(context, {
    header: [...header, ...added],
    added,
    keyIndex: -1,
    indexes: new Map(),
  });
  const names = new Set(added);
  return {
    applied: input.fixes.filter(
      (fix) => fix.kind === "create_field" && names.has(fix.field.trim())
    ),
    addedHeaders: added,
  };
}
