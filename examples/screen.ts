import type {
  Dashboard,
  DashboardFilterValue,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-model";
import type { DashboardBlockSchema } from "../src/components/ui/yayaw-table-dashboard/dashboard-schema";
import type {
  DashboardSourceSummary,
  DashboardSources,
  DashboardSourceUnavailable,
} from "../src/components/ui/yayaw-table-dashboard/dashboard-sources";
import {
  createDemoActions,
  createDemoDashboardStorage,
  demoDay,
  logDashboardRequests,
} from "./dashboard";

/**
 * "Content admin", the `?example=screen` demo of both editions: a screen made
 * of a catalogue of ten sources loaded on demand (two unavailable), host
 * blocks and a full-page table. Its data follows today. Both editions render
 * exactly this; each builds its tables from the specs below.
 */

type Row = Record<string, unknown>;
interface Text {
  en: string;
  fr: string;
}

const options = (values: [string, string][]) =>
  values.map(([value, label]) => ({ value, label }));

// Pages ---------------------------------------------------------------------------

/** Pages: [title, status, author, updated days from today, views]. */
const PAGES: [string, string, string, number, number][] = [
  ["Home", "published", "Ada Martin", -1, 1840],
  ["About us", "published", "Léa Dubois", -3, 420],
  ["Pricing", "published", "Noah Petit", -2, 960],
  ["Contact", "published", "Sam Chen", -12, 310],
  ["Blog", "published", "Ada Martin", -4, 780],
  ["Careers", "published", "Léa Dubois", -20, 150],
  ["Spring launch", "published", "Noah Petit", -6, 640],
  ["Customer stories", "published", "Sam Chen", -9, 270],
  ["Help center", "published", "Ada Martin", -15, 510],
  ["Security", "published", "Noah Petit", -40, 90],
  ["Partners", "published", "Léa Dubois", -33, 120],
  ["Changelog", "published", "Sam Chen", -1, 330],
  ["Summer campaign", "draft", "Noah Petit", 0, 0],
  ["Webinar series", "draft", "Ada Martin", -2, 0],
  ["Integrations", "draft", "Sam Chen", -5, 0],
  ["Team page", "draft", "Léa Dubois", -8, 0],
  ["Events", "draft", "Noah Petit", -25, 0],
  ["Press kit", "review", "Léa Dubois", -1, 0],
  ["Accessibility", "review", "Ada Martin", -3, 0],
  ["Case study: Atlas", "review", "Sam Chen", -7, 0],
  ["Terms of service", "review", "Noah Petit", -11, 0],
  ["Old pricing", "archived", "Ada Martin", -80, 45],
  ["Winter sale", "archived", "Sam Chen", -120, 12],
  ["Beta program", "archived", "Léa Dubois", -65, 8],
];

export interface ScreenPage {
  id: string;
  title: string;
  status: string;
  author: string;
  updatedAt: string;
  views: number;
}

/** The pages, updated relative to `today`. */
export const screenPageRows = (today: Date = new Date()): ScreenPage[] =>
  PAGES.map(([title, status, author, updated, views], index) => ({
    id: `page-${index + 1}`,
    title,
    status,
    author,
    updatedAt: demoDay(updated, today),
    views,
  }));

export const pageColumns = [
  { id: "title", header: "Title", type: "text" as const },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options([
      ["published", "Published"],
      ["draft", "Draft"],
      ["review", "In review"],
      ["archived", "Archived"],
    ]),
  },
  {
    id: "author",
    header: "Author",
    type: "select" as const,
    options: options([
      ["Ada Martin", "Ada Martin"],
      ["Léa Dubois", "Léa Dubois"],
      ["Noah Petit", "Noah Petit"],
      ["Sam Chen", "Sam Chen"],
    ]),
  },
  { id: "updatedAt", header: "Updated", type: "date" as const },
  { id: "views", header: "Views", type: "number" as const },
];

