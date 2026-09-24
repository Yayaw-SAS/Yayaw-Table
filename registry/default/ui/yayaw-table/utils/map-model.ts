/**
 * Map view model shared by the React and Vue editions: settings, markers,
 * clustering inputs, the `bbox` list scope, the list panel, notices and EN/FR
 * labels. It has no map-library dependency: the optional map registry items
 * render it with MapLibre.
 */
import {
  boundsContain,
  boundsOfPoints,
  formatLocation,
  type LocationBounds,
  locationDetail,
  normalizeBounds,
  parseLocation,
} from "./location-model";
import {
  type BoundsScope,
  DEFAULT_SCOPED_MAX_ROWS,
  loadScopedRows,
  type ScopedRowsRequest,
  type ScopedRowsResult,
} from "./scoped-rows";
import { tagAppearance } from "./tag-colors";
import { formatDateValue, formatNumberValue } from "./value-format";

export type MapInitialView = "fit" | "saved";

/** A view's map settings, saved with the view and in the `<tableId>-map` URL key. */
export interface MapViewSettings {
  /** Column holding the places (a `location` column). */
  locationColumn?: string;
  /** Column used as the marker and popup title. */
  titleColumn?: string;
  /** Select column whose option colors color the markers. */
  colorColumn?: string;
  /** Columns listed in the popup, in this order. */
  popupColumns?: string[];
  /** Show the property names in the popup. */
  showPopupLabels?: boolean;
  /** Group nearby markers (MapLibre clusters). */
  cluster?: boolean;
  /** Id of one of the host's `table.map.styles`. */
  style?: string;
  /** Fit the map to the results, or open at the saved center and zoom. */
  initialView?: MapInitialView;
  /** `[longitude, latitude]` of the saved start view. */
  center?: [number, number];
  zoom?: number;
  /** Reload the records of the shown area after each move, instead of offering "Search this area". */
  searchOnMove?: boolean;
}

/** A basemap: a MapLibre style URL or style object, with an optional dark variant. */
export type MapStyleSource = string | Record<string, unknown>;

/** One basemap the host offers (`table.map.styles`). */
export interface MapStyleChoice {
  id: string;
  label: string;
  light: MapStyleSource;
  dark?: MapStyleSource;
  /** Extra attribution shown with this basemap; styles also carry their sources' own. */
  attribution?: string;
}

/**
 * `table.map`: view defaults plus host-only options. The library ships no
 * tiles and no API keys: the basemap comes from `style`/`styles`.
 */
export interface MapTableConfig extends Omit<MapViewSettings, "style"> {
  /** The basemap: an id of `styles`, a style URL/object, or `{ light, dark }`. */
  style?: string | { light: MapStyleSource; dark?: MapStyleSource };
  /** Basemaps offered in the view settings. */
  styles?: MapStyleChoice[];
  /** Attribution added to every basemap. */
  attribution?: string;
  /** Records kept at most when the host does not filter by area (default 2000). */
  maxRows?: number;
  /**
   * MapLibre's worker script (`maplibre-gl-worker.mjs`), when unpkg cannot be
   * used (strict CSPs, offline apps). Since MapLibre 6 the worker imports
   * `./maplibre-gl-shared.mjs` relative to its own URL: serve both files from
   * `node_modules/maplibre-gl/dist/` in the same folder, e.g.
   * `/maplibre/maplibre-gl-worker.mjs` next to `/maplibre/maplibre-gl-shared.mjs`.
   */
  workerUrl?: string;
}

export interface MapColumn {
  id: string;
  header?: string;
  type?: string;
  options?: unknown;
  coloredTags?: boolean;
  numberFormat?: unknown;
  dateDisplayPreset?: string;
  dateFormat?: string;
  timeZone?: string;
}

export const MAP_DEFAULTS = {
  cluster: true,
  initialView: "fit",
  searchOnMove: false,
  showPopupLabels: true,
} as const satisfies MapViewSettings;

/** MapLibre GeoJSON source clustering. */
export const MAP_CLUSTER_RADIUS = 50;
export const MAP_CLUSTER_MAX_ZOOM = 14;
/** Cluster sizes change at these counts. */
export const MAP_CLUSTER_STEPS = [10, 50] as const;
/** Popup properties by default. */
const DEFAULT_POPUP_COLUMNS = 3;
const MAX_ZOOM = 22;
const INITIAL_VIEWS = new Set<MapInitialView>(["fit", "saved"]);
const STRING_KEYS = [
  "locationColumn",
  "titleColumn",
  "colorColumn",
  "style",
] as const;
const BOOLEAN_KEYS = ["cluster", "showPopupLabels", "searchOnMove"] as const;
const OPTION_TYPES = new Set(["select", "multiSelect", "tag"]);
const HIDDEN_COLUMNS = new Set(["select", "actions"]);
const TEMPLATE_PARAM = /\{(\w+)\}/g;
const NONE = "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function normalizeCenter(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) {
    return;
  }
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  return Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
    ? [lng, lat]
    : undefined;
}

