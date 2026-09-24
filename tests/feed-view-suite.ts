import assert from "node:assert/strict";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";
import type * as Controller from "../src/components/ui/yayaw-table/utils/feed-controller";
import type * as Dom from "../src/components/ui/yayaw-table/utils/feed-dom";
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
  | "feedRowMedia"
  | "feedSettingFields"
  | "feedWindowThreshold"
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
/** The pages store and the browser helpers of loading and windowing. */
type LoadingApi = Pick<
  typeof Controller,
  "createFeedPages" | "feedLoadAnnouncement"
> &
  Pick<typeof Dom, "createFeedHeights" | "feedScrollRoot" | "feedWindowRange">;

type Row = Record<string, unknown>;
interface ListAnswer {
  data: unknown[];
  meta?: { totalCount?: number };
}

/**
 * A server-like list of `count` posts whose answers wait for `answer()`, so
 * tests see what is asked while a request runs. `fail` rejects a page once.
 */
function pagedList(count: number, fail?: number) {
  const records = Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
  }));
  const requests: number[] = [];
  const waiting: (() => void)[] = [];
  let failing = fail;
  const list = (params: Record<string, unknown>) => {
    const page = Number(params.page);
    const size = Number(params.pageSize);
    requests.push(page);
    return new Promise<ListAnswer>((resolve, reject) => {
      waiting.push(() => {
        if (page === failing) {
          failing = undefined;
          reject(new Error(`Page ${page} failed`));
          return;
        }
        resolve({
          data: records.slice((page - 1) * size, page * size),
          meta: { totalCount: count },
        });
      });
    });
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  /** Answer every request waiting, then let the store update. */
  const answer = async () => {
    for (const release of waiting.splice(0)) {
      release();
    }
    await settle();
  };
  return { answer, list, requests, settle };
}

