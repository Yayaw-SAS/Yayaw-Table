"use client";

import { Loader2 } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import {
  type FeedAppended,
  feedLoadAnnouncement,
} from "../utils/feed-controller";
import {
  canObserveFeedEnd,
  createFeedHeights,
  type FeedWindowTracker,
  focusFeedPost,
  observeFeedEnd,
  trackFeedWindow,
} from "../utils/feed-dom";
import {
  type FeedColumn,
  type FeedLabelKey,
  type FeedViewSettings,
  feedBodyRenderer,
  feedLabel,
  feedWindowThreshold,
  groupFeedRows,
  type ResolvedFeedSettings,
  resolveFeedSettings,
} from "../utils/feed-view";
import { FeedCard, type FeedLabel } from "./feed-card";
import { FeedLoading } from "./feed-loading";
import { type FeedPages, useFeedPages } from "./use-feed-pages";

type RowRecord = Record<string, unknown>;

// Moving the window re-renders the feed, not the posts whose props are unchanged.
const Post = memo(FeedCard);

function loadMoreText(feed: FeedPages, label: FeedLabel): string {
  if (feed.loadingMore) {
    return label("loadingMore");
  }
  return feed.moreError === undefined ? label("loadMore") : label("retry");
}

/**
 * The end of the feed: pages load as it comes within a screen of the
 * viewport, one request at a time. The "Load more" button stays for the
 * keyboard (shown when focused), shows without IntersectionObserver or with
 * `infiniteScroll` off, and reads "Retry" after a page failed.
 */
