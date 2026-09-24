/**
 * Google Sheets connector, authenticated as a service account. It signs its
 * own RS256 assertion with Web Crypto (`crypto.subtle`), so it runs in Node
 * 20+, Bun, Deno and edge runtimes, and only talks to Google's token endpoint
 * and the fixed Sheets API origin. Provider errors are reduced to typed codes:
 * their bodies can echo cell values, so a 403 body is read only for its
 * machine-readable reason and nothing else is kept.
 *
 * Server-only: call it from the host's server actions, routes or workers.
 */
import {
  acceptRows,
  addFailure,
  addWarning,
  type ConnectorColumn,
  ConnectorError,
  type ConnectorErrorCode,
  type ConnectorOptions,
  type ConnectorPushResult,
  type ConnectorRow,
  createConnectorHttp,
  createPushResult,
  DEFAULT_CONNECTOR_KEY,
  errorCodeForStatus,
  isFatalConnectorError,
  type RetryPolicy,
  safeSliceEnd,
} from "./connector-model";
import {
  normalizeSyncValue,
  placeText,
  SHEET_ROW_ID_PREFIX,
  type SyncItemResult,
  type SyncMapping,
  type SyncRecord,
  type SyncSideAdapter,
  type SyncWrite,
} from "./sync-engine";

export const GOOGLE_SHEETS_API_BASE_URL =
  "https://sheets.googleapis.com/v4/spreadsheets";
export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DEFAULT_GOOGLE_SHEET_KEY_COLUMN = DEFAULT_CONNECTOR_KEY;
/** Default row limit of one push. */
export const DEFAULT_GOOGLE_SHEETS_MAX_ROWS = 10_000;
/** Sheets refuses more than 50,000 characters in one cell. */
export const MAX_SHEET_CELL_LENGTH = 50_000;

const ALLOWED_TOKEN_URLS = new Set([
  GOOGLE_TOKEN_URL,
  "https://www.googleapis.com/oauth2/v4/token",
]);
const SHEETS_ORIGIN = "https://sheets.googleapis.com";
const SHEETS_PATH_PREFIX = "/v4/spreadsheets/";
const JWT_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const ASSERTION_LIFETIME_SECONDS = 3600;
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;
const MAX_CACHED_TOKENS = 256;
const MILLISECONDS_PER_SECOND = 1000;
const SHEETS_MIN_INTERVAL_MS = 250;
const SHEETS_MAX_RETRIES = 5;
// Sheets counts quota per minute; without Retry-After, wait long enough for
// the window to move (2, 4, 8, 16, 30 seconds).
const RATE_LIMIT_BASE_MS = 2000;
// One write request stays well under Google's recommended 2 MB payload.
const MAX_CELLS_PER_WRITE = 40_000;
const MAX_ROWS_PER_WRITE = 1000;
const ALPHABET_SIZE = 26;
const FIRST_COLUMN_CODE = 65; // "A"
const FIRST_DATA_ROW = 2;
const MAX_EMAIL_LENGTH = 320;
const API_DISABLED_REASONS = new Set([
  "SERVICE_DISABLED",
  "accessNotConfigured",
]);
const SPREADSHEET_ID = /^[A-Za-z0-9_-]{20,128}$/;
const SPREADSHEET_URL_ID = /\/spreadsheets\/d\/([^/?#]+)/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PEM_PRIVATE_KEY =
  /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/;
const PEM_NOISE = /\\n|\s+/g;
const BASE64_PLUS = /\+/g;
const BASE64_SLASH = /\//g;
const BASE64_PADDING = /[=]+$/;

// Credentials ------------------------------------------------------------------

export interface GoogleServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
  privateKeyId?: string;
  projectId?: string;
  /** Token endpoint; only Google's own endpoints are accepted. */
  tokenUri: string;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function parseKeyObject(input: unknown): Record<string, unknown> {
  if (typeof input !== "string") {
    return typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  }
  try {
    const parsed: unknown = JSON.parse(input);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    throw new ConnectorError("invalid_credentials");
  }
}

/**
 * Validates the JSON key file of a Google service account (as text or
 * parsed) and returns its credentials. Throws `invalid_credentials` for
 * anything that is not a service account key with a PKCS#8 private key and a
 * Google token endpoint.
 */
export function parseServiceAccountKey(
  input: unknown
): GoogleServiceAccountCredentials {
  const key = parseKeyObject(input);
  const clientEmail = optionalText(key.client_email);
  const privateKey = typeof key.private_key === "string" ? key.private_key : "";
  const tokenUri = optionalText(key.token_uri) ?? GOOGLE_TOKEN_URL;
  const valid =
    key.type === "service_account" &&
    clientEmail !== undefined &&
    clientEmail.length <= MAX_EMAIL_LENGTH &&
    EMAIL.test(clientEmail) &&
    PEM_PRIVATE_KEY.test(privateKey) &&
    ALLOWED_TOKEN_URLS.has(tokenUri);
  if (!(valid && clientEmail)) {
    throw new ConnectorError("invalid_credentials");
  }
  const privateKeyId = optionalText(key.private_key_id);
  const projectId = optionalText(key.project_id);
  return {
    clientEmail,
    privateKey,
    tokenUri,
    ...(privateKeyId ? { privateKeyId } : {}),
    ...(projectId ? { projectId } : {}),
  };
}

// JWT (Web Crypto) ---------------------------------------------------------------

const subtle = (): SubtleCrypto => {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    throw new ConnectorError("invalid_credentials");
  }
  return crypto.subtle;
};

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(BASE64_PLUS, "-")
    .replace(BASE64_SLASH, "_")
    .replace(BASE64_PADDING, "");
}

