import { defineAsyncComponent } from "vue";
import type {
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../display-mode-renderer";
import FeedLoading from "./FeedLoading.vue";
import FeedSettings from "./FeedSettings.vue";

/** The built-in Feed mode: records as posts, and its settings panel. */
export const feedRenderer: DisplayModeRenderer = {
  // The feed's code loads with the first feed shown, not with the table;
  // meanwhile the feed's own loading state shows.
  view: defineAsyncComponent({
    loader: () => import("./FeedView.vue"),
    loadingComponent: FeedLoading,
    delay: 0,
  }),
  settings: FeedSettings,
};

/** Renderers with the built-in Feed mode plugged in (a host renderer for `feed` wins). */
export function withFeedRenderer(
  renderers: DisplayModeRenderers | undefined
): DisplayModeRenderers {
  return renderers?.feed ? renderers : { feed: feedRenderer, ...renderers };
}
