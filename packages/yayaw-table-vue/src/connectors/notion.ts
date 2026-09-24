/**
 * Notion connector: pushes table rows into a Notion database with an internal
 * integration token. It only talks to the fixed public API origin, validates
 * every id before it enters a path, and spaces requests about three per
 * second as Notion asks. Tokens and row contents are never logged, and
 * provider error bodies are reduced to a typed code.
 *
 * Server-only: call it from the host's server actions, routes or workers.
 */
import {
  acceptRows,
  addFailure,
  addWarning,
  type ConnectorColumn,
  ConnectorError,
  type ConnectorHttp,
  type ConnectorMapping,
  type ConnectorOptions,
  type ConnectorPushResult,
  type ConnectorRow,
  type ConnectorWarningReason,
  createConnectorHttp,
  createPushResult,
  DEFAULT_CONNECTOR_KEY,
  safeSliceEnd,
} from "./connector-model";
import {
  normalizeSyncValue,
  placeText,
  type SyncItemResult,
  type SyncMapping,
  type SyncRecord,
  type SyncSideAdapter,
  type SyncWrite,
} from "./sync-engine";

export const NOTION_API_BASE_URL = "https://api.notion.com/v1";
export const NOTION_API_VERSION = "2022-06-28";
export const DEFAULT_NOTION_KEY_PROPERTY = DEFAULT_CONNECTOR_KEY;
/** Rows one push writes at most; Notion writes one page per request. */
export const MAX_NOTION_PUSH_ROWS = 5000;

const NOTION_MIN_INTERVAL_MS = 334; // Notion averages three requests per second.
const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 20;
const QUERY_PAGE_SIZE = 100;
const KEY_QUERY_BATCH_SIZE = 50;
const RICH_TEXT_CHUNK_LENGTH = 2000;
const RICH_TEXT_MAX_ITEMS = 100;
const OPTION_MAX_LENGTH = 100;
const MULTI_SELECT_MAX_ITEMS = 100;
const URL_MAX_LENGTH = 2000;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 200;
const NOTION_ID = /^[0-9a-f]{32}$/;
const NOTION_ID_IN_URL = /([0-9a-f]{32})(?:[?#]|$)/;
const DASHES = /-/g;
const NUMERIC_KEY = /^-?\d+(\.\d+)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_NUMBER = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHITESPACE = /\s+/g;
const DIACRITICS = /\p{Diacritic}/gu;
const NON_ALPHANUMERIC = /[^\p{Letter}\p{Number}]/gu;
const TRUE_WORDS = new Set(["true", "yes", "y", "on", "1", "oui", "vrai"]);
const FALSE_WORDS = new Set(["false", "no", "n", "off", "0", "non", "faux"]);
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const KEY_PROPERTY_TYPES = new Set(["rich_text", "title", "number"]);
/**
 * A revoked token or a missing capability fails every remaining row; other
 * errors (a deleted page, an invalid value) only fail their own row.
 */
const STOP_CODES = new Set(["aborted", "forbidden", "unauthorized"]);

// Schema -----------------------------------------------------------------------

export interface NotionPropertySchema {
  id: string;
  name: string;
  options?: { color?: string; name: string }[];
  type: string;
}

export interface NotionDatabaseSchema {
  id: string;
  properties: NotionPropertySchema[];
  title: string;
  url: string | null;
}

export interface NotionDatabaseSummary {
  id: string;
  title: string;
  url: string | null;
}

export interface NotionTokenIdentity {
  botId: string;
  name: string | null;
  workspaceName: string | null;
}

// Value conversion (pure) ------------------------------------------------------

export type NotionConversion =
  | {
      ok: true;
      payload: Record<string, unknown>;
      warning?: ConnectorWarningReason;
    }
  | { ok: false; reason: ConnectorWarningReason };

const unconvertible: NotionConversion = {
  ok: false,
  reason: "unconvertible_value",
};

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function arrayText(value: readonly unknown[]): string | undefined {
  const parts = value.map(textOf);
  return parts.every((part) => part !== undefined)
    ? parts.filter(Boolean).join(", ")
    : undefined;
}

/** A readable text for a cell value, or undefined when it has none. */
function textOf(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  if (typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  return Array.isArray(value) ? arrayText(value) : placeText(value);
}

export interface NotionRichTextItem {
  text: { content: string };
  type: "text";
}

/**
 * Splits text into Notion rich text items of at most 2,000 characters
 * without breaking surrogate pairs; beyond 100 items the rest is dropped.
 */
export function toRichText(text: string): {
  items: NotionRichTextItem[];
  truncated: boolean;
} {
  const items: NotionRichTextItem[] = [];
  let offset = 0;
  while (offset < text.length && items.length < RICH_TEXT_MAX_ITEMS) {
    const end = safeSliceEnd(text, offset, RICH_TEXT_CHUNK_LENGTH);
    items.push({ type: "text", text: { content: text.slice(offset, end) } });
    offset = end;
  }
  return { items, truncated: offset < text.length };
}

function textPayload(
  key: "rich_text" | "title",
  value: unknown
): NotionConversion {
  const text = textOf(value);
  if (text === undefined) {
    return unconvertible;
  }
  const { items, truncated } = toRichText(text);
  return {
    ok: true,
    payload: { [key]: items },
    ...(truncated ? { warning: "value_truncated" as const } : {}),
  };
}

function numberPayload(value: unknown): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { number: null } };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, payload: { number: value } }
      : unconvertible;
  }
  if (typeof value === "string") {
    const compact = value.replace(WHITESPACE, "");
    return DECIMAL_NUMBER.test(compact)
      ? { ok: true, payload: { number: Number(compact) } }
      : unconvertible;
  }
  return unconvertible;
}

function optionName(value: unknown): string | undefined {
  const text = textOf(value)?.trim();
  if (text === undefined || text.length > OPTION_MAX_LENGTH) {
    return;
  }
  return text;
}

function selectPayload(
  key: "select" | "status",
  property: NotionPropertySchema,
  value: unknown
): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { [key]: null } };
  }
  const name = optionName(value);
  // Notion rejects commas in option names and cannot create status options.
  if (!name || name.includes(",")) {
    return unconvertible;
  }
  const unknownStatus =
    key === "status" &&
    !property.options?.some((option) => option.name === name);
  return unknownStatus
    ? unconvertible
    : { ok: true, payload: { [key]: { name } } };
}