function base64UrlJson(value: unknown): string {
  return base64UrlFromBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesFromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Imports a PKCS#8 PEM private key for RS256 signing. */
export async function importServiceAccountKey(
  privateKey: string
): Promise<CryptoKey> {
  const body = PEM_PRIVATE_KEY.exec(privateKey)?.[1];
  if (!body) {
    throw new ConnectorError("invalid_credentials");
  }
  try {
    return await subtle().importKey(
      "pkcs8",
      bytesFromBase64(body.replace(PEM_NOISE, "")),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
  } catch {
    throw new ConnectorError("invalid_credentials");
  }
}

/** The signed JWT a service account exchanges for an access token. */
export async function signServiceAccountAssertion(
  credentials: GoogleServiceAccountCredentials,
  issuedAtSeconds: number,
  key?: CryptoKey
): Promise<string> {
  const signingKey =
    key ?? (await importServiceAccountKey(credentials.privateKey));
  const header = {
    alg: "RS256",
    typ: "JWT",
    ...(credentials.privateKeyId ? { kid: credentials.privateKeyId } : {}),
  };
  const claims = {
    iss: credentials.clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: credentials.tokenUri,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ASSERTION_LIFETIME_SECONDS,
  };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
  const signature = await subtle().sign(
    "RSASSA-PKCS1-v1_5",
    signingKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

// Token cache --------------------------------------------------------------------

export interface GoogleAccessToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/**
 * Where access tokens live between calls. The default keeps them in memory;
 * a host can plug a shared store. Keys are SHA-256 hashes, never the key.
 */
export interface GoogleTokenCache {
  delete(key: string): void | Promise<void>;
  get(
    key: string
  ): GoogleAccessToken | undefined | Promise<GoogleAccessToken | undefined>;
  set(key: string, token: GoogleAccessToken): void | Promise<void>;
}

/** In-memory token cache, dropping the oldest entry beyond `maxEntries`. */
export function createGoogleTokenCache(
  maxEntries = MAX_CACHED_TOKENS
): GoogleTokenCache {
  const tokens = new Map<string, GoogleAccessToken>();
  return {
    get: (key) => tokens.get(key),
    set(key, token) {
      tokens.delete(key);
      if (tokens.size >= maxEntries) {
        const oldest = tokens.keys().next().value;
        if (oldest !== undefined) {
          tokens.delete(oldest);
        }
      }
      tokens.set(key, token);
    },
    delete(key) {
      tokens.delete(key);
    },
  };
}

const sharedTokenCache = createGoogleTokenCache();
/** Concurrent callers with the same key share one token request. */
const pendingTokens = new Map<string, Promise<GoogleAccessToken>>();

export interface GoogleSheetsOptions extends ConnectorOptions {
  tokenCache?: GoogleTokenCache;
}

async function tokenCacheKey(
  credentials: GoogleServiceAccountCredentials
): Promise<string> {
  const digest = await subtle().digest(
    "SHA-256",
    new TextEncoder().encode(
      `${credentials.clientEmail}\n${credentials.tokenUri}\n${credentials.privateKey}`
    )
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

// Client -------------------------------------------------------------------------

/** The machine-readable reason of a Google error, and nothing else. */
async function errorReason(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      error?: {
        details?: { reason?: unknown }[];
        errors?: { reason?: unknown }[];
      };
    };
    const reasons = [
      ...(body.error?.details ?? []),
      ...(body.error?.errors ?? []),
    ].map((item) => item?.reason);
    return (
      reasons.find(
        (reason): reason is string =>
          typeof reason === "string" && API_DISABLED_REASONS.has(reason)
      ) ?? null
    );
  } catch {
    return null;
  }
}

const discard = async (response: Response) => {
  await response.body?.cancel().catch(() => null);
};

async function classifySheetsResponse(
  response: Response
): Promise<ConnectorErrorCode> {
  if (response.status === 403) {
    return (await errorReason(response)) ? "api_disabled" : "not_shared";
  }
  await discard(response);
  return errorCodeForStatus(response.status);
}

async function classifyTokenResponse(
  response: Response
): Promise<ConnectorErrorCode> {
  await discard(response);
  // `invalid_grant` (400) and `invalid_client` (401): a deleted or disabled
  // key, a deleted account, or a clock too far off to trust the assertion.
  if (response.status === 400 || response.status === 401) {
    return "invalid_credentials";
  }
  // An organization policy can forbid service account keys.
  return response.status === 403
    ? "forbidden"
    : errorCodeForStatus(response.status);
}

interface SheetsRequest {
  body?: unknown;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  retry?: RetryPolicy;
}

interface SheetsClient {
  /** Obtains an access token, bypassing the cache. */
  authorize(): Promise<void>;
  request<T>(request: SheetsRequest): Promise<T>;
}

function sheetsUrl(request: SheetsRequest): string {
  const target = new URL(`${GOOGLE_SHEETS_API_BASE_URL}${request.path}`);
  for (const [name, value] of Object.entries(request.query ?? {})) {
    target.searchParams.set(name, value);
  }
  // Every id and range is validated or encoded before it reaches the path;
  // this keeps a mistake from ever leaving the Sheets API.
  if (
    target.origin !== SHEETS_ORIGIN ||
    !target.pathname.startsWith(SHEETS_PATH_PREFIX)
  ) {
    throw new ConnectorError("invalid_target");
  }
  return target.toString();
}

function createSheetsClient(
  credentials: GoogleServiceAccountCredentials,
  options: GoogleSheetsOptions = {}
): SheetsClient {
  const now = options.now ?? Date.now;
  const cache = options.tokenCache ?? sharedTokenCache;
  const retries = {
    maxRetries: SHEETS_MAX_RETRIES,
    rateLimitBaseMs: RATE_LIMIT_BASE_MS,
  };
  const http = createConnectorHttp(
    {
      ...retries,
      minIntervalMs: SHEETS_MIN_INTERVAL_MS,
      classify: classifySheetsResponse,
    },
    options
  );
  const tokenHttp = createConnectorHttp(
    { ...retries, minIntervalMs: 0, classify: classifyTokenResponse },
    { ...options, rateLimiter: undefined }
  );
  let cacheKey: Promise<string> | undefined;
  const key = () => {
    cacheKey ??= tokenCacheKey(credentials);
    return cacheKey;
  };

  async function fetchToken(): Promise<GoogleAccessToken> {
    const assertion = await signServiceAccountAssertion(
      credentials,
      Math.floor(now() / MILLISECONDS_PER_SECOND)
    );
    const body = await tokenHttp.request<{
      access_token?: unknown;
      expires_in?: unknown;
    }>({
      url: credentials.tokenUri,
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: JWT_GRANT_TYPE,
        assertion,
      }).toString(),
    });
    if (
      typeof body.access_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      throw new ConnectorError("provider_unavailable");
    }
    return {
      accessToken: body.access_token,
      expiresAt: now() + body.expires_in * MILLISECONDS_PER_SECOND,
    };
  }

  async function accessToken(fresh: boolean): Promise<string> {
    const cacheId = await key();
    const cached = fresh ? undefined : await cache.get(cacheId);
    if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > now()) {
      return cached.accessToken;
    }
    let pending = pendingTokens.get(cacheId);
    if (!pending) {
      pending = fetchToken().finally(() => pendingTokens.delete(cacheId));
      pendingTokens.set(cacheId, pending);
    }
    const token = await pending;
    await cache.set(cacheId, token);
    return token.accessToken;
  }

  const send = <T>(request: SheetsRequest, token: string) =>
    http.request<T>({
      url: sheetsUrl(request),
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      retry: request.retry,
    });

  const withAccount = (error: unknown) =>
    error instanceof ConnectorError && error.code === "not_shared"
      ? new ConnectorError("not_shared", {
          ...error.details,
          serviceAccountEmail: credentials.clientEmail,
        })
      : error;

  async function request<T>(request: SheetsRequest): Promise<T> {
    try {
      return await send<T>(request, await accessToken(false));
    } catch (error) {
      if (!(error instanceof ConnectorError && error.code === "unauthorized")) {
        throw withAccount(error);
      }
    }
    // A cached token can be revoked early: try once with a new one.
    try {
      return await send<T>(request, await accessToken(true));
    } catch (error) {
      if (error instanceof ConnectorError && error.code === "unauthorized") {
        await cache.delete(await key());
      }
      throw withAccount(error);
    }
  }

  return {
    async authorize() {
      await accessToken(true);
    },
    request,
  };
}

// Addressing ---------------------------------------------------------------------

/**
 * The spreadsheet id of a Google Sheets URL or of a bare id. Throws
 * `invalid_target` unless the id only uses Google's id characters.
 */
export function parseSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  const candidate = trimmed.includes("/")
    ? (SPREADSHEET_URL_ID.exec(trimmed)?.[1] ?? "")
    : trimmed;
  if (!SPREADSHEET_ID.test(candidate)) {
    throw new ConnectorError("invalid_target");
  }
  return candidate;
}

