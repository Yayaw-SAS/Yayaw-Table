/**
 * The `location` column type, shared by the React and Vue editions: values,
 * parsing, formatting, distance and bounds filters, CSV and connector text,
 * geocoding suggestions and EN/FR labels. No map library is needed here.
 */

/** A stored place: coordinates in degrees (WGS 84), with an optional name and address. */
export interface LocationValue {
  lat: number;
  lng: number;
  /** Short name shown in cells and on the map, e.g. "Head office". */
  label?: string;
  /** Postal address, shown when there is no label. */
  address?: string;
}

/** One suggestion of the host's `actions.geocode(query)`. */
export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  address?: string;
}

/** `actions.geocode`: places matching a text, best first. */
export type GeocodeAction = (
  query: string,
  context?: { locale?: string; signal?: AbortSignal }
) => GeocodeResult[] | Promise<GeocodeResult[]>;

/** A rectangle in degrees; `west > east` crosses the antimeridian. */
export interface LocationBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export const LOCATION_FILTER_OPERATORS = [
  "withinDistance",
  "withinBounds",
  "isEmpty",
  "isNotEmpty",
] as const;
export type LocationFilterOperator = (typeof LOCATION_FILTER_OPERATORS)[number];

const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;
const EARTH_RADIUS_KM = 6371.0088;
const DEGREES_TO_RADIANS = Math.PI / 180;
const COORDINATE_DIGITS = 5;
const MAX_SUGGESTIONS = 8;
/** "48.8566, 2.3522", "48.8566;2.3522" or "48.8566 2.3522". */
const COORDINATES_TEXT =
  /^\s*\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?\s*$/;
const TRAILING_ZEROS = /\.?0+$/;
const TEMPLATE_PARAM = /\{(\w+)\}/g;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return;
};

export const isLatitude = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= MAX_LATITUDE;

export const isLongitude = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Math.abs(value) <= MAX_LONGITUDE;