function optionNames(raw: readonly unknown[]): string[] | undefined {
  const names: string[] = [];
  for (const item of raw) {
    const name = optionName(item);
    if (name === undefined || name.includes(",")) {
      return;
    }
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names.length > MULTI_SELECT_MAX_ITEMS ? undefined : names;
}

function multiSelectPayload(value: unknown): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { multi_select: [] } };
  }
  let raw: readonly unknown[];
  if (Array.isArray(value)) {
    raw = value;
  } else {
    const text = textOf(value);
    if (text === undefined) {
      return unconvertible;
    }
    raw = text.split(",");
  }
  const names = optionNames(raw);
  return names
    ? { ok: true, payload: { multi_select: names.map((name) => ({ name })) } }
    : unconvertible;
}

function validIso(date: Date): string | undefined {
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** ISO date text; a date-only input stays date-only. */
export function toNotionDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return validIso(value);
  }
  if (typeof value === "number") {
    return validIso(new Date(value));
  }
  if (typeof value !== "string") {
    return;
  }
  const text = value.trim();
  if (DATE_ONLY.test(text)) {
    return Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? undefined : text;
  }
  return validIso(new Date(text));
}

function datePayload(value: unknown): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { date: null } };
  }
  const start = toNotionDate(value);
  return start ? { ok: true, payload: { date: { start } } } : unconvertible;
}

function checkboxPayload(value: unknown): NotionConversion {
  if (typeof value === "boolean") {
    return { ok: true, payload: { checkbox: value } };
  }
  if (isEmpty(value)) {
    return { ok: true, payload: { checkbox: false } };
  }
  const word = (textOf(value) ?? "").trim().toLowerCase();
  if (TRUE_WORDS.has(word)) {
    return { ok: true, payload: { checkbox: true } };
  }
  return FALSE_WORDS.has(word)
    ? { ok: true, payload: { checkbox: false } }
    : unconvertible;
}

function urlPayload(value: unknown): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { url: null } };
  }
  const text = textOf(value)?.trim();
  if (!text || text.length > URL_MAX_LENGTH || !URL.canParse(text)) {
    return unconvertible;
  }
  return ALLOWED_URL_PROTOCOLS.has(new URL(text).protocol)
    ? { ok: true, payload: { url: text } }
    : unconvertible;
}

function emailPayload(value: unknown): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { email: null } };
  }
  const text = textOf(value)?.trim();
  return text && text.length <= EMAIL_MAX_LENGTH && EMAIL.test(text)
    ? { ok: true, payload: { email: text } }
    : unconvertible;
}

function phonePayload(value: unknown): NotionConversion {
  if (isEmpty(value)) {
    return { ok: true, payload: { phone_number: null } };
  }
  const text = textOf(value)?.trim();
  return text && text.length <= PHONE_MAX_LENGTH
    ? { ok: true, payload: { phone_number: text } }
    : unconvertible;
}

/**
 * Converts one cell to the payload of a Notion property, chosen by the
 * property's Notion type. Empty values clear the property.
 */
export function toNotionPropertyValue(
  property: NotionPropertySchema,
  value: unknown
): NotionConversion {
  switch (property.type) {
    case "title":
    case "rich_text":
      return textPayload(property.type, value);
    case "number":
      return numberPayload(value);
    case "select":
    case "status":
      return selectPayload(property.type, property, value);
    case "multi_select":
      return multiSelectPayload(value);
    case "date":
      return datePayload(value);
    case "checkbox":
      return checkboxPayload(value);
    case "url":
      return urlPayload(value);
    case "email":
      return emailPayload(value);
    case "phone_number":
      return phonePayload(value);
    default:
      return { ok: false, reason: "unsupported_property_type" };
  }
}

// Mapping (pure) ---------------------------------------------------------------

/** Case, accent, space and punctuation insensitive name. */
export function normalizePropertyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "");
}

const TEXT_TARGETS = ["rich_text", "title"] as const;
const COMPATIBLE_PROPERTY_TYPES: Partial<Record<string, readonly string[]>> = {
  text: [...TEXT_TARGETS, "select", "status", "url", "email", "phone_number"],
  number: ["number", ...TEXT_TARGETS],
  select: ["select", "status", "multi_select", ...TEXT_TARGETS],
  multiSelect: ["multi_select", ...TEXT_TARGETS],
  date: ["date", ...TEXT_TARGETS],
  boolean: ["checkbox", "rich_text"],
  url: ["url", ...TEXT_TARGETS],
  email: ["email", ...TEXT_TARGETS],
};

/** Whether a table column type can fill a Notion property type. */
export function isCompatibleColumn(
  columnType: string | undefined,
  propertyType: string
): boolean {
  const type = columnType ?? "text";
  const targets = Object.hasOwn(COMPATIBLE_PROPERTY_TYPES, type)
    ? COMPATIBLE_PROPERTY_TYPES[type]
    : TEXT_TARGETS;
  return targets?.includes(propertyType) ?? false;
}

/**
 * Suggests a mapping: each column goes to the unused property with the same
 * normalized name and a compatible type. When no column matched the title
 * property, the first unmapped column fills it. The key property is reserved.
 */
export function defaultNotionMapping(
  columns: readonly ConnectorColumn[],
  schema: Pick<NotionDatabaseSchema, "properties">,
  keyProperty = DEFAULT_NOTION_KEY_PROPERTY
): ConnectorMapping {
  const used = new Set<string>([keyProperty]);
  const properties = new Map<string, string>();
  for (const column of columns) {
    const name = normalizePropertyName(column.header);
    const property = schema.properties.find(
      (item) =>
        name !== "" &&
        !used.has(item.name) &&
        normalizePropertyName(item.name) === name &&
        isCompatibleColumn(column.type, item.type)
    );
    if (property) {
      used.add(property.name);
      properties.set(column.id, property.name);
    }
  }
  const title = schema.properties.find((item) => item.type === "title");
  const first = columns.find((column) => !properties.has(column.id));
  if (title && first && !used.has(title.name)) {
    properties.set(first.id, title.name);
  }
  // `fromEntries` defines own properties, even for ids like `__proto__`.
  return { keyProperty, properties: Object.fromEntries(properties) };
}

// Client -----------------------------------------------------------------------

interface NotionRequest {
  body?: unknown;
  method: "GET" | "PATCH" | "POST";
  path: string;
  retry?: "idempotent" | "rate_limit_only";
}

interface NotionClient {
  request<T>(request: NotionRequest): Promise<T>;
}