/** `A`, `B`, … `Z`, `AA`, … for a zero-based column index. */
export function columnLetter(index: number): string {
  let letters = "";
  let remaining = index + 1;
  while (remaining > 0) {
    const offset = (remaining - 1) % ALPHABET_SIZE;
    letters = String.fromCharCode(FIRST_COLUMN_CODE + offset) + letters;
    remaining = Math.floor((remaining - 1) / ALPHABET_SIZE);
  }
  return letters;
}

/** A tab title quoted for A1 notation (`'Q3 ''final'''`). */
export function quoteSheetTitle(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

const spreadsheetPath = (spreadsheetId: string) =>
  `/${parseSpreadsheetId(spreadsheetId)}`;

const valuesPath = (spreadsheetId: string, range: string) =>
  `${spreadsheetPath(spreadsheetId)}/values/${encodeURIComponent(range)}`;

// Verification and discovery -----------------------------------------------------

/**
 * Proves the key works by exchanging a fresh assertion for a token. Returns
 * the service account email the user must share spreadsheets with.
 */
export async function verifyGoogleSheetsCredentials(
  credentials: GoogleServiceAccountCredentials,
  options?: GoogleSheetsOptions
): Promise<{ clientEmail: string }> {
  await createSheetsClient(credentials, options).authorize();
  return { clientEmail: credentials.clientEmail };
}

export interface GoogleSheetTab {
  columnCount: number;
  index: number;
  rowCount: number;
  sheetId: number;
  title: string;
}

export interface GoogleSpreadsheet {
  id: string;
  sheets: GoogleSheetTab[];
  title: string;
  url: string | null;
}

interface SpreadsheetResponse {
  properties?: { title?: unknown };
  sheets?: {
    properties?: {
      gridProperties?: { columnCount?: unknown; rowCount?: unknown };
      index?: unknown;
      sheetId?: unknown;
      sheetType?: unknown;
      title?: unknown;
    };
  }[];
  spreadsheetId?: unknown;
  spreadsheetUrl?: unknown;
}

type SheetProperties = NonNullable<
  NonNullable<SpreadsheetResponse["sheets"]>[number]["properties"]
>;

const SPREADSHEET_FIELDS =
  "spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount))";

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function gridTab(
  properties: SheetProperties | undefined,
  position: number
): GoogleSheetTab[] {
  // Chart and object sheets have no cells to write to.
  if (
    typeof properties?.title !== "string" ||
    typeof properties.sheetId !== "number" ||
    (properties.sheetType !== undefined && properties.sheetType !== "GRID")
  ) {
    return [];
  }
  return [
    {
      sheetId: properties.sheetId,
      title: properties.title,
      index: numberOr(properties.index, position),
      rowCount: numberOr(properties.gridProperties?.rowCount, 0),
      columnCount: numberOr(properties.gridProperties?.columnCount, 0),
    },
  ];
}

const stringOr = <T>(value: unknown, fallback: T): string | T =>
  typeof value === "string" ? value : fallback;

async function readSpreadsheet(
  client: SheetsClient,
  spreadsheetId: string
): Promise<GoogleSpreadsheet> {
  const response = await client.request<SpreadsheetResponse>({
    method: "GET",
    path: spreadsheetPath(spreadsheetId),
    query: { fields: SPREADSHEET_FIELDS },
  });
  const sheets = (response.sheets ?? []).flatMap((sheet, position) =>
    gridTab(sheet.properties, position)
  );
  return {
    id: stringOr(response.spreadsheetId, parseSpreadsheetId(spreadsheetId)),
    title: stringOr(response.properties?.title, ""),
    url: stringOr(response.spreadsheetUrl, null),
    sheets: sheets.sort((left, right) => left.index - right.index),
  };
}

/** The spreadsheet's title and its grid tabs, from a URL or an id. */
export async function getSpreadsheet(
  credentials: GoogleServiceAccountCredentials,
  spreadsheetId: string,
  options?: GoogleSheetsOptions
): Promise<GoogleSpreadsheet> {
  return await readSpreadsheet(
    createSheetsClient(credentials, options),
    spreadsheetId
  );
}

function requireTab(
  spreadsheet: GoogleSpreadsheet,
  sheetTitle: string | undefined
): GoogleSheetTab {
  const tab =
    sheetTitle === undefined
      ? spreadsheet.sheets[0]
      : spreadsheet.sheets.find((sheet) => sheet.title === sheetTitle);
  if (!tab) {
    throw new ConnectorError("invalid_target");
  }
  return tab;
}

const cellText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value).trim();