function FeedFooter({
  feed,
  infiniteScroll,
  label,
  onActivate,
}: {
  feed: FeedPages;
  infiniteScroll: boolean;
  label: FeedLabel;
  onActivate: () => void;
}) {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const { hasMore, loading, loadingMore, loadMore, moreError, pages } = feed;
  const auto = infiniteScroll && moreError === undefined && canObserveFeedEnd();
  // biome-ignore lint/correctness/useExhaustiveDependencies: each page observes again, so the next one loads while the end stays near.
  useEffect(() => {
    if (!(auto && hasMore && sentinel) || loading) {
      return;
    }
    const observer = observeFeedEnd(sentinel, () => {
      loadMore();
    });
    return () => observer?.disconnect();
  }, [auto, hasMore, loading, loadMore, pages, sentinel]);
  if (!hasMore) {
    return pages > 1 ? (
      <p
        className="py-2 text-center text-muted-foreground text-xs"
        data-feed-end
      >
        {label("end")}
      </p>
    ) : null;
  }
  const quiet = auto && !loadingMore;
  return (
    <div
      className="grid justify-items-center gap-2 pt-1"
      data-feed-footer
      ref={setSentinel}
    >
      {moreError === undefined ? null : (
        <p className="text-center text-destructive text-sm" role="alert">
          {label("loadMoreError")}
        </p>
      )}
      {/* Out of sight while scrolling loads pages; shown when it gets focus. */}
      <div className={cn(quiet && "sr-only focus-within:not-sr-only")}>
        <Button
          aria-busy={loadingMore}
          data-feed-load-more
          data-quiet={quiet ? "" : undefined}
          disabled={loadingMore}
          focusableWhenDisabled
          onClick={() => {
            onActivate();
            if (moreError === undefined) {
              loadMore(true);
            } else {
              feed.retry();
            }
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {loadingMore ? (
            <Loader2
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
          ) : null}
          {loadMoreText(feed, label)}
        </Button>
      </div>
    </div>
  );
}

const toggled = (ids: ReadonlySet<string>, id: string) => {
  const next = new Set(ids);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
};

/** The loaded posts, sections, footer and live region of a feed. */
function FeedPosts({
  context,
  feed,
  label,
  settings,
}: {
  context: DisplayModeRenderContext;
  feed: FeedPages;
  label: FeedLabel;
  settings: ResolvedFeedSettings;
}) {
  const { columns, defaults, getRowId, groupBy, locale } = context;
  const { appended, hasMore, rows } = feed;
  const columnMap = useMemo(
    () =>
      new Map((columns as FeedColumn[]).map((column) => [column.id, column])),
    [columns]
  );
  // Relative dates read against the time the rows arrived.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page refreshes "now".
  const now = useMemo(() => new Date(), [rows]);
  const sections = useMemo(
    () =>
      groupFeedRows(
        rows,
        groupBy ? columnMap.get(groupBy) : undefined,
        label("noValue"),
        locale
      ),
    [columnMap, groupBy, label, locale, rows]
  );
  const positions = useMemo(
    () => new Map(rows.map((row, index) => [row, index + 1] as const)),
    [rows]
  );
  const renderBody = feedBodyRenderer(defaults);
  const compact = settings.density === "compact";
  // "Show more" is kept per record so it survives windowing and new pages.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const toggleExpanded = useCallback(
    (id: string) => setExpanded((current) => toggled(current, id)),
    []
  );

  // Long feeds render only the posts near the viewport; the others keep their height.
  const [heights] = useState(() => createFeedHeights());
  const threshold = feedWindowThreshold(defaults);
  const windowed = threshold !== undefined && rows.length > threshold;
  const [shown, setShown] = useState<ReadonlySet<string> | null>(null);
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const tracker = useRef<FeedWindowTracker | undefined>(undefined);
  useLayoutEffect(() => {
    if (!list) {
      return;
    }
    const handle = trackFeedWindow(list, { heights, onChange: setShown });
    tracker.current = handle;
    return () => {
      handle.disconnect();
      tracker.current = undefined;
    };
  }, [heights, list]);
  // After every render: measure the posts shown and move the window.
  useLayoutEffect(() => {
    tracker.current?.update(windowed);
  });
  const rendered = (id: string) =>
    !(windowed && shown) || shown.has(id) || !heights.has(id);

  // "Load more" keeps focus while pages remain; it goes away with the last
  // page, and focus moves to the first new post instead of being lost.
  const pendingFocus = useRef<{ after?: FeedAppended } | null>(null);
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || appended === pending.after) {
      return;
    }
    pendingFocus.current = null;
    if (appended?.manual && !hasMore && list) {
      const last = rows.at(-1);
      focusFeedPost(list, appended.firstId ?? (last && getRowId(last)));
    }
  }, [appended, getRowId, hasMore, list, rows]);

  const setSize = hasMore ? (feed.totalCount ?? -1) : rows.length;
  return (
    <div
      className="mx-auto grid w-full min-w-0 max-w-[720px] gap-4 py-2"
      data-density={settings.density}
      data-feed-view
      data-windowed={windowed ? "" : undefined}
    >
      <div
        aria-busy={feed.loading || feed.loadingMore}
        className={compact ? "grid gap-4" : "grid gap-6"}
        ref={setList}
        role="feed"
      >
        {sections.map((section) => (
          <section
            aria-label={section.label || undefined}
            className={compact ? "grid gap-2" : "grid gap-3"}
            data-feed-section={section.label ? section.id : undefined}
            key={section.id}
          >
            {section.label ? (
              <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
                <span>{section.label}</span>
                <span className="text-xs tabular-nums">
                  {section.rows.length}
                </span>
              </h2>
            ) : null}
            {section.rows.map((row: RowRecord) => {
              const id = getRowId(row);
              return rendered(id) ? (
                <Post
                  coloredTags={context.coloredTags}
                  columns={columnMap}
                  expanded={expanded.has(id)}
                  gallery={context.media}
                  imageColumn={context.imageColumn}
                  key={id}
                  label={label}
                  locale={locale}
                  now={now}
                  onOpen={context.openRow}
                  onToggleExpanded={toggleExpanded}
                  position={positions.get(row) ?? 0}
                  renderBody={renderBody}
                  row={row}
                  rowId={id}
                  setSize={setSize}
                  settings={settings}
                />
              ) : (
                <div
                  aria-hidden="true"
                  data-feed-item
                  data-feed-placeholder
                  data-row-id={id}
                  key={id}
                  style={{ height: heights.heightOf(id) }}
                />
              );
            })}
          </section>
        ))}
      </div>
      {feed.error ? (
        <p className="text-center text-destructive text-sm" role="alert">
          {label("error")}
        </p>
      ) : null}
      <FeedFooter
        feed={feed}
        infiniteScroll={settings.infiniteScroll}
        label={label}
        onActivate={() => {
          pendingFocus.current = { after: appended };
        }}
      />
      <output aria-live="polite" className="sr-only" data-feed-status>
        {feedLoadAnnouncement(feed, label)}
      </output>
    </div>
  );
}

/** The Feed display mode: records as full-width posts in a centered column. */
export function FeedView({ context }: { context: DisplayModeRenderContext }) {
  const { columns, defaults, groupBy, locale, translate } = context;
  const label = useCallback<FeedLabel>(
    (key: FeedLabelKey, params) =>
      feedLabel(
        key,
        locale,
        (name, fallback) => translate(`feed.${name}`, fallback),
        params
      ),
    [locale, translate]
  );
  const settings = useMemo(
    () =>
      resolveFeedSettings(
        columns as FeedColumn[],
        defaults as FeedViewSettings,
        context.settings as FeedViewSettings,
        groupBy
      ),
    [columns, context.settings, defaults, groupBy]
  );
  const feed = useFeedPages(context, settings);

  if (feed.loading && feed.rows.length === 0) {
    return <FeedLoading label={label("loading")} />;
  }
  if (feed.error && feed.rows.length === 0) {
    return (
      <div
        className="mx-auto grid w-full max-w-[720px] justify-items-center gap-3 py-10 text-center"
        data-feed-view
      >
        <p className="text-destructive text-sm" role="alert">
          {label("error")}
        </p>
        <Button
          onClick={() => {
            feed.retry();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("retry")}
        </Button>
      </div>
    );
  }
  if (feed.rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[720px] py-2" data-feed-view>
        {context.emptyState}
      </div>
    );
  }
  return (
    <FeedPosts
      context={context}
      feed={feed}
      label={label}
      settings={settings}
    />
  );
}
