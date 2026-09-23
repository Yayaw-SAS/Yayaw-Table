import { defineAsyncComponent } from "vue";
import type { DisplayModeRenderer } from "../display-mode-renderer";
import ChartSettings from "./ChartSettings.vue";

/**
 * Pass to `<YayawDataTable :display-mode-renderers="{ chart: chartRenderer }" />`
 * and list `"chart"` in `table.displayModes`. Unovis loads with the first
 * chart shown, not with the table.
 */
export const chartRenderer: DisplayModeRenderer = {
  view: defineAsyncComponent(() => import("./ChartView.vue")),
  settings: ChartSettings,
};