function normalizeZoom(value: unknown): number | undefined {
  const zoom = Number(value);
  return value !== undefined &&
    value !== null &&
    Number.isFinite(zoom) &&
    zoom >= 0 &&
    zoom <= MAX_ZOOM
    ? zoom
    : undefined;
}

function normalizeColumns(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }
  const ids = value.filter(
    (id, index): id is string =>
      typeof id === "string" && id !== "" && value.indexOf(id) === index
  );
  return ids;
}

/** Keep only valid map settings; unknown or malformed values are dropped. */
export function normalizeMapViewConfig(
  value: unknown
): MapViewSettings | undefined {
  if (!isRecord(value)) {
    return;
  }
  const normalized: MapViewSettings = {};
  for (const key of STRING_KEYS) {
    const text = typeof value[key] === "string" ? value[key].trim() : "";
    if (text) {
      normalized[key] = text;
    }
  }
  for (const key of BOOLEAN_KEYS) {
    if (typeof value[key] === "boolean") {
      normalized[key] = value[key];
    }
  }
  const popupColumns = normalizeColumns(value.popupColumns);
  if (popupColumns) {
    normalized.popupColumns = popupColumns;
  }
  if (INITIAL_VIEWS.has(value.initialView as MapInitialView)) {
    normalized.initialView = value.initialView as MapInitialView;
  }
  const center = normalizeCenter(value.center);
  const zoom = normalizeZoom(value.zoom);
  if (center && zoom !== undefined) {
    normalized.center = center;
    normalized.zoom = zoom;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

export type ResolvedMapSettings = MapViewSettings &
  Required<
    Pick<
      MapViewSettings,
      | "cluster"
      | "initialView"
      | "popupColumns"
      | "searchOnMove"
      | "showPopupLabels"
    >
  >;

const dataColumns = (columns: readonly MapColumn[]) =>
  columns.filter((column) => !HIDDEN_COLUMNS.has(column.id));

/** Location columns a map can show. */
export const mapLocationColumns = (columns: readonly MapColumn[]) =>
  dataColumns(columns).filter((column) => column.type === "location");

/** Option columns that can color the markers. */
export const mapColorColumns = (columns: readonly MapColumn[]) =>
  dataColumns(columns).filter((column) => OPTION_TYPES.has(column.type ?? ""));

const has = (columns: readonly MapColumn[], id: string | undefined) =>
  Boolean(id && columns.some((column) => column.id === id));

/** Table defaults, then the view; the first location and text columns when none are chosen. */
export function resolveMapSettings(
  columns: readonly MapColumn[],
  defaults: MapViewSettings | MapTableConfig | undefined,
  view: MapViewSettings | undefined
): ResolvedMapSettings {
  const base = normalizeMapViewConfig(defaults) ?? {};
  const merged = { ...MAP_DEFAULTS, ...base, ...view };
  const data = dataColumns(columns);
  const locationColumn = has(mapLocationColumns(columns), merged.locationColumn)
    ? merged.locationColumn
    : mapLocationColumns(columns).at(0)?.id;
  const titleColumn = has(data, merged.titleColumn)
    ? merged.titleColumn
    : data.find((column) => ["text", "string", undefined].includes(column.type))
        ?.id;
  const popupColumns =
    merged.popupColumns?.filter((id) => has(data, id)) ??
    data
      .filter(
        (column) => column.id !== titleColumn && column.id !== locationColumn
      )
      .slice(0, DEFAULT_POPUP_COLUMNS)
      .map((column) => column.id);
  return {
    ...merged,
    locationColumn,
    titleColumn,
    colorColumn: has(mapColorColumns(columns), merged.colorColumn)
      ? merged.colorColumn
      : undefined,
    popupColumns,
  };
}

// Basemaps ---------------------------------------------------------------------

export interface ResolvedMapStyle {
  id?: string;
  light: MapStyleSource;
  dark: MapStyleSource;
  attribution?: string;
}

const validChoice = (choice: unknown): choice is MapStyleChoice =>
  isRecord(choice) &&
  typeof choice.id === "string" &&
  typeof choice.label === "string" &&
  (typeof choice.light === "string" || isRecord(choice.light));

/** The basemaps the host offers. */
export function mapStyleChoices(
  config: MapTableConfig | undefined
): MapStyleChoice[] {
  return Array.isArray(config?.styles) ? config.styles.filter(validChoice) : [];
}

const attributionOf = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;

function fromChoice(
  choice: MapStyleChoice,
  config: MapTableConfig | undefined
): ResolvedMapStyle {
  return {
    id: choice.id,
    light: choice.light,
    dark: choice.dark ?? choice.light,
    attribution: attributionOf(choice.attribution, config?.attribution),
  };
}

/**
 * The basemap to show: the view's choice among `styles`, else `style` (an
 * id, a URL/object or `{ light, dark }`), else the first choice. Undefined
 * when the host configured none: the map then has no basemap.
 */
export function resolveMapStyle(
  config: MapTableConfig | undefined,
  view: MapViewSettings | undefined
): ResolvedMapStyle | undefined {
  const choices = mapStyleChoices(config);
  const byId = (id: unknown) => choices.find((choice) => choice.id === id);
  const chosen = byId(view?.style) ?? byId(config?.style);
  if (chosen) {
    return fromChoice(chosen, config);
  }
  const style = config?.style;
  if (typeof style === "string" || (isRecord(style) && !("light" in style))) {
    return {
      light: style,
      dark: style,
      attribution: attributionOf(config?.attribution),
    };
  }
  if (isRecord(style) && style.light) {
    return {
      light: style.light,
      dark: style.dark ?? style.light,
      attribution: attributionOf(config?.attribution),
    };
  }
  const first = choices.at(0);
  return first ? fromChoice(first, config) : undefined;
}

/** A tile-less basemap, used when the host configured none. */
export const BLANK_MAP_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "rgba(0, 0, 0, 0)" },
    },
  ],
} as const;

