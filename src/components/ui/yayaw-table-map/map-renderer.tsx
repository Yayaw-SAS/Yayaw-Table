"use client";

import { lazy, Suspense } from "react";
import type {
  DisplayModeRenderContext,
  DisplayModeRenderer,
} from "@/src/components/ui/yayaw-table/types/display-mode-renderer";
import { mapLabel } from "@/src/components/ui/yayaw-table/utils/map-model";
import { MapSettings } from "./map-settings";

// MapLibre (through mapcn) loads with the first map shown, not with the table.
const LazyMapView = lazy(async () => ({
  default: (await import("./map-view")).MapView,
}));

function MapViewLoader({ context }: { context: DisplayModeRenderContext }) {
  return (
    <Suspense
      fallback={
        <output className="block text-muted-foreground text-sm">
          {mapLabel("loading", context.locale, (key, fallback) =>
            context.translate(`map.${key}`, fallback)
          )}
        </output>
      }
    >
      <LazyMapView context={context} />
    </Suspense>
  );
}

/**
 * Pass to `<DataTable displayModeRenderers={{ map: mapRenderer }} />`
 * and list `"map"` in `table.displayModes`.
 */
export const mapRenderer: DisplayModeRenderer = {
  View: MapViewLoader,
  Settings: MapSettings,
};
