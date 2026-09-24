import assert from "node:assert/strict";
import type * as Sync from "../src/components/ui/yayaw-table/connectors/sync-engine";
import type * as DisplayModes from "../src/components/ui/yayaw-table/utils/display-modes";
import type * as ExportModel from "../src/components/ui/yayaw-table/utils/export-model";
import type * as FormView from "../src/components/ui/yayaw-table/utils/form-view";
import type * as ImportModel from "../src/components/ui/yayaw-table/utils/import-model";
import type * as Location from "../src/components/ui/yayaw-table/utils/location-model";
import type * as MapModel from "../src/components/ui/yayaw-table/utils/map-model";
import type * as Scoped from "../src/components/ui/yayaw-table/utils/scoped-rows";
import type * as Contracts from "../src/components/ui/yayaw-table/utils/table-contracts";

type Test = (name: string, run: () => void | Promise<void>) => void;

export interface MapModelModules {
  location: Pick<
    typeof Location,
    | "addressesToGeocode"
    | "boundsContain"
    | "boundsOfPoints"
    | "createGeocodeSearch"
    | "distanceKm"
    | "formatCoordinates"
    | "formatLocation"
    | "formatLocationFilterValue"
    | "geocodeAddresses"
    | "hasLocation"
    | "locationDetail"
    | "locationDraftFrom"
    | "locationFilterHasValue"
    | "locationFromDraft"
    | "locationFromGeocode"
    | "locationLabel"
    | "locationToText"
    | "locationsEqual"
    | "matchesLocationFilter"
    | "normalizeBounds"
    | "normalizeGeocodeResults"
    | "parseLocation"
  >;
  map: Pick<
    typeof MapModel,
    | "MAP_CLUSTER_MAX_ZOOM"
    | "MAP_CLUSTER_RADIUS"
    | "MAP_SOURCE_ID"
    | "attachMapItems"
    | "boundsFromMap"
    | "clusterSize"
    | "expandMapCluster"
    | "isMapBackgroundClick"
    | "loadMapRows"
    | "mapBboxScope"
    | "mapColorColumns"
    | "mapFeatureCollection"
    | "mapItemsFromFeatures"
    | "mapItemsWithoutClusters"
    | "mapLabel"
    | "mapLocationColumns"
    | "mapMarkers"
    | "mapNotices"
    | "mapPopupProperties"
    | "mapSettingFields"
    | "mapStyleChoices"
    | "mapWorkerUrl"
    | "markerColor"
    | "markersBounds"
    | "markersInBounds"
    | "normalizeMapViewConfig"
    | "rememberMapViewport"
    | "resolveMapSettings"
    | "resolveMapStyle"
    | "sameBounds"
    | "withoutLocationLabel"
  >;
  scoped: Pick<typeof Scoped, "loadScopedRows" | "rowInScope">;
  contracts: Pick<
    typeof Contracts,
    | "dataTypeValueError"
    | "matchesContractFilter"
    | "resolveDataTypeEditor"
    | "TABLE_DATA_TYPES"
  >;
  importModel: Pick<typeof ImportModel, "coerceImportValue">;
  exportModel: Pick<typeof ExportModel, "exportMatrix">;
  formView: Pick<typeof FormView, "formColumnEditor">;
  sync: Pick<typeof Sync, "normalizeSyncValue" | "placeText">;
  modes: Pick<
    typeof DisplayModes,
    "isTableDisplayMode" | "normalizeModeConfig"
  >;
}

const PARIS = {
  lat: 48.8566,
  lng: 2.3522,
  label: "Paris office",
  address: "Place de l’Hôtel de Ville, 75004 Paris",
};
const DEFENSE = { lat: 48.8918, lng: 2.2361, label: "La Défense hub" };
const LYON = { lat: 45.764, lng: 4.8357, label: "Lyon workshop" };
const FRANCE = { west: -5, south: 42, east: 8.5, north: 51.2 };

