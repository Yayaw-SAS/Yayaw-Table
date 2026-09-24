"use client";

import { lazy, Suspense } from "react";
import type {
  DisplayModeRenderContext,
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../types/display-mode-renderer";
import { feedLabel } from "../utils/feed-view";
import { FeedLoading } from "./feed-loading";
import { FeedSettings } from "./feed-settings";

// The feed's code loads with the first feed shown, not with the table.
const LazyFeedView = lazy(async () => ({
  default: (await import("./feed-view")).FeedView,
}));

function FeedViewLoader({ context }: { context: DisplayModeRenderContext }) {
  return (
    <Suspense
      fallback={
        <FeedLoading
          label={feedLabel("loading", context.locale, (key, fallback) =>
            context.translate(`feed.${key}`, fallback)
          )}
        />
      }
    >
      <LazyFeedView context={context} />
    </Suspense>
  );
}

/** The built-in Feed mode: records as posts, and its settings panel. */
export const feedRenderer: DisplayModeRenderer = {
  View: FeedViewLoader,
  Settings: FeedSettings,
};

/** Renderers with the built-in Feed mode plugged in (a host renderer for `feed` wins). */
export function withFeedRenderer(
  renderers: DisplayModeRenderers | undefined
): DisplayModeRenderers {
  return renderers?.feed ? renderers : { feed: feedRenderer, ...renderers };
}
