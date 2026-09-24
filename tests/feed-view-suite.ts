import assert from "node:assert/strict";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";
import type * as Feed from "../src/components/ui/yayaw-table/utils/feed-view";

type FeedApi = Pick<
  typeof Feed,
  | "appendFeedRows"
  | "feedAuthor"
  | "feedBodyMayOverflow"
  | "feedBodyNeedsToggle"
  | "feedBodyText"
  | "feedDate"
  | "feedLabel"
  | "feedListParams"
  | "feedMedia"
  | "feedPropertyValue"
  | "feedSettingFields"
  | "formatFeedRelativeDate"
  | "groupFeedRows"
  | "loadFeedPages"
  | "normalizeFeedViewConfig"
  | "resolveFeedSettings"
>;
type ModesApi = Pick<
  typeof Modes,
  | "modeDefaultsOf"
  | "normalizeModeConfig"
  | "resolveDisplayModes"
  | "withoutDisabledModeRenderers"
>;

const statusColumn = {
  id: "status",
  header: "Status",
  type: "select",
  options: [
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" },
  ],
};

const columns = [
  { id: "select", header: "", type: "text" },
  { id: "name", header: "Name", type: "text" },
  statusColumn,
  { id: "price", header: "Price", type: "number" },
  { id: "dueDate", header: "Due", type: "date" },
  { id: "update", header: "Update", type: "text" },
  { id: "author", header: "Author", type: "text" },
  { id: "postedAt", header: "Posted at", type: "date" },
  { id: "cover", header: "Cover", type: "image" },
  { id: "actions", header: "", type: "actions" },
];

const FRENCH_THREE_HOURS = /^il y a 3/;
const NOW = new Date("2026-09-24T12:00:00");
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 3_600_000).toISOString();