/** The Pages list page: URL state, saved views, selection and bulk delete. */
export const pageTableOptions = {
  syncUrl: true,
  enableViews: true,
  allowViewSave: true,
  enableAdvancedFilters: true,
  enableRowSelection: true,
  allowBulkDelete: true,
  allowDelete: true,
  allowEdit: true,
  coloredTags: true,
  defaultDisplayMode: "table" as const,
  displayModes: ["table", "list", "kanban"] as ("table" | "list" | "kanban")[],
  defaultPageSize: 10,
  kanban: { groupBy: "status" },
  list: { titleColumn: "title", cardColumnIds: ["status", "author"] },
};

const savedView = (tableId: string, id: string, name: string, config: Row) => ({
  id,
  tableId,
  name,
  createdById: "demo",
  isGlobal: true,
  canEdit: false,
  canDelete: false,
  config,
});

const statusRule = (id: string, values: string[]) => ({
  id,
  columnId: "status",
  type: "select",
  operator: "isAnyOf",
  values,
  isActive: true,
});

/** Saved views of the Pages source (the list page's own). */
export const pageViews = [
  savedView("pages", "drafts", "Drafts", {
    displayMode: "table",
    advancedFilters: [statusRule("drafts", ["draft"])],
    sorting: [{ id: "updatedAt", desc: true }],
  }),
  savedView("pages", "in-review", "In review", {
    displayMode: "list",
    advancedFilters: [statusRule("review", ["review"])],
  }),
];

// Media ---------------------------------------------------------------------------

const NON_WORD = /\W+/g;

/** A picture per file (the gallery shows HTTP(S) images only); documents have none. */
const thumbnail = (name: string, kind: string): string =>
  kind === "document"
    ? ""
    : `https://picsum.photos/seed/yayaw-${name.replace(NON_WORD, "-")}/640/400`;

/** Media: [name, kind, size (MB), uploaded days from today, by, alt text, in the trash]. */
const MEDIA: [string, string, number, number, string, string, boolean][] = [
  [
    "hero-spring.jpg",
    "image",
    2.4,
    0,
    "Noah Petit",
    "Spring collection",
    false,
  ],
  ["team-offsite.jpg", "image", 3.1, -1, "Léa Dubois", "", false],
  ["product-demo.mp4", "video", 48.5, -2, "Sam Chen", "", false],
  ["logo-dark.png", "image", 0.3, -3, "Ada Martin", "Company logo", false],
  ["pricing-sheet.pdf", "document", 1.2, -5, "Noah Petit", "", false],
  ["banner-summer.jpg", "image", 2.9, -6, "Noah Petit", "", false],
  ["office-map.png", "image", 0.8, -9, "Léa Dubois", "Office map", false],
  ["webinar-teaser.mp4", "video", 36.2, -12, "Ada Martin", "", false],
  ["case-study-atlas.pdf", "document", 2.2, -15, "Sam Chen", "", false],
  ["portrait-ada.jpg", "image", 1.5, -20, "Ada Martin", "Ada Martin", false],
  ["icons.svg", "image", 0.1, -28, "Sam Chen", "Icon set", false],
  ["brochure-2025.pdf", "document", 4.4, -45, "Léa Dubois", "", false],
  ["old-banner.jpg", "image", 2, -70, "Noah Petit", "", true],
  ["draft-video.mp4", "video", 52, -90, "Sam Chen", "", true],
];

export interface ScreenMedia {
  id: string;
  name: string;
  kind: string;
  size: number;
  createdAt: string;
  uploadedBy: string;
  alt: string;
  trashed: boolean;
  url: string;
}

/** The media, uploaded relative to `today`. */
export const screenMediaRows = (today: Date = new Date()): ScreenMedia[] =>
  MEDIA.map(([name, kind, size, created, uploadedBy, alt, trashed], index) => ({
    id: `media-${index + 1}`,
    name,
    kind,
    size,
    createdAt: demoDay(created, today),
    uploadedBy,
    alt,
    trashed,
    url: thumbnail(name, kind),
  }));

export const mediaColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "kind",
    header: "Type",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: options([
      ["image", "Image"],
      ["video", "Video"],
      ["document", "Document"],
    ]),
  },
  {
    id: "size",
    header: "Size",
    type: "number" as const,
    numberFormat: {
      style: "unit" as const,
      unit: "megabyte",
      unitDisplay: "short" as const,
      decimals: 1,
    },
  },
  { id: "createdAt", header: "Uploaded", type: "date" as const },
  { id: "uploadedBy", header: "By", type: "text" as const },
  { id: "alt", header: "Alt text", type: "text" as const },
  { id: "trashed", header: "In the trash", type: "boolean" as const },
  { id: "url", header: "Preview", type: "text" as const },
];

