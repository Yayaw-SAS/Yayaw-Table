/**
 * Provider-neutral contract of YaYaw Table connectors: the rows and columns a
 * table pushes, the result of a push, typed errors and a small HTTP helper.
 *
 * Connector modules are plain TypeScript meant to run on the host's server
 * (Node 20+, Bun, Deno or an edge runtime). They never read credentials,
 * never persist anything and never log: the host stores credentials, checks
 * who may push where, and calls these functions from its server actions,
 * routes or workers. Provider error bodies can echo submitted values, so they
 * are reduced to a typed code and never included in an error.
 */

/** Default name of the target field that holds each row's stable id. */
export const DEFAULT_CONNECTOR_KEY = "Yayaw ID";
/** Longest row id a connector accepts. */
export const MAX_CONNECTOR_ROW_ID_LENGTH = 2000;
/** Warnings and failures listed in a result; the counts keep going. */
export const MAX_REPORTED_ISSUES = 200;

const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;
/** A provider can never hold a request for longer than this. */
export const MAX_RETRY_AFTER_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const MILLISECONDS_PER_SECOND = 1000;
const HTTP_DATE_RETRY_AFTER = /[a-z]/i;

// Columns and rows ---------------------------------------------------------------

/** A table column as a connector sees it. `type` is the table column type. */
export interface ConnectorColumn {
  header: string;
  id: string;
  type?: string;
}

/** A table record, keyed by column id. */
export type ConnectorRecord = Record<string, unknown>;

/** One row to push: a stable id and its values keyed by column id. */
export interface ConnectorRow {
  id: string;
  values: ConnectorRecord;
}

/**
 * Where each column goes: `properties` maps a column id to the name of the
 * target field (a Notion property, a sheet header). `keyProperty` names the
 * field holding the row id, `DEFAULT_CONNECTOR_KEY` by default.
 * `propertyIds` (column id to Notion property id) and `keyPropertyId` are
 * found first, so a property renamed in Notion keeps receiving its column.
 */
export interface ConnectorMapping {
  keyProperty?: string;
  keyPropertyId?: string;
  properties: Record<string, string>;
  propertyIds?: Record<string, string>;
}

const rowIdText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  return "";
};

/**
 * Turns table records into connector rows. The id comes from the `rowId`
 * field (default `id`) or a function; a record without one is kept with an
 * empty id and skipped by the push, with a warning.
 */
export function toConnectorRows(
  records: readonly ConnectorRecord[],
  rowId: string | ((record: ConnectorRecord) => unknown) = "id"
): ConnectorRow[] {
  return records.map((record) => ({
    id: rowIdText(typeof rowId === "function" ? rowId(record) : record[rowId]),
    values: record,
  }));
}

// Results ----------------------------------------------------------------------

export type ConnectorWarningReason =
  | "duplicate_row"
  | "duplicate_target_key"
  | "invalid_row_id"
  | "property_in_use"
  | "property_missing"
  | "row_limit"
  | "unconvertible_value"
  | "unsupported_property_type"
  | "value_truncated";

export interface ConnectorWarning {
  columnId?: string;
  reason: ConnectorWarningReason;
  rowId?: string;
}

export interface ConnectorFailure {
  code: ConnectorErrorCode;
  /** The row that failed, for providers that write one row at a time. */
  rowId?: string;
  /** How many rows the failure left unwritten. */
  rows: number;
}

export interface ConnectorPushResult {
  created: number;
  /** Rows not written. */
  failed: number;
  failures: ConnectorFailure[];
  /** Rows refused before writing (no id, duplicate id). */
  skipped: number;
  /** True when rows beyond `maxRows` were left out. */
  truncated: boolean;
  updated: number;
  warningCount: number;
  warnings: ConnectorWarning[];
}

export function createPushResult(): ConnectorPushResult {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
    warnings: [],
    warningCount: 0,
    truncated: false,
  };
}

export function addWarning(
  result: ConnectorPushResult,
  warning: ConnectorWarning
): void {
  result.warningCount += 1;
  if (result.warnings.length < MAX_REPORTED_ISSUES) {
    result.warnings.push(warning);
  }
}

export function addFailure(
  result: ConnectorPushResult,
  failure: ConnectorFailure
): void {
  result.failed += failure.rows;
  if (result.failures.length < MAX_REPORTED_ISSUES) {
    result.failures.push(failure);
  }
}

export interface AcceptRowsOptions {
  /** Extra id check, for example numeric keys. */
  isValidId?: (id: string) => boolean;
  maxRows: number;
}

/**
 * Trims ids and keeps the first row of each id, up to `maxRows` rows. Rows
 * without a usable id or with a repeated one are skipped with a warning; rows
 * beyond the limit mark the result as truncated.
 */