const rowId = (row: Row) => String(row.id);

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
  modes: ModesApi,
  loading: LoadingApi
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
      infiniteScroll: true,
    });
  });

  test("loads on scroll by default; a table or a view turns it off", () => {
    assert.equal(
      feed.resolveFeedSettings(columns, { infiniteScroll: false }, undefined)
        .infiniteScroll,
      false
    );
    assert.equal(
      feed.resolveFeedSettings(columns, undefined, { infiniteScroll: false })
        .infiniteScroll,
      false
    );
    assert.equal(
      feed.resolveFeedSettings(
        columns,
        { infiniteScroll: false },
        { infiniteScroll: true }
      ).infiniteScroll,
      true
    );
    const { fields } = feed.feedSettingFields({
      columns,
      view: {},
      locale: "en",
      update: () => undefined,
    });
    assert.equal(
      fields.find((field) => field.id === "infiniteScroll")?.value,
      "on"
    );
  });

  test("windows long feeds past 60 posts unless `table.feed.windowing` says otherwise", () => {
    assert.equal(feed.feedWindowThreshold({}), 60);
    assert.equal(feed.feedWindowThreshold({ windowing: true }), 60);
    assert.equal(feed.feedWindowThreshold({ windowing: 25 }), 25);
    assert.equal(feed.feedWindowThreshold({ windowing: 0 }), 60);
    assert.equal(feed.feedWindowThreshold({ windowing: 2.5 }), 60);
    assert.equal(feed.feedWindowThreshold({ windowing: false }), undefined);
    // A host option, never saved with views.
    assert.equal(
      feed.normalizeFeedViewConfig({ windowing: false, pageSize: 5 })?.pageSize,
      5
    );
    assert.equal(
      "windowing" in (feed.normalizeFeedViewConfig({ windowing: 5 }) ?? {}),
      false
    );
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

  test("reads videos of the media contract with posters and captions", () => {
    const media = feed.feedMedia([
      {
        url: "https://example.com/launch",
        type: "video",
        poster: "https://example.com/launch.jpg",
        alt: "Launch demo",
        tracks: [
          { src: "/launch.en.vtt", srcLang: "en", label: "English" },
          { src: "javascript:alert(1)", srcLang: "fr" },
        ],
      },
      { url: "https://example.com/tour.webm", poster: "javascript:x" },
      { url: "/clip", mimeType: "video/mp4" },
      // An explicit type wins over the extension.
      { url: "https://example.com/notes.mp4", type: "document", name: "Notes" },
    ]);
    assert.deepEqual(media.videos, [
      {
        url: "https://example.com/launch",
        alt: "Launch demo",
        poster: "https://example.com/launch.jpg",
        tracks: [
          {
            src: "/launch.en.vtt",
            kind: "captions",
            label: "English",
            srcLang: "en",
          },
        ],
      },
      { url: "https://example.com/tour.webm", alt: "", tracks: [] },
    ]);
    // Past two videos, the others are listed as files.
    assert.deepEqual(media.files, [
      { name: "clip", url: "/clip" },
      { name: "Notes", url: "https://example.com/notes.mp4" },
    ]);
    assert.equal(media.images.length, 0);
    // In an image column, a video URL is still a video.
    assert.equal(
      feed.feedMedia("https://example.com/a.mov", {
        id: "cover",
        type: "image",
      }).videos.length,
      1
    );
  });

  test("takes a post's media from the table's gallery media contract for its column", () => {
    const cover = { id: "cover", header: "Cover", type: "image" };
    const row = {
      cover: "https://example.com/clip.mp4",
      kind: "video",
      still: "https://example.com/still.jpg",
    };
    const gallery = {
      enabled: true,
      typeColumn: "kind",
      posterColumn: "still",
    };
    assert.deepEqual(feed.feedRowMedia(row, cover, gallery, "cover").videos, [
      {
        url: "https://example.com/clip.mp4",
        alt: "",
        poster: "https://example.com/still.jpg",
        tracks: [],
      },
    ]);
    // `getMedia` describes the row's media itself.
    const custom = feed.feedRowMedia(
      { cover: "https://example.com/a.jpg" },
      cover,
      {
        enabled: true,
        getMedia: () => ({
          url: "https://example.com/b.jpg",
          type: "image",
          alt: "B",
        }),
      },
      "cover"
    );
    assert.deepEqual(custom.images, [
      { url: "https://example.com/b.jpg", alt: "B" },
    ]);
    // Off, or for another column, the column's value is read as it is.
    assert.deepEqual(
      feed.feedRowMedia(row, cover, { ...gallery, enabled: false }).videos[0]
        ?.poster,
      undefined
    );
    assert.equal(
      feed.feedRowMedia(
        { other: "https://example.com/o.png" },
        { id: "other", type: "image" },
        gallery,
        "cover"
      ).images.length,
      1
    );
    assert.deepEqual(feed.feedRowMedia(row, undefined), {
      images: [],
      moreImages: 0,
      videos: [],
      files: [],
    });
  });

  test("appends the next page one request at a time and stops at the end", async () => {
    const server = pagedList(5);
    const store = loading.createFeedPages();
    const updates: number[] = [];
    store.subscribe(() => updates.push(store.getState().rows.length));
    const source = {
      list: server.list,
      settings: { pageSize: 2 },
      getRowId: rowId,
    };
    const first = store.load(source, "query");
    assert.equal(store.getState().loading, true);
    await server.answer();
    await first;
    assert.deepEqual(store.getState().rows.map(rowId), ["p1", "p2"]);
    assert.equal(store.getState().hasMore, true);
    assert.equal(store.getState().totalCount, 5);
    // Scrolling asks again while the page loads: one request only.
    const more = store.loadMore();
    store.loadMore();
    store.loadMore(true);
    assert.deepEqual(server.requests, [1, 2]);
    assert.equal(store.getState().loadingMore, true);
    await server.answer();
    await more;
    assert.deepEqual(store.getState().appended, {
      count: 2,
      total: 4,
      firstId: "p3",
      manual: false,
    });
    const last = store.loadMore(true);
    await server.answer();
    await last;
    assert.deepEqual(store.getState().rows.map(rowId), [
      "p1",
      "p2",
      "p3",
      "p4",
      "p5",
    ]);
    assert.equal(store.getState().hasMore, false);
    assert.equal(store.getState().appended?.manual, true);
    // At the end nothing more is asked.
    await store.loadMore();
    assert.deepEqual(server.requests, [1, 2, 3]);
    assert.ok(updates.length > 0);
  });

  test("keeps the posts shown when a page fails, pauses, and retries that page", async () => {
    const server = pagedList(6, 2);
    const store = loading.createFeedPages();
    const source = {
      list: server.list,
      settings: { pageSize: 2 },
      getRowId: rowId,
    };
    const first = store.load(source, "query");
    await server.answer();
    await first;
    const failed = store.loadMore();
    await server.answer();
    await failed;
    assert.equal(store.getState().moreError, "Page 2 failed");
    assert.equal(store.getState().loadingMore, false);
    assert.deepEqual(store.getState().rows.map(rowId), ["p1", "p2"]);
    // Paused: scrolling asks nothing until a retry.
    await store.loadMore();
    assert.deepEqual(server.requests, [1, 2]);
    const retried = store.retry();
    assert.equal(store.getState().moreError, undefined);
    await server.answer();
    await retried;
    assert.deepEqual(server.requests, [1, 2, 2]);
    assert.deepEqual(store.getState().rows.map(rowId), [
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
    assert.equal(store.getState().appended?.manual, true);
  });

  test("reloads the pages shown after a change and starts over for a new query", async () => {
    const server = pagedList(9);
    const store = loading.createFeedPages();
    const source = {
      list: server.list,
      settings: { pageSize: 3 },
      getRowId: rowId,
    };
    const first = store.load(source, "all");
    await server.answer();
    await first;
    const more = store.loadMore();
    await server.answer();
    await more;
    server.requests.length = 0;
    // A mutation (same query): both pages shown are asked again.
    const reload = store.load(source, "all");
    await server.answer();
    await server.answer();
    await reload;
    assert.deepEqual(server.requests, [1, 2]);
    assert.equal(store.getState().rows.length, 6);
    assert.equal(store.getState().pages, 2);
    assert.equal(store.getState().appended, undefined);
    server.requests.length = 0;
    // A new query drops the answer of the one before and starts at page 1.
    const stale = store.load(source, "all");
    const fresh = store.load(source, "search");
    await server.answer();
    await server.answer();
    await Promise.all([stale, fresh]);
    assert.deepEqual(server.requests, [1, 1]);
    assert.equal(store.getState().pages, 1);
    assert.deepEqual(store.getState().rows.map(rowId), ["p1", "p2", "p3"]);
    assert.equal(store.getState().loading, false);
  });

  test("shows the first load's error and retries it", async () => {
    const server = pagedList(3, 1);
    const store = loading.createFeedPages();
    const source = {
      list: server.list,
      settings: { pageSize: 3 },
      getRowId: rowId,
    };
    const first = store.load(source, "query");
    await server.answer();
    await first;
    assert.equal(store.getState().error, "Page 1 failed");
    assert.equal(store.getState().loading, false);
    const retried = store.retry();
    await server.answer();
    await retried;
    assert.equal(store.getState().error, undefined);
    assert.equal(store.getState().rows.length, 3);
    assert.equal(store.getState().hasMore, false);
  });

  test("announces the posts loaded and the end in English and French", () => {
    const english = (key: Parameters<FeedApi["feedLabel"]>[0], params = {}) =>
      feed.feedLabel(key, "en", undefined, params);
    const french = (key: Parameters<FeedApi["feedLabel"]>[0], params = {}) =>
      feed.feedLabel(key, "fr", undefined, params);
    const appended = { count: 10, total: 30, manual: false };
    assert.equal(
      loading.feedLoadAnnouncement({ appended, hasMore: true }, english),
      "10 more posts loaded, 30 shown."
    );
    assert.equal(
      loading.feedLoadAnnouncement(
        { appended: { ...appended, count: 1, total: 21 }, hasMore: false },
        english
      ),
      "1 more post loaded, 21 shown. You're all caught up."
    );
    assert.equal(
      loading.feedLoadAnnouncement({ appended, hasMore: false }, french),
      "10 publications de plus chargées, 30 affichées. Vous êtes à jour."
    );
    assert.equal(
      loading.feedLoadAnnouncement(
        { appended: { ...appended, count: 0 }, hasMore: false },
        english
      ),
      "You're all caught up."
    );
    assert.equal(loading.feedLoadAnnouncement({ hasMore: true }, english), "");
  });

  test("windows posts near the view and keeps measured heights", () => {
    // Ten posts of 100px with 10px gaps: post n spans [110n, 110n + 100].
    const boxes = Array.from({ length: 10 }, (_, index) => ({
      top: index * 110,
      bottom: index * 110 + 100,
    }));
    const read: number[] = [];
    const boxAt = (index: number) => {
      read.push(index);
      return boxes[index] ?? { top: 0, bottom: 0 };
    };
    assert.deepEqual(
      loading.feedWindowRange(10, boxAt, { top: 300, bottom: 500 }, 200),
      { start: 1, end: 7 }
    );
    // Bisection reads a few boxes, not all of them.
    assert.ok(read.length < 10);
    assert.deepEqual(
      loading.feedWindowRange(10, boxAt, { top: 5000, bottom: 5200 }, 100),
      { start: 10, end: 10 }
    );
    assert.deepEqual(
      loading.feedWindowRange(0, boxAt, { top: 0, bottom: 500 }, 500),
      { start: 0, end: 0 }
    );
    const heights = loading.createFeedHeights(200);
    assert.equal(heights.heightOf("a"), 200);
    heights.set("a", 100);
    heights.set("b", 300);
    heights.set("c", 0);
    assert.equal(heights.has("c"), false);
    assert.equal(heights.heightOf("a"), 100);
    // Never measured: the average of the measured posts.
    assert.equal(heights.heightOf("z"), 200);
    heights.set("b", 500);
    assert.equal(heights.heightOf("z"), 300);
  });

  test("finds the ancestor that scrolls the feed", () => {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    const clipper = document.createElement("div");
    clipper.style.overflowX = "auto";
    const list = document.createElement("div");
    clipper.append(list);
    scroller.append(clipper);
    document.body.append(scroller);
    const size = (scrollHeight: number) => {
      Object.defineProperty(scroller, "scrollHeight", {
        configurable: true,
        value: scrollHeight,
      });
      Object.defineProperty(scroller, "clientHeight", {
        configurable: true,
        value: 300,
      });
    };
    size(900);
    assert.equal(loading.feedScrollRoot(list), scroller);
    // A container that does not overflow does not scroll the feed.
    size(300);
    assert.equal(loading.feedScrollRoot(list), undefined);
    scroller.remove();
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