const COLUMNS = [
  { id: "select", header: "", type: "text" },
  { id: "name", header: "Name", type: "text" },
  {
    id: "status",
    header: "Status",
    type: "select",
    options: [
      { value: "Active", label: "Active" },
      { value: "Draft", label: "Draft", color: "#ff0000" },
    ],
  },
  {
    id: "tags",
    header: "Tags",
    type: "multiSelect",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  {
    id: "price",
    header: "Price",
    type: "number",
    numberFormat: { currency: "EUR", locale: "en-US" },
  },
  { id: "due", header: "Due", type: "date", dateDisplayPreset: "iso-date" },
  { id: "site", header: "Site", type: "location" },
  { id: "office", header: "Office", type: "location" },
];

const ROWS = [
  {
    id: "alpha",
    name: "Alpha",
    status: "Active",
    tags: ["b", "a"],
    price: 49,
    due: "2026-09-02",
    site: PARIS,
  },
  { id: "bravo", name: "Bravo", status: "Draft", price: 120, site: LYON },
  { id: "charlie", name: "Charlie", status: "Active", site: "48.8918, 2.2361" },
  { id: "delta", name: "Delta", status: "Active", site: null },
  { id: "echo", name: "", status: "Draft", site: DEFENSE },
];
const rowId = (row: Record<string, unknown>) => String(row.id);
const TAG_HUE = /^hsl\(\d+ 70% 45%\)$/;

function locationValueTests(test: Test, { location }: MapModelModules) {
  test("locations parse from objects, GeoJSON points and 'lat, lng' text", () => {
    assert.deepEqual(location.parseLocation(PARIS), PARIS);
    assert.deepEqual(
      location.parseLocation({ latitude: "45.764", longitude: 4.8357 }),
      {
        lat: 45.764,
        lng: 4.8357,
      }
    );
    assert.deepEqual(location.parseLocation({ lat: 1, lon: 2, name: "Here" }), {
      lat: 1,
      lng: 2,
      label: "Here",
    });
    assert.deepEqual(
      location.parseLocation({ type: "Point", coordinates: [2.3522, 48.8566] }),
      { lat: 48.8566, lng: 2.3522 }
    );
    for (const text of [
      "48.8566, 2.3522",
      "48.8566;2.3522",
      "(48.8566 2.3522)",
    ]) {
      assert.deepEqual(location.parseLocation(text), {
        lat: 48.8566,
        lng: 2.3522,
      });
    }
    assert.deepEqual(
      location.parseLocation(
        JSON.stringify({ lat: 1, lng: 2, address: " A " })
      ),
      { lat: 1, lng: 2, address: "A" }
    );
    for (const invalid of [
      null,
      undefined,
      "",
      "Paris",
      "91, 2",
      "45, 181",
      { lat: 1 },
      { lat: "x", lng: 2 },
      [48, 2],
      "{broken",
    ]) {
      assert.equal(location.parseLocation(invalid), null, String(invalid));
    }
    assert.equal(location.hasLocation(LYON), true);
    assert.equal(location.hasLocation("nowhere"), false);
  });

  test("locations read as their label, else address, else coordinates", () => {
    assert.equal(location.formatLocation(PARIS), "Paris office");
    assert.equal(
      location.formatLocation({ lat: 1, lng: 2, address: "Road" }),
      "Road"
    );
    assert.equal(
      location.formatLocation({ lat: 48.856_600_1, lng: 2.35 }),
      "48.8566, 2.35"
    );
    assert.equal(location.formatLocation(null), "");
    assert.equal(location.formatLocation("Paris"), "Paris");
    assert.equal(location.locationDetail(PARIS), PARIS.address);
    assert.equal(location.locationDetail(LYON), "45.764, 4.8357");
    assert.equal(location.locationDetail({ lat: 1, lng: 2 }), undefined);
    assert.equal(
      location.formatCoordinates({ lat: -0.1, lng: 10 }),
      "-0.1, 10"
    );
    assert.equal(location.locationToText(PARIS), "48.8566,2.3522");
    assert.equal(location.locationToText(PARIS, ", "), "48.8566, 2.3522");
    assert.equal(location.locationToText("somewhere"), "");
    assert.equal(location.locationsEqual(PARIS, { ...PARIS }), true);
    assert.equal(location.locationsEqual(PARIS, LYON), false);
    assert.equal(location.locationsEqual(null, null), true);
  });

  test("distances and bounds, including across the antimeridian", () => {
    assert.ok(Math.abs(location.distanceKm(PARIS, LYON) - 392) < 3);
    assert.equal(location.distanceKm(PARIS, PARIS), 0);
    assert.deepEqual(location.normalizeBounds([-5, 42, 8.5, 51.2]), FRANCE);
    assert.deepEqual(location.normalizeBounds(FRANCE), FRANCE);
    assert.equal(location.normalizeBounds([0, 50, 1, 40]), undefined);
    assert.equal(location.normalizeBounds([0, 0, 200, 1]), undefined);
    assert.equal(location.boundsContain(FRANCE, PARIS), true);
    assert.equal(
      location.boundsContain(FRANCE, { lat: 40.4, lng: -3.7 }),
      false
    );
    const pacific = { west: 170, south: -30, east: -170, north: 10 };
    assert.equal(
      location.boundsContain(pacific, { lat: -17.7, lng: 178 }),
      true
    );
    assert.equal(
      location.boundsContain(pacific, { lat: -14, lng: -172 }),
      true
    );
    assert.equal(location.boundsContain(pacific, { lat: 0, lng: 0 }), false);
    assert.deepEqual(location.boundsOfPoints([PARIS, LYON]), {
      west: 2.3522,
      south: 45.764,
      east: 4.8357,
      north: 48.8566,
    });
    assert.equal(location.boundsOfPoints([]), undefined);
  });
}

function locationFilterTests(test: Test, modules: MapModelModules) {
  const { location, contracts } = modules;
  test("location filters: empty, within N km of a point, within an area", () => {
    const near = [48.8566, 2.3522, 20];
    assert.equal(
      location.matchesLocationFilter(DEFENSE, "withinDistance", near),
      true
    );
    assert.equal(
      location.matchesLocationFilter(LYON, "withinDistance", near),
      false
    );
    assert.equal(
      location.matchesLocationFilter(null, "withinDistance", near),
      false
    );
    assert.equal(
      location.matchesLocationFilter(LYON, "withinBounds", [-5, 42, 8.5, 51.2]),
      true
    );
    assert.equal(
      location.matchesLocationFilter(LYON, "withinBounds", [0, 47, 8, 51]),
      false
    );
    assert.equal(
      location.matchesLocationFilter(null, "isEmpty", undefined),
      true
    );
    assert.equal(
      location.matchesLocationFilter("Paris", "isEmpty", undefined),
      true
    );
    assert.equal(
      location.matchesLocationFilter(PARIS, "isNotEmpty", undefined),
      true
    );
    // Incomplete rules keep every row, like the other filter types.
    assert.equal(
      location.matchesLocationFilter(LYON, "withinDistance", [48]),
      true
    );
    assert.equal(
      location.matchesLocationFilter(LYON, "withinBounds", []),
      true
    );
    assert.equal(
      location.locationFilterHasValue("withinDistance", [48, 2, 5]),
      true
    );
    assert.equal(
      location.locationFilterHasValue("withinDistance", [48, 2, Number.NaN]),
      false
    );
    assert.equal(
      location.locationFilterHasValue("withinBounds", [-5, 42, 8.5, 51.2]),
      true
    );
    assert.equal(location.locationFilterHasValue("isEmpty", undefined), true);
    // The shared filter engine of both editions and of the demo hosts.
    const rule = { type: "location", operator: "withinDistance", values: near };
    assert.equal(contracts.matchesContractFilter(DEFENSE, rule), true);
    assert.equal(contracts.matchesContractFilter(LYON, rule), false);
    assert.equal(
      contracts.matchesContractFilter(null, {
        type: "location",
        operator: "isEmpty",
      }),
      true
    );
  });

  test("location filters read in their chip, in English and French", () => {
    assert.equal(
      location.formatLocationFilterValue(
        "withinDistance",
        [48.8566, 2.3522, 20],
        "en"
      ),
      "20 km of 48.8566, 2.3522"
    );
    assert.equal(
      location.formatLocationFilterValue(
        "withinDistance",
        [48.8566, 2.3522, 20],
        "fr"
      ),
      "20 km de 48.8566, 2.3522"
    );
    assert.equal(
      location.formatLocationFilterValue(
        "withinBounds",
        [-5, 42, 8.5, 51.2],
        "en"
      ),
      "42, -5 to 51.2, 8.5"
    );
    assert.equal(
      location.formatLocationFilterValue("isEmpty", undefined, "en"),
      ""
    );
  });
}

function locationEditorTests(
  test: Test,
  { location, contracts }: MapModelModules
) {
  test("the location type drives the editors and validation", () => {
    assert.deepEqual(contracts.TABLE_DATA_TYPES.location, {
      form: "location",
      inline: "location",
      filter: "location",
    });
    assert.equal(
      contracts.resolveDataTypeEditor({ columnType: "location" }),
      "location"
    );
    assert.equal(
      contracts.resolveDataTypeEditor({ formFieldType: "location" }),
      "location"
    );
    assert.equal(contracts.dataTypeValueError("location", PARIS), undefined);
    assert.equal(contracts.dataTypeValueError("location", null), undefined);
    assert.equal(
      contracts.dataTypeValueError("location", "Paris"),
      "Expected a location (lat, lng)"
    );
  });

  test("the editor's fields become a place, or an error when the coordinates are wrong", () => {
    const draft = location.locationDraftFrom(PARIS);
    assert.deepEqual(draft, {
      label: "Paris office",
      address: PARIS.address,
      lat: "48.8566",
      lng: "2.3522",
    });
    assert.deepEqual(location.locationFromDraft(draft), { value: PARIS });
    assert.deepEqual(
      location.locationFromDraft({ label: "", address: "", lat: "", lng: "" }),
      { value: null }
    );
    assert.deepEqual(
      location.locationFromDraft({
        label: "Spot",
        address: "45.764, 4.8357",
        lat: "",
        lng: "",
      }),
      { value: { lat: 45.764, lng: 4.8357, label: "Spot" } }
    );
    assert.deepEqual(
      location.locationFromDraft({
        label: "",
        address: "Somewhere",
        lat: "95",
        lng: "2",
      }),
      { error: "invalidCoordinates" }
    );
  });

  test("geocoder suggestions are validated, capped and searched after a pause", async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      lat: index,
      lng: index,
      label: `Place ${index}`,
    }));
    assert.equal(location.normalizeGeocodeResults(many).length, 8);
    assert.deepEqual(
      location.normalizeGeocodeResults([
        { lat: 99, lng: 0, label: "Bad" },
        { lat: 1, lng: 2, address: "Road" },
        "x",
      ]),
      [{ lat: 1, lng: 2, label: "Road", address: "Road" }]
    );
    assert.deepEqual(location.normalizeGeocodeResults(null), []);
    assert.deepEqual(location.locationFromGeocode({ ...PARIS }), PARIS);

    const states: string[] = [];
    const queries: string[] = [];
    const search = location.createGeocodeSearch({
      geocode: (query) => {
        queries.push(query);
        return query === "fail" ? Promise.reject(new Error("down")) : [LYON];
      },
      delayMs: 1,
      onChange: (state) =>
        states.push(`${state.status}:${state.results.length}`),
    });
    search.search("ly");
    search.search("48.1, 2.3");
    assert.deepEqual(states, ["idle:0", "idle:0"]);
    search.search("Lyo");
    search.search("Lyon");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(queries, ["Lyon"]);
    assert.deepEqual(states.slice(2), ["searching:0", "done:1"]);
    search.search("fail");
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(states.at(-1), "error:0");
    search.cancel();
  });

  test("labels come in English and French, and the host can override them", () => {
    assert.equal(location.locationLabel("search", "en"), "Search an address");
    assert.equal(
      location.locationLabel("search", "fr-FR"),
      "Rechercher une adresse"
    );
    assert.equal(
      location.locationLabel("search", "en", (key, fallback) =>
        key === "search" ? "Find a place" : fallback
      ),
      "Find a place"
    );
  });
}