// Markers ----------------------------------------------------------------------

export interface MapMarker {
  /** The record's id. */
  id: string;
  lat: number;
  lng: number;
  title: string;
  /** Secondary text: the place's address or coordinates. */
  place: string;
  /** CSS color of the marker; the default marker color when undefined. */
  color?: string;
  row: Record<string, unknown>;
}

const columnById = (columns: readonly MapColumn[], id: string | undefined) =>
  id ? columns.find((column) => column.id === id) : undefined;

const optionOf = (column: MapColumn | undefined, value: unknown) =>
  Array.isArray(column?.options)
    ? (column.options as unknown[])
        .filter(isRecord)
        .find((option) => Object.is(option.value, value))
    : undefined;

/**
 * A marker color from an option column: the option's own color, else the
 * hue its tag gets when tags are colored (also when the table shows plain
 * tags: coloring markers is the point of "Color by"). Multi-select values
 * use their first option.
 */
export function markerColor(
  value: unknown,
  column: MapColumn | undefined
): string | undefined {
  const first = Array.isArray(value) ? value.at(0) : value;
  if (first === null || first === undefined || first === "" || !column) {
    return;
  }
  const option = optionOf(column, first);
  if (typeof option?.color === "string" && option.color) {
    return option.color;
  }
  const hue = tagAppearance(String(first), true).style?.["--yayaw-tag-hue"];
  return hue ? `hsl(${hue} 70% 45%)` : undefined;
}

const titleText = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

/** Markers of the rows that have a place, and how many rows have none. */
export function mapMarkers(
  rows: readonly Record<string, unknown>[],
  settings: Pick<
    MapViewSettings,
    "colorColumn" | "locationColumn" | "titleColumn"
  >,
  columns: readonly MapColumn[],
  getRowId: (row: Record<string, unknown>) => string
): { markers: MapMarker[]; withoutLocation: number } {
  const { locationColumn, titleColumn, colorColumn } = settings;
  if (!locationColumn) {
    return { markers: [], withoutLocation: rows.length };
  }
  const colorBy = columnById(columns, colorColumn);
  const markers: MapMarker[] = [];
  let withoutLocation = 0;
  for (const row of rows) {
    const location = parseLocation(row[locationColumn]);
    if (!location) {
      withoutLocation += 1;
      continue;
    }
    const id = getRowId(row);
    const title =
      titleText(titleColumn ? row[titleColumn] : undefined) ||
      formatLocation(location);
    markers.push({
      id,
      lat: location.lat,
      lng: location.lng,
      title,
      place: locationDetail(location) ?? formatLocation(location),
      color: colorBy ? markerColor(row[colorBy.id], colorBy) : undefined,
      row,
    });
  }
  return { markers, withoutLocation };
}

