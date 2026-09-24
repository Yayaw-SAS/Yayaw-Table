/**
 * Feed view model shared by the React and Vue editions (synced to Vue by
 * `contracts:sync`): settings, column defaults, list pages, dates, bodies,
 * authors, media, properties, groups, labels and the settings panel.
 */
import {
  mediaUrl,
  resolveGalleryMedia,
  type TableGalleryMediaConfig,
} from "./media-contract";
import { type ContractRecord, compatibleListParams } from "./table-contracts";
import { tagAppearance } from "./tag-colors";
import {
  type DateDisplayPreset,
  formatDateValue,
  formatNumberValue,
  type NumberFormatConfig,
  parseDateValue,
} from "./value-format";

export type FeedDateDisplay = "absolute" | "relative";
export type FeedDensity = "comfortable" | "compact";

/** A feed view's own settings, saved with views and in `<tableId>-feed`. */
export interface FeedViewSettings {
  /** Column shown as the card title. */
  titleColumn?: string;
  /** Column naming the author (text, or a person-like `{ name, avatarUrl }`); `null` shows none. */
  authorColumn?: string | null;
  /** Column holding the publication date; `null` shows none. */
  dateColumn?: string | null;
  /** Relative dates ("3 hr. ago", absolute on hover) or absolute dates. */
  dateDisplay?: FeedDateDisplay;
  /** Long text shown as the card body; `null` shows none. */
  bodyColumn?: string | null;
  /** Images or files shown under the body; `null` shows none. */
  mediaColumn?: string | null;
  /** Properties shown at the bottom of each card, in order. */
  propertyColumnIds?: string[];
  /** Show each property's column name before its value. */
  showPropertyLabels?: boolean;
  /** Lines of body shown before "Show more"; 0 never clamps. */
  bodyLines?: number;
  density?: FeedDensity;
  /** Records per page requested from `actions.list`. */
  pageSize?: number;
  /**
   * Load the next page when the end of the feed comes within a screen of the
   * viewport (on by default); off, "Load more" loads it.
   */
  infiniteScroll?: boolean;
}

/**
 * Renders a body value, e.g. markdown or sanitized HTML. React returns a
 * ReactNode, Vue a VNode or string. Without it the body is plain text.
 */
export type FeedBodyRenderer = (
  value: unknown,
  row: Record<string, unknown>
) => unknown;

/**
 * `table.feed` defaults. `renderBody` and `windowing` are host options, never
 * saved in views.
 */
export interface FeedTableSettings extends FeedViewSettings {
  renderBody?: FeedBodyRenderer;
  /**
   * Past this many loaded posts (`FEED_WINDOW_THRESHOLD`, 60, with `true` or
   * unset), only the posts near the viewport are rendered; the others keep
   * their measured height. `false` renders every post, e.g. so the browser's
   * find in page sees them all.
   */
  windowing?: boolean | number;
}

export interface ResolvedFeedSettings {
  titleColumn?: string;
  authorColumn?: string;
  dateColumn?: string;
  dateDisplay: FeedDateDisplay;
  bodyColumn?: string;
  mediaColumn?: string;
  propertyColumnIds: string[];
  showPropertyLabels: boolean;
  bodyLines: number;
  density: FeedDensity;
  pageSize: number;
  infiniteScroll: boolean;
}

export const FEED_DEFAULTS = {
  dateDisplay: "relative",
  showPropertyLabels: false,
  bodyLines: 4,
  density: "comfortable",
  pageSize: 10,
  infiniteScroll: true,
} as const satisfies Partial<ResolvedFeedSettings>;

