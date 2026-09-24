import { defineAsyncComponent } from "vue";
import type { DisplayModeRenderer } from "../display-mode-renderer";
import MapSettings from "./MapSettings.vue";

/**
 * Pass to `<YayawDataTable :display-mode-renderers="{ map: mapRenderer }" />`
 * and list `"map"` in `table.displayModes`. MapLibre loads with the first
 * map shown, not with the table.
 */
export const mapRenderer: DisplayModeRenderer = {
  view: defineAsyncComponent(() => import("./MapView.vue")),
  settings: MapSettings,
};