/** Coordinates of a "lat, lng" text; undefined for anything else. */
export function parseCoordinates(
  text: string
): { lat: number; lng: number } | undefined {
  const match = COORDINATES_TEXT.exec(text);
  if (!match) {
    return;
  }
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return isLatitude(lat) && isLongitude(lng) ? { lat, lng } : undefined;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** Coordinates of an object, whichever common naming it uses. */
function objectCoordinates(
  input: Record<string, unknown>
): { lat: number; lng: number } | undefined {
  if (input.type === "Point" && Array.isArray(input.coordinates)) {
    const [lng, lat] = input.coordinates.map(finite);
    return isLatitude(lat) && isLongitude(lng) ? { lat, lng } : undefined;
  }
  const lat = finite(input.lat ?? input.latitude);
  const lng = finite(input.lng ?? input.lon ?? input.long ?? input.longitude);
  return isLatitude(lat) && isLongitude(lng) ? { lat, lng } : undefined;
}

function fromObject(input: Record<string, unknown>): LocationValue | null {
  const coordinates = objectCoordinates(input);
  if (!coordinates) {
    return null;
  }
  const label = text(input.label ?? input.name);
  const address = text(input.address);
  return {
    ...coordinates,
    ...(label ? { label } : {}),
    ...(address ? { address } : {}),
  };
}

function fromText(value: string): LocationValue | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    try {
      return parseLocation(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return parseCoordinates(trimmed) ?? null;
}

/**
 * A location from a stored value: `{ lat, lng, label?, address? }` (also
 * `latitude`/`longitude`, `lon`, a GeoJSON point), a "lat, lng" text or its
 * JSON. Null when there are no valid coordinates.
 */
export function parseLocation(value: unknown): LocationValue | null {
  if (typeof value === "string") {
    return fromText(value);
  }
  return isRecord(value) ? fromObject(value) : null;
}

export const hasLocation = (value: unknown): boolean =>
  parseLocation(value) !== null;

const trimNumber = (value: number, digits = COORDINATE_DIGITS): string =>
  value.toFixed(digits).replace(TRAILING_ZEROS, "");

/** "48.8566, 2.3522": five decimals at most (about one metre). */
export function formatCoordinates(point: { lat: number; lng: number }): string {
  return `${trimNumber(point.lat)}, ${trimNumber(point.lng)}`;
}

/** What a cell shows: the label, else the address, else the coordinates. */
export function formatLocation(value: unknown): string {
  const location = parseLocation(value);
  if (!location) {
    return typeof value === "string" ? value : "";
  }
  return location.label ?? location.address ?? formatCoordinates(location);
}

/** Secondary line under the label: the address, else the coordinates. */
export function locationDetail(value: unknown): string | undefined {
  const location = parseLocation(value);
  if (!location) {
    return;
  }
  if (location.label && location.address) {
    return location.address;
  }
  return location.label || location.address
    ? formatCoordinates(location)
    : undefined;
}

/** "lat,lng" as written to CSV files and text columns; empty without coordinates. */
export function locationToText(value: unknown, separator = ","): string {
  const location = parseLocation(value);
  return location
    ? `${trimNumber(location.lat)}${separator}${trimNumber(location.lng)}`
    : "";
}

export function locationsEqual(left: unknown, right: unknown): boolean {
  const a = parseLocation(left);
  const b = parseLocation(right);
  if (!(a && b)) {
    return a === b;
  }
  return (
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.label === b.label &&
    a.address === b.address
  );
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLat = (to.lat - from.lat) * DEGREES_TO_RADIANS;
  const dLng = (to.lng - from.lng) * DEGREES_TO_RADIANS;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * DEGREES_TO_RADIANS) *
      Math.cos(to.lat * DEGREES_TO_RADIANS) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Bounds from `{ west, south, east, north }` or `[west, south, east, north]`. */
export function normalizeBounds(value: unknown): LocationBounds | undefined {
  const [west, south, east, north] = (
    Array.isArray(value)
      ? value
      : [
          (value as LocationBounds | undefined)?.west,
          (value as LocationBounds | undefined)?.south,
          (value as LocationBounds | undefined)?.east,
          (value as LocationBounds | undefined)?.north,
        ]
  ).map(finite);
  if (
    !(
      isLongitude(west) &&
      isLongitude(east) &&
      isLatitude(south) &&
      isLatitude(north)
    ) ||
    south > north
  ) {
    return;
  }
  return { west, south, east, north };
}

/** Whether a point lies in the bounds; bounds with `west > east` wrap the antimeridian. */
export function boundsContain(
  bounds: LocationBounds,
  point: { lat: number; lng: number }
): boolean {
  if (point.lat < bounds.south || point.lat > bounds.north) {
    return false;
  }
  return bounds.west <= bounds.east
    ? point.lng >= bounds.west && point.lng <= bounds.east
    : point.lng >= bounds.west || point.lng <= bounds.east;
}

/** Smallest bounds holding every point, or undefined without points. */
export function boundsOfPoints(
  points: readonly { lat: number; lng: number }[]
): LocationBounds | undefined {
  if (!points.length) {
    return;
  }
  let west = MAX_LONGITUDE;
  let east = -MAX_LONGITUDE;
  let south = MAX_LATITUDE;
  let north = -MAX_LATITUDE;
  for (const point of points) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  return { west, south, east, north };
}

/** `[lat, lng, km]` of a "within N km" filter, when valid. */
export function distanceFilterValue(
  values: unknown
): { lat: number; lng: number; km: number } | undefined {
  const [lat, lng, km] = (Array.isArray(values) ? values : []).map(finite);
  return isLatitude(lat) && isLongitude(lng) && km !== undefined && km >= 0
    ? { lat, lng, km }
    : undefined;
}

/** A location filter rule has what its operator needs. */
export function locationFilterHasValue(
  operator: unknown,
  values: unknown
): boolean {
  if (operator === "withinDistance") {
    return distanceFilterValue(values) !== undefined;
  }
  if (operator === "withinBounds") {
    return normalizeBounds(values) !== undefined;
  }
  return operator === "isEmpty" || operator === "isNotEmpty";
}

/**
 * Local matching of the location operators: `isEmpty`/`isNotEmpty` (no
 * coordinates counts as empty), `withinDistance` (`[lat, lng, km]`) and
 * `withinBounds` (`[west, south, east, north]`). Incomplete rules match all.
 */
export function matchesLocationFilter(
  actual: unknown,
  operator: unknown,
  values: unknown
): boolean {
  const location = parseLocation(actual);
  switch (operator) {
    case "isEmpty":
      return location === null;
    case "isNotEmpty":
      return location !== null;
    case "withinDistance": {
      const target = distanceFilterValue(values);
      if (!target) {
        return true;
      }
      return location !== null && distanceKm(target, location) <= target.km;
    }
    case "withinBounds": {
      const bounds = normalizeBounds(values);
      if (!bounds) {
        return true;
      }
      return location !== null && boundsContain(bounds, location);
    }
    default:
      return true;
  }
}

/** Suggestions from a geocoder, validated and capped. */
export function normalizeGeocodeResults(value: unknown): GeocodeResult[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .flatMap((item) => {
      const location = isRecord(item) ? fromObject(item) : null;
      if (!location) {
        return [];
      }
      const label =
        location.label ?? location.address ?? formatCoordinates(location);
      return [
        {
          lat: location.lat,
          lng: location.lng,
          label,
          ...(location.address ? { address: location.address } : {}),
        },
      ];
    })
    .slice(0, MAX_SUGGESTIONS);
}

/** The value stored when a suggestion is chosen. */
export function locationFromGeocode(result: GeocodeResult): LocationValue {
  return {
    lat: result.lat,
    lng: result.lng,
    label: result.label,
    ...(result.address ? { address: result.address } : {}),
  };
}

export interface GeocodeSearchState {
  status: "done" | "error" | "idle" | "searching";
  query: string;
  results: GeocodeResult[];
}

export const GEOCODE_DELAY_MS = 300;
export const GEOCODE_MIN_LENGTH = 3;

/**
 * Address suggestions as the user types: debounced, the previous request
 * aborted, nothing asked for short texts or typed coordinates. Both editors
 * use it, so they query the host the same way.
 */
export function createGeocodeSearch({
  geocode,
  locale,
  onChange,
  delayMs = GEOCODE_DELAY_MS,
  minLength = GEOCODE_MIN_LENGTH,
}: {
  geocode?: GeocodeAction;
  locale?: string;
  onChange: (state: GeocodeSearchState) => void;
  delayMs?: number;
  minLength?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const cancel = () => {
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
  };
  const run = async (query: string) => {
    const current = new AbortController();
    controller = current;
    onChange({ status: "searching", query, results: [] });
    try {
      const results = normalizeGeocodeResults(
        await geocode?.(query, { locale, signal: current.signal })
      );
      if (!current.signal.aborted) {
        onChange({ status: "done", query, results });
      }
    } catch {
      if (!current.signal.aborted) {
        onChange({ status: "error", query, results: [] });
      }
    }
  };
  return {
    search(input: string) {
      cancel();
      const query = input.trim();
      if (!geocode || query.length < minLength || parseCoordinates(query)) {
        onChange({ status: "idle", query, results: [] });
        return;
      }
      timer = setTimeout(() => {
        run(query).catch(() => undefined);
      }, delayMs);
    },
    cancel,
  };
}

/**
 * Where a floating editor goes (fixed position, viewport pixels): under its
 * cell, or above it when there is no room below, always inside the window.
 */
export function floatingPanelPosition(
  anchor: { top: number; bottom: number; left: number },
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 4,
  margin = 8
): { top: number; left: number } {
  const left = Math.max(
    margin,
    Math.min(anchor.left, viewport.width - panel.width - margin)
  );
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - panel.height;
  const fitsBelow = below + panel.height <= viewport.height - margin;
  return { top: fitsBelow || above < margin ? below : above, left };
}

/** Text fields of the location editor. */
export interface LocationDraft {
  label: string;
  address: string;
  lat: string;
  lng: string;
}

export function locationDraftFrom(value: unknown): LocationDraft {
  const location = parseLocation(value);
  return {
    label: location?.label ?? "",
    address: location?.address ?? "",
    lat: location ? String(location.lat) : "",
    lng: location ? String(location.lng) : "",
  };
}

/**
 * The value an editor saves: null when every field is empty, an error key
 * (`location.<key>`) when the coordinates are missing or out of range. A
 * "lat, lng" typed in the address field fills the coordinates.
 */
export function locationFromDraft(
  draft: LocationDraft
): { value: LocationValue | null } | { error: "invalidCoordinates" } {
  const label = draft.label.trim();
  const address = draft.address.trim();
  const typed = parseCoordinates(address);
  const empty = !(label || address || draft.lat.trim() || draft.lng.trim());
  if (empty) {
    return { value: null };
  }
  const lat = typed?.lat ?? finite(draft.lat);
  const lng = typed?.lng ?? finite(draft.lng);
  if (!(isLatitude(lat) && isLongitude(lng))) {
    return { error: "invalidCoordinates" };
  }
  return {
    value: {
      lat,
      lng,
      ...(label ? { label } : {}),
      ...(address && !typed ? { address } : {}),
    },
  };
}

/** Structural validation of a stored location, as `dataTypeValueError` does for other types. */
export function locationValueError(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") {
    return;
  }
  return parseLocation(value) ? undefined : "Expected a location (lat, lng)";
}

/**
 * A cell of an imported file: "lat,lng" (or `;`, a space), a JSON location,
 * or an address resolved beforehand by the host's geocoder (`geocoded`).
 */
export function parseLocationImport(
  raw: string,
  geocoded?: ReadonlyMap<string, LocationValue | null>
): { value: LocationValue } | { error: "invalid_location" } {
  const direct = fromText(raw);
  if (direct) {
    return { value: direct };
  }
  const found = geocoded?.get(raw.trim());
  return found ? { value: found } : { error: "invalid_location" };
}

/** Distinct import cells that are addresses, to geocode before converting. */
export function addressesToGeocode(cells: readonly unknown[]): string[] {
  const addresses = new Set<string>();
  for (const cell of cells) {
    const value = typeof cell === "string" ? cell.trim() : "";
    if (value && !fromText(value)) {
      addresses.add(value);
    }
  }
  return [...addresses];
}

/** Resolve addresses with the host's geocoder (first suggestion each). */
export async function geocodeAddresses(
  addresses: readonly string[],
  geocode: GeocodeAction,
  options: { locale?: string; signal?: AbortSignal } = {}
): Promise<Map<string, LocationValue | null>> {
  const resolved = new Map<string, LocationValue | null>();
  const resolve = async (address: string) => {
    options.signal?.throwIfAborted();
    try {
      const [first] = normalizeGeocodeResults(await geocode(address, options));
      resolved.set(
        address,
        first ? { ...locationFromGeocode(first), address } : null
      );
    } catch {
      resolved.set(address, null);
    }
  };
  // One request at a time: public geocoders limit request rates.
  await addresses.reduce(
    (previous, address) => previous.then(() => resolve(address)),
    Promise.resolve()
  );
  return resolved;
}

// Labels ----------------------------------------------------------------------

const ENGLISH_LABELS = {
  location: "Location",
  pin: "Location",
  label: "Name",
  address: "Address",
  latitude: "Latitude",
  longitude: "Longitude",
  search: "Search an address",
  searching: "Searching…",
  noResults: "No place found",
  searchFailed: "The search failed",
  suggestions: "Suggestions",
  clear: "Clear",
  done: "Done",
  cancel: "Cancel",
  edit: "Edit location",
  invalidCoordinates:
    "Enter a latitude between -90 and 90 and a longitude between -180 and 180.",
  coordinatesHint: "Or type the coordinates, e.g. 48.8566, 2.3522",
  withinDistance: "within",
  withinBounds: "within area",
  distance: "Distance (km)",
  west: "West",
  south: "South",
  east: "East",
  north: "North",
  withinKm: "{km} km of {point}",
  inArea: "{south}, {west} to {north}, {east}",
  noLocation: "No location",
} as const;

export type LocationLabelKey = keyof typeof ENGLISH_LABELS;

const FRENCH_LABELS: Record<LocationLabelKey, string> = {
  location: "Lieu",
  pin: "Lieu",
  label: "Nom",
  address: "Adresse",
  latitude: "Latitude",
  longitude: "Longitude",
  search: "Rechercher une adresse",
  searching: "Recherche…",
  noResults: "Aucun lieu trouvé",
  searchFailed: "La recherche a échoué",
  suggestions: "Suggestions",
  clear: "Effacer",
  done: "Terminé",
  cancel: "Annuler",
  edit: "Modifier le lieu",
  invalidCoordinates:
    "Saisissez une latitude entre -90 et 90 et une longitude entre -180 et 180.",
  coordinatesHint: "Ou saisissez les coordonnées, par ex. 48.8566, 2.3522",
  withinDistance: "à moins de",
  withinBounds: "dans la zone",
  distance: "Distance (km)",
  west: "Ouest",
  south: "Sud",
  east: "Est",
  north: "Nord",
  withinKm: "{km} km de {point}",
  inArea: "{south}, {west} à {north}, {east}",
  noLocation: "Aucun lieu",
};

/** Host override for a label (`location.<key>`), or the built-in one. */
export type LocationTranslate = (key: string, fallback: string) => string;

/** Built-in English or French labels, overridable per key by the host. */
export function locationLabel(
  key: LocationLabelKey,
  locale: string,
  translate?: LocationTranslate,
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

/** How a location filter reads in its chip, e.g. "10 km of 48.85, 2.35". */
export function formatLocationFilterValue(
  operator: unknown,
  values: unknown,
  locale: string,
  translate?: LocationTranslate
): string {
  if (operator === "withinDistance") {
    const target = distanceFilterValue(values);
    return target
      ? locationLabel("withinKm", locale, translate, {
          km: trimNumber(target.km, 2),
          point: formatCoordinates(target),
        })
      : "";
  }
  if (operator === "withinBounds") {
    const bounds = normalizeBounds(values);
    return bounds
      ? locationLabel("inArea", locale, translate, {
          west: trimNumber(bounds.west, 2),
          south: trimNumber(bounds.south, 2),
          east: trimNumber(bounds.east, 2),
          north: trimNumber(bounds.north, 2),
        })
      : "";
  }
  return "";
}