export const mediaTableOptions = {
  syncUrl: true,
  enableAdvancedFilters: true,
  coloredTags: true,
  defaultDisplayMode: "gallery" as const,
  displayModes: ["gallery", "table"] as ("gallery" | "table")[],
  defaultPageSize: 12,
  gallery: {
    titleColumn: "name",
    imageColumn: "url",
    cardColumnIds: ["kind", "size"],
  },
};

// Sources that are not on the screen ---------------------------------------------------

/** A small source the catalogue lists: [id, en name, fr name, group, rows]. */
const SMALL: [string, string, string, string, string[]][] = [
  ["sections", "Sections", "Sections", "CMS", ["Hero", "Pricing table", "FAQ"]],
  [
    "components",
    "Components",
    "Composants",
    "CMS",
    ["Button", "Card", "Banner"],
  ],
  ["forms", "Forms", "Formulaires", "CMS", ["Contact", "Newsletter"]],
  ["redirects", "Redirects", "Redirections", "CMS", ["/old-pricing"]],
  ["users", "Users", "Utilisateurs", "Admin", ["Ada Martin", "Sam Chen"]],
  [
    "analytics",
    "Page views",
    "Pages vues",
    "Analytics",
    ["Home", "Pricing", "Blog"],
  ],
];

export const nameColumns = [
  { id: "name", header: "Name", type: "text" as const },
];

export const nameTableOptions = {
  syncUrl: false,
  defaultDisplayMode: "table" as const,
  displayModes: ["table"] as "table"[],
  defaultPageSize: 10,
};

/** The notice the analytics source answers: no provider is connected. */
export const ANALYTICS_NOTICE = {
  code: "notConfigured",
  message: "Connect an analytics provider to count page views.",
};

/** Sources the catalogue lists as unavailable to this user. */
const UNAVAILABLE: Record<string, DashboardSourceUnavailable & { name: Text }> =
  {
    audit: {
      unavailable: true,
      reason: "forbidden",
      name: { en: "Audit log", fr: "Journal d’audit" },
    },
    billing: {
      unavailable: true,
      reason: "notConfigured",
      message: "Connect Stripe to see invoices.",
      name: { en: "Invoices", fr: "Factures" },
    },
  };

// The catalogue --------------------------------------------------------------------------

/** What an edition needs to build one of its tables. */
export interface ScreenSourceSpec {
  id: string;
  name: Text;
  columns: readonly Row[];
  visible: string[];
  mandatory: string[];
  table: Row;
  actions: Row;
  views: Row[];
}

export interface ScreenHost<S> {
  /** The lazy catalogue given to `YayawDashboard`'s `sources`. */
  sources: DashboardSources<S>;
  /** The rows the sources serve, for the blocks. */
  pages: ScreenPage[];
  media: ScreenMedia[];
}