export function acceptRows(
  rows: readonly ConnectorRow[],
  options: AcceptRowsOptions,
  result: ConnectorPushResult
): ConnectorRow[] {
  const seen = new Set<string>();
  const accepted: ConnectorRow[] = [];
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const valid =
      id !== "" &&
      id.length <= MAX_CONNECTOR_ROW_ID_LENGTH &&
      (options.isValidId?.(id) ?? true);
    if (!valid) {
      result.skipped += 1;
      addWarning(result, { reason: "invalid_row_id" });
    } else if (seen.has(id)) {
      result.skipped += 1;
      addWarning(result, { rowId: id, reason: "duplicate_row" });
    } else if (accepted.length >= options.maxRows) {
      result.truncated = true;
    } else {
      seen.add(id);
      accepted.push({ id, values: row.values ?? {} });
    }
  }
  if (result.truncated) {
    addWarning(result, { reason: "row_limit" });
  }
  return accepted;
}

// Errors -----------------------------------------------------------------------

export type ConnectorErrorCode =
  /** The request was cancelled by the caller's signal. */
  | "aborted"
  /** The provider API is not enabled for the credentials' project. */
  | "api_disabled"
  /** The target is shared, but the credentials lack a capability. */
  | "forbidden"
  /** The provider refused the credentials when exchanging them. */
  | "invalid_credentials"
  /** The mapping cannot be applied (missing or unusable key field). */
  | "invalid_mapping"
  /** The provider rejected the request as invalid. */
  | "invalid_request"
  /** A database, spreadsheet or tab id or URL is malformed. */
  | "invalid_target"
  /** The target does not exist, or is not visible to the credentials. */
  | "not_found"
  /** The target exists but is not shared with the credentials. */
  | "not_shared"
  /** Timeout, network failure, 5xx or an unreadable response. */
  | "provider_unavailable"
  | "rate_limited"
  /** The token was revoked or expired. */
  | "unauthorized";

/** Values safe to show: they never contain row data or provider bodies. */
export interface ConnectorErrorDetails {
  /** Service account to share a Google spreadsheet with. */
  serviceAccountEmail?: string;
  /** HTTP status of the provider response. */
  status?: number;
}

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly details: ConnectorErrorDetails;

  constructor(code: ConnectorErrorCode, details: ConnectorErrorDetails = {}) {
    super(`Connector request failed: ${code}`);
    this.name = "ConnectorError";
    this.code = code;
    this.details = details;
  }
}

export function isConnectorError(error: unknown): error is ConnectorError {
  return error instanceof ConnectorError;
}

/** Errors after which every further write of a push would fail too. */
const FATAL_CODES = new Set<ConnectorErrorCode>([
  "aborted",
  "api_disabled",
  "forbidden",
  "invalid_credentials",
  "not_found",
  "not_shared",
  "unauthorized",
]);

export function isFatalConnectorError(code: ConnectorErrorCode): boolean {
  return FATAL_CODES.has(code);
}

/** Default classification of a failed provider response. */
export function errorCodeForStatus(status: number): ConnectorErrorCode {
  if (status === 401) {
    return "unauthorized";
  }
  if (status === 403) {
    return "forbidden";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 429) {
    return "rate_limited";
  }
  if (status === 409 || status >= 500) {
    return "provider_unavailable";
  }
  return "invalid_request";
}

// HTTP -------------------------------------------------------------------------

export type Sleep = (milliseconds: number) => Promise<void>;

export const defaultSleep: Sleep = (milliseconds) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export function backoffDelay(attempt: number, baseMs = BASE_BACKOFF_MS) {
  return Math.min(MAX_BACKOFF_MS, baseMs * 2 ** attempt);
}

/**
 * The wait before the next attempt: `Retry-After` in seconds or as an HTTP
 * date, otherwise exponential backoff from `baseMs`, never over 30 seconds.
 */
export function retryDelay(
  header: string | null,
  attempt: number,
  now: number,
  baseMs = BASE_BACKOFF_MS
): number {
  const fallback = Math.min(MAX_RETRY_AFTER_MS, baseMs * 2 ** attempt);
  const trimmed = header?.trim();
  if (!trimmed) {
    return fallback;
  }
  const milliseconds = HTTP_DATE_RETRY_AFTER.test(trimmed)
    ? Date.parse(trimmed) - now
    : Number(trimmed) * MILLISECONDS_PER_SECOND;
  if (!Number.isFinite(milliseconds)) {
    return fallback;
  }
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, milliseconds));
}

export interface ConnectorRateLimiter {
  /** Resolves when the next request may start. */
  wait(): Promise<void>;
}

/** Spaces requests `minIntervalMs` apart, in call order. */
export function createRateLimiter(
  minIntervalMs: number,
  clock: { now?: () => number; sleep?: Sleep } = {}
): ConnectorRateLimiter {
  const now = clock.now ?? Date.now;
  const sleep = clock.sleep ?? defaultSleep;
  let nextSlot = 0;
  return {
    async wait() {
      const current = now();
      const delay = nextSlot - current;
      nextSlot = Math.max(current, nextSlot) + minIntervalMs;
      if (delay > 0) {
        await sleep(delay);
      }
    },
  };
}