function locationDataTests(test: Test, modules: MapModelModules) {
  const { location, importModel, exportModel, sync } = modules;
  const column = { id: "site", header: "Site", type: "location" };
  test("CSV imports read 'lat,lng', JSON places and geocoded addresses", async () => {
    assert.deepEqual(importModel.coerceImportValue("48.8566,2.3522", column), {
      value: { lat: 48.8566, lng: 2.3522 },
    });
    assert.deepEqual(importModel.coerceImportValue("", column), {
      value: null,
    });
    assert.deepEqual(importModel.coerceImportValue("Lyon", column), {
      error: "invalid_location",
    });
    const addresses = location.addressesToGeocode([
      "Lyon",
      "48.1, 2.2",
      "",
      "Lyon",
      " Lille ",
    ]);
    assert.deepEqual(addresses, ["Lyon", "Lille"]);
    const asked: string[] = [];
    const geocoded = await location.geocodeAddresses(addresses, (query) => {
      asked.push(query);
      return query === "Lyon" ? [LYON] : [];
    });
    assert.deepEqual(asked, ["Lyon", "Lille"]);
    assert.deepEqual(geocoded.get("Lille"), null);
    assert.deepEqual(
      importModel.coerceImportValue("Lyon", column, { geocoded }),
      {
        value: { ...LYON, address: "Lyon" },
      }
    );
  });

  test("Form views ask places with the location editor", () => {
    assert.equal(modules.formView.formColumnEditor(column), "location");
  });

  test("exports write places as displayed or as 'lat,lng'", () => {
    const rows = [{ site: PARIS }, { site: null }];
    assert.deepEqual(
      exportModel.exportMatrix(rows, [column], { formatted: true }).rows,
      [["Paris office"], [""]]
    );
    assert.deepEqual(
      exportModel.exportMatrix(rows, [column], { formatted: false }).rows,
      [["48.8566,2.3522"], [null]]
    );
  });

  test("connectors write places as 'lat, lng' text and compare them so", () => {
    assert.equal(sync.placeText(PARIS), "48.8566, 2.3522");
    assert.equal(sync.placeText("48.8566,2.3522"), "48.8566, 2.3522");
    assert.equal(sync.placeText({ a: 1 }), undefined);
    assert.equal(
      sync.normalizeSyncValue(PARIS, "location"),
      sync.normalizeSyncValue(" 48.8566 ; 2.3522 ", "location")
    );
    assert.equal(sync.normalizeSyncValue("", "location"), null);
    assert.equal(sync.normalizeSyncValue("Paris", "location"), "Paris");
  });
}

