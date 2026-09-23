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
  return Array.isArray(value) ? arrayText(value) : undefined;
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

function resolveKeyProperty(
  schema: NotionDatabaseSchema,
  name: string
): NotionPropertySchema {
  const property = schema.properties.find((item) => item.name === name);
  if (!(property && KEY_PROPERTY_TYPES.has(property.type))) {
    throw new ConnectorError("invalid_mapping");
  }
  return property;
}

function targetIssue(
  property: NotionPropertySchema | undefined,
  used: ReadonlySet<string>
): ConnectorWarningReason | null {
  if (!property) {
    return "property_missing";
  }
  if (used.has(property.name)) {
    return "property_in_use";
  }
  return toNotionPropertyValue(property, null).ok
    ? null
    : "unsupported_property_type";
}

function resolveTargets(
  schema: NotionDatabaseSchema,
  mapping: ConnectorMapping,
  keyProperty: NotionPropertySchema,
  result: ConnectorPushResult
): PushTarget[] {
  const targets: PushTarget[] = [];
  const used = new Set<string>([keyProperty.name]);
  for (const [columnId, propertyName] of Object.entries(mapping.properties)) {
    const property = schema.properties.find(
      (item) => item.name === propertyName
    );
    const issue = targetIssue(property, used);
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
    input.mapping.keyProperty ?? DEFAULT_NOTION_KEY_PROPERTY
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