/** The GeoJSON a clustered MapLibre source receives: one point per marker. */
export function mapFeatureCollection(markers: readonly MapMarker[]) {
  return {
    type: "FeatureCollection" as const,
    features: markers.map((marker, index) => ({
      type: "Feature" as const,
      id: index,
      geometry: {
        type: "Point" as const,
        coordinates: [marker.lng, marker.lat] as [number, number],
      },
      properties: { rowId: marker.id },
    })),
  };
}

/** A marker drawn on the map: one record, or a cluster of them. */
export type MapItem =
  | {
      kind: "cluster";
      key: string;
      clusterId: number;
      count: number;
      lng: number;
      lat: number;
      size: "lg" | "md" | "sm";
    }
  | { kind: "point"; key: string; marker: MapMarker; lng: number; lat: number };

/** Minimal shape of the features `map.querySourceFeatures` returns. */
export interface SourceFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown> | null;
}

export function clusterSize(count: number): "lg" | "md" | "sm" {
  if (count >= MAP_CLUSTER_STEPS[1]) {
    return "lg";
  }
  return count >= MAP_CLUSTER_STEPS[0] ? "md" : "sm";
}

function featureItem(
  feature: SourceFeature,
  markersById: ReadonlyMap<string, MapMarker>
): MapItem | undefined {
  const properties = feature.properties ?? {};
  const [lng, lat] = Array.isArray(feature.geometry?.coordinates)
    ? (feature.geometry.coordinates as number[])
    : [];
  if (!(Number.isFinite(lng) && Number.isFinite(lat))) {
    return;
  }
  if (properties.cluster) {
    const clusterId = Number(properties.cluster_id);
    const count = Number(properties.point_count);
    return {
      kind: "cluster",
      key: `cluster:${clusterId}`,
      clusterId,
      count,
      lng: lng as number,
      lat: lat as number,
      size: clusterSize(count),
    };
  }
  const marker = markersById.get(String(properties.rowId));
  return marker
    ? {
        kind: "point",
        key: `point:${marker.id}`,
        marker,
        lng: marker.lng,
        lat: marker.lat,
      }
    : undefined;
}

/**
 * The markers to draw from a clustered source's features. Features repeat
 * across tiles, so each cluster or record appears once.
 */
export function mapItemsFromFeatures(
  features: readonly SourceFeature[],
  markers: readonly MapMarker[]
): MapItem[] {
  const markersById = new Map(markers.map((marker) => [marker.id, marker]));
  const items = new Map<string, MapItem>();
  for (const feature of features) {
    const item = featureItem(feature, markersById);
    if (item && !items.has(item.key)) {
      items.set(item.key, item);
    }
  }
  return [...items.values()];
}

/** Every marker as its own item, when clustering is off. */
export const mapItemsWithoutClusters = (
  markers: readonly MapMarker[]
): MapItem[] =>
  markers.map((marker) => ({
    kind: "point",
    key: `point:${marker.id}`,
    marker,
    lng: marker.lng,
    lat: marker.lat,
  }));

/**
 * What the map items need from a MapLibre map (structural, so this model
 * stays free of the library).
 */
export interface ClusterMap {
  addSource: (id: string, source: Record<string, unknown>) => unknown;
  addLayer: (layer: Record<string, unknown>) => unknown;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => unknown;
  removeLayer: (id: string) => unknown;
  removeSource: (id: string) => unknown;
  querySourceFeatures: (id: string) => SourceFeature[];
  on: (
    type: string,
    listener: (event: { sourceId?: string }) => void
  ) => unknown;
  off: (
    type: string,
    listener: (event: { sourceId?: string }) => void
  ) => unknown;
  easeTo: (options: { center: [number, number]; zoom: number }) => unknown;
}

export const MAP_SOURCE_ID = "yayaw-map-records";
const MAP_LAYER_ID = "yayaw-map-records-hit";

/**
 * Feed the markers to a clustered GeoJSON source and report the items to
 * draw (clusters and single records in view) after each move. Without
 * clustering, every marker is an item. Returns the cleanup.
 */