export const FEED_MAX_BODY_LINES = 20;
export const FEED_MAX_PAGE_SIZE = 100;
/** Images shown at most on a card; the rest are counted. */
export const FEED_MAX_IMAGES = 4;
/** Videos shown at most on a card; the others are listed as files. */
export const FEED_MAX_VIDEOS = 2;
/** Loaded posts rendered in full before the feed renders only those near the viewport. */
export const FEED_WINDOW_THRESHOLD = 60;
/** Average characters per body line, to guess overflow before layout. */
const CHARS_PER_LINE = 80;
const FEED_DATE_DISPLAYS: readonly FeedDateDisplay[] = ["relative", "absolute"];
const FEED_DENSITIES: readonly FeedDensity[] = ["comfortable", "compact"];
const COLUMN_KEYS = [
  "authorColumn",
  "dateColumn",
  "bodyColumn",
  "mediaColumn",
] as const;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TEMPLATE_PARAM = /\{(\w+)\}/g;
const LINE_BREAK = /\r\n|\r|\n/;
const IMAGE_EXTENSION = /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i;
const VIDEO_EXTENSION = /\.(m4v|mov|mp4|ogv|webm)(\?|#|$)/i;
const WHITESPACE = /\s+/;
const URL_SUFFIX = /[?#]/;
const AUTHOR_HINT =
  /author|auteur|owner|creator|created.?by|posted.?by|writer|user|person|assignee/i;
const DATE_HINTS = [
  /posted|published|created|publi|cr[eé]{2}/i,
  /date|_at$|At$/,
];
const BODY_HINTS = [
  /body|content|contenu|update|post|message|comment/i,
  /description|details|notes?|summary|r[eé]sum[eé]|text/i,
];
const TEXT_TYPES = new Set(["text", "string", "code"]);
const OPTION_TYPES = new Set(["select", "multiSelect", "tag"]);
const MEDIA_TYPES = new Set(["image", "files", "collection"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const oneOf = <T extends string>(list: readonly T[], value: unknown) =>
  list.includes(value as T) ? (value as T) : undefined;

const cleanText = (value: unknown): string | undefined => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
};

const cleanIds = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ]
    : undefined;

const boundedInteger = (
  value: unknown,
  min: number,
  max: number
): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : undefined;
};

function normalizeColumns(
  input: Record<string, unknown>,
  normalized: FeedViewSettings
) {
  const title = cleanText(input.titleColumn);
  if (title) {
    normalized.titleColumn = title;
  }
  for (const key of COLUMN_KEYS) {
    if (input[key] === null) {
      normalized[key] = null;
      continue;
    }
    const id = cleanText(input[key]);
    if (id) {
      normalized[key] = id;
    }
  }
  const properties = cleanIds(input.propertyColumnIds);
  if (properties) {
    normalized.propertyColumnIds = properties;
  }
}

/** Keep only valid feed settings; unknown or malformed values are dropped. */
export function normalizeFeedViewConfig(
  value: unknown
): FeedViewSettings | undefined {
  if (!isRecord(value)) {
    return;
  }
  const normalized: FeedViewSettings = {};
  normalizeColumns(value, normalized);
  const extras: Partial<FeedViewSettings> = {
    dateDisplay: oneOf(FEED_DATE_DISPLAYS, value.dateDisplay),
    density: oneOf(FEED_DENSITIES, value.density),
    bodyLines: boundedInteger(value.bodyLines, 0, FEED_MAX_BODY_LINES),
    pageSize: boundedInteger(value.pageSize, 1, FEED_MAX_PAGE_SIZE),
    showPropertyLabels:
      typeof value.showPropertyLabels === "boolean"
        ? value.showPropertyLabels
        : undefined,
    infiniteScroll:
      typeof value.infiniteScroll === "boolean"
        ? value.infiniteScroll
        : undefined,
  };
  for (const [key, item] of Object.entries(extras)) {
    if (item !== undefined) {
      Object.assign(normalized, { [key]: item });
    }
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

// Columns ----------------------------------------------------------------------

/** A column as the feed reads it; both editions' column definitions fit. */
export interface FeedColumn {
  id: string;
  header?: string;
  type?: string;
  accessorKey?: string;
  accessorFn?: (row: never) => unknown;
  options?: readonly { value: unknown; label: string }[] | unknown;
  displayVariant?: string;
  numberFormat?: NumberFormatConfig;
  dateDisplayPreset?: DateDisplayPreset;
  dateFormat?: string;
  timeZone?: string;
  hour12?: boolean;
  tagColorMap?: Record<string, string>;
  coloredTags?: boolean;
}

const isDataColumn = (column: FeedColumn) =>
  column.id !== "select" &&
  column.id !== "actions" &&
  column.type !== "actions";

const columnName = (column: FeedColumn) =>
  `${column.id} ${column.header ?? ""}`;

export const isFeedTextColumn = (column: FeedColumn) =>
  TEXT_TYPES.has(column.type ?? "text");

export const isFeedOptionColumn = (column: FeedColumn) =>
  OPTION_TYPES.has(column.type ?? "") || column.displayVariant === "tag";

/** Columns the feed can use at all (no selection or action columns). */
export function feedColumns<T extends FeedColumn>(columns: readonly T[]): T[] {
  return columns.filter(isDataColumn);
}

/** The value of a column in a row, through its accessor when it has one. */
export function feedValue(
  row: Record<string, unknown>,
  column: FeedColumn | undefined
): unknown {
  if (!column) {
    return;
  }
  if (column.accessorFn) {
    return (column.accessorFn as (row: Record<string, unknown>) => unknown)(
      row
    );
  }
  return row[column.accessorKey ?? column.id];
}

const known = (columns: readonly FeedColumn[], id: string | undefined) =>
  id && columns.some((column) => column.id === id) ? id : undefined;

function firstMatching(
  columns: readonly FeedColumn[],
  hints: readonly RegExp[],
  accept: (column: FeedColumn) => boolean
): string | undefined {
  for (const hint of hints) {
    const match = columns.find(
      (column) => accept(column) && hint.test(columnName(column))
    );
    if (match) {
      return match.id;
    }
  }
}

function defaultTitle(columns: readonly FeedColumn[]): string | undefined {
  return (columns.find(isFeedTextColumn) ?? columns.at(0))?.id;
}

function defaultDate(columns: readonly FeedColumn[]): string | undefined {
  const isDate = (column: FeedColumn) => column.type === "date";
  return firstMatching(columns, DATE_HINTS, isDate) ?? columns.find(isDate)?.id;
}

/** A column choice: the view's, else the table's, else a guess; `null` means none. */
function chosenColumn(
  columns: readonly FeedColumn[],
  view: FeedViewSettings,
  defaults: FeedViewSettings,
  key: (typeof COLUMN_KEYS)[number],
  guess: () => string | undefined
): string | undefined {
  for (const source of [view, defaults]) {
    if (source[key] === null) {
      return;
    }
    const id = known(columns, source[key] ?? undefined);
    if (id) {
      return id;
    }
  }
  return guess();
}

function resolveColumns(
  columns: readonly FeedColumn[],
  defaults: FeedViewSettings,
  view: FeedViewSettings
) {
  const titleColumn =
    known(columns, view.titleColumn) ??
    known(columns, defaults.titleColumn) ??
    defaultTitle(columns);
  const others = columns.filter((column) => column.id !== titleColumn);
  const authorColumn = chosenColumn(
    columns,
    view,
    defaults,
    "authorColumn",
    () =>
      firstMatching(others, [AUTHOR_HINT], (column) => column.type !== "date")
  );
  const dateColumn = chosenColumn(columns, view, defaults, "dateColumn", () =>
    defaultDate(others)
  );
  const bodyColumn = chosenColumn(columns, view, defaults, "bodyColumn", () =>
    firstMatching(
      others.filter((column) => column.id !== authorColumn),
      BODY_HINTS,
      isFeedTextColumn
    )
  );
  const mediaColumn = chosenColumn(
    columns,
    view,
    defaults,
    "mediaColumn",
    () => others.find((column) => MEDIA_TYPES.has(column.type ?? ""))?.id
  );
  return { titleColumn, authorColumn, dateColumn, bodyColumn, mediaColumn };
}

/**
 * Defaults, then table settings, then the view's; columns that do not exist
 * are ignored and sensible ones are guessed. Properties never repeat the
 * title, author, date, body, media or grouped column.
 */
export function resolveFeedSettings(
  allColumns: readonly FeedColumn[],
  defaults: FeedViewSettings | undefined,
  view: FeedViewSettings | undefined,
  groupBy?: string
): ResolvedFeedSettings {
  const columns = feedColumns(allColumns);
  const table = normalizeFeedViewConfig(defaults) ?? {};
  const own = normalizeFeedViewConfig(view) ?? {};
  const merged = { ...FEED_DEFAULTS, ...table, ...own };
  const chosen = resolveColumns(columns, table, own);
  const used = new Set<string | undefined>([...Object.values(chosen), groupBy]);
  const candidates = columns.filter((column) => !used.has(column.id));
  const configured = merged.propertyColumnIds;
  const propertyColumnIds = configured
    ? configured.filter((id) => candidates.some((column) => column.id === id))
    : candidates.filter(isFeedOptionColumn).map((column) => column.id);
  return {
    ...chosen,
    dateDisplay: merged.dateDisplay,
    propertyColumnIds,
    showPropertyLabels: merged.showPropertyLabels,
    bodyLines: merged.bodyLines,
    density: merged.density,
    pageSize: merged.pageSize,
    infiniteScroll: merged.infiniteScroll,
  };
}

// Pages ----------------------------------------------------------------------

type FeedListAction = (params: ContractRecord) => Promise<{
  data: unknown[];
  meta?: { pageCount?: number; totalCount?: number };
}>;

const hasSort = (params: ContractRecord): boolean => {
  if (Array.isArray(params.sorting) && params.sorting.length > 0) {
    return true;
  }
  return isRecord(params.orderBy) && Object.keys(params.orderBy).length > 0;
};

/**
 * List parameters of a feed page: the view's query, sorted by the date column
 * (newest first) when the view has no sort of its own.
 */
export function feedListParams(
  params: ContractRecord,
  settings: Pick<ResolvedFeedSettings, "dateColumn" | "pageSize">,
  page: number,
  groupBy?: string
): ContractRecord {
  const sorted =
    hasSort(params) || !settings.dateColumn
      ? params
      : {
          ...params,
          sorting: [{ id: settings.dateColumn, desc: true }],
          orderBy: { [settings.dateColumn]: "desc" },
        };
  return compatibleListParams({
    ...sorted,
    ...(groupBy ? { grouping: [groupBy] } : {}),
    page,
    pageSize: settings.pageSize,
  });
}

const compareDates =
  (column: FeedColumn | undefined) =>
  (left: Record<string, unknown>, right: Record<string, unknown>) => {
    const a = parseDateValue(feedValue(left, column))?.getTime();
    const b = parseDateValue(feedValue(right, column))?.getTime();
    if (a === b) {
      return 0;
    }
    if (a === undefined) {
      return 1;
    }
    if (b === undefined) {
      return -1;
    }
    return b - a;
  };

function isLastPage(
  batch: number,
  meta: { pageCount?: number; totalCount?: number } | undefined,
  page: number,
  loaded: number,
  pageSize: number
): boolean {
  const pageCount = Number(meta?.pageCount);
  const totalCount = Number(meta?.totalCount);
  if (Number.isFinite(pageCount) && pageCount > 0) {
    return page >= pageCount;
  }
  if (Number.isFinite(totalCount) && totalCount >= 0) {
    return loaded >= totalCount;
  }
  return batch < pageSize;
}

export interface FeedPagesRequest {
  /** Server list action; pages come from the host. */
  list?: FeedListAction;
  /** Rows matching the query, used when there is no list action. */
  rows?: readonly unknown[];
  params?: ContractRecord;
  columns?: readonly FeedColumn[];
  settings: Pick<ResolvedFeedSettings, "dateColumn" | "pageSize">;
  groupBy?: string;
  /** First page to load (1-based). */
  page: number;
  /** Pages to load from `page` on, e.g. to reload what was shown. */
  pages?: number;
  signal?: AbortSignal;
}

export interface FeedPagesResult {
  rows: Record<string, unknown>[];
  /** Another page can be loaded after these. */
  hasMore: boolean;
  totalCount?: number;
}

function localPages(request: FeedPagesRequest): FeedPagesResult {
  const { columns = [], page, pages = 1, params = {}, settings } = request;
  const records = (request.rows ?? []).filter(isRecord);
  const dateColumn = columns.find(
    (column) => column.id === settings.dateColumn
  );
  const ordered =
    hasSort(params) || !dateColumn
      ? records
      : [...records].sort(compareDates(dateColumn));
  const start = (page - 1) * settings.pageSize;
  const end = start + pages * settings.pageSize;
  return {
    rows: ordered.slice(start, end),
    hasMore: end < ordered.length,
    totalCount: ordered.length,
  };
}

/** Load feed pages from `list` (or slice local rows), `pages` pages from `page` on. */
export async function loadFeedPages(
  request: FeedPagesRequest
): Promise<FeedPagesResult> {
  const { list, page, pages = 1, params = {}, settings, signal } = request;
  if (!list) {
    return localPages(request);
  }
  const rows: Record<string, unknown>[] = [];
  let loaded = (page - 1) * settings.pageSize;
  let hasMore = true;
  let totalCount: number | undefined;
  for (let current = page; current < page + pages && hasMore; current += 1) {
    signal?.throwIfAborted();
    const result = await list(
      feedListParams(params, settings, current, request.groupBy)
    );
    signal?.throwIfAborted();
    const batch = (result.data ?? []).filter(isRecord);
    rows.push(...batch);
    loaded += batch.length;
    const total = Number(result.meta?.totalCount);
    totalCount = Number.isFinite(total) ? total : totalCount;
    hasMore =
      batch.length > 0 &&
      !isLastPage(
        batch.length,
        result.meta,
        current,
        loaded,
        settings.pageSize
      );
  }
  return { rows, hasMore, totalCount };
}

/** Rows shown so far followed by a new page, without repeating a record. */
export function appendFeedRows<T extends Record<string, unknown>>(
  current: readonly T[],
  next: readonly T[],
  getRowId: (row: T) => string
): T[] {
  const seen = new Set(current.map(getRowId));
  return [
    ...current,
    ...next.filter((row) => {
      const id = getRowId(row);
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    }),
  ];
}

// Dates ----------------------------------------------------------------------

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
];
const DAY_MS = 86_400_000;
const localMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

function relativeUnit(seconds: number): [Intl.RelativeTimeFormatUnit, number] {
  return (
    RELATIVE_UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? [
      "second",
      1,
    ]
  );
}

/**
 * "3 hr. ago", "yesterday", "in 2 days" in the locale's words. Calendar days
 * (`YYYY-MM-DD`) compare by local day; under a minute reads "now".
 */
export function formatFeedRelativeDate(
  value: unknown,
  locale: string,
  now: Date = new Date()
): string | undefined {
  const date = parseDateValue(value);
  if (!date) {
    return;
  }
  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    const days = Math.round(
      (localMidnight(date) - localMidnight(now)) / DAY_MS
    );
    if (Math.abs(days) < 7) {
      return format.format(days, "day");
    }
  }
  const seconds = (date.getTime() - now.getTime()) / 1000;
  if (Math.abs(seconds) < 60) {
    return format.format(0, "second");
  }
  const [unit, size] = relativeUnit(seconds);
  return format.format(Math.round(seconds / size), unit);
}

/** The full date (and time for instants) in the locale, as shown on hover. */
export function formatFeedAbsoluteDate(
  value: unknown,
  locale: string,
  column?: FeedColumn
): string | undefined {
  const date = parseDateValue(value);
  if (!date) {
    return;
  }
  const calendarDay = typeof value === "string" && DATE_ONLY.test(value);
  return formatDateValue(value, {
    preset: calendarDay ? "localized-medium" : "dateTime",
    locale,
    timeZone: column?.timeZone,
    hour12: column?.hour12,
  });
}

export interface FeedDate {
  /** What the card shows. */
  text: string;
  /** Full date, for the `title` and screen readers. */
  title: string;
  /** Machine-readable value for `<time datetime>`. */
  dateTime: string;
}

/** The date line of a card, relative or absolute per the settings. */
export function feedDate(
  value: unknown,
  display: FeedDateDisplay,
  locale: string,
  column?: FeedColumn,
  now: Date = new Date()
): FeedDate | undefined {
  const date = parseDateValue(value);
  const title = formatFeedAbsoluteDate(value, locale, column);
  if (!(date && title)) {
    return;
  }
  const calendarDay = typeof value === "string" && DATE_ONLY.test(value);
  const text =
    display === "relative"
      ? (formatFeedRelativeDate(value, locale, now) ?? title)
      : title;
  return {
    text,
    title,
    dateTime: calendarDay ? String(value) : date.toISOString(),
  };
}

// Body -------------------------------------------------------------------------

/** A body value as plain text; lists become lines, objects their text. */
export function feedBodyText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map(feedBodyText).filter(Boolean).join("\n");
  }
  if (isRecord(value)) {
    return feedBodyText(value.text ?? value.content ?? value.label ?? "");
  }
  return String(value).trim();
}

