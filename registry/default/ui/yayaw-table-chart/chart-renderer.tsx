"use client";

import { lazy, Suspense } from "react";
import type {
  DisplayModeRenderContext,
  DisplayModeRenderer,
} from "@/components/ui/yayaw-table/types/display-mode-renderer";
import { chartLabel } from "@/components/ui/yayaw-table/utils/chart-model";
import { ChartSettings } from "./chart-settings";

// Recharts loads with the first chart shown, not with the table.
const LazyChartView = lazy(async () => ({
  default: (await import("./chart-view")).ChartView,
}));

function ChartViewLoader({ context }: { context: DisplayModeRenderContext }) {
  return (
    <Suspense
      fallback={
        <output className="block text-muted-foreground text-sm">
          {chartLabel("loading", context.locale, (key, fallback) =>
            context.translate(`chart.${key}`, fallback)
          )}
        </output>
      }
    >
      <LazyChartView context={context} />
    </Suspense>
  );
}

/**
 * Pass to `<DataTable displayModeRenderers={{ chart: chartRenderer }} />`
 * and list `"chart"` in `table.displayModes`.
 */
export const chartRenderer: DisplayModeRenderer = {
  View: ChartViewLoader,
  Settings: ChartSettings,
};