export function attachMapItems(
  map: ClusterMap,
  markers: readonly MapMarker[],
  cluster: boolean,
  onItems: (items: MapItem[]) => void
): () => void {
  if (!cluster) {
    onItems(mapItemsWithoutClusters(markers));
    return () => undefined;
  }
  map.addSource(MAP_SOURCE_ID, {
    type: "geojson",
    data: mapFeatureCollection(markers),
    cluster: true,
    clusterRadius: MAP_CLUSTER_RADIUS,
    clusterMaxZoom: MAP_CLUSTER_MAX_ZOOM,
  });
  // An invisible layer makes MapLibre load the source's tiles.
  map.addLayer({
    id: MAP_LAYER_ID,
    type: "circle",
    source: MAP_SOURCE_ID,
    paint: { "circle-radius": 0, "circle-opacity": 0 },
  });
  // Undefined until the first report, so a map without records is cleared too.
  let shown: string | undefined;
  const update = () => {
    const items = mapItemsFromFeatures(
      map.querySourceFeatures(MAP_SOURCE_ID),
      markers
    );
    // Tiles report the same items many times; draw only real changes.
    const signature = items.map((item) => item.key).join("|");
    if (signature !== shown) {
      shown = signature;
      onItems(items);
    }
  };
  const onData = (event: { sourceId?: string }) => {
    if (event.sourceId === MAP_SOURCE_ID) {
      update();
    }
  };
  map.on("moveend", update);
  map.on("idle", update);
  map.on("sourcedata", onData);
  update();
  return () => {
    map.off("moveend", update);
    map.off("idle", update);
    map.off("sourcedata", onData);
    try {
      if (map.getLayer(MAP_LAYER_ID)) {
        map.removeLayer(MAP_LAYER_ID);
      }
      if (map.getSource(MAP_SOURCE_ID)) {
        map.removeSource(MAP_SOURCE_ID);
      }
    } catch {
      // The map is already removed.
    }
  };
}

/** Zoom into a cluster far enough to split it. */
export async function expandMapCluster(
  map: ClusterMap,
  item: Extract<MapItem, { kind: "cluster" }>
): Promise<void> {
  const source = map.getSource(MAP_SOURCE_ID) as
    | { getClusterExpansionZoom?: (id: number) => Promise<number> }
    | undefined;
  const zoom = await source?.getClusterExpansionZoom?.(item.clusterId);
  map.easeTo({
    center: [item.lng, item.lat],
    zoom: Math.min(zoom ?? MAP_CLUSTER_MAX_ZOOM + 1, MAX_ZOOM),
  });
}

/**
 * A click on the map itself, not on a marker or a popup: it closes the popup.
 * (MapLibre reports marker clicks as map clicks too.)
 */
export function isMapBackgroundClick(target: unknown): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  return !element?.closest?.(".maplibregl-marker, .maplibregl-popup");
}

