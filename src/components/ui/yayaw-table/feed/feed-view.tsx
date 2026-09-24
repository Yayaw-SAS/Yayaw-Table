"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import {
  type FeedColumn,
  type FeedLabelKey,
  type FeedViewSettings,
  feedBodyRenderer,
  feedLabel,
  groupFeedRows,
  resolveFeedSettings,
} from "../utils/feed-view";
import { FeedCard, type FeedLabel } from "./feed-card";
import { useFeedPages } from "./use-feed-pages";

const SKELETON_CARDS = ["a", "b", "c"];
/** Start loading the next page a little before the end scrolls into view. */
const INFINITE_SCROLL_MARGIN = "240px";

function FeedSkeleton() {
  return (
    <div className="grid gap-3" data-feed-skeleton>
      {SKELETON_CARDS.map((key) => (
        <div className="grid gap-3 rounded-lg border p-4" key={key}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

function FeedFooter({
  hasMore,
  infiniteScroll,
  label,
  loadingMore,
  onLoadMore,
}: {
  hasMore: boolean;
  infiniteScroll: boolean;
  label: FeedLabel;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (
      !(infiniteScroll && hasMore && element) ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: INFINITE_SCROLL_MARGIN }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, infiniteScroll, onLoadMore]);
  if (!hasMore) {
    return null;
  }
  // The button stays as the accessible way to load more, also with infinite scroll.
  return (
    <div className="flex justify-center pt-1" data-feed-footer ref={sentinel}>
      <Button
        aria-busy={loadingMore}
        disabled={loadingMore}
        onClick={onLoadMore}
        size="sm"
        type="button"
        variant="outline"
      >
        {loadingMore ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {loadingMore ? label("loadingMore") : label("loadMore")}
      </Button>
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
  const columnMap = useMemo(
    () =>
      new Map((columns as FeedColumn[]).map((column) => [column.id, column])),
    [columns]
  );
  const feed = useFeedPages(context, settings);
  // Relative dates read against the time the rows arrived.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page refreshes "now".
  const now = useMemo(() => new Date(), [feed.rows]);
  const sections = useMemo(
    () =>
      groupFeedRows(
        feed.rows,
        groupBy ? columnMap.get(groupBy) : undefined,
        label("noValue")
      ),
    [columnMap, feed.rows, groupBy, label]
  );
  const renderBody = feedBodyRenderer(defaults);
  const positions = new Map(
    feed.rows.map((row, index) => [row, index + 1] as const)
  );
  const compact = settings.density === "compact";

  if (feed.loading && feed.rows.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[720px] py-2" data-feed-view>
        <output className="sr-only">{label("loading")}</output>
        <FeedSkeleton />
      </div>
    );
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
        <Button onClick={feed.retry} size="sm" type="button" variant="outline">
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
    <div
      className="mx-auto grid w-full min-w-0 max-w-[720px] gap-4 py-2"
      data-density={settings.density}
      data-feed-view
    >
      <div
        aria-busy={feed.loading || feed.loadingMore}
        className={compact ? "grid gap-4" : "grid gap-6"}
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
            {section.rows.map((row) => (
              <FeedCard
                coloredTags={context.coloredTags}
                columns={columnMap}
                key={context.getRowId(row)}
                label={label}
                locale={locale}
                now={now}
                onOpen={context.openRow}
                position={positions.get(row) ?? 0}
                renderBody={renderBody}
                row={row}
                rowId={context.getRowId(row)}
                setSize={feed.hasMore ? -1 : feed.rows.length}
                settings={settings}
              />
            ))}
          </section>
        ))}
      </div>
      {feed.error ? (
        <p className="text-center text-destructive text-sm" role="alert">
          {label("error")}
        </p>
      ) : null}
      <FeedFooter
        hasMore={feed.hasMore}
        infiniteScroll={settings.infiniteScroll}
        label={label}
        loadingMore={feed.loadingMore}
        onLoadMore={feed.loadMore}
      />
    </div>
  );
}