function mapSettingsTests(test: Test, { map, modes }: MapModelModules) {
  test("map settings are normalized for saved views and URLs", () => {
    assert.equal(modes.isTableDisplayMode("map"), true);
    const raw = {
      locationColumn: " site ",
      titleColumn: "",
      colorColumn: "status",
      popupColumns: ["price", "price", 3, "due"],
      cluster: false,
      searchOnMove: "yes",
      initialView: "saved",
      center: [2.35, 48.85],
      zoom: 11,
      unknown: true,
    };
    const expected = {
      locationColumn: "site",
      colorColumn: "status",
      popupColumns: ["price", "due"],
      cluster: false,
      initialView: "saved",
      center: [2.35, 48.85],
      zoom: 11,
    };
    assert.deepEqual(map.normalizeMapViewConfig(raw), expected);
    assert.deepEqual(modes.normalizeModeConfig("map", raw), expected);
    assert.deepEqual(
      map.normalizeMapViewConfig({ center: [2, 48] }),
      undefined
    );
    assert.deepEqual(
      map.normalizeMapViewConfig({ zoom: 40, initialView: "globe" }),
      undefined
    );
    assert.equal(map.normalizeMapViewConfig("map"), undefined);
  });

  test("resolved settings pick the first location and text columns", () => {
    const resolved = map.resolveMapSettings(COLUMNS, undefined, undefined);
    assert.equal(resolved.locationColumn, "site");
    assert.equal(resolved.titleColumn, "name");
    assert.equal(resolved.colorColumn, undefined);
    assert.deepEqual(resolved.popupColumns, ["status", "tags", "price"]);
    assert.equal(resolved.cluster, true);
    assert.equal(resolved.initialView, "fit");
    const chosen = map.resolveMapSettings(
      COLUMNS,
      { locationColumn: "office", colorColumn: "status", cluster: false },
      { locationColumn: "missing", colorColumn: "price", popupColumns: [] }
    );
    assert.equal(chosen.locationColumn, "site");
    assert.equal(chosen.colorColumn, undefined);
    assert.deepEqual(chosen.popupColumns, []);
    assert.equal(chosen.cluster, false);
    assert.deepEqual(
      map.mapLocationColumns(COLUMNS).map((column) => column.id),
      ["site", "office"]
    );
    assert.deepEqual(
      map.mapColorColumns(COLUMNS).map((column) => column.id),
      ["status", "tags"]
    );
  });

  test("the basemap comes from the host: a chosen style, a URL or none", () => {
    const styles = [
      {
        id: "light",
        label: "Light",
        light: "https://tiles/light.json",
        dark: "https://tiles/dark.json",
      },
      {
        id: "sat",
        label: "Satellite",
        light: "https://tiles/sat.json",
        attribution: "© Imagery",
      },
      { id: "broken", label: "Broken" },
    ] as unknown as MapModel.MapStyleChoice[];
    const config = { styles, attribution: "© Host" };
    assert.deepEqual(
      map.mapStyleChoices(config).map((style) => style.id),
      ["light", "sat"]
    );
    assert.deepEqual(map.resolveMapStyle(config, { style: "sat" }), {
      id: "sat",
      light: "https://tiles/sat.json",
      dark: "https://tiles/sat.json",
      attribution: "© Imagery · © Host",
    });
    assert.equal(
      map.resolveMapStyle({ ...config, style: "sat" }, undefined)?.id,
      "sat"
    );
    assert.equal(
      map.resolveMapStyle(config, { style: "unknown" })?.id,
      "light"
    );
    assert.deepEqual(
      map.resolveMapStyle({ style: "https://tiles/one.json" }, undefined),
      {
        light: "https://tiles/one.json",
        dark: "https://tiles/one.json",
        attribution: undefined,
      }
    );
    assert.deepEqual(
      map.resolveMapStyle(
        { style: { light: "l.json", dark: "d.json" } },
        undefined
      )?.dark,
      "d.json"
    );
    assert.equal(map.resolveMapStyle(undefined, undefined), undefined);
    assert.equal(map.resolveMapStyle({}, undefined), undefined);
  });
}

