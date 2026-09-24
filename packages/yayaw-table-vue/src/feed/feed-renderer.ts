import type {
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../display-mode-renderer";
import FeedSettings from "./FeedSettings.vue";
import FeedView from "./FeedView.vue";

/** The built-in Feed mode: records as posts, and its settings panel. */
export const feedRenderer: DisplayModeRenderer = {
  view: FeedView,
  settings: FeedSettings,
};

/** Renderers with the built-in Feed mode plugged in (a host renderer for `feed` wins). */
export function withFeedRenderer(
  renderers: DisplayModeRenderers | undefined
): DisplayModeRenderers {
  return renderers?.feed ? renderers : { feed: feedRenderer, ...renderers };
}
