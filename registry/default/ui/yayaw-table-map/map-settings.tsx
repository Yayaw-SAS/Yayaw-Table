"use client";

import { Button } from "@/components/ui/button";
import { ViewSettingsPanel } from "@/components/ui/yayaw-table/components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import {
  type MapTableConfig,
  type MapViewSettings,
  mapSettingFields,
} from "@/components/ui/yayaw-table/utils/map-model";

/** View → Card settings of the map: columns, popup, clusters, basemap, start view. */
export function MapSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const view = context.settings as MapViewSettings;
  const { fields, properties } = mapSettingFields({
    tableId: context.tableId,
    columns: context.columns,
    defaults: context.defaults as MapTableConfig,
    view,
    locale: context.locale,
    translate: (key, fallback) => context.translate(`map.${key}`, fallback),
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