/** Whether a text likely needs more than `lines` lines, before layout. */
export function feedBodyMayOverflow(text: string, lines: number): boolean {
  if (lines <= 0 || !text) {
    return false;
  }
  const paragraphs = text.split(LINE_BREAK);
  const needed = paragraphs.reduce(
    (total, paragraph) =>
      total + Math.max(1, Math.ceil(paragraph.length / CHARS_PER_LINE)),
    0
  );
  return needed > lines;
}

/**
 * Offer "Show more" when the clamped body overflows. A measured element
 * (`scrollHeight` over `clientHeight`) wins over the length estimate.
 */
export function feedBodyNeedsToggle(
  text: string,
  lines: number,
  measured?: { clientHeight: number; scrollHeight: number }
): boolean {
  if (lines <= 0) {
    return false;
  }
  if (measured && measured.clientHeight > 0) {
    return measured.scrollHeight - measured.clientHeight > 1;
  }
  return feedBodyMayOverflow(text, lines);
}

// Authors and media ------------------------------------------------------------

export interface FeedAuthor {
  name: string;
  initials: string;
  avatarUrl?: string;
}

const AVATAR_KEYS = ["avatarUrl", "avatar", "image", "picture", "photo"];

function initialsOf(name: string): string {
  const words = name.split(WHITESPACE).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.at(0) ?? ""}${words.at(-1)?.at(0) ?? ""}`
      : name.slice(0, 2);
  return letters.toLocaleUpperCase();
}

/** A text or person-like value (`{ name | label | email, avatarUrl }`); lists use the first. */
export function feedAuthor(value: unknown): FeedAuthor | undefined {
  const first = Array.isArray(value) ? value.at(0) : value;
  if (first === null || first === undefined || first === "") {
    return;
  }
  if (!isRecord(first)) {
    const name = String(first).trim();
    return name ? { name, initials: initialsOf(name) } : undefined;
  }
  const name = cleanText(
    first.name ?? first.label ?? first.displayName ?? first.email
  );
  if (!name) {
    return;
  }
  const avatar = AVATAR_KEYS.map((key) => mediaUrl(first[key])).find(Boolean);
  return {
    name,
    initials: initialsOf(name),
    ...(avatar ? { avatarUrl: avatar } : {}),
  };
}

export interface FeedMediaImage {
  url: string;
  alt: string;
}

export interface FeedMediaFile {
  name: string;
  url?: string;
}

/** A caption track of a video, from the gallery media contract's `tracks`. */
export interface FeedMediaTrack {
  src: string;
  label?: string;
  srcLang?: string;
  kind: "captions" | "subtitles";
}

/** A video: shown by its poster, nothing loaded beyond metadata before it plays. */
export interface FeedMediaVideo {
  url: string;
  /** Accessible name; empty when the item has none (the post's title is used). */
  alt: string;
  poster?: string;
  mimeType?: string;
  tracks: FeedMediaTrack[];
}

export interface FeedMedia {
  /** Images shown, at most `FEED_MAX_IMAGES`. */
  images: FeedMediaImage[];
  /** Images not shown. */
  moreImages: number;
  /** Videos shown, at most `FEED_MAX_VIDEOS`; the others are listed as files. */
  videos: FeedMediaVideo[];
  files: FeedMediaFile[];
}

const fileNameOf = (url: string) =>
  decodeURIComponent(url.split(URL_SUFFIX)[0]?.split("/").at(-1) ?? url);

function mediaTracks(value: unknown): FeedMediaTrack[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).flatMap((track) => {
    const src = mediaUrl(track.src);
    if (!src) {
      return [];
    }
    const label = cleanText(track.label);
    const srcLang = cleanText(track.srcLang);
    const kind: FeedMediaTrack["kind"] =
      track.kind === "subtitles" ? "subtitles" : "captions";
    return [
      {
        src,
        kind,
        ...(label ? { label } : {}),
        ...(srcLang ? { srcLang } : {}),
      },
    ];
  });
}

function isVideoItem(record: Record<string, unknown>, url: string): boolean {
  const type = String(record.type ?? "");
  const mimeType = String(record.mimeType ?? "");
  if (type === "video" || mimeType.startsWith("video/")) {
    return true;
  }
  // Only an untyped item is guessed from its extension.
  return !(type || mimeType) && VIDEO_EXTENSION.test(url);
}

function mediaItem(
  item: unknown,
  imageColumn: boolean
): { image?: FeedMediaImage; video?: FeedMediaVideo; file?: FeedMediaFile } {
  const record = isRecord(item) ? item : { url: item };
  const url = mediaUrl(record.url ?? record.src ?? record.href);
  const name = cleanText(record.name ?? record.alt ?? record.label);
  const alt = cleanText(record.alt) ?? name ?? "";
  if (url && isVideoItem(record, url)) {
    const poster = mediaUrl(record.poster);
    const mimeType = cleanText(record.mimeType);
    return {
      video: {
        url,
        alt,
        ...(poster ? { poster } : {}),
        ...(mimeType ? { mimeType } : {}),
        tracks: mediaTracks(record.tracks),
      },
    };
  }
  const kind = String(record.type ?? record.mimeType ?? "");
  const isImage =
    kind === "image" ||
    kind.startsWith("image/") ||
    (url !== undefined && (imageColumn || IMAGE_EXTENSION.test(url)));
  if (url && isImage) {
    return { image: { url, alt } };
  }
  const fileName = name ?? (url ? fileNameOf(url) : undefined);
  return fileName ? { file: { name: fileName, url } } : {};
}

/**
 * Images, videos and files of a media value: URLs, lists or items of the
 * gallery media contract (`{ url, type, mimeType, poster, alt, tracks }`).
 */
export function feedMedia(value: unknown, column?: FeedColumn): FeedMedia {
  const items = (Array.isArray(value) ? value : [value]).filter(
    (item) => item !== null && item !== undefined && item !== ""
  );
  const images: FeedMediaImage[] = [];
  const videos: FeedMediaVideo[] = [];
  const files: FeedMediaFile[] = [];
  for (const item of items) {
    const { image, video, file } = mediaItem(item, column?.type === "image");
    if (image) {
      images.push(image);
    } else if (video && videos.length < FEED_MAX_VIDEOS) {
      videos.push(video);
    } else if (video) {
      files.push({ name: video.alt || fileNameOf(video.url), url: video.url });
    } else if (file) {
      files.push(file);
    }
  }
  return {
    images: images.slice(0, FEED_MAX_IMAGES),
    moreImages: Math.max(0, images.length - FEED_MAX_IMAGES),
    videos,
    files,
  };
}

/**
 * The media of a post: its media column's items; when the table's gallery
 * media contract is on (`table.gallery.media.enabled`) for that column (its
 * `urlColumn`, else the gallery image column), the source it resolves, with
 * `getMedia`, the type, MIME type and poster columns.
 */
export function feedRowMedia(
  row: Record<string, unknown>,
  column: FeedColumn | undefined,
  gallery?: TableGalleryMediaConfig,
  imageColumn?: string
): FeedMedia {
  if (!column) {
    return feedMedia(undefined);
  }
  if (
    gallery?.enabled === true &&
    (gallery.urlColumn ?? imageColumn) === column.id
  ) {
    const source = resolveGalleryMedia(row, gallery, imageColumn);
    if (source) {
      return feedMedia([source], column);
    }
  }
  return feedMedia(feedValue(row, column), column);
}

// Properties -------------------------------------------------------------------

export interface FeedTag {
  id: string;
  text: string;
  colored: boolean;
  className?: string;
  style?: Record<string, string>;
}

export type FeedPropertyValue =
  | { kind: "tags"; tags: FeedTag[] }
  | { kind: "link"; text: string; href: string }
  | { kind: "text"; text: string };

const optionsOf = (column: FeedColumn) =>
  Array.isArray(column.options)
    ? (column.options as { value: unknown; label: string }[])
    : [];

/** The label of a stored option value, or its own text. */
export function feedOptionLabel(column: FeedColumn, value: unknown): string {
  const option = optionsOf(column).find((item) => Object.is(item.value, value));
  if (option) {
    return option.label;
  }
  if (isRecord(value)) {
    return String(value.label ?? value.name ?? value.id ?? "");
  }
  return String(value);
}

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const safeHref = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return;
  }
};

function tagsOf(
  column: FeedColumn,
  value: unknown,
  coloredTags: boolean
): FeedPropertyValue {
  const values = Array.isArray(value) ? value : [value];
  return {
    kind: "tags",
    tags: values.map((item, index) => {
      const appearance = tagAppearance(
        String(isRecord(item) ? (item.value ?? item.id ?? "") : item),
        column.coloredTags ?? coloredTags,
        column.tagColorMap
      );
      return {
        id: `${index}`,
        text: feedOptionLabel(column, item),
        ...appearance,
      };
    }),
  };
}

function textOf(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(textOf).join(", ");
  }
  if (isRecord(value)) {
    return String(value.label ?? value.name ?? value.title ?? value.id ?? "");
  }
  return String(value);
}

/**
 * How a property value shows on a card: tags for options, formatted numbers
 * and dates, safe links, text otherwise. Empty values show nothing.
 */
export function feedPropertyValue(
  column: FeedColumn,
  value: unknown,
  options: { locale: string; coloredTags: boolean; yes: string; no: string }
): FeedPropertyValue | undefined {
  if (isEmptyValue(value)) {
    return;
  }
  if (isFeedOptionColumn(column)) {
    return tagsOf(column, value, options.coloredTags);
  }
  switch (column.type) {
    case "boolean":
      return { kind: "text", text: value ? options.yes : options.no };
    case "number":
      return {
        kind: "text",
        text: formatNumberValue(value, column.numberFormat, options.locale),
      };
    case "date":
      return {
        kind: "text",
        text: formatDateValue(value, {
          preset: column.dateDisplayPreset,
          pattern: column.dateFormat,
          locale: options.locale,
          timeZone: column.timeZone,
          hour12: column.hour12,
        }),
      };
    case "url": {
      const href = safeHref(value);
      return href
        ? { kind: "link", text: String(value), href }
        : { kind: "text", text: String(value) };
    }
    default:
      return { kind: "text", text: textOf(value) };
  }
}

// Groups -----------------------------------------------------------------------

export interface FeedSection<T> {
  id: string;
  label: string;
  rows: T[];
}

/** Rows by the grouped column's value, in order of first appearance. */
export function groupFeedRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  column: FeedColumn | undefined,
  emptyLabel: string
): FeedSection<T>[] {
  if (!column) {
    return [{ id: "all", label: "", rows: [...rows] }];
  }
  const sections = new Map<string, FeedSection<T>>();
  for (const row of rows) {
    const raw = feedValue(row, column);
    const empty = isEmptyValue(raw);
    const id = empty ? "__empty" : JSON.stringify(raw);
    let section = sections.get(id);
    if (!section) {
      const label = empty
        ? emptyLabel
        : (Array.isArray(raw) ? raw : [raw])
            .map((item) => feedOptionLabel(column, item))
            .join(", ");
      section = { id, label, rows: [] };
      sections.set(id, section);
    }
    section.rows.push(row);
  }
  return [...sections.values()];
}

// Labels -----------------------------------------------------------------------

const ENGLISH_LABELS = {
  showMore: "Show more",
  showLess: "Show less",
  loadMore: "Load more",
  loading: "Loading…",
  loadingMore: "Loading more…",
  error: "The feed could not be loaded.",
  loadMoreError: "More posts could not be loaded.",
  retry: "Retry",
  end: "You're all caught up",
  loadedOne: "1 more post loaded, {total} shown.",
  loadedMany: "{count} more posts loaded, {total} shown.",
  untitled: "Untitled",
  noValue: "No value",
  yes: "Yes",
  no: "No",
  moreImages: "+{count}",
  by: "By",
  media: "Media of {title}",
  video: "Video of {title}",
  titleColumn: "Title",
  authorColumn: "Author",
  dateColumn: "Date",
  dateDisplay: "Date format",
  relative: "Relative (3 hr. ago)",
  absolute: "Full date",
  bodyColumn: "Body",
  mediaColumn: "Media",
  properties: "Properties",
  showPropertyLabels: "Show property names",
  bodyLines: "Body preview",
  lines: "{count} lines",
  noLimit: "Full text",
  density: "Card density",
  comfortable: "Comfortable",
  compact: "Compact",
  pageSize: "Posts per page",
  infiniteScroll: "Load more on scroll",
  on: "On",
  off: "Off",
  none: "None",
} as const;

export type FeedLabelKey = keyof typeof ENGLISH_LABELS;

const FRENCH_LABELS: Record<FeedLabelKey, string> = {
  showMore: "Voir plus",
  showLess: "Voir moins",
  loadMore: "Charger plus",
  loading: "Chargement…",
  loadingMore: "Chargement de la suite…",
  error: "Le fil n'a pas pu être chargé.",
  loadMoreError: "La suite du fil n'a pas pu être chargée.",
  retry: "Réessayer",
  end: "Vous êtes à jour",
  loadedOne: "1 publication de plus chargée, {total} affichées.",
  loadedMany: "{count} publications de plus chargées, {total} affichées.",
  untitled: "Sans titre",
  noValue: "Aucune valeur",
  yes: "Oui",
  no: "Non",
  moreImages: "+{count}",
  by: "Par",
  media: "Médias de {title}",
  video: "Vidéo de {title}",
  titleColumn: "Titre",
  authorColumn: "Auteur",
  dateColumn: "Date",
  dateDisplay: "Format de date",
  relative: "Relative (il y a 3 h)",
  absolute: "Date complète",
  bodyColumn: "Contenu",
  mediaColumn: "Médias",
  properties: "Propriétés",
  showPropertyLabels: "Afficher le nom des propriétés",
  bodyLines: "Aperçu du contenu",
  lines: "{count} lignes",
  noLimit: "Texte entier",
  density: "Densité des cartes",
  comfortable: "Confortable",
  compact: "Compacte",
  pageSize: "Publications par page",
  infiniteScroll: "Charger la suite au défilement",
  on: "Oui",
  off: "Non",
  none: "Aucune",
};

export type FeedTranslate = (key: FeedLabelKey, fallback: string) => string;

/** Built-in English or French labels, overridable per key (`feed.<key>`) by the host. */
export function feedLabel(
  key: FeedLabelKey,
  locale: string,
  translate?: FeedTranslate,
  params: Record<string, number | string> = {}
): string {
  const labels = locale.toLowerCase().startsWith("fr")
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  const template = translate ? translate(key, labels[key]) : labels[key];
  return template.replace(TEMPLATE_PARAM, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

// Settings panel ----------------------------------------------------------------

/** One select of the feed settings, the same in both editions. */
export interface FeedSettingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** The properties picker of the settings panel. */
export interface FeedSettingProperties {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  showLabels: boolean;
  showLabelsLabel: string;
  onShowLabelsChange: (value: boolean) => void;
}

export interface FeedSettingFieldsInput {
  columns: readonly FeedColumn[];
  defaults?: FeedViewSettings;
  view: FeedViewSettings;
  locale: string;
  translate?: FeedTranslate;
  groupBy?: string;
  /** Saves the view's settings; undefined values are left out. */
  update: (settings: Record<string, unknown>) => void;
}

const NONE = "";
const LINE_CHOICES = [2, 3, 4, 6, 8, 12];
const PAGE_SIZE_CHOICES = [5, 10, 20, 50];

const columnOption = (column: FeedColumn) => ({
  value: column.id,
  label: column.header ?? column.id,
});

interface FieldContext {
  columns: FeedColumn[];
  active: ResolvedFeedSettings;
  label: (
    key: FeedLabelKey,
    params?: Record<string, number | string>
  ) => string;
  set: (patch: Record<string, unknown>) => void;
}

function columnField(
  context: FieldContext,
  key: (typeof COLUMN_KEYS)[number],
  candidates: FeedColumn[]
): FeedSettingField {
  return {
    id: key,
    label: context.label(key),
    value: context.active[key] ?? NONE,
    options: [
      { value: NONE, label: context.label("none") },
      ...candidates.map(columnOption),
    ],
    // "None" is saved as null so the guessed default does not come back.
    onChange: (value) => context.set({ [key]: value || null }),
  };
}

function choiceField(
  context: FieldContext,
  key: "dateDisplay" | "density",
  choices: readonly (FeedDateDisplay | FeedDensity)[]
): FeedSettingField {
  return {
    id: key,
    label: context.label(key),
    value: context.active[key],
    options: choices.map((choice) => ({
      value: choice,
      label: context.label(choice),
    })),
    onChange: (value) => context.set({ [key]: value }),
  };
}

function numberField(
  context: FieldContext,
  key: "bodyLines" | "pageSize",
  choices: number[]
): FeedSettingField {
  const current = context.active[key];
  const values = [...new Set([...choices, current])].sort((a, b) => a - b);
  const text = (count: number) => {
    if (key === "pageSize") {
      return String(count);
    }
    return count === 0
      ? context.label("noLimit")
      : context.label("lines", { count });
  };
  return {
    id: key,
    label: context.label(key),
    value: String(current),
    options: [
      ...values
        .filter((count) => key === "pageSize" || count > 0)
        .map((count) => ({ value: String(count), label: text(count) })),
      ...(key === "bodyLines"
        ? [{ value: "0", label: context.label("noLimit") }]
        : []),
    ],
    onChange: (value) => context.set({ [key]: Number(value) }),
  };
}

function propertiesPicker(context: FieldContext): FeedSettingProperties {
  const { active, columns, label, set } = context;
  const used = new Set([
    active.titleColumn,
    active.authorColumn,
    active.dateColumn,
    active.bodyColumn,
    active.mediaColumn,
  ]);
  return {
    label: label("properties"),
    options: columns.filter((column) => !used.has(column.id)).map(columnOption),
    value: active.propertyColumnIds,
    onChange: (value) => set({ propertyColumnIds: value }),
    showLabels: active.showPropertyLabels,
    showLabelsLabel: label("showPropertyLabels"),
    onShowLabelsChange: (value) => set({ showPropertyLabels: value }),
  };
}

/** The feed settings panel: columns, dates, body, cards and loading. */
export function feedSettingFields(input: FeedSettingFieldsInput): {
  fields: FeedSettingField[];
  properties: FeedSettingProperties;
} {
  const { defaults, groupBy, locale, translate, update, view } = input;
  const columns = feedColumns(input.columns);
  const active = resolveFeedSettings(columns, defaults, view, groupBy);
  const set = (patch: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...view, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) {
        Reflect.deleteProperty(next, key);
      }
    }
    update(next);
  };
  const context: FieldContext = {
    columns,
    active,
    label: (key, params) => feedLabel(key, locale, translate, params),
    set,
  };
  const texts = columns.filter(isFeedTextColumn);
  const fields: FeedSettingField[] = [
    {
      id: "titleColumn",
      label: context.label("titleColumn"),
      value: active.titleColumn ?? NONE,
      options: columns.map(columnOption),
      onChange: (value) => set({ titleColumn: value || undefined }),
    },
    columnField(
      context,
      "authorColumn",
      columns.filter((column) => column.type !== "date")
    ),
    columnField(
      context,
      "dateColumn",
      columns.filter((column) => column.type === "date")
    ),
  ];
  if (active.dateColumn) {
    fields.push(choiceField(context, "dateDisplay", FEED_DATE_DISPLAYS));
  }
  fields.push(columnField(context, "bodyColumn", texts));
  if (active.bodyColumn) {
    fields.push(numberField(context, "bodyLines", LINE_CHOICES));
  }
  fields.push(
    columnField(
      context,
      "mediaColumn",
      columns.filter(
        (column) =>
          MEDIA_TYPES.has(column.type ?? "") || isFeedTextColumn(column)
      )
    ),
    choiceField(context, "density", FEED_DENSITIES),
    numberField(context, "pageSize", PAGE_SIZE_CHOICES),
    {
      id: "infiniteScroll",
      label: context.label("infiniteScroll"),
      value: active.infiniteScroll ? "on" : "off",
      options: [
        { value: "on", label: context.label("on") },
        { value: "off", label: context.label("off") },
      ],
      onChange: (value) => set({ infiniteScroll: value === "on" }),
    }
  );
  return { fields, properties: propertiesPicker(context) };
}

/** The host's body renderer from `table.feed.renderBody`, if any. */
export function feedBodyRenderer(
  defaults: Record<string, unknown>
): FeedBodyRenderer | undefined {
  return typeof defaults.renderBody === "function"
    ? (defaults.renderBody as FeedBodyRenderer)
    : undefined;
}

/**
 * Loaded posts past which only those near the viewport render, from
 * `table.feed.windowing`: the default with `true` or nothing valid, none with
 * `false`.
 */
export function feedWindowThreshold(
  defaults: Record<string, unknown>
): number | undefined {
  const { windowing } = defaults;
  if (windowing === false) {
    return;
  }
  return typeof windowing === "number" &&
    Number.isInteger(windowing) &&
    windowing > 0
    ? windowing
    : FEED_WINDOW_THRESHOLD;
}