function mapMarkerTests(test: Test, { map }: MapModelModules) {
  test("markers come from the location column; rows without one are counted", () => {
    const settings = map.resolveMapSettings(COLUMNS, undefined, {
      colorColumn: "status",
    });
    const { markers, withoutLocation } = map.mapMarkers(
      ROWS,
      settings,
      COLUMNS,
      rowId
    );
    assert.deepEqual(
      markers.map((marker) => marker.id),
      ["alpha", "bravo", "charlie", "echo"]
    );
    assert.equal(withoutLocation, 1);
    const [alpha, bravo, charlie, echo] = markers;
    assert.equal(alpha?.title, "Alpha");
    assert.equal(alpha?.place, PARIS.address);
    assert.equal(charlie?.lat, 48.8918);
    // A row without a title shows its place.
    assert.equal(echo?.title, "La Défense hub");
    // The option's own color, else the tag hue of its value.
    assert.equal(bravo?.color, "#ff0000");
    assert.equal(alpha?.color, charlie?.color);
    assert.match(alpha?.color ?? "", TAG_HUE);
    assert.equal(
      map.markerColor(["b", "a"], COLUMNS[3]),
      map.markerColor("b", COLUMNS[3])
    );
    assert.equal(map.markerColor(null, COLUMNS[2]), undefined);
    assert.deepEqual(map.mapMarkers(ROWS, {}, COLUMNS, rowId), {
      markers: [],
      withoutLocation: 5,
    });
  });

  test("clustering input: one GeoJSON point per record, keyed by row id", () => {
    const { markers } = map.mapMarkers(
      ROWS,
      { locationColumn: "site" },
      COLUMNS,
      rowId
    );
    const collection = map.mapFeatureCollection(markers);
    assert.equal(collection.type, "FeatureCollection");
    assert.deepEqual(collection.features[1], {
      type: "Feature",
      id: 1,
      geometry: { type: "Point", coordinates: [4.8357, 45.764] },
      properties: { rowId: "bravo" },
    });
    assert.equal(map.MAP_CLUSTER_RADIUS, 50);
    assert.equal(map.MAP_CLUSTER_MAX_ZOOM, 14);
  });

  test("clusters and records in view are drawn once, whatever the tiles", () => {
    const { markers } = map.mapMarkers(
      ROWS,
      { locationColumn: "site" },
      COLUMNS,
      rowId
    );
    const cluster = {
      geometry: { type: "Point", coordinates: [2.3, 48.87] },
      properties: { cluster: true, cluster_id: 7, point_count: 12 },
    };
    const lyon = {
      geometry: { type: "Point", coordinates: [4.8357, 45.764] },
      properties: { rowId: "bravo" },
    };
    const items = map.mapItemsFromFeatures(
      [
        cluster,
        lyon,
        cluster,
        lyon,
        { geometry: {}, properties: {} },
        { geometry: { coordinates: [0, 0] }, properties: { rowId: "gone" } },
      ],
      markers
    );
    assert.deepEqual(
      items.map((item) => item.key),
      ["cluster:7", "point:bravo"]
    );
    assert.equal(items[0]?.kind === "cluster" && items[0].size, "md");
    assert.deepEqual([1, 9, 10, 49, 50, 500].map(map.clusterSize), [
      "sm",
      "sm",
      "md",
      "md",
      "lg",
      "lg",
    ]);
    assert.equal(map.mapItemsWithoutClusters(markers).length, 4);
  });

  test("the list shows the records in the area; fitting keeps a margin around one place", () => {
    const { markers } = map.mapMarkers(
      ROWS,
      { locationColumn: "site" },
      COLUMNS,
      rowId
    );
    const paris = { west: 2, south: 48.5, east: 2.6, north: 49 };
    assert.deepEqual(
      map.markersInBounds(markers, paris).map((marker) => marker.id),
      ["alpha", "charlie", "echo"]
    );
    assert.equal(map.markersInBounds(markers, undefined).length, 4);
    const around = map.markersBounds([markers[1] as MapModel.MapMarker]);
    assert.deepEqual(
      around && Object.values(around).map((value) => Number(value.toFixed(4))),
      [4.8257, 45.754, 4.8457, 45.774]
    );
    assert.equal(map.markersBounds([]), undefined);
  });

  test("popups list the chosen properties as the table shows them", () => {
    const properties = map.mapPopupProperties(
      ROWS[0] as Record<string, unknown>,
      {
        popupColumns: [
          "status",
          "tags",
          "price",
          "due",
          "site",
          "missing",
          "office",
        ],
      },
      COLUMNS,
      "en-US"
    );
    assert.deepEqual(properties, [
      { id: "status", label: "Status", text: "Active" },
      { id: "tags", label: "Tags", text: "B, A" },
      { id: "price", label: "Price", text: "€49.00" },
      { id: "due", label: "Due", text: "2026-09-02" },
      { id: "site", label: "Site", text: "Paris office" },
    ]);
  });
}