async function readHeader(
  client: SheetsClient,
  spreadsheetId: string,
  sheetTitle: string
): Promise<string[]> {
  const response = await client.request<{ values?: unknown[][] }>({
    method: "GET",
    path: valuesPath(spreadsheetId, `${quoteSheetTitle(sheetTitle)}!1:1`),
    query: { majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" },
  });
  const header = (response.values?.[0] ?? []).map(cellText);
  while (header.length > 0 && header.at(-1) === "") {
    header.pop();
  }
  return header;
}

/** The first row of a tab, trimmed, without trailing empty cells. */
export async function readHeaderRow(
  credentials: GoogleServiceAccountCredentials,
  spreadsheetId: string,
  sheetTitle: string,
  options?: GoogleSheetsOptions
): Promise<string[]> {
  const client = createSheetsClient(credentials, options);
  const tab = requireTab(
    await readSpreadsheet(client, spreadsheetId),
    sheetTitle
  );
  return await readHeader(client, spreadsheetId, tab.title);
}

// Push planning (pure) -------------------------------------------------------------

export interface SheetHeaderPlan {
  /** Headers appended after the user's own, in order. */
  added: string[];
  /** The header row after the push. */
  header: string[];
  /** Zero-based column of each column id. */
  indexes: Map<string, number>;
  keyIndex: number;
}

/**
 * Saved positions of mapped headers (the mapping's `fieldIndex`), used when a
 * header was renamed in the sheet. `keyIndex` is the key column's saved
 * position: saved positions shift by as much as the key column moved.
 */
export interface SheetColumnHints {
  indexes?: Readonly<Record<string, number>>;
  keyIndex?: number;
}

export interface SheetColumnResolution {
  /** Zero-based column of each column id found by header or position. */
  indexes: Map<string, number>;
  /** Columns without a header and without a saved position: new headers. */
  missing: string[];
  /** Columns whose header is gone and whose saved position is unusable. */
  ambiguous: string[];
}

function positionShift(
  header: readonly string[],
  keyColumn: string,
  keyIndex: number | undefined
): number {
  const found = header.indexOf(keyColumn);
  return keyIndex === undefined || found < 0 ? 0 : found - keyIndex;
}

/**
 * Where each column is in an existing header row (pure): by header first;
 * a header that is gone is taken at its saved position (shifted like the key
 * column) when the header there is not mapped by anything else, since it was
 * renamed. A column with a saved position that cannot be used is ambiguous;
 * one without a saved position is missing (a new header).
 */
export function resolveSheetColumns(
  existing: readonly string[],
  keyColumn: string,
  columns: readonly Pick<ConnectorColumn, "id" | "header">[],
  hints: SheetColumnHints = {}
): SheetColumnResolution {
  const header = existing.map((name) => name.trim());
  const shift = positionShift(header, keyColumn, hints.keyIndex);
  const taken = new Set([
    keyColumn,
    ...columns.map((column) => column.header.trim()),
  ]);
  const resolution: SheetColumnResolution = {
    indexes: new Map(),
    missing: [],
    ambiguous: [],
  };
  const used = new Set<number>();
  for (const column of columns) {
    const found = header.indexOf(column.header.trim());
    const saved = hints.indexes?.[column.id];
    if (found >= 0) {
      resolution.indexes.set(column.id, found);
      used.add(found);
    } else if (saved === undefined) {
      resolution.missing.push(column.id);
    } else {
      const index = saved + shift;
      const renamed = header[index] ?? "";
      const usable = renamed !== "" && !taken.has(renamed) && !used.has(index);
      if (usable) {
        resolution.indexes.set(column.id, index);
        used.add(index);
      } else {
        resolution.ambiguous.push(column.id);
      }
    }
  }
  return resolution;
}

/**
 * Finds each column's header in the existing header row and appends the
 * missing ones at the end, so the user's own column order is never changed.
 * A header renamed in the sheet is found at its saved position (`hints`) and
 * written in place, never added again; when that position cannot be used,
 * nothing is written (`field_missing`). An empty sheet gets the key column
 * first, then the columns in order.
 */
export function planSheetHeader(
  existing: readonly string[],
  keyColumn: string,
  columns: readonly ConnectorColumn[],
  hints: SheetColumnHints = {}
): SheetHeaderPlan {
  const names = [keyColumn, ...columns.map((column) => column.header.trim())];
  const ids = new Set(columns.map((column) => column.id));
  const invalid =
    names.some((name) => name === "") ||
    new Set(names).size !== names.length ||
    ids.size !== columns.length;
  if (invalid) {
    throw new ConnectorError("invalid_mapping");
  }
  const resolution = resolveSheetColumns(existing, keyColumn, columns, hints);
  if (resolution.ambiguous.length > 0) {
    throw new ConnectorError("field_missing");
  }
  const header = existing.map((name) => name.trim());
  const added: string[] = [];
  const position = (name: string) => {
    const found = header.indexOf(name);
    if (found >= 0) {
      return found;
    }
    header.push(name);
    added.push(name);
    return header.length - 1;
  };
  const keyIndex = position(keyColumn);
  const indexes = new Map<string, number>();
  for (const column of columns) {
    indexes.set(
      column.id,
      resolution.indexes.get(column.id) ?? position(column.header.trim())
    );
  }
  return { header, added, keyIndex, indexes };
}

export interface SheetUpsertPlan<Row> {
  appends: Row[];
  /** Keys that appear more than once in the sheet; the first row wins. */
  duplicateSheetKeys: number;
  updates: { row: Row; rowNumber: number }[];
}

/**
 * Splits rows into in-place updates (their key is already in the sheet) and
 * appends. `sheetKeys[0]` is the key cell of sheet row 2.
 */
export function planSheetUpsert<Row extends { id: string }>(
  rows: readonly Row[],
  sheetKeys: readonly unknown[]
): SheetUpsertPlan<Row> {
  const existing = new Map<string, number>();
  let duplicateSheetKeys = 0;
  for (const [index, value] of sheetKeys.entries()) {
    const key = cellText(value);
    if (key && existing.has(key)) {
      duplicateSheetKeys += 1;
    } else if (key) {
      existing.set(key, index + FIRST_DATA_ROW);
    }
  }
  const plan: SheetUpsertPlan<Row> = {
    updates: [],
    appends: [],
    duplicateSheetKeys,
  };
  for (const row of rows) {
    const rowNumber = existing.get(row.id);
    if (rowNumber === undefined) {
      plan.appends.push(row);
    } else {
      plan.updates.push({ row, rowNumber });
    }
  }
  return plan;
}

export type SheetCell = string | number | boolean | null;

function textOf(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item)
      )
      .join(", ");
  }
  if (typeof value === "object" && value !== null) {
    return placeText(value) ?? JSON.stringify(value);
  }
  return String(value);
}

/**
 * A table value as a Sheets cell: numbers and booleans stay typed, other
 * values become text of at most 50,000 characters. Values are sent `RAW`,
 * so text starting with `=` is never evaluated as a formula.
 */
export function toSheetCell(value: unknown): {
  cell: Exclude<SheetCell, null>;
  truncated: boolean;
} {
  if (value === null || value === undefined) {
    return { cell: "", truncated: false };
  }
  if (typeof value === "number") {
    return { cell: Number.isFinite(value) ? value : "", truncated: false };
  }
  if (typeof value === "boolean") {
    return { cell: value, truncated: false };
  }
  const text = textOf(value);
  if (text.length <= MAX_SHEET_CELL_LENGTH) {
    return { cell: text, truncated: false };
  }
  return {
    cell: text.slice(0, safeSliceEnd(text, 0, MAX_SHEET_CELL_LENGTH)),
    truncated: true,
  };
}

// Push ---------------------------------------------------------------------------

export type GoogleSheetPushMode = "replace" | "upsert";

export interface GoogleSheetPushInput {
  /** Columns in the order new headers are added. */
  columns: readonly ConnectorColumn[];
  /**
   * Saved header positions by column id (the mapping's `fieldIndex`): a
   * header renamed in the sheet keeps receiving its column.
   */
  fieldIndexes?: Readonly<Record<string, number>>;
  /** Saved position of the key column (`keyFieldIndex`). */
  keyColumnIndex?: number;
  credentials: GoogleServiceAccountCredentials;
  /** Header of the column holding row ids, "Yayaw ID" by default. */
  keyColumn?: string;
  /** Rows written at most; the others mark the result as truncated. */
  maxRows?: number;
  /**
   * `upsert` (default) updates rows whose id is in the sheet and appends the
   * others; `replace` clears everything below the header and writes again.
   */
  mode?: GoogleSheetPushMode;
  rows: readonly ConnectorRow[];
  /** Tab title; the first tab by default. */
  sheetTitle?: string;
  spreadsheetId: string;
}

export interface GoogleSheetPushResult extends ConnectorPushResult {
  /** Headers added at the end of the header row. */
  addedHeaders: string[];
  sheetTitle: string;
  spreadsheetId: string;
}

interface RowWriter {
  cells(row: ConnectorRow): SheetCell[];
  width: number;
}