export function feedViewSuite(
  test: (name: string, run: () => void | Promise<void>) => void,
  feed: FeedApi,
  modes: ModesApi
) {
  test("keeps only valid feed settings", () => {
    assert.deepEqual(
      feed.normalizeFeedViewConfig({
        titleColumn: " name ",
        authorColumn: null,
        dateColumn: "postedAt",
        bodyColumn: "",
        propertyColumnIds: ["status", "", 3, "status"],
        dateDisplay: "absolute",
        density: "compact",
        bodyLines: "6",
        pageSize: 0,
        infiniteScroll: true,
        showPropertyLabels: "yes",
        renderBody: () => "html",
        unknown: 1,
      }),
      {
        titleColumn: "name",
        authorColumn: null,
        dateColumn: "postedAt",
        propertyColumnIds: ["status"],
        dateDisplay: "absolute",
        density: "compact",
        bodyLines: 6,
        infiniteScroll: true,
      }
    );
    assert.equal(feed.normalizeFeedViewConfig({ density: "airy" }), undefined);
    assert.equal(feed.normalizeFeedViewConfig({ bodyLines: 21 }), undefined);
    assert.equal(feed.normalizeFeedViewConfig([]), undefined);
    assert.deepEqual(modes.normalizeModeConfig("feed", { pageSize: 5 }), {
      pageSize: 5,
    });
  });

  test("guesses title, author, date, body and media, and shows option columns", () => {
    const settings = feed.resolveFeedSettings(columns, undefined, undefined);
    assert.deepEqual(settings, {
      titleColumn: "name",
      authorColumn: "author",
      dateColumn: "postedAt",
      bodyColumn: "update",
      mediaColumn: "cover",
      propertyColumnIds: ["status"],
      showPropertyLabels: false,
      dateDisplay: "relative",
      bodyLines: 4,
      density: "comfortable",
      pageSize: 10,
      infiniteScroll: false,
    });
  });

  test("applies table defaults, then the view; null hides a part and missing columns are ignored", () => {
    const settings = feed.resolveFeedSettings(
      columns,
      { bodyLines: 2, dateColumn: "dueDate", authorColumn: "missing" },
      {
        authorColumn: null,
        mediaColumn: null,
        propertyColumnIds: ["price", "name", "status", "missing"],
        density: "compact",
      },
      "status"
    );
    assert.equal(settings.authorColumn, undefined);
    assert.equal(settings.mediaColumn, undefined);
    assert.equal(settings.dateColumn, "dueDate");
    assert.equal(settings.bodyLines, 2);
    assert.equal(settings.density, "compact");
    // The title and the grouped column never repeat as properties.
    assert.deepEqual(settings.propertyColumnIds, ["price"]);
  });

  test("sorts by the date column, newest first, when the view has no sort", () => {
    const settings = { dateColumn: "postedAt", pageSize: 3 };
    const params = feed.feedListParams({ search: "a" }, settings, 2, "status");
    assert.deepEqual(params.sorting, [{ id: "postedAt", desc: true }]);
    assert.deepEqual(params.orderBy, { postedAt: "desc" });
    assert.equal(params.page, 2);
    assert.equal(params.pageSize, 3);
    assert.deepEqual(params.grouping, ["status"]);
    const own = feed.feedListParams(
      { sorting: [{ id: "name", desc: false }] },
      settings,
      1
    );
    assert.deepEqual(own.sorting, [{ id: "name", desc: false }]);
    const react = feed.feedListParams(
      { orderBy: { price: "asc" } },
      settings,
      1
    );
    assert.deepEqual(react.orderBy, { price: "asc" });
  });

  test("loads list pages, knows when more remain and reloads several pages", async () => {
    const records = Array.from({ length: 7 }, (_, index) => ({
      id: `r${index}`,
    }));
    const requests: Record<string, unknown>[] = [];
    const list = (params: Record<string, unknown>) => {
      requests.push(params);
      const size = Number(params.pageSize);
      const start = (Number(params.page) - 1) * size;
      return Promise.resolve({
        data: records.slice(start, start + size),
        meta: { totalCount: records.length },
      });
    };
    const settings = { dateColumn: "postedAt", pageSize: 3 };
    const first = await feed.loadFeedPages({ list, settings, page: 1 });
    assert.deepEqual(
      first.rows.map((row) => row.id),
      ["r0", "r1", "r2"]
    );
    assert.equal(first.hasMore, true);
    assert.equal(first.totalCount, 7);
    const last = await feed.loadFeedPages({ list, settings, page: 3 });
    assert.deepEqual(
      last.rows.map((row) => row.id),
      ["r6"]
    );
    assert.equal(last.hasMore, false);
    const reload = await feed.loadFeedPages({
      list,
      settings,
      page: 1,
      pages: 5,
    });
    assert.equal(reload.rows.length, 7);
    assert.equal(reload.hasMore, false);
    // Stopped after the third page although five were asked.
    assert.equal(requests.length, 5);
    assert.deepEqual(
      feed
        .appendFeedRows(first.rows, reload.rows, (row) => String(row.id))
        .map((row) => row.id),
      ["r0", "r1", "r2", "r3", "r4", "r5", "r6"]
    );
  });

  test("pages local rows newest first without a list action", async () => {
    const rows = [
      { id: "old", postedAt: hoursAgo(30) },
      { id: "none" },
      { id: "new", postedAt: hoursAgo(1) },
    ];
    const result = await feed.loadFeedPages({
      rows,
      columns,
      settings: { dateColumn: "postedAt", pageSize: 2 },
      page: 1,
    });
    assert.deepEqual(
      result.rows.map((row) => row.id),
      ["new", "old"]
    );
    assert.equal(result.hasMore, true);
  });

  test("formats relative dates in English and French, absolute on hover", () => {
    assert.equal(
      feed.formatFeedRelativeDate(hoursAgo(3), "en", NOW),
      new Intl.RelativeTimeFormat("en", { style: "short" }).format(-3, "hour")
    );
    assert.equal(
      feed.formatFeedRelativeDate(hoursAgo(3), "fr", NOW),
      new Intl.RelativeTimeFormat("fr", { style: "short" }).format(-3, "hour")
    );
    assert.match(
      String(feed.formatFeedRelativeDate(hoursAgo(3), "fr", NOW)),
      FRENCH_THREE_HOURS
    );
    assert.equal(
      feed.formatFeedRelativeDate(hoursAgo(0.001), "en", NOW),
      new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(0, "second")
    );
    assert.equal(
      feed.formatFeedRelativeDate("2026-09-23", "en", NOW),
      "yesterday"
    );
    assert.equal(feed.formatFeedRelativeDate("2026-09-23", "fr", NOW), "hier");
    assert.equal(
      feed.formatFeedRelativeDate("not a date", "en", NOW),
      undefined
    );
    const date = feed.feedDate(hoursAgo(3), "relative", "en", undefined, NOW);
    assert.ok(date);
    assert.equal(date.dateTime, hoursAgo(3));
    assert.notEqual(date.title, date.text);
    const absolute = feed.feedDate(
      "2026-09-02",
      "absolute",
      "fr",
      undefined,
      NOW
    );
    assert.deepEqual(absolute, {
      text: "2 sept. 2026",
      title: "2 sept. 2026",
      dateTime: "2026-09-02",
    });
  });

  test("clamps long bodies, measured sizes winning over the estimate", () => {
    const long = "word ".repeat(100).trim();
    assert.equal(feed.feedBodyMayOverflow(long, 4), true);
    assert.equal(feed.feedBodyMayOverflow("short", 4), false);
    assert.equal(feed.feedBodyMayOverflow("a\nb\nc\nd\ne", 4), true);
    assert.equal(feed.feedBodyMayOverflow(long, 0), false);
    assert.equal(
      feed.feedBodyNeedsToggle(long, 4, { clientHeight: 96, scrollHeight: 96 }),
      false
    );
    assert.equal(
      feed.feedBodyNeedsToggle("short", 4, {
        clientHeight: 96,
        scrollHeight: 140,
      }),
      true
    );
    assert.equal(
      feed.feedBodyNeedsToggle(long, 4, { clientHeight: 0, scrollHeight: 0 }),
      true
    );
    assert.equal(feed.feedBodyText(["One", null, "Two"]), "One\nTwo");
    assert.equal(feed.feedBodyText({ text: " Hello " }), "Hello");
  });

  test("reads authors, media and property values", () => {
    assert.deepEqual(feed.feedAuthor("Ada Lovelace"), {
      name: "Ada Lovelace",
      initials: "AL",
    });
    assert.deepEqual(
      feed.feedAuthor([
        { name: "Grace", avatarUrl: "https://example.com/g.png" },
      ]),
      { name: "Grace", initials: "GR", avatarUrl: "https://example.com/g.png" }
    );
    assert.equal(
      feed.feedAuthor({ name: "Eve", avatar: "javascript:alert(1)" })
        ?.avatarUrl,
      undefined
    );
    assert.equal(feed.feedAuthor(""), undefined);
    const media = feed.feedMedia([
      "https://example.com/a.jpg",
      { url: "https://example.com/doc.pdf", name: "Brief.pdf" },
      { url: "/b", type: "image", alt: "Chart" },
      "javascript:alert(1)",
      "https://example.com/c.png",
      "https://example.com/d.webp",
      "https://example.com/e.gif",
    ]);
    assert.equal(media.images.length, 4);
    assert.equal(media.moreImages, 1);
    assert.deepEqual(media.images[1], { url: "/b", alt: "Chart" });
    assert.deepEqual(media.files, [
      { name: "Brief.pdf", url: "https://example.com/doc.pdf" },
    ]);
    const labels = { locale: "en", coloredTags: false, yes: "Yes", no: "No" };
    const status = statusColumn;
    assert.deepEqual(feed.feedPropertyValue(status, "active", labels), {
      kind: "tags",
      tags: [{ id: "0", text: "Active", colored: false }],
    });
    assert.equal(feed.feedPropertyValue(status, "", labels), undefined);
    assert.deepEqual(
      feed.feedPropertyValue(
        { id: "price", type: "number", numberFormat: { currency: "EUR" } },
        12,
        labels
      ),
      { kind: "text", text: "€12.00" }
    );
    assert.deepEqual(
      feed.feedPropertyValue(
        { id: "site", type: "url" },
        "javascript:x",
        labels
      ),
      { kind: "text", text: "javascript:x" }
    );
    assert.deepEqual(
      feed.feedPropertyValue({ id: "done", type: "boolean" }, false, labels),
      { kind: "text", text: "No" }
    );
  });

  test("sections rows by the grouped column in order of appearance", () => {
    const rows = [
      { id: "a", status: "draft" },
      { id: "b", status: "active" },
      { id: "c", status: "draft" },
      { id: "d" },
    ];
    const sections = feed.groupFeedRows(rows, statusColumn, "No value");
    assert.deepEqual(
      sections.map((section) => [
        section.label,
        section.rows.map((row) => row.id),
      ]),
      [
        ["Draft", ["a", "c"]],
        ["Active", ["b"]],
        ["No value", ["d"]],
      ]
    );
    assert.equal(feed.groupFeedRows(rows, undefined, "").length, 1);
  });

  test("labels in English and French, overridable by the host", () => {
    assert.equal(feed.feedLabel("showMore", "en"), "Show more");
    assert.equal(feed.feedLabel("showMore", "fr-FR"), "Voir plus");
    assert.equal(feed.feedLabel("loadMore", "fr"), "Charger plus");
    assert.equal(
      feed.feedLabel("lines", "fr", undefined, { count: 3 }),
      "3 lignes"
    );
    assert.equal(
      feed.feedLabel("loadMore", "en", (key, fallback) =>
        key === "loadMore" ? "More posts" : fallback
      ),
      "More posts"
    );
  });

  test("settings fields save the view, None as null", () => {
    let saved: Record<string, unknown> = {};
    const { fields, properties } = feed.feedSettingFields({
      columns,
      view: { density: "compact" },
      locale: "en",
      update: (next) => {
        saved = next;
      },
    });
    assert.deepEqual(
      fields.map((field) => field.id),
      [
        "titleColumn",
        "authorColumn",
        "dateColumn",
        "dateDisplay",
        "bodyColumn",
        "bodyLines",
        "mediaColumn",
        "density",
        "pageSize",
        "infiniteScroll",
      ]
    );
    const body = fields.find((field) => field.id === "bodyColumn");
    assert.equal(body?.value, "update");
    body?.onChange("");
    assert.deepEqual(saved, { density: "compact", bodyColumn: null });
    fields.find((field) => field.id === "bodyLines")?.onChange("0");
    assert.deepEqual(saved, { density: "compact", bodyLines: 0 });
    assert.deepEqual(properties.value, ["status"]);
    assert.equal(
      properties.options.some((option) => option.value === "update"),
      false
    );
    properties.onChange(["price", "status"]);
    assert.deepEqual(saved, {
      density: "compact",
      propertyColumnIds: ["price", "status"],
    });
  });

  test("the feed mode ships in the table and `table.feed: false` withholds it", () => {
    const renderers = { feed: {}, chart: {} };
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "feed"], {
        renderers: Object.keys(renderers),
      }),
      ["table", "feed"]
    );
    assert.deepEqual(
      Object.keys(
        modes.withoutDisabledModeRenderers(renderers, { feed: false }) ?? {}
      ),
      ["chart"]
    );
    assert.deepEqual(
      modes.resolveDisplayModes(["table", "feed"], { renderers: [] }),
      ["table"]
    );
    const renderBody = () => "x";
    assert.equal(
      modes.modeDefaultsOf({ feed: { renderBody } }, "feed").renderBody,
      renderBody
    );
  });
}
