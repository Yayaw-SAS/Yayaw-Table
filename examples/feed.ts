/**
 * Feed lazy-loading parity: the same 120 posts, list handler and config in
 * both demos (`?example=feed`). Pages load as the end of the feed comes near,
 * images load lazily, and past 60 posts only the posts near the viewport are
 * rendered. `&fail-page=3` makes the first request for page 3 fail, to try
 * the retry control; `&delay=800` answers after 800 ms, to see the loading
 * states.
 */
import {
  compatibleListParams,
  matchesContractFilter,
} from "../src/components/ui/yayaw-table/utils/table-contracts";

const HOUR_MS = 3_600_000;
const POST_COUNT = 120;
/** A short open-licence clip; the feed shows its poster until it plays. */
const DEMO_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const picture = (seed: string) =>
  `https://picsum.photos/seed/yayaw-feed-${seed}/720/450`;

const AUTHORS = [
  "Ada Martin",
  "Léa Dubois",
  "Sam Chen",
  "Noah Petit",
  "Maya Laurent",
];
const TOPICS = ["Product", "Engineering", "Design", "Company"];
const SUBJECTS = [
  "Release notes",
  "Sprint review",
  "Customer visit",
  "Design critique",
  "Hiring update",
  "Roadmap",
  "Incident review",
  "Team offsite",
  "Office move",
  "Partner launch",
  "Security audit",
  "Quarterly numbers",
];
const LONG_BODY = [
  "We shipped the changes planned for this cycle and the first numbers are encouraging: sign-ups are ahead of plan and support volume stays low.",
  "Next come the onboarding emails, a review of the pricing page and a short survey for the first twenty accounts.",
  "We will share the details at Friday's review, with the signals we are watching and the two themes that came up most this week.",
].join("\n\n");

export interface FeedPost extends Record<string, unknown> {
  id: string;
  title: string;
  author: string;
  postedAt: string;
  body: string;
  media: Record<string, unknown>[];
  topic: string;
}

function mediaOf(index: number): Record<string, unknown>[] {
  const seed = String(index);
  if (index === 2) {
    return [
      {
        url: DEMO_VIDEO,
        type: "video",
        mimeType: "video/mp4",
        poster: picture("video"),
        alt: "Flowers opening, a time-lapse",
      },
    ];
  }
  if (index % 10 === 3) {
    return [
      { url: picture(`${seed}a`), type: "image", alt: `Photo ${seed}a` },
      { url: picture(`${seed}b`), type: "image", alt: `Photo ${seed}b` },
    ];
  }
  return index % 4 === 1
    ? [{ url: picture(seed), type: "image", alt: `Photo ${seed}` }]
    : [];
}

/** Update 1 is the newest; each post is three hours older than the one before. */
export const feedPosts = (): FeedPost[] =>
  Array.from({ length: POST_COUNT }, (_, offset) => {
    const index = offset + 1;
    return {
      id: `post-${String(index).padStart(3, "0")}`,
      title: `Update ${index}: ${SUBJECTS[offset % SUBJECTS.length]}`,
      author: AUTHORS[offset % AUTHORS.length] ?? "",
      postedAt: new Date(Date.now() - (index * 3 + 1) * HOUR_MS).toISOString(),
      body:
        index % 3 === 1
          ? LONG_BODY
          : `A short note from the ${TOPICS[offset % TOPICS.length]?.toLowerCase()} team.`,
      media: mediaOf(index),
      topic: TOPICS[offset % TOPICS.length] ?? "",
    };
  });

export const feedPostColumns = [
  { id: "title", header: "Title", type: "text" as const },
  { id: "author", header: "Author", type: "text" as const },
  {
    id: "postedAt",
    header: "Posted at",
    type: "date" as const,
    dateDisplayPreset: "dateTime" as const,
  },
  { id: "body", header: "Post", type: "text" as const },
  // Items of the gallery media contract: `{ url, type, poster, alt }`.
  { id: "media", header: "Media", type: "json" as const },
  {
    id: "topic",
    header: "Topic",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: TOPICS.map((value) => ({ value, label: value })),
  },
];

/** The list requests the demo host received, for the end-to-end tests. */
function recordRequest(params: Record<string, unknown>) {
  const holder = globalThis as {
    yayawDemoFeedRequests?: { page: number; pageSize: number }[];
  };
  holder.yayawDemoFeedRequests ??= [];
  holder.yayawDemoFeedRequests.push({
    page: Number(params.page),
    pageSize: Number(params.pageSize),
  });
}

/** A positive whole number from the page's URL, e.g. `&fail-page=3`. */
const urlNumber = (name: string): number | undefined => {
  if (typeof window === "undefined") {
    return;
  }
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : undefined;
};

const compareText = (left: unknown, right: unknown): number =>
  String(left ?? "").localeCompare(String(right ?? ""));

/**
 * A server-like host: search, filters, `orderBy`, then one page at a time.
 * `&delay=800` answers after 800 ms, to see the loading states.
 */
export function createFeedActions() {
  const posts = feedPosts();
  let failing = urlNumber("fail-page");
  const delay = urlNumber("delay");
  return {
    list: async (input: Record<string, unknown>) => {
      recordRequest(input);
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      const params = compatibleListParams(input);
      const page = Math.max(1, Number(params.page) || 1);
      if (page === failing) {
        failing = undefined;
        throw new Error("The demo host failed this page once.");
      }
      const search = String(params.search ?? "")
        .trim()
        .toLocaleLowerCase();
      const rules = params.advancedFilters as Record<string, unknown>[];
      const orderBy = Object.entries(
        (params.orderBy ?? {}) as Record<string, string>
      );
      const rows = posts
        .filter(
          (post) =>
            !search ||
            `${post.title} ${post.body} ${post.author}`
              .toLocaleLowerCase()
              .includes(search)
        )
        .filter((post) =>
          rules.every((rule) =>
            matchesContractFilter(post[String(rule.columnId)], rule)
          )
        )
        .sort((left, right) => {
          for (const [id, direction] of orderBy) {
            const comparison = compareText(left[id], right[id]);
            if (comparison) {
              return direction === "desc" ? -comparison : comparison;
            }
          }
          return compareText(left.id, right.id);
        });
      const pageSize = Math.max(1, Number(params.pageSize) || rows.length);
      return {
        data: rows
          .slice((page - 1) * pageSize, page * pageSize)
          .map((row) => ({ ...row })),
        meta: {
          pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
          totalCount: rows.length,
        },
      };
    },
  };
}

/** The table config both editions pass to `defineTableConfig`. */
export function feedExampleConfig() {
  return {
    id: "news",
    columns: {
      definitions: feedPostColumns,
      order: feedPostColumns.map((column) => column.id),
      visible: ["title", "author", "postedAt", "topic"],
      mandatory: ["title"],
    },
    table: {
      displayModes: ["feed", "table"] as ("feed" | "table")[],
      defaultDisplayMode: "feed" as const,
      // The table's own pages differ from any feed page size (the tests tell them apart).
      defaultPageSize: 25,
      allowCreate: false,
      allowDelete: false,
      allowDuplicate: false,
      feed: { mediaColumn: "media", propertyColumnIds: ["topic"] },
    },
    translations: {
      namespace: "news",
      keys: {
        title: "Team news",
        description:
          "120 posts: pages load as you scroll, long feeds keep only the posts near the screen.",
      },
    },
  };
}