function mapScopeTests(test: Test, { map, scoped }: MapModelModules) {
  test("the area searched is a bbox scope on the location column", () => {
    const view = {
      getWest: () => -190,
      getSouth: () => -95,
      getEast: () => 20.5,
      getNorth: () => 51,
    };
    assert.deepEqual(map.boundsFromMap(view), {
      west: 170,
      south: -90,
      east: 20.5,
      north: 51,
    });
    assert.deepEqual(
      map.boundsFromMap({
        getWest: () => -300,
        getSouth: () => 0,
        getEast: () => 200,
        getNorth: () => 1,
      }),
      { west: -180, south: 0, east: 180, north: 1 }
    );
    assert.deepEqual(map.mapBboxScope("site", FRANCE), {
      kind: "bbox",
      field: "site",
      ...FRANCE,
    });
    assert.equal(map.mapBboxScope(undefined, FRANCE), undefined);
    assert.equal(
      map.mapBboxScope("site", { west: 0, south: 10, east: 1, north: 5 }),
      undefined
    );
    assert.equal(map.sameBounds(FRANCE, { ...FRANCE, west: -5.000_001 }), true);
    assert.equal(map.sameBounds(FRANCE, { ...FRANCE, west: -4.9 }), false);
    assert.equal(map.sameBounds(undefined, undefined), true);
    const scope = {
      kind: "bbox" as const,
      field: "site",
      west: 2,
      south: 48.5,
      east: 2.6,
      north: 49,
    };
    assert.equal(
      scoped.rowInScope(ROWS[0] as Record<string, unknown>, scope),
      true
    );
    assert.equal(
      scoped.rowInScope(ROWS[1] as Record<string, unknown>, scope),
      false
    );
    assert.equal(
      scoped.rowInScope(ROWS[3] as Record<string, unknown>, scope),
      false
    );
  });

  test("hosts that apply the scope say so; others are filtered in the browser, capped", async () => {
    const calls: Record<string, unknown>[] = [];
    const applied = await map.loadMapRows({
      list: (params) => {
        calls.push(params);
        return Promise.resolve({
          data: [ROWS[0]],
          meta: { pageCount: 1, scope: "applied" },
        });
      },
      params: { search: "a" },
      locationColumn: "site",
      bounds: FRANCE,
    });
    assert.deepEqual(calls[0]?.scope, {
      kind: "bbox",
      field: "site",
      ...FRANCE,
    });
    assert.equal(calls[0]?.search, "a");
    assert.equal(applied.scopeApplied, "server");
    assert.equal(applied.rows.length, 1);

    const ignored = await map.loadMapRows({
      list: () => Promise.resolve({ data: ROWS, meta: { pageCount: 1 } }),
      locationColumn: "site",
      bounds: { west: 2, south: 48.5, east: 2.6, north: 49 },
    });
    assert.equal(ignored.scopeApplied, "client");
    assert.deepEqual(ignored.rows.map(rowId), ["alpha", "charlie", "echo"]);

    const all = await map.loadMapRows({
      rows: ROWS,
      locationColumn: "site",
      maxRows: 2,
    });
    assert.equal(all.scopeApplied, "none");
    assert.equal(all.truncated, true);
    assert.equal(all.rows.length, 2);

    assert.deepEqual(map.mapNotices(undefined, 2000, "en"), []);
    assert.deepEqual(
      map.mapNotices(
        { scopeApplied: "client", truncated: true },
        2000,
        "en-US"
      ),
      [
        "Only the first 2,000 records are shown. Narrow the filters to see all of them.",
        "The area is filtered in the browser over the loaded records.",
      ]
    );
    assert.equal(map.withoutLocationLabel(0, "en"), undefined);
    assert.equal(
      map.withoutLocationLabel(1, "en"),
      "1 record without a location"
    );
    assert.equal(
      map.withoutLocationLabel(12, "fr"),
      "12 enregistrements sans lieu"
    );
    assert.equal(
      map.mapLabel("searchArea", "fr"),
      "Rechercher dans cette zone"
    );
  });
}

