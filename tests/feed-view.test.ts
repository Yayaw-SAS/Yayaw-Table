import { test } from "bun:test";
import {
  modeDefaultsOf,
  normalizeModeConfig,
  resolveDisplayModes,
  withoutDisabledModeRenderers,
} from "../src/components/ui/yayaw-table/utils/display-modes";
import {
  createFeedPages,
  feedLoadAnnouncement,
} from "../src/components/ui/yayaw-table/utils/feed-controller";
import {
  createFeedHeights,
  feedScrollRoot,
  feedWindowRange,
} from "../src/components/ui/yayaw-table/utils/feed-dom";
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
} from "../src/components/ui/yayaw-table/utils/feed-view";
import { feedViewSuite } from "./feed-view-suite";

feedViewSuite(
  test,
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