/**
 * Cells for one row across the whole header. Columns that are not pushed
 * stay `null`, which Sheets skips, so the user's own columns keep their
 * values on update.
 */
function rowWriter(
  plan: SheetHeaderPlan,
  result: ConnectorPushResult
): RowWriter {
  const width = plan.header.length;
  return {
    width,
    cells(row) {
      const cells = Array.from({ length: width }, (): SheetCell => null);
      cells[plan.keyIndex] = row.id;
      for (const [columnId, index] of plan.indexes) {
        const { cell, truncated } = toSheetCell(row.values[columnId]);
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
    },
  };
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

interface ValueRange {
  majorDimension: "ROWS";
  range: string;
  values: SheetCell[][];
}

interface PushContext {
  client: SheetsClient;
  quoted: string;
  spreadsheetId: string;
  tab: GoogleSheetTab;
}

interface WriteStep {
  rows: number;
  run: () => Promise<unknown>;
}

function rowRange(
  context: PushContext,
  firstRow: number,
  rowCount: number,
  width: number
): string {
  const lastRow = firstRow + rowCount - 1;
  return `${context.quoted}!A${firstRow}:${columnLetter(width - 1)}${lastRow}`;
}

async function batchUpdateValues(context: PushContext, data: ValueRange[]) {
  if (data.length === 0) {
    return;
  }
  await context.client.request({
    method: "POST",
    path: `${spreadsheetPath(context.spreadsheetId)}/values:batchUpdate`,
    body: { valueInputOption: "RAW", includeValuesInResponse: false, data },
  });
}

/** Grows the grid; not retried after an ambiguous failure. */
async function appendDimension(
  context: PushContext,
  dimension: "COLUMNS" | "ROWS",
  length: number
) {
  if (length <= 0) {
    return;
  }
  await context.client.request({
    method: "POST",
    path: `${spreadsheetPath(context.spreadsheetId)}:batchUpdate`,
    body: {
      requests: [
        {
          appendDimension: { sheetId: context.tab.sheetId, dimension, length },
        },
      ],
    },
    retry: "rate_limit_only",
  });
}

async function readKeyColumn(
  context: PushContext,
  keyIndex: number
): Promise<unknown[]> {
  const letter = columnLetter(keyIndex);
  const response = await context.client.request<{ values?: unknown[][] }>({
    method: "GET",
    path: valuesPath(
      context.spreadsheetId,
      `${context.quoted}!${letter}${FIRST_DATA_ROW}:${letter}`
    ),
    query: { majorDimension: "COLUMNS", valueRenderOption: "FORMATTED_VALUE" },
  });
  return response.values?.[0] ?? [];
}

function headerRange(
  context: PushContext,
  plan: SheetHeaderPlan
): ValueRange | null {
  if (plan.added.length === 0) {
    return null;
  }
  const first = plan.header.length - plan.added.length;
  return {
    range: `${context.quoted}!${columnLetter(first)}1:${columnLetter(plan.header.length - 1)}1`,
    majorDimension: "ROWS",
    values: [plan.added],
  };
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
      // Writes are ordered: an append must follow the previous one.
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

function appendStep(
  context: PushContext,
  writer: RowWriter,
  chunk: readonly ConnectorRow[]
): WriteStep {
  const range = `${context.quoted}!A1:${columnLetter(writer.width - 1)}1`;
  return {
    rows: chunk.length,
    run: () =>
      context.client.request({
        method: "POST",
        path: `${valuesPath(context.spreadsheetId, range)}:append`,
        query: {
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          includeValuesInResponse: "false",
        },
        body: {
          majorDimension: "ROWS",
          values: chunk.map((row) => writer.cells(row)),
        },
        retry: "rate_limit_only",
      }),
  };
}

async function upsertRows(
  context: PushContext,
  plan: SheetHeaderPlan,
  rows: readonly ConnectorRow[],
  result: ConnectorPushResult
) {
  const writer = rowWriter(plan, result);
  // A key column added by this push has no keys to read yet.
  const sheetKeys = plan.added.includes(plan.header[plan.keyIndex] ?? "")
    ? []
    : await readKeyColumn(context, plan.keyIndex);
  const upsert = planSheetUpsert(rows, sheetKeys);
  if (upsert.duplicateSheetKeys > 0) {
    addWarning(result, { reason: "duplicate_target_key" });
  }
  const size = chunkSize(writer.width);
  const header = headerRange(context, plan);
  const updateSteps: WriteStep[] = chunks(upsert.updates, size).map(
    (chunk, index) => ({
      rows: chunk.length,
      run: () =>
        batchUpdateValues(context, [
          // The header change rides along with the first write.
          ...(index === 0 && header ? [header] : []),
          ...chunk.map(({ row, rowNumber }) => ({
            range: rowRange(context, rowNumber, 1, writer.width),
            majorDimension: "ROWS" as const,
            values: [writer.cells(row)],
          })),
        ]),
    })
  );
  if (updateSteps.length === 0 && header) {
    await batchUpdateValues(context, [header]);
  }
  const updated = await writeInOrder(updateSteps, result, (count) => {
    result.updated += count;
  });
  if (!updated) {
    if (upsert.appends.length === 0) {
      return;
    }
    // Appending after a failed update could misplace rows; report them.
    addFailure(result, {
      code: result.failures.at(-1)?.code ?? "provider_unavailable",
      rows: upsert.appends.length,
    });
    return;
  }
  const appendSteps = chunks(upsert.appends, size).map((chunk) =>
    appendStep(context, writer, chunk)
  );
  await writeInOrder(appendSteps, result, (count) => {
    result.created += count;
  });
}

async function replaceRows(
  context: PushContext,
  plan: SheetHeaderPlan,
  rows: readonly ConnectorRow[],
  result: ConnectorPushResult
) {
  const writer = rowWriter(plan, result);
  const header = headerRange(context, plan);
  if (header) {
    await batchUpdateValues(context, [header]);
  }
  const width = Math.max(writer.width, context.tab.columnCount);
  if (context.tab.rowCount >= FIRST_DATA_ROW) {
    await context.client.request({
      method: "POST",
      path: `${valuesPath(context.spreadsheetId, `${context.quoted}!A${FIRST_DATA_ROW}:${columnLetter(width - 1)}`)}:clear`,
      body: {},
    });
  }
  // Fixed-position writes need the grid to have the rows already.
  await appendDimension(
    context,
    "ROWS",
    rows.length + 1 - context.tab.rowCount
  );
  let nextRow = FIRST_DATA_ROW;
  const steps: WriteStep[] = chunks(rows, chunkSize(writer.width)).map(
    (chunk) => {
      const firstRow = nextRow;
      nextRow += chunk.length;
      return {
        rows: chunk.length,
        run: () =>
          batchUpdateValues(context, [
            {
              range: rowRange(context, firstRow, chunk.length, writer.width),
              majorDimension: "ROWS",
              values: chunk.map((row) => writer.cells(row)),
            },
          ]),
      };
    }
  );
  await writeInOrder(steps, result, (count) => {
    result.created += count;
  });
}

/**
 * Writes rows to one tab of a spreadsheet, keyed by `keyColumn` ("Yayaw ID"
 * by default). The header row is written when empty; missing headers are
 * added at its end and the user's columns are never reordered. `upsert` reads
 * the key column once, updates matching rows in place with
 * `values:batchUpdate` and appends the others with `values:append`;
 * `replace` clears everything below the header and writes the rows again.
 * Rows go out in large batches because Sheets allows about 60 writes a
 * minute, and values are sent `RAW` so nothing is evaluated as a formula.
 *
 * Throws a `ConnectorError` when nothing can be written (`not_shared` carries
 * `details.serviceAccountEmail`); a failure midway is recorded in `failures`.
 */
export async function pushRowsToSheet(
  input: GoogleSheetPushInput,
  options?: GoogleSheetsOptions
): Promise<GoogleSheetPushResult> {
  const client = createSheetsClient(input.credentials, options);
  const spreadsheet = await readSpreadsheet(client, input.spreadsheetId);
  const tab = requireTab(spreadsheet, input.sheetTitle);
  const context: PushContext = {
    client,
    spreadsheetId: parseSpreadsheetId(spreadsheet.id),
    tab,
    quoted: quoteSheetTitle(tab.title),
  };
  const plan = planSheetHeader(
    await readHeader(client, context.spreadsheetId, tab.title),
    (input.keyColumn ?? DEFAULT_GOOGLE_SHEET_KEY_COLUMN).trim(),
    input.columns,
    { indexes: input.fieldIndexes, keyIndex: input.keyColumnIndex }
  );
  const result: GoogleSheetPushResult = {
    ...createPushResult(),
    addedHeaders: plan.added,
    sheetTitle: tab.title,
    spreadsheetId: context.spreadsheetId,
  };
  const rows = acceptRows(
    input.rows,
    { maxRows: input.maxRows ?? DEFAULT_GOOGLE_SHEETS_MAX_ROWS },
    result
  );
  await appendDimension(
    context,
    "COLUMNS",
    plan.header.length - tab.columnCount
  );
  if (input.mode === "replace") {
    await replaceRows(context, plan, rows, result);
  } else {
    await upsertRows(context, plan, rows, result);
  }
  return result;
}

// Read and sync ------------------------------------------------------------------

/** Rows one `deleteDimension` batch removes at most. */
const MAX_ROWS_PER_DELETE = 500;

export interface GoogleSheetSyncInput {
  credentials: GoogleServiceAccountCredentials;
  /** Mapped columns (headers and column types) and the key column. */
  mapping: SyncMapping;
  /** Tab title; the first tab by default. */
  sheetTitle?: string;
  spreadsheetId: string;
}

const isBlankCell = (value: unknown) => cellText(value) === "";

const keyColumnOf = (mapping: SyncMapping) =>
  (mapping.keyField ?? DEFAULT_GOOGLE_SHEET_KEY_COLUMN).trim();

const sheetColumnsOf = (mapping: SyncMapping) =>
  mapping.fields.map((field) => ({ id: field.columnId, header: field.field }));

/** The mapping's saved header positions (`fieldIndex`, `keyFieldIndex`). */
const sheetHintsOf = (mapping: SyncMapping): SheetColumnHints => ({
  indexes: Object.fromEntries(
    mapping.fields.flatMap((field) =>
      field.fieldIndex === undefined ? [] : [[field.columnId, field.fieldIndex]]
    )
  ),
  keyIndex: mapping.keyFieldIndex,
});

/**
 * Sync records from the values of a tab, header row first. Each mapped column
 * is found by its header; a column whose header is missing is left out of
 * `values` (unknown), an empty cell is empty. Values are normalized by column
 * type, since cells come back as text, numbers or booleans. The remote id is
 * the row's key, or `row:<number>` for a row without one. Empty rows are
 * skipped.
 */
export function sheetValuesToRecords(
  grid: readonly (readonly unknown[] | undefined)[],
  mapping: SyncMapping
): SyncRecord[] {
  const header = (grid[0] ?? []).map(cellText);
  const keyIndex = header.indexOf(keyColumnOf(mapping));
  // Renamed headers are read at their saved position; ambiguous ones stay unknown.
  const { indexes } = resolveSheetColumns(
    header,
    keyColumnOf(mapping),
    sheetColumnsOf(mapping),
    sheetHintsOf(mapping)
  );
  const columns = mapping.fields.flatMap((field) => {
    const index = indexes.get(field.columnId);
    return index === undefined ? [] : [{ field, index }];
  });
  const records: SyncRecord[] = [];
  for (const [offset, row] of grid.slice(1).entries()) {
    const cells = row ?? [];
    if (!cells.every(isBlankCell)) {
      const key = keyIndex >= 0 ? cellText(cells[keyIndex]) : "";
      const id = key || `${SHEET_ROW_ID_PREFIX}${offset + FIRST_DATA_ROW}`;
      const values = columns.map(({ field, index }) => [
        field.columnId,
        normalizeSyncValue(cells[index], field.type),
      ]);
      records.push({
        id,
        ...(key ? { key } : {}),
        values: Object.fromEntries(values),
      });
    }
  }
  return records;
}

async function openTab(
  client: SheetsClient,
  input: GoogleSheetSyncInput
): Promise<PushContext> {
  const spreadsheet = await readSpreadsheet(client, input.spreadsheetId);
  const tab = requireTab(spreadsheet, input.sheetTitle);
  return {
    client,
    spreadsheetId: parseSpreadsheetId(spreadsheet.id),
    tab,
    quoted: quoteSheetTitle(tab.title),
  };
}

async function readGrid(context: PushContext): Promise<unknown[][]> {
  const response = await context.client.request<{ values?: unknown[][] }>({
    method: "GET",
    path: valuesPath(context.spreadsheetId, context.quoted),
    // Numbers and booleans come back typed; dates as the text they show.
    query: {
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    },
  });
  return response.values ?? [];
}

/**
 * Reads a tab as sync records (see `sheetValuesToRecords`). Sheets has no
 * per-row edit time, so records have no `updatedAt`.
 */
export async function readSheetRows(
  input: GoogleSheetSyncInput,
  options?: GoogleSheetsOptions
): Promise<SyncRecord[]> {
  const context = await openTab(
    createSheetsClient(input.credentials, options),
    input
  );
  return sheetValuesToRecords(await readGrid(context), input.mapping);
}

interface SheetWriteContext {
  context: PushContext;
  plan: SheetHeaderPlan;
}

/** Opens the tab and adds missing headers (and grid columns) first. */
async function prepareSheetWrite(
  client: SheetsClient,
  input: GoogleSheetSyncInput
): Promise<SheetWriteContext> {
  const context = await openTab(client, input);
  // A renamed header is written in place; an ambiguous one stops before any write.
  const plan = planSheetHeader(
    await readHeader(client, context.spreadsheetId, context.tab.title),
    keyColumnOf(input.mapping),
    sheetColumnsOf(input.mapping),
    sheetHintsOf(input.mapping)
  );
  await appendDimension(
    context,
    "COLUMNS",
    plan.header.length - context.tab.columnCount
  );
  const header = headerRange(context, plan);
  if (header) {
    await batchUpdateValues(context, [header]);
  }
  return { context, plan };
}

/**
 * Cells of one sync write across the whole header: the key and the columns in
 * `values`; the others stay `null`, which Sheets leaves untouched.
 */
function syncCells(plan: SheetHeaderPlan, item: SyncWrite): SheetCell[] {
  const cells = Array.from(
    { length: plan.header.length },
    (): SheetCell => null
  );
  if (item.key !== undefined) {
    cells[plan.keyIndex] = item.key;
  }
  for (const [columnId, index] of plan.indexes) {
    if (Object.hasOwn(item.values, columnId)) {
      cells[index] = toSheetCell(item.values[columnId]).cell;
    }
  }
  return cells;
}

type RowLocator = (id: string) => number | undefined;

/**
 * Finds a row by its key, or by `row:<number>` while that row still has no
 * key and is inside the grid.
 */
function rowLocator(keys: readonly unknown[], rowCount: number): RowLocator {
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
      row <= rowCount &&
      isBlankCell(keys[row - FIRST_DATA_ROW]);
    return valid ? row : undefined;
  };
}

async function readRowLocator(write: SheetWriteContext): Promise<RowLocator> {
  const { context, plan } = write;
  const keyAdded = plan.added.includes(plan.header[plan.keyIndex] ?? "");
  const keys = keyAdded ? [] : await readKeyColumn(context, plan.keyIndex);
  return rowLocator(keys, context.tab.rowCount);
}

interface PendingWrite<T> {
  id?: string;
  index: number;
  value: T;
}

const failedResults = (count: number): SyncItemResult[] =>
  Array.from({ length: count }, () => ({ ok: false, code: "failed" }) as const);

/**
 * Runs writes chunk by chunk. A chunk that fails fails its items; a failure
 * that would repeat for every chunk stops with its error.
 */
async function writeChunks<T>(
  pending: readonly PendingWrite<T>[],
  size: number,
  results: SyncItemResult[],
  write: (values: T[]) => Promise<unknown>
) {
  for (const chunk of chunks(pending, size)) {
    try {
      // Chunks are ordered: Sheets allows about 60 writes a minute.
      await write(chunk.map((item) => item.value));
      for (const item of chunk) {
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
      for (const item of chunk) {
        results[item.index] = { ok: false, code: error.code };
      }
    }
  }
}

async function createSheetRows(
  write: SheetWriteContext,
  items: readonly SyncWrite[]
): Promise<SyncItemResult[]> {
  const { context, plan } = write;
  const results = failedResults(items.length);
  const pending: PendingWrite<SheetCell[]>[] = [];
  for (const [index, item] of items.entries()) {
    if (item.key) {
      pending.push({ index, id: item.key, value: syncCells(plan, item) });
    } else {
      results[index] = { ok: false, code: "invalid_request" };
    }
  }
  const range = `${context.quoted}!A1:${columnLetter(plan.header.length - 1)}1`;
  await writeChunks(pending, chunkSize(plan.header.length), results, (chunk) =>
    context.client.request({
      method: "POST",
      path: `${valuesPath(context.spreadsheetId, range)}:append`,
      query: {
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        includeValuesInResponse: "false",
      },
      body: { majorDimension: "ROWS", values: chunk },
      // Appending is retried only on 429: it must never write twice.
      retry: "rate_limit_only",
    })
  );
  return results;
}

async function updateSheetRows(
  write: SheetWriteContext,
  items: readonly SyncWrite[]
): Promise<SyncItemResult[]> {
  const { context, plan } = write;
  const locate = await readRowLocator(write);
  const width = plan.header.length;
  const results = failedResults(items.length);
  const pending: PendingWrite<ValueRange>[] = [];
  for (const [index, item] of items.entries()) {
    const row = locate(item.id ?? "");
    if (row === undefined) {
      results[index] = { ok: false, code: "not_found" };
    } else {
      pending.push({
        index,
        // A row that gets its key is found by that key from now on.
        id: item.key || item.id,
        value: {
          range: rowRange(context, row, 1, width),
          majorDimension: "ROWS",
          values: [syncCells(plan, item)],
        },
      });
    }
  }
  await writeChunks(pending, chunkSize(width), results, (chunk) =>
    batchUpdateValues(context, chunk)
  );
  return results;
}

async function deleteSheetRows(
  client: SheetsClient,
  input: GoogleSheetSyncInput,
  ids: readonly string[]
): Promise<SyncItemResult[]> {
  const context = await openTab(client, input);
  const header = await readHeader(
    client,
    context.spreadsheetId,
    context.tab.title
  );
  const keyIndex = header.indexOf(keyColumnOf(input.mapping));
  const keys = keyIndex >= 0 ? await readKeyColumn(context, keyIndex) : [];
  const locate = rowLocator(keys, 0);
  const results = failedResults(ids.length);
  const rows = new Map<number, number[]>();
  for (const [index, id] of ids.entries()) {
    const row = locate(id);
    // Rows are only deleted by key: a row number can shift. A key that is no
    // longer in the sheet is already deleted.
    if (id.startsWith(SHEET_ROW_ID_PREFIX) && row === undefined) {
      results[index] = { ok: false, code: "invalid_request" };
    } else if (row === undefined) {
      results[index] = { ok: true };
    } else {
      rows.set(row, [...(rows.get(row) ?? []), index]);
    }
  }
  // From the bottom up, so each deletion leaves the rows above in place.
  const pending = [...rows.keys()]
    .sort((left, right) => right - left)
    .flatMap((row) =>
      (rows.get(row) ?? []).map((index) => ({ index, value: row }))
    );
  await writeChunks(pending, MAX_ROWS_PER_DELETE, results, (chunk) =>
    context.client.request({
      method: "POST",
      path: `${spreadsheetPath(context.spreadsheetId)}:batchUpdate`,
      body: {
        requests: [...new Set(chunk)].map((row) => ({
          deleteDimension: {
            range: {
              sheetId: context.tab.sheetId,
              dimension: "ROWS",
              startIndex: row - 1,
              endIndex: row,
            },
          },
        })),
      },
      retry: "rate_limit_only",
    })
  );
  return results;
}

export interface GoogleSheetSyncTarget extends Required<SyncSideAdapter> {
  read(): Promise<SyncRecord[]>;
}

/**
 * The target adapter of `applySyncPlan` for one tab, sharing one client and
 * token: `read` returns the rows, `create` appends rows keyed by "Yayaw ID",
 * `update` writes the given columns and the key of rows found by key (or by
 * `row:<number>` for a row without a key yet), and `delete` removes rows found
 * by key, from the bottom up, in one request per 500 rows. Missing headers
 * are added at the end of the header row before writing.
 */
export function createSheetSyncTarget(
  input: GoogleSheetSyncInput,
  options?: GoogleSheetsOptions
): GoogleSheetSyncTarget {
  const client = createSheetsClient(input.credentials, options);
  return {
    read: async () =>
      sheetValuesToRecords(
        await readGrid(await openTab(client, input)),
        input.mapping
      ),
    create: async (items) =>
      await createSheetRows(await prepareSheetWrite(client, input), items),
    update: async (items) =>
      await updateSheetRows(await prepareSheetWrite(client, input), items),
    delete: async (ids) => await deleteSheetRows(client, input, ids),
  };
}

// Schema health --------------------------------------------------------------------

/** Rows read to sample each column's type. */
const SCHEMA_SAMPLE_ROWS = 20;
const DATE_LIKE = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}(?:[ T].*)?$/;

type SampledType = "number" | "boolean" | "date" | "text";

function cellType(value: unknown): SampledType | null {
  if (typeof value === "number") {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  const text = cellText(value);
  if (text === "") {
    return null;
  }
  return DATE_LIKE.test(text) && !Number.isNaN(Date.parse(text))
    ? "date"
    : "text";
}

/** The type every sampled cell shares, "text" when they differ. */
function sampledType(values: readonly unknown[]): SampledType | undefined {
  const types = new Set(values.flatMap((value) => cellType(value) ?? []));
  if (types.size === 0) {
    return;
  }
  return types.size === 1 ? [...types][0] : "text";
}

/** One field of a sheet as the shared `checkTargetSchema` takes it. */
export interface SheetSchemaField {
  index: number;
  name: string;
  sample: unknown[];
  type?: SampledType;
}

/**
 * A tab's header row and first rows as the shared `checkTargetSchema` takes
 * it (`targetSchema`, provider "sheets"): each header with its position, a
 * sample of its values and the type they share (`number`, `boolean`, `date`
 * or `text`). Blank headers are left out.
 */
export function sheetTargetSchema(
  grid: readonly (readonly unknown[] | undefined)[]
): { provider: "sheets"; fields: SheetSchemaField[] } {
  const header = (grid[0] ?? []).map(cellText);
  const rows = grid.slice(1, SCHEMA_SAMPLE_ROWS + 1);
  const fields = header.flatMap((name, index) => {
    if (name === "") {
      return [];
    }
    const sample = rows.map((row) => row?.[index] ?? null);
    const type = sampledType(sample);
    return [{ name, index, sample, ...(type ? { type } : {}) }];
  });
  return { provider: "sheets", fields };
}

/** Reads a tab's header and first rows as a `sheetTargetSchema`. */
export async function getSheetTargetSchema(
  input: Omit<GoogleSheetSyncInput, "mapping">,
  options?: GoogleSheetsOptions
): Promise<{ provider: "sheets"; fields: SheetSchemaField[] }> {
  const client = createSheetsClient(input.credentials, options);
  const context = await openTab(client, { ...input, mapping: { fields: [] } });
  const response = await client.request<{ values?: unknown[][] }>({
    method: "GET",
    path: valuesPath(
      context.spreadsheetId,
      `${context.quoted}!1:${SCHEMA_SAMPLE_ROWS + 1}`
    ),
    query: {
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    },
  });
  return sheetTargetSchema(response.values ?? []);
}

/** A fix `prepareSheet` applies: a header to add (options are Notion's only). */
export interface SheetSchemaFix {
  kind: "create_field" | "add_options";
  field: string;
  key?: boolean;
  columnId?: string;
  /** Saved position of the header: a renamed header is never added again. */
  fieldIndex?: number;
}

export interface GoogleSheetPrepareInput {
  credentials: GoogleServiceAccountCredentials;
  fixes: readonly SheetSchemaFix[];
  /** Key header ("Yayaw ID" by default) and its saved position, to shift saved positions. */
  keyColumn?: string;
  keyColumnIndex?: number;
  /** Tab title; the first tab by default. */
  sheetTitle?: string;
  spreadsheetId: string;
}

/**
 * Headers to add at the end of a header row (pure): the missing ones of the
 * `create_field` fixes, the key first, each once. Existing headers are never
 * moved, renamed or removed. A fix with a saved position whose header was
 * renamed is already there (nothing is added); when that position cannot be
 * used, it throws `field_missing` so nothing is written.
 */
export function planSheetPrepare(
  header: readonly string[],
  fixes: readonly SheetSchemaFix[],
  hints: { keyColumn?: string; keyColumnIndex?: number } = {}
): string[] {
  const creates = fixes.filter(
    (fix) => fix.kind === "create_field" && fix.field.trim() && !fix.key
  );
  const columns = creates.map((fix, index) => ({
    id: fix.columnId ?? `fix:${index}`,
    header: fix.field,
  }));
  const resolution = resolveSheetColumns(
    header,
    (hints.keyColumn ?? DEFAULT_GOOGLE_SHEET_KEY_COLUMN).trim(),
    columns,
    {
      indexes: Object.fromEntries(
        creates.flatMap((fix, index) =>
          fix.fieldIndex === undefined
            ? []
            : [[columns[index]?.id ?? "", fix.fieldIndex]]
        )
      ),
      keyIndex: hints.keyColumnIndex,
    }
  );
  if (resolution.ambiguous.length > 0) {
    throw new ConnectorError("field_missing");
  }
  const existing = new Set(header.map((name) => name.trim()));
  const missing = new Set(resolution.missing);
  const ordered = [
    ...fixes.filter((fix) => fix.kind === "create_field" && fix.key),
    ...creates.filter((_, index) => missing.has(columns[index]?.id ?? "")),
  ];
  const added: string[] = [];
  for (const fix of ordered) {
    const name = fix.field.trim();
    if (name && !existing.has(name)) {
      existing.add(name);
      added.push(name);
    }
  }
  return added;
}

/**
 * Makes a tab ready for the table: adds the missing headers (the "Yayaw ID"
 * key first) at the end of the header row, growing the grid when needed. It
 * never reorders, renames or deletes a column, and only writes the header
 * row. Idempotent: `applied` is empty when nothing was missing. Select
 * options have no equivalent in a sheet and are left alone.
 */
export async function prepareSheet(
  input: GoogleSheetPrepareInput,
  options?: GoogleSheetsOptions
): Promise<{ applied: SheetSchemaFix[]; addedHeaders: string[] }> {
  const client = createSheetsClient(input.credentials, options);
  const context = await openTab(client, { ...input, mapping: { fields: [] } });
  const header = await readHeader(
    client,
    context.spreadsheetId,
    context.tab.title
  );
  const added = planSheetPrepare(header, input.fixes, input);
  if (added.length === 0) {
    return { applied: [], addedHeaders: [] };
  }
  const plan: SheetHeaderPlan = {
    header: [...header, ...added],
    added,
    keyIndex: -1,
    indexes: new Map(),
  };
  await appendDimension(
    context,
    "COLUMNS",
    plan.header.length - context.tab.columnCount
  );
  const range = headerRange(context, plan);
  if (range) {
    await batchUpdateValues(context, [range]);
  }
  const names = new Set(added);
  return {
    applied: input.fixes.filter(
      (fix) => fix.kind === "create_field" && names.has(fix.field.trim())
    ),
    addedHeaders: added,
  };
}