interface FakeMap extends MapModel.ClusterMap {
  sources: Map<string, Record<string, unknown>>;
  layers: string[];
  listeners: Map<string, ((event: { sourceId?: string }) => void)[]>;
  features: MapModel.SourceFeature[];
  eased: unknown[];
  emit: (type: string, event?: { sourceId?: string }) => void;
}

function fakeMap(): FakeMap {
  const fake: FakeMap = {
    sources: new Map(),
    layers: [],
    listeners: new Map(),
    features: [],
    eased: [],
    addSource: (id, source) => fake.sources.set(id, source),
    addLayer: (layer) => fake.layers.push(String(layer.id)),
    getLayer: (id) => fake.layers.includes(id),
    getSource: (id) =>
      fake.sources.has(id)
        ? {
            getClusterExpansionZoom: (clusterId: number) =>
              Promise.resolve(clusterId + 1),
          }
        : undefined,
    removeLayer: (id) => {
      fake.layers = fake.layers.filter((layer) => layer !== id);
    },
    removeSource: (id) => fake.sources.delete(id),
    querySourceFeatures: () => fake.features,
    on: (type, listener) =>
      fake.listeners.set(type, [...(fake.listeners.get(type) ?? []), listener]),
    off: (type, listener) =>
      fake.listeners.set(
        type,
        (fake.listeners.get(type) ?? []).filter((item) => item !== listener)
      ),
    easeTo: (options) => fake.eased.push(options),
    emit: (type, event = {}) => {
      for (const listener of fake.listeners.get(type) ?? []) {
        listener(event);
      }
    },
  };
  return fake;
}