function createNotionClient(
  token: string,
  options: ConnectorOptions = {}
): NotionClient {
  const http: ConnectorHttp = createConnectorHttp(
    { minIntervalMs: NOTION_MIN_INTERVAL_MS },
    options
  );
  return {
    request: <T>(request: NotionRequest) =>
      http.request<T>({
        url: `${NOTION_API_BASE_URL}${request.path}`,
        method: request.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": NOTION_API_VERSION,
        },
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
        retry: request.retry,
      }),
  };
}

/**
 * Accepts a Notion id with or without dashes, or a Notion URL ending with
 * one, and returns the dashed form. Anything else is refused so an id can
 * never change the API path.
 */
export function normalizeNotionId(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const compact = trimmed.replace(DASHES, "");
  const id = NOTION_ID.test(compact)
    ? compact
    : NOTION_ID_IN_URL.exec(trimmed.split("?")[0] ?? "")?.[1];
  if (!id) {
    throw new ConnectorError("invalid_target");
  }
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20),
  ].join("-");
}

function plainText(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((item: { plain_text?: unknown }) =>
      typeof item?.plain_text === "string" ? item.plain_text : ""
    )
    .join("");
}

// Verification and discovery ---------------------------------------------------

interface NotionUserResponse {
  bot?: { workspace_name?: string | null };
  id?: string;
  name?: string | null;
  type?: string;
}

/** Checks that the token belongs to an integration (bot) and names it. */
export async function verifyNotionToken(
  token: string,
  options?: ConnectorOptions
): Promise<NotionTokenIdentity> {
  const user = await createNotionClient(
    token,
    options
  ).request<NotionUserResponse>({ method: "GET", path: "/users/me" });
  if (user.type !== "bot" || typeof user.id !== "string") {
    throw new ConnectorError("unauthorized");
  }
  return {
    botId: user.id,
    name: user.name ?? null,
    workspaceName: user.bot?.workspace_name ?? null,
  };
}

interface NotionSearchResponse {
  has_more?: boolean;
  next_cursor?: string | null;
  results?: { id?: string; object?: string; title?: unknown; url?: string }[];
}

function databaseSummaries(
  response: NotionSearchResponse
): NotionDatabaseSummary[] {
  return (response.results ?? []).flatMap((result) =>
    result.object === "database" && typeof result.id === "string"
      ? [
          {
            id: result.id,
            title: plainText(result.title),
            url: typeof result.url === "string" ? result.url : null,
          },
        ]
      : []
  );
}

function nextCursor(response: {
  has_more?: boolean;
  next_cursor?: string | null;
}): string | undefined {
  return response.has_more && response.next_cursor
    ? response.next_cursor
    : undefined;
}

/** Databases shared with the integration, following search pagination. */
export async function listNotionDatabases(
  token: string,
  options?: ConnectorOptions
): Promise<NotionDatabaseSummary[]> {
  const client = createNotionClient(token, options);
  const databases: NotionDatabaseSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    // Pages are sequential: each needs the previous cursor.
    const response = await client.request<NotionSearchResponse>({
      method: "POST",
      path: "/search",
      body: {
        filter: { property: "object", value: "database" },
        page_size: SEARCH_PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    });
    databases.push(...databaseSummaries(response));
    cursor = nextCursor(response);
    if (!cursor) {
      break;
    }
  }
  return databases;
}

interface NotionOptionList {
  options?: { color?: string; name?: string }[];
}

interface NotionDatabaseResponse {
  id?: string;
  properties?: Record<
    string,
    {
      id?: string;
      multi_select?: NotionOptionList;
      name?: string;
      select?: NotionOptionList;
      status?: NotionOptionList;
      type?: string;
    }
  >;
  title?: unknown;
  url?: string;
}

type NotionPropertyResponse = NonNullable<
  NotionDatabaseResponse["properties"]
>[string];

function propertyOptions(
  property: NotionPropertyResponse
): NotionPropertySchema["options"] {
  const source = property.select ?? property.multi_select ?? property.status;
  if (!source?.options) {
    return;
  }
  return source.options.flatMap((option) =>
    typeof option.name === "string"
      ? [
          {
            name: option.name,
            ...(option.color ? { color: option.color } : {}),
          },
        ]
      : []
  );
}

function propertySchema(
  key: string,
  property: NotionPropertyResponse
): NotionPropertySchema[] {
  if (typeof property.type !== "string") {
    return [];
  }
  const options = propertyOptions(property);
  return [
    {
      id: property.id ?? key,
      name: property.name ?? key,
      type: property.type,
      ...(options ? { options } : {}),
    },
  ];
}

async function readDatabaseSchema(
  client: NotionClient,
  databaseId: string
): Promise<NotionDatabaseSchema> {
  const database = await client.request<NotionDatabaseResponse>({
    method: "GET",
    path: `/databases/${databaseId}`,
  });
  return {
    id: database.id ?? databaseId,
    title: plainText(database.title),
    url: typeof database.url === "string" ? database.url : null,
    properties: Object.entries(database.properties ?? {}).flatMap(
      ([key, property]) => propertySchema(key, property)
    ),
  };
}

/** A database's title and properties, with select and status options. */
export async function getNotionDatabaseSchema(
  token: string,
  databaseId: string,
  options?: ConnectorOptions
): Promise<NotionDatabaseSchema> {
  const id = normalizeNotionId(databaseId);
  return await readDatabaseSchema(createNotionClient(token, options), id);
}

// Push -------------------------------------------------------------------------

export interface NotionPushInput {
  databaseId: string;
  /** Column id to Notion property name, and the key property. */
  mapping: ConnectorMapping;
  /** Default and upper bound: `MAX_NOTION_PUSH_ROWS`. */
  maxRows?: number;
  rows: readonly ConnectorRow[];
  token: string;
}

interface PushTarget {
  columnId: string;
  property: NotionPropertySchema;
}

/** A property by its stable id first (renames keep it), then by name. */
function findProperty(
  schema: NotionDatabaseSchema,
  name: string,
  id: string | undefined
): NotionPropertySchema | undefined {
  return (
    (id ? schema.properties.find((item) => item.id === id) : undefined) ??
    schema.properties.find((item) => item.name === name)
  );
}

function resolveKeyProperty(
  schema: NotionDatabaseSchema,
  name: string,
  id?: string
): NotionPropertySchema {
  const property = findProperty(schema, name, id);
  if (!(property && KEY_PROPERTY_TYPES.has(property.type))) {
    throw new ConnectorError("invalid_mapping");
  }
  return property;
}

