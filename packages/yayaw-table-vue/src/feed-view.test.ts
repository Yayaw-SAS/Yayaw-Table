import { it } from "vitest";
import { feedViewSuite } from "../../../tests/feed-view-suite";
import {
  modeDefaultsOf,
  normalizeModeConfig,
  resolveDisplayModes,
  withoutDisabledModeRenderers,
} from "./display-modes";
import { createFeedPages, feedLoadAnnouncement } from "./feed-controller";
import { createFeedHeights, feedScrollRoot, feedWindowRange } from "./feed-dom";
import {
  appendFeedRows,
  feedAuthor,
  feedBodyMayOverflow,
  feedBodyNeedsToggle,
  feedBodyText,
  feedDate,
  feedLabel,
  feedListParams,
  feedMedia,
  feedPropertyValue,
  feedRowMedia,
  feedSettingFields,
  feedWindowThreshold,
  formatFeedRelativeDate,
  groupFeedRows,
  loadFeedPages,
  normalizeFeedViewConfig,
  resolveFeedSettings,
} from "./feed-view";

feedViewSuite(
  it,
  {
    appendFeedRows,
    feedAuthor,
    feedBodyMayOverflow,
    feedBodyNeedsToggle,
    feedBodyText,
    feedDate,
    feedLabel,
    feedListParams,
    feedMedia,
    feedPropertyValue,
    feedRowMedia,
    feedSettingFields,
    feedWindowThreshold,
    formatFeedRelativeDate,
    groupFeedRows,
    loadFeedPages,
    normalizeFeedViewConfig,
    resolveFeedSettings,
  },
  {
    modeDefaultsOf,
    normalizeModeConfig,
    resolveDisplayModes,
    withoutDisabledModeRenderers,
  },
  {
    createFeedHeights,
    createFeedPages,
    feedLoadAnnouncement,
    feedScrollRoot,
    feedWindowRange,
  }
);