/** Injectable runtime of every connector function. */
export interface ConnectorOptions {
  fetch?: typeof fetch;
  /** Attempts after the first one; 429 and transient failures only. */
  maxRetries?: number;
  now?: () => number;
  /**
   * Shares a limiter between operations using the same credentials. By
   * default each operation (one push, one listing) gets its own.
   */
  rateLimiter?: ConnectorRateLimiter;
  signal?: AbortSignal;
  sleep?: Sleep;
  timeoutMs?: number;
}

/** What a provider module decides about its HTTP traffic. */
export interface ConnectorHttpProfile {
  /** Maps a failed response to a code; may read the body, never returns it. */
  classify?: (
    response: Response
  ) => ConnectorErrorCode | Promise<ConnectorErrorCode>;
  maxRetries?: number;
  minIntervalMs: number;
  /** First wait after a 429 without `Retry-After`. */
  rateLimitBaseMs?: number;
}

/**
 * `idempotent` requests retry on 429, 409, 5xx and network failures.
 * `rate_limit_only` requests (creating a page, appending rows) retry only on
 * 429, which providers answer before doing any work, so an ambiguous failure
 * never writes twice.
 */
export type RetryPolicy = "idempotent" | "rate_limit_only";

export interface ConnectorHttpRequest {
  body?: string;
  headers?: Record<string, string>;
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  retry?: RetryPolicy;
  url: string;
}

export interface ConnectorHttp {
  /** Sends the request and parses its JSON body, or throws `ConnectorError`. */
  request<T>(request: ConnectorHttpRequest): Promise<T>;
}

type Attempt<T> = { data: T } | { retryIn: number };

const ignore = () => null;

async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(ignore);
}

async function defaultClassify(
  response: Response
): Promise<ConnectorErrorCode> {
  await discardBody(response);
  return errorCodeForStatus(response.status);
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new ConnectorError("provider_unavailable", {
      status: response.status,
    });
  }
}

function isRetryable(code: ConnectorErrorCode, policy: RetryPolicy): boolean {
  if (code === "rate_limited") {
    return true;
  }
  return policy === "idempotent" && code === "provider_unavailable";
}

export function createConnectorHttp(
  profile: ConnectorHttpProfile,
  options: ConnectorOptions = {}
): ConnectorHttp {
  const fetcher = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries =
    options.maxRetries ?? profile.maxRetries ?? DEFAULT_MAX_RETRIES;
  const classify = profile.classify ?? defaultClassify;
  const limiter =
    options.rateLimiter ??
    createRateLimiter(profile.minIntervalMs, { now, sleep });

  const assertActive = () => {
    if (options.signal?.aborted) {
      throw new ConnectorError("aborted");
    }
  };

  const send = (request: ConnectorHttpRequest) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    return fetcher(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "error",
      signal: options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout,
    });
  };

  async function attempt<T>(
    request: ConnectorHttpRequest,
    index: number
  ): Promise<Attempt<T>> {
    const policy = request.retry ?? "idempotent";
    const lastAttempt = index >= maxRetries;
    assertActive();
    await limiter.wait();
    let response: Response;
    try {
      response = await send(request);
    } catch {
      assertActive();
      // A network failure or a timeout is ambiguous for a write.
      if (lastAttempt || policy !== "idempotent") {
        throw new ConnectorError("provider_unavailable");
      }
      return { retryIn: backoffDelay(index) };
    }
    if (response.ok) {
      return { data: await readJson<T>(response) };
    }
    const code = await classify(response);
    if (lastAttempt || !isRetryable(code, policy)) {
      throw new ConnectorError(code, { status: response.status });
    }
    const baseMs =
      code === "rate_limited" ? profile.rateLimitBaseMs : BASE_BACKOFF_MS;
    return {
      retryIn: retryDelay(
        response.headers.get("retry-after"),
        index,
        now(),
        baseMs
      ),
    };
  }

  async function request<T>(request: ConnectorHttpRequest): Promise<T> {
    for (let index = 0; index <= maxRetries; index += 1) {
      // Attempts are sequential by design: each waits for the previous one.
      const outcome = await attempt<T>(request, index);
      if ("data" in outcome) {
        return outcome.data;
      }
      await sleep(outcome.retryIn);
    }
    throw new ConnectorError("provider_unavailable");
  }

  return { request };
}

// Encoding ---------------------------------------------------------------------

const HIGH_SURROGATE_START = 0xd8_00;
const HIGH_SURROGATE_END = 0xdb_ff;

/**
 * The end of a slice of at most `length` UTF-16 units from `start`, moved
 * back by one when it would split a surrogate pair.
 */
export function safeSliceEnd(
  text: string,
  start: number,
  length: number
): number {
  const end = Math.min(text.length, start + length);
  const last = text.charCodeAt(end - 1);
  const splitsPair =
    end < text.length &&
    end - 1 > start &&
    last >= HIGH_SURROGATE_START &&
    last <= HIGH_SURROGATE_END;
  return splitsPair ? end - 1 : end;
}