/** Computed properties a sync can read but never write. */
const READ_ONLY_READABLE_TYPES = new Set([
  "formula",
  "created_time",
  "last_edited_time",
  "unique_id",
]);

function targetIssue(
  property: NotionPropertySchema | undefined,
  used: ReadonlySet<string>,
  mode: "read" | "write"
): ConnectorWarningReason | null {
  if (!property) {
    return "property_missing";
  }
  if (used.has(property.name)) {
    return "property_in_use";
  }
  if (mode === "read" && READ_ONLY_READABLE_TYPES.has(property.type)) {
    return null;
  }
  return toNotionPropertyValue(property, null).ok
    ? null
    : "unsupported_property_type";
}

function resolveTargets(
  schema: NotionDatabaseSchema,
  mapping: ConnectorMapping,
  keyProperty: NotionPropertySchema,
  result: ConnectorPushResult,
  mode: "read" | "write" = "write"
): PushTarget[] {
  const targets: PushTarget[] = [];
  const used = new Set<string>([keyProperty.name]);
  for (const [columnId, propertyName] of Object.entries(mapping.properties)) {
    const property = findProperty(
      schema,
      propertyName,
      mapping.propertyIds?.[columnId]
    );
    const issue = targetIssue(property, used, mode);
    if (issue || !property) {
      addWarning(result, { columnId, reason: issue ?? "property_missing" });
    } else {
      used.add(property.name);
      targets.push({ columnId, property });
    }
  }
  return targets;
}

function keyFilter(property: NotionPropertySchema, key: string) {
  if (property.type === "number") {
    return { property: property.name, number: { equals: Number(key) } };
  }
  return { property: property.name, [property.type]: { equals: key } };
}

type NotionPageProperties = Record<string, Record<string, unknown>>;

function readKey(
  page: { properties?: NotionPageProperties },
  property: NotionPropertySchema
): string | null {
  const value = page.properties?.[property.name];
  if (!value) {
    return null;
  }
  if (property.type === "number") {
    return typeof value.number === "number" ? String(value.number) : null;
  }
  return plainText(value[property.type]) || null;
}

interface NotionQueryResponse {
  has_more?: boolean;
  next_cursor?: string | null;
  results?: { id?: string; properties?: NotionPageProperties }[];
}

