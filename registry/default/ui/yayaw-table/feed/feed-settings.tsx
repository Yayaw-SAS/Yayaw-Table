"use client";

import { Button } from "@/components/ui/button";
import { ViewSettingsPanel } from "../components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "../types/display-mode-renderer";
import {
  type FeedColumn,
  type FeedViewSettings,
  feedSettingFields,
} from "../utils/feed-view";

/** View → Card settings of the feed: columns, dates, body, cards and loading. */
export function FeedSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const view = context.settings as FeedViewSettings;
  const { fields, properties } = feedSettingFields({
    columns: context.columns as FeedColumn[],
    defaults: context.defaults as FeedViewSettings,
    view,
    locale: context.locale,
    translate: (key, fallback) => context.translate(`feed.${key}`, fallback),
    update: (next) => context.updateSettings(next),
  });
  return (
    <ViewSettingsPanel fields={fields} properties={properties}>
      <Button
        className="font-normal"
        disabled={Object.keys(view).length === 0}
        onClick={() => context.updateSettings(undefined)}
        size="sm"
        type="button"
        variant="outline"
      >
        {context.translate("common.reset", "Reset")}
      </Button>
    </ViewSettingsPanel>
  );
}
