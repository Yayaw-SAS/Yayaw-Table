"use client";

import { useId } from "react";
import { Checkbox } from "@/src/components/ui/checkbox";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { planningLabelOverrides } from "../../planning/labels";
import { ganttSettingsLabels } from "../../planning/settings";
import type { TableGanttViewConfig } from "../../planning/types";
import { useTranslations } from "../../providers/table-provider";
import type { TableDisplayMode } from "../../types/display-types";
import { ViewSettingsPanel } from "./view-settings-panel";

export function TableGanttSettings({
  tableId,
  defaultConfig,
  defaultDisplayMode,
}: {
  tableId: string;
  defaultConfig?: TableGanttViewConfig;
  defaultDisplayMode?: TableDisplayMode;
}) {
  const { locale, t } = useTranslations();
  const id = useId();
  const labels = ganttSettingsLabels(locale, planningLabelOverrides(t));
  const { ganttParam, setGanttFromUI } = useTableUrlState({
    tableId,
    defaultGantt: defaultConfig,
    defaultDisplayMode,
  });
  const update = (patch: TableGanttViewConfig) =>
    setGanttFromUI({ ...ganttParam, ...patch });
  return (
    <div className="grid gap-3 p-3">
      <ViewSettingsPanel
        fields={[
          {
            id: "zoom",
            label: labels.zoom,
            value: ganttParam.zoom ?? "week",
            options: labels.zoomOptions,
            onChange: (value) =>
              update({ zoom: value as TableGanttViewConfig["zoom"] }),
          },
          {
            id: "week-start",
            label: labels.weekStart,
            value: String(ganttParam.weekStartsOn ?? 1),
            options: labels.weekOptions,
            onChange: (value) => update({ weekStartsOn: Number(value) }),
          },
        ]}
      >
        <div className="flex min-h-9 cursor-pointer items-center gap-3 text-sm max-md:min-h-11">
          <Checkbox
            id={id}
            aria-label={labels.showDependencies}
            className="min-h-0! min-w-0!"
            checked={ganttParam.showDependencies !== false}
            onCheckedChange={(showDependencies) => update({ showDependencies })}
          />
          <label className="flex-1 cursor-pointer" htmlFor={id}>
            {labels.showDependencies}
          </label>
        </div>
      </ViewSettingsPanel>
    </div>
  );
}