const idOf = (prefix: string, rows: readonly Row[]) => {
  let index = rows.length + 1;
  while (rows.some((row) => row.id === `${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
};

/** In-memory actions that also create, delete and duplicate. */
function editableActions<T extends Row>(prefix: string, records: T[]) {
  const remove = (ids: readonly string[]) => {
    let removed = 0;
    for (const id of ids) {
      const index = records.findIndex((row) => row.id === id);
      if (index >= 0) {
        records.splice(index, 1);
        removed += 1;
      }
    }
    return removed;
  };
  return {
    ...createDemoActions(records),
    create: (data: Row) => {
      const row = { ...data, id: idOf(prefix, records) } as unknown as T;
      records.unshift(row);
      return Promise.resolve({ success: true, data: row });
    },
    delete: (id: string) =>
      Promise.resolve({ success: remove([String(id)]) > 0 }),
    bulkDelete: (ids: string[]) => {
      remove(ids.map(String));
      return Promise.resolve({ success: true });
    },
    duplicate: (id: string) => {
      const source = records.find((row) => row.id === String(id));
      if (!source) {
        return Promise.resolve({ success: false, error: "Not found" });
      }
      const copy = { ...source, id: idOf(prefix, records) } as T;
      records.unshift(copy);
      return Promise.resolve({ success: true, data: copy });
    },
  };
}

/** A source whose `list` and `aggregate` answer `meta.notice` (not configured). */
const noticeActions = () => ({
  list: () =>
    Promise.resolve({
      data: [],
      meta: { totalCount: 0, notice: ANALYTICS_NOTICE },
    }),
  aggregate: () =>
    Promise.resolve({ groups: [], meta: { notice: ANALYTICS_NOTICE } }),
});

const SOURCE_DELAY = 20;
const wait = () =>
  new Promise((resolve) => {
    setTimeout(resolve, SOURCE_DELAY);
  });

/** The demo logs each source it loads (`window.yayawScreenSourceLoads`). */
const logLoad = (id: string) => {
  const scope = globalThis as { yayawScreenSourceLoads?: string[] };
  scope.yayawScreenSourceLoads ??= [];
  scope.yayawScreenSourceLoads.push(id);
};

/**
 * The host of the screen: ten sources, loaded on demand through `build`
 * (each edition's table config); `audit` is forbidden and `billing` not
 * configured. Requests are logged in `window.yayawDashboardRequests`.
 */
export function createScreenHost<S>(
  build: (spec: ScreenSourceSpec) => S,
  today: Date = new Date()
): ScreenHost<S> {
  const pages = screenPageRows(today);
  const media = screenMediaRows(today);
  const specs: Record<string, () => ScreenSourceSpec> = {
    pages: () => ({
      id: "pages",
      name: { en: "Pages", fr: "Pages" },
      columns: pageColumns,
      visible: pageColumns.map((column) => column.id),
      mandatory: ["title"],
      table: pageTableOptions,
      actions: logDashboardRequests(
        "pages",
        editableActions("page", pages as unknown as Row[])
      ),
      views: pageViews,
    }),
    media: () => ({
      id: "media",
      name: { en: "Media", fr: "Médias" },
      columns: mediaColumns,
      visible: ["name", "kind", "size", "createdAt", "uploadedBy", "alt"],
      mandatory: ["name"],
      table: mediaTableOptions,
      actions: logDashboardRequests(
        "media",
        editableActions("media", media as unknown as Row[])
      ),
      views: [],
    }),
  };
  for (const [id, en, fr, , names] of SMALL) {
    specs[id] = () => ({
      id,
      name: { en, fr },
      columns: nameColumns,
      visible: ["name"],
      mandatory: ["name"],
      table: nameTableOptions,
      actions: logDashboardRequests(
        id,
        id === "analytics"
          ? noticeActions()
          : createDemoActions(
              names.map((name, index) => ({ id: `${id}-${index}`, name }))
            )
      ),
      views: [],
    });
  }
  const summaries: DashboardSourceSummary[] = [
    { id: "pages", name: { en: "Pages", fr: "Pages" }, group: "CMS" },
    { id: "media", name: { en: "Media", fr: "Médias" }, group: "CMS" },
    ...SMALL.map(([id, en, fr, group]) => ({ id, name: { en, fr }, group })),
    ...Object.entries(UNAVAILABLE).map(([id, entry]) => ({
      id,
      name: entry.name,
      group: "Admin",
      available: false,
      unavailableReason: entry.reason,
      ...(entry.message ? { unavailableMessage: entry.message } : {}),
    })),
  ];
  return {
    pages,
    media,
    sources: {
      list: () => Promise.resolve(summaries),
      load: async (id) => {
        logLoad(id);
        await wait();
        const unavailable = UNAVAILABLE[id];
        if (unavailable) {
          const { name: _name, ...answer } = unavailable;
          return answer;
        }
        const spec = specs[id];
        return spec ? build(spec()) : { unavailable: true, reason: "notFound" };
      },
    },
  };
}

// Blocks ---------------------------------------------------------------------------

/** A link of the `shortcuts` block. */
export interface ScreenShortcut {
  /** One text, or one per language. */
  label: Text | string;
  href: string;
}

export const screenText = (text: Text | string, locale: string): string => {
  if (typeof text === "string") {
    return text;
  }
  return locale.toLowerCase().startsWith("fr") ? text.fr : text.en;
};

/** Something the `attention` block asks to deal with. */
export interface ScreenAttentionItem {
  id: "review" | "alt";
  count: number;
  text: string;
}

const inRange = (day: string, range: unknown): boolean => {
  const { start, end } = (range ?? {}) as { start?: string; end?: string };
  return !((start && day < start) || (end && day > end));
};

/**
 * What needs attention under the screen's filters (period, author): pages
 * waiting for review, images without alt text. Nothing when all is done.
 */
export function screenAttention(
  host: Pick<ScreenHost<unknown>, "pages" | "media">,
  filters: Readonly<Record<string, DashboardFilterValue | undefined>>,
  locale: string
): ScreenAttentionItem[] {
  const authors = Array.isArray(filters.author) ? filters.author : [];
  const review = host.pages.filter(
    (page) =>
      page.status === "review" &&
      inRange(page.updatedAt, filters.period) &&
      (!authors.length || authors.includes(page.author))
  ).length;
  const alt = host.media.filter(
    (item) =>
      item.kind === "image" &&
      !item.trashed &&
      !item.alt &&
      inRange(item.createdAt, filters.period)
  ).length;
  const french = locale.toLowerCase().startsWith("fr");
  const items: ScreenAttentionItem[] = [
    {
      id: "review",
      count: review,
      text: french
        ? `${review} pages en attente de relecture`
        : `${review} pages waiting for review`,
    },
    {
      id: "alt",
      count: alt,
      text: french
        ? `${alt} images sans texte alternatif`
        : `${alt} images without alt text`,
    },
  ];
  return items.filter((item) => item.count > 0);
}

/** The views the `attention` block opens: pages waiting for review, images without alt text. */
export const attentionViews: Record<
  ScreenAttentionItem["id"],
  { tableId: string; view: Row }
> = {
  review: {
    tableId: "pages",
    view: {
      displayMode: "table",
      advancedFilters: [statusRule("review", ["review"])],
    },
  },
  alt: {
    tableId: "media",
    view: {
      displayMode: "table",
      advancedFilters: [
        {
          id: "images",
          columnId: "kind",
          type: "select",
          operator: "isAnyOf",
          values: ["image"],
          isActive: true,
        },
        {
          id: "no-alt",
          columnId: "alt",
          type: "text",
          operator: "isEmpty",
          values: [],
          isActive: true,
        },
      ],
    },
  },
};

// The screen -----------------------------------------------------------------------

const kpi = (
  id: string,
  tableId: string,
  title: Text,
  view: Row,
  settings: Row = { metric: "count" }
) => ({ id, type: "kpi", tableId, title, view, settings });

/**
 * The "Content admin" screen: an overview grid (two numbers over inline
 * views, the storage, an audit number whose source is forbidden, the
 * shortcuts and attention blocks, a gallery of recent uploads), then the Pages
 * list page. Filters: the period (pages and media) and the author.
 */
export const contentAdminScreen = {
  version: 2,
  id: "content-admin",
  name: { en: "Content admin", fr: "Administration du contenu" },
  sections: [
    {
      id: "overview",
      type: "grid",
      title: { en: "Overview", fr: "Vue d’ensemble" },
      layout: [
        { widgetId: "published", x: 0, y: 0, w: 1, h: 1 },
        { widgetId: "drafts", x: 1, y: 0, w: 1, h: 1 },
        { widgetId: "storage", x: 2, y: 0, w: 1, h: 1 },
        { widgetId: "audit", x: 3, y: 0, w: 1, h: 1 },
        { widgetId: "uploads", x: 0, y: 1, w: 2, h: 2 },
        { widgetId: "shortcuts", x: 2, y: 1, w: 1, h: 2 },
        { widgetId: "attention", x: 3, y: 1, w: 1, h: 2 },
      ],
    },
    {
      id: "pages",
      type: "flow",
      title: { en: "Pages", fr: "Pages" },
      widgetIds: ["pages-table"],
    },
  ],
  widgets: [
    kpi(
      "published",
      "pages",
      { en: "Published pages", fr: "Pages publiées" },
      { advancedFilters: [statusRule("published", ["published"])] }
    ),
    kpi(
      "drafts",
      "pages",
      { en: "Drafts", fr: "Brouillons" },
      { advancedFilters: [statusRule("drafts", ["draft"])] }
    ),
    kpi(
      "storage",
      "media",
      { en: "Storage", fr: "Stockage" },
      {
        advancedFilters: [
          {
            id: "live",
            columnId: "trashed",
            type: "boolean",
            operator: "isFalse",
            values: [],
            isActive: true,
          },
        ],
      },
      { metric: "sum", metricColumn: "size" }
    ),
    kpi("audit", "audit", { en: "Audit events", fr: "Événements d’audit" }, {}),
    {
      id: "uploads",
      type: "view",
      tableId: "media",
      title: { en: "Recent uploads", fr: "Derniers imports" },
      view: {
        displayMode: "gallery",
        sorting: [{ id: "createdAt", desc: true }],
        advancedFilters: [
          {
            id: "live",
            columnId: "trashed",
            type: "boolean",
            operator: "isFalse",
            values: [],
            isActive: true,
          },
        ],
      },
      settings: {},
    },
    {
      id: "shortcuts",
      type: "block",
      block: "shortcuts",
      props: {
        links: [
          { label: { en: "New page", fr: "Nouvelle page" }, href: "#new-page" },
          {
            label: { en: "Upload media", fr: "Importer un média" },
            href: "#upload",
          },
          {
            label: { en: "Site settings", fr: "Réglages du site" },
            href: "#settings",
          },
        ],
      },
      settings: {},
    },
    { id: "attention", type: "block", block: "attention", settings: {} },
    {
      id: "pages-table",
      type: "table",
      tableId: "pages",
      view: {
        displayMode: "table",
        sorting: [{ id: "updatedAt", desc: true }],
      },
      settings: {},
    },
  ],
  filters: [
    {
      id: "period",
      type: "dateRange",
      label: { en: "Period", fr: "Période" },
      targets: [
        { tableId: "pages", columnId: "updatedAt" },
        { tableId: "media", columnId: "createdAt" },
      ],
    },
    {
      id: "author",
      type: "select",
      label: { en: "Author", fr: "Auteur" },
      targets: [{ tableId: "pages", columnId: "author" }],
    },
  ],
} satisfies Record<string, unknown>;

/** The screen's storage: in memory, mirrored in the tab's session storage. */
export const createScreenStorage = () =>
  createDemoDashboardStorage([contentAdminScreen as unknown as Dashboard]);

/** The problems of the `shortcuts` block's props: a list of links, each with a label and an href. */
export function shortcutProblems(
  props: Row
): { message: string; path: string }[] | undefined {
  const { links } = props;
  if (links === undefined) {
    return;
  }
  if (!Array.isArray(links)) {
    return [{ message: "links is a list of { label, href }.", path: "links" }];
  }
  const problems = links.flatMap((link: unknown, index) => {
    const entry = (link ?? {}) as Row;
    return typeof entry.href === "string" && entry.label !== undefined
      ? []
      : [
          {
            message: "Each link has a label and an href.",
            path: `links[${index}]`,
          },
        ];
  });
  return problems.length ? problems : undefined;
}

/** The block keys the demo host has, with their labels (the host's registry adds components). */
export const SCREEN_BLOCKS: Record<
  "shortcuts" | "attention",
  DashboardBlockSchema
> = {
  shortcuts: {
    label: { en: "Shortcuts", fr: "Raccourcis" },
    description: "Links to frequent tasks.",
    group: "Navigation",
    placement: "any",
    defaultSize: { w: 1, h: 2 },
    defaultProps: { links: [] },
    validateProps: shortcutProblems,
    propsSchema: {
      type: "object",
      properties: {
        links: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "href"],
            properties: { label: {}, href: { type: "string" } },
          },
        },
      },
    },
  },
  attention: {
    label: { en: "Needs attention", fr: "À traiter" },
    description: "Pages waiting for review, images without alt text.",
    group: "CMS",
    placement: "any",
    defaultSize: { w: 1, h: 2 },
  },
};
