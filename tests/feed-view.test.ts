import { test } from "bun:test";
import {
  modeDefaultsOf,
  normalizeModeConfig,
  resolveDisplayModes,
  withoutDisabledModeRenderers,
} from "../src/components/ui/yayaw-table/utils/display-modes";
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
  feedSettingFields,
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
    feedSettingFields,
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
  }
);
