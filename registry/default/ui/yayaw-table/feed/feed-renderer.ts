import type {
  DisplayModeRenderer,
  DisplayModeRenderers,
} from "../types/display-mode-renderer";
import { FeedSettings } from "./feed-settings";
import { FeedView } from "./feed-view";

/** The built-in Feed mode: records as posts, and its settings panel. */
export const feedRenderer: DisplayModeRenderer = {
  View: FeedView,
  Settings: FeedSettings,
};

/** Renderers with the built-in Feed mode plugged in (a host renderer for `feed` wins). */
export function withFeedRenderer(
  renderers: DisplayModeRenderers | undefined
): DisplayModeRenderers {
  return renderers?.feed ? renderers : { feed: feedRenderer, ...renderers };
}