function mapLayerTests(test: Test, { map }: MapModelModules) {
  test("clustered maps draw MapLibre clusters; unclustered maps draw every record", async () => {
    const { markers } = map.mapMarkers(
      ROWS,
      { locationColumn: "site" },
      COLUMNS,
      rowId
    );
    const flat = fakeMap();
    const flatItems: MapModel.MapItem[][] = [];
    map.attachMapItems(flat, markers, false, (items) => flatItems.push(items));
    assert.equal(flat.sources.size, 0);
    assert.equal(flatItems[0]?.length, 4);

    const clustered = fakeMap();
    const drawn: string[][] = [];
    const detach = map.attachMapItems(clustered, markers, true, (items) =>
      drawn.push(items.map((item) => item.key))
    );
    const source = clustered.sources.get(map.MAP_SOURCE_ID);
    assert.equal(source?.cluster, true);
    assert.equal(source?.clusterRadius, 50);
    assert.equal(clustered.layers.length, 1);
    assert.deepEqual(drawn, [[]]);
    clustered.features = [
      {
        geometry: { coordinates: [2.3, 48.87] },
        properties: { cluster: true, cluster_id: 4, point_count: 3 },
      },
    ];
    clustered.emit("sourcedata", { sourceId: "other" });
    clustered.emit("sourcedata", { sourceId: map.MAP_SOURCE_ID });
    clustered.emit("moveend");
    // The same items are reported once.
    assert.deepEqual(drawn, [[], ["cluster:4"]]);
    const cluster = map.mapItemsFromFeatures(clustered.features, markers)[0];
    if (cluster?.kind !== "cluster") {
      throw new Error("Expected a cluster");
    }
    await map.expandMapCluster(clustered, cluster);
    assert.deepEqual(clustered.eased, [{ center: [2.3, 48.87], zoom: 5 }]);
    detach();
    assert.equal(clustered.sources.size, 0);
    assert.deepEqual(clustered.layers, []);
    assert.equal(clustered.listeners.get("moveend")?.length, 0);
  });

  test("clicks on the background close popups; markers and popups do not", () => {
    const inside = (selector: string) => ({
      closest: (query: string) => (query.includes(selector) ? {} : null),
    });
    assert.equal(map.isMapBackgroundClick({ closest: () => null }), true);
    assert.equal(map.isMapBackgroundClick(inside(".maplibregl-marker")), false);
    assert.equal(map.isMapBackgroundClick(inside(".maplibregl-popup")), false);
    assert.equal(map.isMapBackgroundClick(null), true);
    assert.equal(
      map.mapWorkerUrl("6.11.1"),
      "https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl-worker.mjs"
    );
    assert.equal(map.mapWorkerUrl("6.11.1", "/worker.mjs"), "/worker.mjs");
  });

  test("the settings panel edits the view's map settings", () => {
    const saved: Record<string, unknown>[] = [];
    const styles = [
      { id: "light", label: "Light", light: "l.json" },
      { id: "dark", label: "Dark", light: "d.json" },
    ];
    map.rememberMapViewport("sites", {
      center: [2.351_234_567, 48.8],
      zoom: 6.123,
    });
    const panel = map.mapSettingFields({
      tableId: "sites",
      columns: COLUMNS,
      defaults: { styles },
      view: { cluster: false },
      locale: "en",
      update: (next) => saved.push(next),
    });
    assert.deepEqual(
      panel.fields.map((field) => field.id),
      [
        "locationColumn",
        "titleColumn",
        "colorColumn",
        "cluster",
        "style",
        "initialView",
        "searchOnMove",
      ]
    );
    const field = (id: string) => panel.fields.find((item) => item.id === id);
    assert.deepEqual(
      field("locationColumn")?.options.map((option) => option.value),
      ["site", "office"]
    );
    assert.equal(field("cluster")?.value, "off");
    field("colorColumn")?.onChange("status");
    field("colorColumn")?.onChange("");
    field("initialView")?.onChange("saved");
    field("initialView")?.onChange("fit");
    field("style")?.onChange("dark");
    panel.properties.onChange(["price"]);
    panel.properties.onShowLabelsChange(false);
    assert.deepEqual(saved, [
      { cluster: false, colorColumn: "status" },
      { cluster: false },
      {
        cluster: false,
        initialView: "saved",
        center: [2.351_23, 48.8],
        zoom: 6.12,
      },
      { cluster: false, initialView: "fit" },
      { cluster: false, style: "dark" },
      { cluster: false, popupColumns: ["price"] },
      { cluster: false, showPopupLabels: false },
    ]);
    const single = map.mapSettingFields({
      tableId: "other",
      columns: COLUMNS,
      defaults: { styles: [styles[0] as MapModel.MapStyleChoice] },
      view: {},
      locale: "fr",
      update: () => undefined,
    });
    assert.equal(
      single.fields.some((item) => item.id === "style"),
      false
    );
    assert.equal(single.fields[0]?.label, "Lieu");
    single.fields.find((item) => item.id === "initialView")?.onChange("saved");
  });
}

/** Location values and filters, and the Map mode's model: shared by both editions. */
export function mapModelSuite(test: Test, modules: MapModelModules) {
  locationValueTests(test, modules);
  locationFilterTests(test, modules);
  locationEditorTests(test, modules);
  locationDataTests(test, modules);
  mapSettingsTests(test, modules);
  mapMarkerTests(test, modules);
  mapScopeTests(test, modules);
  mapLayerTests(test, modules);
}
