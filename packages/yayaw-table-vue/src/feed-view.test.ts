import { it } from "vitest";
import { feedViewSuite } from "../../../tests/feed-view-suite";
import {
  modeDefaultsOf,
  normalizeModeConfig,
  resolveDisplayModes,
  withoutDisabledModeRenderers,
} from "./display-modes";
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