async function queryKeyBatch(
  client: NotionClient,
  databaseId: string,
  keyProperty: NotionPropertySchema,
  keys: readonly string[],
  pages: Map<string, string>
) {
  const filter =
    keys.length === 1
      ? keyFilter(keyProperty, keys[0] ?? "")
      : { or: keys.map((key) => keyFilter(keyProperty, key)) };
  const path = `/databases/${databaseId}/query?filter_properties=${encodeURIComponent(keyProperty.id)}`;
  let cursor: string | undefined;
  do {
    // Result pages are sequential: each needs the previous cursor.
    const response = await client.request<NotionQueryResponse>({
      method: "POST",
      path,
      body: {
        filter,
        page_size: QUERY_PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    });
    for (const page of response.results ?? []) {
      const key = readKey(page, keyProperty);
      if (key && typeof page.id === "string" && !pages.has(key)) {
        pages.set(key, page.id);
      }
    }
    cursor = nextCursor(response);
  } while (cursor);
}

async function findExistingPages(
  client: NotionClient,
  databaseId: string,
  keyProperty: NotionPropertySchema,
  keys: readonly string[]
): Promise<Map<string, string>> {
  const pages = new Map<string, string>();
  for (let index = 0; index < keys.length; index += KEY_QUERY_BATCH_SIZE) {
    // Batches share the rate limiter, so they run one after another.
    await queryKeyBatch(
      client,
      databaseId,
      keyProperty,
      keys.slice(index, index + KEY_QUERY_BATCH_SIZE),
      pages
    );
  }
  return pages;
}

function rowProperties(
  row: ConnectorRow,
  keyProperty: NotionPropertySchema,
  targets: readonly PushTarget[],
  result: ConnectorPushResult
): Record<string, unknown> {
  const key = toNotionPropertyValue(keyProperty, row.id);
  const properties = new Map<string, unknown>(
    key.ok ? [[keyProperty.name, key.payload]] : []
  );
  for (const target of targets) {
    const conversion = toNotionPropertyValue(
      target.property,
      row.values[target.columnId]
    );
    const reason = conversion.ok ? conversion.warning : conversion.reason;
    if (conversion.ok) {
      properties.set(target.property.name, conversion.payload);
    }
    if (reason) {
      addWarning(result, { rowId: row.id, columnId: target.columnId, reason });
    }
  }
  return Object.fromEntries(properties);
}

async function writeRow(
  client: NotionClient,
  databaseId: string,
  pageId: string | undefined,
  properties: Record<string, unknown>
): Promise<"created" | "updated"> {
  if (pageId) {
    await client.request({
      method: "PATCH",
      path: `/pages/${normalizeNotionId(pageId)}`,
      body: { properties },
    });
    return "updated";
  }
  // Creating a page is retried only on 429: a timeout after a successful
  // write must never create the page twice.
  await client.request({
    method: "POST",
    path: "/pages",
    body: { parent: { database_id: databaseId }, properties },
    retry: "rate_limit_only",
  });
  return "created";
}

/**
 * Upserts one Notion page per row, keyed by `mapping.keyProperty` (a title,
 * text or number property holding the row id, "Yayaw ID" by default). Rows
 * are written one at a time behind the rate limiter. A failing row is recorded
 * and the push continues, except for a revoked token or a database that is no
 * longer shared, which stop it with a `ConnectorError`.
 */
export async function pushRowsToNotionDatabase(
  input: NotionPushInput,
  options?: ConnectorOptions
): Promise<ConnectorPushResult> {
  const client = createNotionClient(input.token, options);
  const databaseId = normalizeNotionId(input.databaseId);
  const schema = await readDatabaseSchema(client, databaseId);
  const keyProperty = resolveKeyProperty(
    schema,
    input.mapping.keyProperty ?? DEFAULT_NOTION_KEY_PROPERTY,
    input.mapping.keyPropertyId
  );
  const result = createPushResult();
  const targets = resolveTargets(schema, input.mapping, keyProperty, result);
  const rows = acceptRows(
    input.rows,
    {
      maxRows: Math.min(
        input.maxRows ?? MAX_NOTION_PUSH_ROWS,
        MAX_NOTION_PUSH_ROWS
      ),
      isValidId: (id) => keyProperty.type !== "number" || NUMERIC_KEY.test(id),
    },
    result
  );
  const existing = await findExistingPages(
    client,
    databaseId,
    keyProperty,
    rows.map((row) => row.id)
  );
  for (const row of rows) {
    try {
      // Rows are written one at a time behind the rate limiter.
      const outcome = await writeRow(
        client,
        databaseId,
        existing.get(row.id),
        rowProperties(row, keyProperty, targets, result)
      );
      result[outcome] += 1;
    } catch (error) {
      if (!(error instanceof ConnectorError) || STOP_CODES.has(error.code)) {
        throw error;
      }
      addFailure(result, { code: error.code, rowId: row.id, rows: 1 });
    }
  }
  return result;
}

// Read and sync ----------------------------------------------------------------

const MILLISECONDS_PER_MINUTE = 60_000;

function optionValue(option: unknown): string | null {
  const name = (option as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name : null;
}

function optionValues(options: unknown): string[] {
  return Array.isArray(options)
    ? options.flatMap((option) => optionValue(option) ?? [])
    : [];
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function dateValue(date: unknown): string | null {
  return stringOrNull((date as { start?: unknown } | null)?.start);
}

function formulaValue(formula: unknown): unknown {
  const result = formula as {
    type?: string;
    string?: unknown;
    number?: unknown;
    boolean?: unknown;
    date?: unknown;
  } | null;
  switch (result?.type) {
    case "string":
      return stringOrNull(result.string);
    case "number":
      return typeof result.number === "number" ? result.number : null;
    case "boolean":
      return result.boolean === true;
    case "date":
      return dateValue(result.date);
    default:
      return null;
  }
}

function uniqueIdValue(uniqueId: unknown): string | null {
  const id = uniqueId as { prefix?: unknown; number?: unknown } | null;
  if (typeof id?.number !== "number") {
    return null;
  }
  return typeof id.prefix === "string" && id.prefix
    ? `${id.prefix}-${id.number}`
    : String(id.number);
}

/**
 * The plain value of a Notion property, symmetric with
 * `toNotionPropertyValue`: text for title and rich text, a number, the option
 * name of a select or status, option names of a multi-select, the start of a
 * date, a boolean, or text for url, email and phone; formulas give their
 * result, created and edited times their ISO text and unique ids
 * `PREFIX-12`. Returns `undefined` for types the connector cannot read
 * (relations, people, rollups…).
 */
export function fromNotionPropertyValue(
  value: Record<string, unknown> | undefined,
  type: string
): unknown {
  if (!value) {
    return;
  }
  switch (type) {
    case "title":
    case "rich_text":
      return plainText(value[type]);
    case "number":
      return typeof value.number === "number" ? value.number : null;
    case "select":
    case "status":
      return optionValue(value[type]);
    case "multi_select":
      return optionValues(value.multi_select);
    case "date":
      return dateValue(value.date);
    case "checkbox":
      return value.checkbox === true;
    case "url":
    case "email":
    case "phone_number":
    case "created_time":
    case "last_edited_time":
      return stringOrNull(value[type]);
    case "formula":
      return formulaValue(value.formula);
    case "unique_id":
      return uniqueIdValue(value.unique_id);
    default:
      return;
  }
}

export interface NotionSyncInput {
  databaseId: string;
  /** Mapped columns (property names and column types) and the key property. */
  mapping: SyncMapping;
  token: string;
}

export interface NotionReadInput extends NotionSyncInput {
  /**
   * Only pages edited at or after this time. Notion records edit times to the
   * minute, so the filter starts at the beginning of that minute. Pass the
   * result to `planSync` with `targetPartial: true`.
   */
  since?: Date | number | string;
}

interface SyncTarget extends PushTarget {
  type?: string;
}

interface NotionSyncContext {
  client: NotionClient;
  databaseId: string;
  keyProperty: NotionPropertySchema;
  targets: SyncTarget[];
}

function toConnectorMapping(mapping: SyncMapping): ConnectorMapping {
  const ids = mapping.fields.flatMap((field) =>
    field.fieldId ? [[field.columnId, field.fieldId] as const] : []
  );
  return {
    keyProperty: mapping.keyField ?? DEFAULT_NOTION_KEY_PROPERTY,
    ...(mapping.keyFieldId ? { keyPropertyId: mapping.keyFieldId } : {}),
    properties: Object.fromEntries(
      mapping.fields.map((field) => [field.columnId, field.field])
    ),
    ...(ids.length > 0 ? { propertyIds: Object.fromEntries(ids) } : {}),
  };
}

async function loadSyncContext(
  client: NotionClient,
  input: NotionSyncInput
): Promise<NotionSyncContext> {
  const databaseId = normalizeNotionId(input.databaseId);
  const schema = await readDatabaseSchema(client, databaseId);
  const mapping = toConnectorMapping(input.mapping);
  const keyProperty = resolveKeyProperty(
    schema,
    mapping.keyProperty ?? DEFAULT_NOTION_KEY_PROPERTY,
    mapping.keyPropertyId
  );
  // Unusable properties are left out; computed ones are read, never written.
  const resolved = resolveTargets(
    schema,
    mapping,
    keyProperty,
    createPushResult(),
    "read"
  );
  const types = new Map(
    input.mapping.fields.map((field) => [field.columnId, field.type])
  );
  const targets = resolved.map((target) => ({
    ...target,
    type: types.get(target.columnId),
  }));
  return { client, databaseId, keyProperty, targets };
}

function sinceFilter(since: NotionReadInput["since"]) {
  if (since === undefined) {
    return;
  }
  const time = new Date(since).getTime();
  if (Number.isNaN(time)) {
    throw new ConnectorError("invalid_request");
  }
  const minute = Math.floor(time / MILLISECONDS_PER_MINUTE);
  return {
    timestamp: "last_edited_time",
    last_edited_time: {
      on_or_after: new Date(minute * MILLISECONDS_PER_MINUTE).toISOString(),
    },
  };
}

interface NotionPage {
  archived?: boolean;
  id?: string;
  in_trash?: boolean;
  last_edited_time?: string;
  properties?: NotionPageProperties;
}

function pageRecord(
  context: NotionSyncContext,
  page: NotionPage
): SyncRecord[] {
  if (typeof page.id !== "string" || page.archived || page.in_trash) {
    return [];
  }
  const values = new Map<string, unknown>();
  for (const target of context.targets) {
    const raw = fromNotionPropertyValue(
      page.properties?.[target.property.name],
      target.property.type
    );
    if (raw !== undefined) {
      values.set(target.columnId, normalizeSyncValue(raw, target.type));
    }
  }
  const key = readKey(page, context.keyProperty);
  return [
    {
      id: page.id,
      ...(key ? { key } : {}),
      ...(page.last_edited_time ? { updatedAt: page.last_edited_time } : {}),
      values: Object.fromEntries(values),
    },
  ];
}

function queryPath(context: NotionSyncContext): string {
  const properties = [
    context.keyProperty,
    ...context.targets.map((target) => target.property),
  ];
  const query = properties
    .map((property) => `filter_properties=${encodeURIComponent(property.id)}`)
    .join("&");
  return `/databases/${context.databaseId}/query?${query}`;
}

interface NotionPageList {
  has_more?: boolean;
  next_cursor?: string | null;
  results?: NotionPage[];
}

async function readPages(
  context: NotionSyncContext,
  since: NotionReadInput["since"]
): Promise<SyncRecord[]> {
  const filter = sinceFilter(since);
  const path = queryPath(context);
  const records: SyncRecord[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    // Result pages are sequential: each needs the previous cursor.
    const response = await context.client.request<NotionPageList>({
      method: "POST",
      path,
      body: {
        page_size: QUERY_PAGE_SIZE,
        ...(filter ? { filter } : {}),
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    });
    records.push(
      ...(response.results ?? []).flatMap((page) => pageRecord(context, page))
    );
    cursor = nextCursor(response);
    // A cursor seen twice would loop forever.
    if (cursor && seen.has(cursor)) {
      throw new ConnectorError("provider_unavailable");
    }
    seen.add(cursor ?? "");
  } while (cursor);
  return records;
}

/**
 * Reads every page of a database (or those edited since `since`) as sync
 * records: the page id, the "Yayaw ID" key, `last_edited_time` as
 * `updatedAt`, and the mapped properties converted back to plain values and
 * normalized by column type. Archived pages are left out. Throws
 * `invalid_mapping` when the key property is missing.
 */
export async function readNotionDatabase(
  input: NotionReadInput,
  options?: ConnectorOptions
): Promise<SyncRecord[]> {
  const client = createNotionClient(input.token, options);
  return await readPages(await loadSyncContext(client, input), input.since);
}

function syncProperties(
  context: NotionSyncContext,
  item: SyncWrite
): Record<string, unknown> {
  const properties = new Map<string, unknown>();
  const key =
    item.key === undefined
      ? undefined
      : toNotionPropertyValue(context.keyProperty, item.key);
  if (key?.ok) {
    properties.set(context.keyProperty.name, key.payload);
  }
  for (const target of context.targets) {
    const conversion = Object.hasOwn(item.values, target.columnId)
      ? toNotionPropertyValue(target.property, item.values[target.columnId])
      : undefined;
    if (conversion?.ok) {
      properties.set(target.property.name, conversion.payload);
    }
  }
  return Object.fromEntries(properties);
}

/**
 * Writes pages one at a time behind the rate limiter. A revoked token or a
 * missing capability stops with its error; other errors fail their item.
 */
async function eachPage<T>(
  items: readonly T[],
  write: (item: T) => Promise<string | undefined>,
  missingIsDone = false
): Promise<SyncItemResult[]> {
  const results: SyncItemResult[] = [];
  for (const item of items) {
    try {
      // Pages are written one at a time behind the rate limiter.
      const id = await write(item);
      results.push(id ? { ok: true, id } : { ok: true });
    } catch (error) {
      if (!(error instanceof ConnectorError) || STOP_CODES.has(error.code)) {
        throw error;
      }
      const done = missingIsDone && error.code === "not_found";
      results.push(done ? { ok: true } : { ok: false, code: error.code });
    }
  }
  return results;
}

export interface NotionSyncTarget extends Required<SyncSideAdapter> {
  read(since?: NotionReadInput["since"]): Promise<SyncRecord[]>;
}

/**
 * The target adapter of `applySyncPlan` for one database, sharing one client
 * and rate limiter: `read` lists pages, `create` adds pages keyed by "Yayaw
 * ID" (retried only on 429), `update` patches the given properties and the
 * key, and `delete` archives pages (Notion's trash; a missing page counts as
 * deleted).
 */
export function createNotionSyncTarget(
  input: NotionSyncInput,
  options?: ConnectorOptions
): NotionSyncTarget {
  const client = createNotionClient(input.token, options);
  let pending: Promise<NotionSyncContext> | undefined;
  const context = () => {
    pending ??= loadSyncContext(client, input);
    return pending;
  };
  return {
    read: async (since) => await readPages(await context(), since),
    async create(items) {
      const sync = await context();
      return await eachPage(items, async (item) => {
        // Creating a page is retried only on 429: it must never run twice.
        const page = await client.request<{ id?: unknown }>({
          method: "POST",
          path: "/pages",
          body: {
            parent: { database_id: sync.databaseId },
            properties: syncProperties(sync, item),
          },
          retry: "rate_limit_only",
        });
        return typeof page.id === "string" ? page.id : undefined;
      });
    },
    async update(items) {
      const sync = await context();
      return await eachPage(items, async (item) => {
        await client.request({
          method: "PATCH",
          path: `/pages/${normalizeNotionId(item.id ?? "")}`,
          body: { properties: syncProperties(sync, item) },
        });
        return item.id;
      });
    },
    async delete(ids) {
      await context();
      return await eachPage(
        ids,
        async (id) => {
          await client.request({
            method: "PATCH",
            path: `/pages/${normalizeNotionId(id)}`,
            body: { archived: true },
          });
          return id;
        },
        true
      );
    },
  };
}

// Schema health --------------------------------------------------------------------

/** A database as the shared `checkTargetSchema` takes it (`targetSchema`). */
export function notionTargetSchema(
  schema: Pick<NotionDatabaseSchema, "properties">
): {
  provider: "notion";
  fields: {
    name: string;
    id: string;
    type: string;
    options?: { name: string; color?: string }[];
  }[];
} {
  return {
    provider: "notion",
    fields: schema.properties.map((property) => ({
      name: property.name,
      id: property.id,
      type: property.type,
      ...(property.options ? { options: property.options } : {}),
    })),
  };
}

/**
 * An additive change `prepareNotionDatabase` makes: a property to create, or
 * options to add to a select or multi-select. Structural copy of the shared
 * `SchemaFix`, so a report's `fixes` pass straight through.
 */
export type NotionSchemaFix =
  | {
      kind: "create_field";
      field: string;
      type: string;
      options?: { name: string; color?: string }[];
      columnId?: string;
      key?: boolean;
    }
  | {
      kind: "add_options";
      field: string;
      fieldId?: string;
      type: string;
      options: { name: string; color?: string }[];
    };

export interface NotionPrepareInput {
  databaseId: string;
  fixes: readonly NotionSchemaFix[];
  token: string;
}

export interface NotionPrepareResult {
  /** What was changed; empty when the database already matched. */
  applied: NotionSchemaFix[];
  /** Fixes left out: an unsupported type, an invalid option, a missing select. */
  skipped: { field: string; option?: string; reason: string }[];
}

const CREATABLE_TYPES = new Set([
  "rich_text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "url",
  "email",
  "phone_number",
]);
const OPTION_TYPES = new Set(["select", "multi_select"]);
const NOTION_COLORS = new Set([
  "default",
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
]);

const looseName = (name: string) => name.trim().toLowerCase();

const optionPayload = (option: { name: string; color?: string }) => ({
  name: option.name,
  ...(option.color && NOTION_COLORS.has(option.color)
    ? { color: option.color }
    : {}),
});

/** Notion refuses commas in option names and names over 100 characters. */
const validOption = (name: string) =>
  name.trim() !== "" && !name.includes(",") && name.length <= OPTION_MAX_LENGTH;

interface PreparePlan {
  properties: Map<string, unknown>;
  applied: NotionSchemaFix[];
  skipped: NotionPrepareResult["skipped"];
}

function newOptions(
  options: readonly { name: string; color?: string }[],
  known: Set<string>,
  plan: PreparePlan,
  field: string
): { name: string; color?: string }[] {
  const added: { name: string; color?: string }[] = [];
  for (const option of options) {
    const name = option.name.trim();
    if (!validOption(name)) {
      plan.skipped.push({
        field,
        option: option.name,
        reason: "invalid_option",
      });
    } else if (!known.has(looseName(name))) {
      known.add(looseName(name));
      added.push({ ...option, name });
    }
  }
  return added;
}

function planCreate(
  fix: Extract<NotionSchemaFix, { kind: "create_field" }>,
  names: Set<string>,
  plan: PreparePlan
): void {
  const name = fix.field.trim();
  // An existing property is never changed, whatever its type.
  if (!name || names.has(looseName(name))) {
    return;
  }
  if (!CREATABLE_TYPES.has(fix.type)) {
    plan.skipped.push({ field: name, reason: "unsupported_property_type" });
    return;
  }
  names.add(looseName(name));
  const options = OPTION_TYPES.has(fix.type)
    ? newOptions(fix.options ?? [], new Set(), plan, name)
    : [];
  plan.properties.set(name, {
    [fix.type]: OPTION_TYPES.has(fix.type)
      ? { options: options.map(optionPayload) }
      : {},
  });
  const { options: _requested, ...rest } = fix;
  plan.applied.push({
    ...rest,
    field: name,
    ...(options.length > 0 ? { options } : {}),
  });
}

function planOptions(
  fix: Extract<NotionSchemaFix, { kind: "add_options" }>,
  schema: NotionDatabaseSchema,
  plan: PreparePlan
): void {
  const property = findProperty(schema, fix.field, fix.fieldId);
  // Never change a type: options only go to an existing select.
  if (!(property && OPTION_TYPES.has(property.type))) {
    plan.skipped.push({ field: fix.field, reason: "property_missing" });
    return;
  }
  const existing = property.options ?? [];
  const known = new Set(existing.map((option) => looseName(option.name)));
  const added = newOptions(fix.options, known, plan, property.name);
  if (added.length === 0) {
    return;
  }
  // Notion replaces the option list: every existing option is sent back.
  plan.properties.set(property.id, {
    [property.type]: {
      options: [...existing, ...added].map(optionPayload),
    },
  });
  plan.applied.push({
    kind: "add_options",
    field: property.name,
    fieldId: property.id,
    type: property.type,
    options: added,
  });
}

/**
 * What `prepareNotionDatabase` would send for a schema (pure): properties to
 * create (missing ones only) and options to add (missing ones only). Nothing
 * existing is deleted, renamed or retyped, so running it twice changes
 * nothing the second time.
 */
export function planNotionPrepare(
  schema: NotionDatabaseSchema,
  fixes: readonly NotionSchemaFix[]
): {
  properties: Record<string, unknown>;
  applied: NotionSchemaFix[];
  skipped: NotionPrepareResult["skipped"];
} {
  const plan: PreparePlan = {
    properties: new Map(),
    applied: [],
    skipped: [],
  };
  const names = new Set(schema.properties.map((item) => looseName(item.name)));
  for (const fix of fixes) {
    if (fix.kind === "create_field") {
      planCreate(fix, names, plan);
    } else {
      planOptions(fix, schema, plan);
    }
  }
  return {
    properties: Object.fromEntries(plan.properties),
    applied: plan.applied,
    skipped: plan.skipped,
  };
}

/**
 * Makes a database ready for the table: creates missing properties with the
 * right type (including "Yayaw ID" as text) and adds missing select and
 * multi-select options with the table's colors, in one `PATCH /databases`
 * request. It reads the database first and never deletes, renames or changes
 * the type of an existing property; status options cannot be added through
 * the API. Idempotent: `applied` is empty when nothing was missing.
 */
export async function prepareNotionDatabase(
  input: NotionPrepareInput,
  options?: ConnectorOptions
): Promise<NotionPrepareResult> {
  const client = createNotionClient(input.token, options);
  const databaseId = normalizeNotionId(input.databaseId);
  const schema = await readDatabaseSchema(client, databaseId);
  const plan = planNotionPrepare(schema, input.fixes);
  if (plan.applied.length > 0) {
    await client.request({
      method: "PATCH",
      path: `/databases/${databaseId}`,
      body: { properties: plan.properties },
    });
  }
  return { applied: plan.applied, skipped: plan.skipped };
}

export interface NotionPageSummary {
  id: string;
  title: string;
  url: string | null;
}

interface NotionPageSearchResponse {
  has_more?: boolean;
  next_cursor?: string | null;
  results?: {
    id?: string;
    object?: string;
    properties?: Record<string, { title?: unknown; type?: string }>;
    url?: string;
  }[];
}

function pageTitle(
  properties: Record<string, { title?: unknown; type?: string }> | undefined
): string {
  const title = Object.values(properties ?? {}).find(
    (property) => property.type === "title"
  );
  return plainText(title?.title);
}

function pageSummaries(
  response: NotionPageSearchResponse
): NotionPageSummary[] {
  return (response.results ?? []).flatMap((result) =>
    result.object === "page" && typeof result.id === "string"
      ? [
          {
            id: result.id,
            title: pageTitle(result.properties),
            url: typeof result.url === "string" ? result.url : null,
          },
        ]
      : []
  );
}

/**
 * Pages shared with the integration, following search pagination: the
 * parents a new database can be created in.
 */
export async function listNotionPages(
  token: string,
  options?: ConnectorOptions
): Promise<NotionPageSummary[]> {
  const client = createNotionClient(token, options);
  const pages: NotionPageSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    // Pages are sequential: each needs the previous cursor.
    const response = await client.request<NotionPageSearchResponse>({
      method: "POST",
      path: "/search",
      body: {
        filter: { property: "object", value: "page" },
        page_size: SEARCH_PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    });
    pages.push(...pageSummaries(response));
    cursor = nextCursor(response);
    if (!cursor) {
      break;
    }
  }
  return pages;
}

/** A table column for a new database; options carry Notion colors. */
export interface NotionNewDatabaseColumn extends ConnectorColumn {
  options?: { name: string; color?: string }[];
}

export interface NotionCreateDatabaseInput {
  columns: readonly NotionNewDatabaseColumn[];
  /** Default "Yayaw ID". */
  keyProperty?: string;
  parentPageId: string;
  title: string;
  /** Column filling the page title; default the first text column. */
  titleColumnId?: string;
  token: string;
}

export interface NotionCreatedDatabase {
  id: string;
  /** The mapping to save: every column, with property ids. */
  mapping: Required<Pick<ConnectorMapping, "keyProperty" | "properties">> &
    Pick<ConnectorMapping, "keyPropertyId" | "propertyIds">;
  title: string;
  url: string | null;
}

const NEW_PROPERTY_TYPES: Record<string, string> = {
  number: "number",
  currency: "number",
  percent: "number",
  rating: "number",
  date: "date",
  datetime: "date",
  boolean: "checkbox",
  checkbox: "checkbox",
  select: "select",
  status: "select",
  tag: "select",
  multiSelect: "multi_select",
  tags: "multi_select",
  url: "url",
  email: "email",
  phone: "phone_number",
};

const TITLE_COLUMN_TYPES = new Set([undefined, "text", "longText", "textarea"]);

function newPropertyConfig(
  column: NotionNewDatabaseColumn
): Record<string, unknown> {
  const type = NEW_PROPERTY_TYPES[column.type ?? "text"] ?? "rich_text";
  if (!OPTION_TYPES.has(type)) {
    return { [type]: {} };
  }
  const options = (column.options ?? []).filter((option) =>
    validOption(option.name)
  );
  return { [type]: { options: options.map(optionPayload) } };
}

/** Properties of a new database: one title, the key, one per column (pure). */
export function planNotionDatabase(
  columns: readonly NotionNewDatabaseColumn[],
  keyProperty: string,
  titleColumnId?: string
): { properties: Record<string, unknown>; columnFor: Map<string, string> } {
  const titleColumn =
    columns.find((column) => column.id === titleColumnId) ??
    columns.find((column) => TITLE_COLUMN_TYPES.has(column.type));
  const properties = new Map<string, unknown>();
  const columnFor = new Map<string, string>();
  const used = new Set<string>([looseName(keyProperty)]);
  // Without a text column, the record id becomes the page title.
  properties.set(keyProperty, titleColumn ? { rich_text: {} } : { title: {} });
  const ordered = titleColumn
    ? [titleColumn, ...columns.filter((column) => column !== titleColumn)]
    : columns;
  for (const column of ordered) {
    const name = column.header.trim();
    if (name && !used.has(looseName(name))) {
      used.add(looseName(name));
      properties.set(
        name,
        column === titleColumn ? { title: {} } : newPropertyConfig(column)
      );
      columnFor.set(name, column.id);
    }
  }
  return { properties: Object.fromEntries(properties), columnFor };
}

/**
 * Creates a database under a page shared with the integration, with one
 * property per column (the right Notion type, select options with their
 * colors), a title property filled by the first text column (or by the
 * record id when there is none) and the "Yayaw ID" key. Returns the new
 * database and the mapping to save, with property ids.
 */
export async function createNotionDatabase(
  input: NotionCreateDatabaseInput,
  options?: ConnectorOptions
): Promise<NotionCreatedDatabase> {
  const keyProperty = input.keyProperty?.trim() || DEFAULT_NOTION_KEY_PROPERTY;
  const layout = planNotionDatabase(
    input.columns,
    keyProperty,
    input.titleColumnId
  );
  const client = createNotionClient(input.token, options);
  // Creating a database is retried only on 429: it must never run twice.
  const database = await client.request<NotionDatabaseResponse>({
    method: "POST",
    path: "/databases",
    body: {
      parent: {
        type: "page_id",
        page_id: normalizeNotionId(input.parentPageId),
      },
      title: toRichText(input.title.trim() || "Yayaw").items,
      properties: layout.properties,
    },
    retry: "rate_limit_only",
  });
  if (typeof database.id !== "string") {
    throw new ConnectorError("provider_unavailable");
  }
  const properties = Object.entries(database.properties ?? {}).flatMap(
    ([key, property]) => propertySchema(key, property)
  );
  const key = properties.find((item) => item.name === keyProperty);
  const mapped = properties.flatMap((property) => {
    const columnId = layout.columnFor.get(property.name);
    return columnId ? [{ columnId, property }] : [];
  });
  return {
    id: database.id,
    title: plainText(database.title),
    url: typeof database.url === "string" ? database.url : null,
    mapping: {
      keyProperty,
      ...(key ? { keyPropertyId: key.id } : {}),
      properties: Object.fromEntries(
        mapped.map(({ columnId, property }) => [columnId, property.name])
      ),
      propertyIds: Object.fromEntries(
        mapped.map(({ columnId, property }) => [columnId, property.id])
      ),
    },
  };
}
