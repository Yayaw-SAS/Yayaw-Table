import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  normalizeSyncValue,
  placeText,
} from "../src/components/ui/yayaw-table/connectors/sync-engine";
import {
  isTableDisplayMode,
  normalizeModeConfig,
} from "../src/components/ui/yayaw-table/utils/display-modes";
import { exportMatrix } from "../src/components/ui/yayaw-table/utils/export-model";
import { formColumnEditor } from "../src/components/ui/yayaw-table/utils/form-view";
import { coerceImportValue } from "../src/components/ui/yayaw-table/utils/import-model";
import {
  addressesToGeocode,
  boundsContain,
  boundsOfPoints,
  createGeocodeSearch,
  distanceKm,
  formatCoordinates,
  formatLocation,
  formatLocationFilterValue,
  geocodeAddresses,
  hasLocation,
  locationDetail,
  locationDraftFrom,
  locationFilterHasValue,
  locationFromDraft,
  locationFromGeocode,
  locationLabel,
  locationsEqual,
  locationToText,
  matchesLocationFilter,
  normalizeBounds,
  normalizeGeocodeResults,
  parseLocation,
} from "../src/components/ui/yayaw-table/utils/location-model";
import {
  attachMapItems,
  boundsFromMap,
  clusterSize,
  expandMapCluster,
  isMapBackgroundClick,
  loadMapRows,
  MAP_CLUSTER_MAX_ZOOM,
  MAP_CLUSTER_RADIUS,
  MAP_SOURCE_ID,
  mapBboxScope,
  mapColorColumns,
  mapFeatureCollection,
  mapItemsFromFeatures,
  mapItemsWithoutClusters,
  mapLabel,
  mapLocationColumns,
  mapMarkers,
  mapNotices,
  mapPopupProperties,
  mapSettingFields,
  mapStyleChoices,
  mapWorkerUrl,
  markerColor,
  markersBounds,
  markersInBounds,
  normalizeMapViewConfig,
  rememberMapViewport,
  resolveMapSettings,
  resolveMapStyle,
  sameBounds,
  withoutLocationLabel,
} from "../src/components/ui/yayaw-table/utils/map-model";
import {
  loadScopedRows,
  rowInScope,
} from "../src/components/ui/yayaw-table/utils/scoped-rows";
import {
  dataTypeValueError,
  matchesContractFilter,
  resolveDataTypeEditor,
  TABLE_DATA_TYPES,
} from "../src/components/ui/yayaw-table/utils/table-contracts";
import { mapModelSuite } from "./map-model-suite";

mapModelSuite(test, {
  location: {
    addressesToGeocode,
    boundsContain,
    boundsOfPoints,
    createGeocodeSearch,
    distanceKm,
    formatCoordinates,
    formatLocation,
    formatLocationFilterValue,
    geocodeAddresses,
    hasLocation,
    locationDetail,
    locationDraftFrom,
    locationFilterHasValue,
    locationFromDraft,
    locationFromGeocode,
    locationLabel,
    locationToText,
    locationsEqual,
    matchesLocationFilter,
    normalizeBounds,
    normalizeGeocodeResults,
    parseLocation,
  },
  map: {
    MAP_CLUSTER_MAX_ZOOM,
    MAP_CLUSTER_RADIUS,
    MAP_SOURCE_ID,
    attachMapItems,
    boundsFromMap,
    clusterSize,
    expandMapCluster,
    isMapBackgroundClick,
    loadMapRows,
    mapBboxScope,
    mapColorColumns,
    mapFeatureCollection,
    mapItemsFromFeatures,
    mapItemsWithoutClusters,
    mapLabel,
    mapLocationColumns,
    mapMarkers,
    mapNotices,
    mapPopupProperties,
    mapSettingFields,
    mapStyleChoices,
    mapWorkerUrl,
    markerColor,
    markersBounds,
    markersInBounds,
    normalizeMapViewConfig,
    rememberMapViewport,
    resolveMapSettings,
    resolveMapStyle,
    sameBounds,
    withoutLocationLabel,
  },
  scoped: { loadScopedRows, rowInScope },
  contracts: {
    dataTypeValueError,
    matchesContractFilter,
    resolveDataTypeEditor,
    TABLE_DATA_TYPES,
  },
  importModel: { coerceImportValue },
  exportModel: { exportMatrix },
  formView: { formColumnEditor },
  sync: { normalizeSyncValue, placeText },
  modes: { isTableDisplayMode, normalizeModeConfig },
});

// The docs tell hosts that self-host the worker to copy it with
// `maplibre-gl-shared.mjs`: the installed worker must import only that sibling.
const MAPLIBRE_IMPORTS =
  /\bfrom\s*["'`]([^"'`]+)["'`]|\bimport\s*["'`]([^"'`]+)["'`]/g;

test("MapLibre's worker imports only maplibre-gl-shared.mjs, from its own folder", () => {
  const worker = readFileSync(
    new URL(
      "../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
      import.meta.url
    ),
    "utf8"
  );
  const imports = new Set(
    [...worker.matchAll(MAPLIBRE_IMPORTS)].map((match) => match[1] ?? match[2])
  );
  expect([...imports]).toEqual(["./maplibre-gl-shared.mjs"]);
});
