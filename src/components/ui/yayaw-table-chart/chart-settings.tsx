"use client";

import { Button } from "@/src/components/ui/button";
import {
  type ViewSettingField,
  ViewSettingsPanel,
} from "@/src/components/ui/yayaw-table/components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import {
  chartSettingFields,
  type ChartViewSettings,
} from "@/src/components/ui/yayaw-table/utils/chart-model";

/** View → Card settings of the chart: type, axes, grouping and display. */
export function ChartSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const view = context.settings as ChartViewSettings;
  const fields: ViewSettingField[] = chartSettingFields({
    columns: context.columns,
    defaults: context.defaults as ChartViewSettings,
    view,
    locale: context.locale,
    translate: (key, fallback) => context.translate(`chart.${key}`, fallback),
    update: (next) => context.updateSettings(next),
  });
  return (
    <ViewSettingsPanel fields={fields}>
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