/** Whether the browser can draw the map (MapLibre needs WebGL). */
export function supportsWebGL(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * MapLibre's worker, as mapcn loads it: from unpkg for the installed
 * version, unless the host sets `table.map.workerUrl` (strict CSPs,
 * offline apps). The worker loads `maplibre-gl-shared.mjs` from its own
 * folder, so a self-hosted worker needs that file next to it.
 */
export const mapWorkerUrl = (version: string, override?: string): string =>
  override ??
  `https://unpkg.com/maplibre-gl@${version}/dist/maplibre-gl-worker.mjs`;

/** Markers inside the shown area, for the list panel. */
export function markersInBounds(
  markers: readonly MapMarker[],
  bounds: LocationBounds | undefined
): MapMarker[] {
  return bounds
    ? markers.filter((marker) => boundsContain(bounds, marker))
    : [...markers];
}

/** Bounds to fit the map to, with a small margin around a single place. */
export function markersBounds(
  markers: readonly MapMarker[]
): LocationBounds | undefined {
  const bounds = boundsOfPoints(markers);
  if (!bounds) {
    return;
  }
  const margin = 0.01;
  return bounds.west === bounds.east && bounds.south === bounds.north
    ? {
        west: bounds.west - margin,
        south: bounds.south - margin,
        east: bounds.east + margin,
        north: bounds.north + margin,
      }
    : bounds;
}

// Rows and the bbox scope --------------------------------------------------------

/** Bounds of a MapLibre `LngLatBounds` (`getWest()`…) or a plain object. */
export function boundsFromMap(value: {
  getWest: () => number;
  getSouth: () => number;
  getEast: () => number;
  getNorth: () => number;
}): LocationBounds {
  const clamp = (number: number, limit: number) =>
    Math.max(-limit, Math.min(limit, number));
  const west = value.getWest();
  const east = value.getEast();
  // A view wider than the world covers every longitude.
  const whole = east - west >= 360;
  return {
    west: whole ? -180 : ((((west + 180) % 360) + 360) % 360) - 180,
    south: clamp(value.getSouth(), 90),
    east: whole ? 180 : ((((east + 180) % 360) + 360) % 360) - 180,
    north: clamp(value.getNorth(), 90),
  };
}

/**
 * The `list` scope of an area: `{ kind: "bbox", field, west, south, east, north }`.
 * A host that filters by it answers `meta.scope: "applied"`.
 */
export function mapBboxScope(
  field: string | undefined,
  bounds: LocationBounds | undefined
): BoundsScope | undefined {
  const valid = normalizeBounds(bounds);
  return field && valid ? { kind: "bbox", field, ...valid } : undefined;
}

const ROUNDING = 1e5;
const round = (value: number) => Math.round(value * ROUNDING) / ROUNDING;

/** Bounds rounded to about a metre, so tiny moves do not count as a new area. */
export const roundBounds = (bounds: LocationBounds): LocationBounds => ({
  west: round(bounds.west),
  south: round(bounds.south),
  east: round(bounds.east),
  north: round(bounds.north),
});

export function sameBounds(
  left: LocationBounds | undefined,
  right: LocationBounds | undefined
): boolean {
  if (!(left && right)) {
    return left === right;
  }
  const a = roundBounds(left);
  const b = roundBounds(right);
  return (
    a.west === b.west &&
    a.south === b.south &&
    a.east === b.east &&
    a.north === b.north
  );
}

export interface MapRowsRequest
  extends Pick<ScopedRowsRequest, "list" | "rows" | "params" | "signal"> {
  locationColumn?: string;
  /** The area searched; all records when undefined. */
  bounds?: LocationBounds;
  maxRows?: number;
}

/** The records of the map: those of an area (`bbox` scope) or all of them. */
export function loadMapRows({
  list,
  rows,
  params,
  signal,
  locationColumn,
  bounds,
  maxRows = DEFAULT_SCOPED_MAX_ROWS,
}: MapRowsRequest): Promise<ScopedRowsResult> {
  return loadScopedRows({
    list,
    rows,
    params,
    signal,
    maxRows,
    scope: mapBboxScope(locationColumn, bounds),
  });
}

/** What the map says about the loaded records: filtered in the browser, truncated. */
export function mapNotices(
  result: Pick<ScopedRowsResult, "scopeApplied" | "truncated"> | undefined,
  maxRows: number,
  locale: string,
  translate?: MapTranslate
): string[] {
  if (!result) {
    return [];
  }
  const notices: string[] = [];
  if (result.truncated) {
    notices.push(
      mapLabel("truncated", locale, translate, {
        count: maxRows.toLocaleString(locale),
      })
    );
  }
  if (result.scopeApplied === "client") {
    notices.push(mapLabel("clientFiltered", locale, translate));
  }
  return notices;
}

// Popup --------------------------------------------------------------------------

export interface MapPopupProperty {
  id: string;
  label: string;
  text: string;
}

const optionLabel = (column: MapColumn, value: unknown) => {
  const option = optionOf(column, value);
  return typeof option?.label === "string" ? option.label : String(value);
};

const DATE_TYPES = new Set(["date"]);

function propertyText(
  value: unknown,
  column: MapColumn,
  locale: string
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  if (Array.isArray(value)) {
    return value.map((item) => optionLabel(column, item)).join(", ");
  }
  if (OPTION_TYPES.has(column.type ?? "")) {
    return optionLabel(column, value);
  }
  if (column.type === "number") {
    return formatNumberValue(
      value,
      column.numberFormat as Parameters<typeof formatNumberValue>[1],
      locale
    );
  }
  if (DATE_TYPES.has(column.type ?? "")) {
    return formatDateValue(value, {
      preset: column.dateDisplayPreset as never,
      pattern: column.dateFormat,
      locale,
      timeZone: column.timeZone,
    });
  }
  if (column.type === "location") {
    return formatLocation(value);
  }
  if (typeof value === "boolean") {
    return value ? "✓" : "—";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** The popup's properties: label and displayed text; empty values are left out. */
export function mapPopupProperties(
  row: Record<string, unknown>,
  settings: Pick<MapViewSettings, "popupColumns">,
  columns: readonly MapColumn[],
  locale: string
): MapPopupProperty[] {
  return (settings.popupColumns ?? []).flatMap((id) => {
    const column = columnById(columns, id);
    if (!column) {
      return [];
    }
    const text = propertyText(row[id], column, locale);
    return text ? [{ id, label: column.header ?? id, text }] : [];
  });
}

// Viewport memory ------------------------------------------------------------------

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

const viewports = new Map<string, MapViewport>();

/** The map remembers its last viewport per table, so settings can save it as the start view. */
export function rememberMapViewport(tableId: string, viewport: MapViewport) {
  viewports.set(tableId, {
    center: [round(viewport.center[0]), round(viewport.center[1])],
    zoom: Math.round(viewport.zoom * 100) / 100,
  });
}

export const lastMapViewport = (tableId: string): MapViewport | undefined =>
  viewports.get(tableId);

// Labels ------------------------------------------------------------------------------

const ENGLISH_LABELS = {
  loading: "Loading the map…",
  map: "Map",
  noLocationColumn: "Add a location column to show this table on a map.",
  withoutLocation: "{count} records without a location",
  withoutLocationOne: "1 record without a location",
  searchArea: "Search this area",
  searching: "Searching…",
  fit: "Fit to results",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  list: "Records in view",
  inView: "{count} in view",
  showList: "Show list",
  hideList: "Hide list",
  emptyList: "No records in this area.",
  open: "Open",
  close: "Close",
  cluster: "{count} records",
  marker: "{title}",
  truncated:
    "Only the first {count} records are shown. Narrow the filters to see all of them.",
  clientFiltered:
    "The area is filtered in the browser over the loaded records.",
  noStyle: "No basemap is configured (table.map.style).",
  unavailable:
    "The map cannot be displayed in this browser (WebGL is unavailable).",
  locationColumn: "Location",
  titleColumn: "Title",
  colorColumn: "Color by",
  none: "None",
  popupColumns: "Popup properties",
  showPopupLabels: "Show property names",
  clusterSetting: "Group nearby markers",
  style: "Map style",
  initialView: "Start view",
  initialFit: "Fit to results",
  initialSaved: "Current position",
  searchOnMove: "Search when the map moves",
  on: "On",
  off: "Off",
} as const;

export type MapLabelKey = keyof typeof ENGLISH_LABELS;

const FRENCH_LABELS: Record<MapLabelKey, string> = {
  loading: "Chargement de la carte…",
  map: "Carte",
  noLocationColumn:
    "Ajoutez une colonne Lieu pour afficher ce tableau sur une carte.",
  withoutLocation: "{count} enregistrements sans lieu",
  withoutLocationOne: "1 enregistrement sans lieu",
  searchArea: "Rechercher dans cette zone",
  searching: "Recherche…",
  fit: "Ajuster aux résultats",
  zoomIn: "Zoom avant",
  zoomOut: "Zoom arrière",
  list: "Enregistrements visibles",
  inView: "{count} visibles",
  showList: "Afficher la liste",
  hideList: "Masquer la liste",
  emptyList: "Aucun enregistrement dans cette zone.",
  open: "Ouvrir",
  close: "Fermer",
  cluster: "{count} enregistrements",
  marker: "{title}",
  truncated:
    "Seuls les {count} premiers enregistrements sont affichés. Affinez les filtres pour tous les voir.",
  clientFiltered:
    "La zone est filtrée dans le navigateur parmi les enregistrements chargés.",
  noStyle: "Aucun fond de carte n’est configuré (table.map.style).",
  unavailable:
    "La carte ne peut pas s’afficher dans ce navigateur (WebGL indisponible).",
  locationColumn: "Lieu",
  titleColumn: "Titre",
  colorColumn: "Couleur selon",
  none: "Aucune",
  popupColumns: "Propriétés de la bulle",
  showPopupLabels: "Afficher le nom des propriétés",
  clusterSetting: "Regrouper les marqueurs proches",
  style: "Style de carte",
  initialView: "Vue de départ",
  initialFit: "Ajuster aux résultats",
  initialSaved: "Position actuelle",
  searchOnMove: "Rechercher en déplaçant la carte",
  on: "Oui",
  off: "Non",
};

/** Host override for a label (`map.<key>`), or the built-in one. */
export type MapTranslate = (key: string, fallback: string) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function mapLabel(
  key: MapLabelKey,
  locale: string,
  translate?: MapTranslate,
  params: Record<string, number | string> = {}
): string {
  const labels = locale.toLowerCase().startsWith("fr")
    ? FRENCH_LABELS
    : ENGLISH_LABELS;
  const template = translate ? translate(key, labels[key]) : labels[key];
  return template.replace(TEMPLATE_PARAM, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/** "12 records without a location", or nothing when every record has one. */
export function withoutLocationLabel(
  count: number,
  locale: string,
  translate?: MapTranslate
): string | undefined {
  if (count <= 0) {
    return;
  }
  return count === 1
    ? mapLabel("withoutLocationOne", locale, translate)
    : mapLabel("withoutLocation", locale, translate, {
        count: count.toLocaleString(locale),
      });
}

// Settings panel -----------------------------------------------------------------------

export interface MapSettingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}

export interface MapSettingProperties {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  showLabels: boolean;
  showLabelsLabel: string;
  onShowLabelsChange: (value: boolean) => void;
}

export interface MapSettingFieldsInput {
  tableId: string;
  columns: readonly MapColumn[];
  defaults: MapTableConfig | undefined;
  view: MapViewSettings;
  locale: string;
  translate?: MapTranslate;
  /** Saves the view's settings; undefined and empty values are left out. */
  update: (settings: Record<string, unknown>) => void;
}

const columnOption = (column: MapColumn) => ({
  value: column.id,
  label: column.header ?? column.id,
});

function onOff(
  id: string,
  label: string,
  value: boolean,
  labels: { on: string; off: string },
  onChange: (value: boolean) => void
): MapSettingField {
  return {
    id,
    label,
    value: value ? "on" : "off",
    options: [
      { value: "on", label: labels.on },
      { value: "off", label: labels.off },
    ],
    onChange: (next) => onChange(next === "on"),
  };
}

function viewportPatch(tableId: string, value: string) {
  if (value !== "saved") {
    return { initialView: value, center: undefined, zoom: undefined };
  }
  const viewport = lastMapViewport(tableId);
  return viewport
    ? { initialView: "saved", center: viewport.center, zoom: viewport.zoom }
    : { initialView: "saved" };
}

/** The map settings panel: columns, popup, clusters, basemap and start view. */
export function mapSettingFields(input: MapSettingFieldsInput): {
  fields: MapSettingField[];
  properties: MapSettingProperties;
} {
  const { columns, defaults, view, locale, translate, update, tableId } = input;
  const active = resolveMapSettings(columns, defaults, view);
  const label = (key: MapLabelKey) => mapLabel(key, locale, translate);
  const labels = { on: label("on"), off: label("off") };
  const set = (patch: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...view, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === NONE) {
        Reflect.deleteProperty(next, key);
      }
    }
    update(next);
  };
  const data = dataColumns(columns);
  const fields: MapSettingField[] = [
    {
      id: "locationColumn",
      label: label("locationColumn"),
      value: active.locationColumn ?? NONE,
      options: mapLocationColumns(columns).map(columnOption),
      onChange: (value) => set({ locationColumn: value }),
    },
    {
      id: "titleColumn",
      label: label("titleColumn"),
      value: active.titleColumn ?? NONE,
      options: data
        .filter((column) => column.type !== "location")
        .map(columnOption),
      onChange: (value) => set({ titleColumn: value }),
    },
    {
      id: "colorColumn",
      label: label("colorColumn"),
      value: active.colorColumn ?? NONE,
      options: [
        { value: NONE, label: label("none") },
        ...mapColorColumns(columns).map(columnOption),
      ],
      onChange: (value) => set({ colorColumn: value || undefined }),
    },
    onOff("cluster", label("clusterSetting"), active.cluster, labels, (value) =>
      set({ cluster: value })
    ),
  ];
  const styles = mapStyleChoices(defaults);
  if (styles.length > 1) {
    fields.push({
      id: "style",
      label: label("style"),
      value: resolveMapStyle(defaults, view)?.id ?? styles.at(0)?.id ?? NONE,
      options: styles.map((style) => ({ value: style.id, label: style.label })),
      onChange: (value) => set({ style: value }),
    });
  }
  fields.push(
    {
      id: "initialView",
      label: label("initialView"),
      value: active.initialView,
      options: [
        { value: "fit", label: label("initialFit") },
        { value: "saved", label: label("initialSaved") },
      ],
      onChange: (value) => set(viewportPatch(tableId, value)),
    },
    onOff(
      "searchOnMove",
      label("searchOnMove"),
      active.searchOnMove,
      labels,
      (value) => set({ searchOnMove: value })
    )
  );
  return {
    fields,
    properties: {
      label: label("popupColumns"),
      options: data
        .filter(
          (column) =>
            column.id !== active.titleColumn &&
            column.id !== active.locationColumn
        )
        .map(columnOption),
      value: active.popupColumns,
      onChange: (value) => set({ popupColumns: value }),
      showLabels: active.showPopupLabels,
      showLabelsLabel: label("showPopupLabels"),
      onShowLabelsChange: (value) => set({ showPopupLabels: value }),
    },
  };
}
