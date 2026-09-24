"use client";

import { Skeleton } from "@/src/components/ui/skeleton";

const SKELETON_CARDS = ["a", "b", "c"];

/**
 * The feed while its code or first page loads: skeleton posts in the feed's
 * column and the loading text for screen readers.
 */
export function FeedLoading({ label }: { label: string }) {
  return (
    <div
      className="mx-auto w-full max-w-[720px] py-2"
      data-feed-loading
      data-feed-view
    >
      <output className="sr-only">{label}</output>
      <div className="grid gap-3" data-feed-skeleton>
        {SKELETON_CARDS.map((key) => (
          <div className="grid gap-3 rounded-lg border p-4" key={key}>
            <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-1/3 motion-reduce:animate-none" />
            <Skeleton className="h-14 w-full motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
