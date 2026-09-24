<script setup lang="ts">
import {
  ChevronDown,
  ChevronUp,
  List,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-vue-next";
import {
  getVersion,
  getWorkerUrl,
  type MapLibreEvent,
  Map as MapLibreMap,
  Marker,
  Popup,
  setWorkerUrl,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import type { DisplayModeRenderContext } from "../display-mode-renderer";
import type { LocationBounds } from "../location-model";
import {
  attachMapItems,
  BLANK_MAP_STYLE,
  boundsFromMap,
  type ClusterMap,
  expandMapCluster,
  isMapBackgroundClick,
  type MapItem,
  type MapLabelKey,
  type MapMarker,
  type MapStyleSource,
  type MapTableConfig,
  type MapViewSettings,
  loadMapRows,
  mapLabel,
  mapMarkers,
  mapNotices,
  mapPopupProperties,
  mapWorkerUrl,
  markersBounds,
  markersInBounds,
  rememberMapViewport,
  resolveMapSettings,
  resolveMapStyle,
  supportsWebGL,
  withoutLocationLabel,
} from "../map-model";
import { DEFAULT_SCOPED_MAX_ROWS, type ScopedRowsResult } from "../scoped-rows";
import "./map.css";

/** Map display mode for YaYaw Table Vue, rendered with MapLibre like the React edition's mapcn. */
const props = defineProps<{ context: DisplayModeRenderContext }>();

type ClusterItem = Extract<MapItem, { kind: "cluster" }>;
const FIT_PADDING = 48;
const FIT_MAX_ZOOM = 13;
const FOCUS_ZOOM = 12;
const MAX_LIST_ITEMS = 300;
const WORLD_CENTER: [number, number] = [0, 20];
const WORLD_ZOOM = 1;
const MARKER_COLOR = "#3b82f6";
const MOBILE_QUERY = "(max-width: 767px)";

const config = computed(() => props.context.defaults as MapTableConfig);
const view = computed(() => props.context.settings as MapViewSettings);
const settings = computed(() =>
  resolveMapSettings(props.context.columns, config.value, view.value)
);
const translate = (key: string, fallback: string): string =>
  props.context.translate(`map.${key}`, fallback);
const label = (key: MapLabelKey, params?: Record<string, number | string>): string =>
  mapLabel(key, props.context.locale, translate, params);
const style = computed(() => resolveMapStyle(config.value, view.value));
const maxRows = computed(() => config.value.maxRows ?? DEFAULT_SCOPED_MAX_ROWS);
const webgl = supportsWebGL();

// Records ------------------------------------------------------------------------
const search = shallowRef<LocationBounds>();
const rows = shallowRef<Record<string, unknown>[]>([]);
const result = shallowRef<ScopedRowsResult>();
const loadedBounds = shallowRef<LocationBounds>();
const loading = ref(true);
const error = ref<string>();
let pending: AbortController | undefined;
watch(
  () => [
    search.value,
    props.context.list,
    props.context.listParams,
    props.context.list ? undefined : props.context.rows,
    props.context.revision,
    settings.value.locationColumn,
    maxRows.value,
  ],
  async () => {
    pending?.abort();
    const locationColumn = settings.value.locationColumn;
    if (!locationColumn) return;
    const controller = new AbortController();
    pending = controller;
    const bounds = search.value;
    loading.value = true;
    try {
      const loaded = await loadMapRows({
        list: props.context.list,
        rows: props.context.list ? undefined : props.context.rows,
        params: props.context.listParams,
        locationColumn,
        bounds,
        maxRows: maxRows.value,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      rows.value = loaded.rows;
      result.value = loaded;
      loadedBounds.value = bounds;
      error.value = undefined;
      loading.value = false;
    } catch (reason) {
      if (controller.signal.aborted) return;
      loading.value = false;
      error.value = reason instanceof Error ? reason.message : String(reason);
    }
  },
  { immediate: true }
);
onBeforeUnmount(() => pending?.abort());

const located = computed(() =>
  mapMarkers(
    rows.value,
    settings.value,
    props.context.columns,
    props.context.getRowId,
    props.context.locale
  )
);
const markers = computed(() => located.value.markers);
const notices = computed(() => [
  ...mapNotices(result.value, maxRows.value, props.context.locale, translate),
  ...(style.value ? [] : [label("noStyle")]),
]);
const withoutLocation = computed(() =>
  withoutLocationLabel(located.value.withoutLocation, props.context.locale, translate)
);

// Map ----------------------------------------------------------------------------
const container = useTemplateRef<HTMLDivElement>("container");
const map = shallowRef<MapLibreMap>();
const ready = ref(false);
const viewBounds = shallowRef<LocationBounds>();
const moved = ref(false);
const items = shallowRef<MapItem[]>([]);
const markerElements = new Map<string, { marker: Marker; element: HTMLElement }>();
const selection = shallowRef<{ id: string; keyboard: boolean }>();
const highlightId = ref<string>();
const listOpen = ref<boolean>();
const mobile = ref(false);
let fitted: string | undefined;
let detachItems: (() => void) | undefined;
let popup: Popup | undefined;
const popupElement = document.createElement("div");

type Theme = "dark" | "light";
const documentTheme = (): Theme | undefined => {
  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  const dataTheme = root.dataset.theme;
  return dataTheme === "dark" || dataTheme === "light" ? dataTheme : undefined;
};
const resolvedTheme = (): Theme =>
  documentTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const theme = ref<Theme>(resolvedTheme());
const styleSource = computed<MapStyleSource>(() => {
  const chosen = style.value;
  if (!chosen) return BLANK_MAP_STYLE as unknown as MapStyleSource;
  return theme.value === "dark" ? chosen.dark : chosen.light;
});

const setItems = (next: MapItem[]): void => {
  // Markers are MapLibre DOM markers; their content is teleported into them.
  const keys = new Set(next.map((item) => item.key));
  for (const [key, entry] of markerElements) {
    if (!keys.has(key)) {
      entry.marker.remove();
      markerElements.delete(key);
    }
  }
  for (const item of next) {
    const existing = markerElements.get(item.key);
    if (existing) {
      existing.marker.setLngLat([item.lng, item.lat]);
      continue;
    }
    const element = document.createElement("div");
    const marker = new Marker({ element, anchor: "center" }).setLngLat([item.lng, item.lat]);
    if (map.value) marker.addTo(map.value);
    markerElements.set(item.key, { marker, element });
  }
  items.value = next;
};
const elementFor = (key: string): HTMLElement =>
  markerElements.get(key)?.element ?? popupElement;

const attachItems = (): void => {
  detachItems?.();
  detachItems = undefined;
  if (!(map.value && ready.value)) return;
  detachItems = attachMapItems(
    map.value as unknown as ClusterMap,
    markers.value,
    settings.value.cluster,
    setItems
  );
};

const fitToMarkers = (animate: boolean): void => {
  const bounds = markersBounds(markers.value);
  if (!(bounds && map.value)) return;
  map.value.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM, duration: animate ? 600 : 0 }
  );
};
// Fit mode: fit once per query, after the first unscoped load.
const queryKey = computed(() =>
  JSON.stringify([props.context.listParams, settings.value.locationColumn])
);
const fitIfNeeded = (): void => {
  const unscoped = !(loading.value || loadedBounds.value);
  if (ready.value && unscoped && settings.value.initialView === "fit" && fitted !== queryKey.value) {
    fitted = queryKey.value;
    fitToMarkers(false);
  }
};

const onMove = (event: MapLibreEvent & { originalEvent?: unknown }): void => {
  const current = map.value;
  if (!current) return;
  const bounds = boundsFromMap(current.getBounds());
  viewBounds.value = bounds;
  const center = current.getCenter();
  rememberMapViewport(props.context.tableId, { center: [center.lng, center.lat], zoom: current.getZoom() });
  if (!event.originalEvent) return;
  if (settings.value.searchOnMove) search.value = bounds;
  else moved.value = true;
};
const onReady = (): void => {
  const current = map.value;
  if (!current) return;
  ready.value = true;
  const bounds = boundsFromMap(current.getBounds());
  viewBounds.value = bounds;
  if (settings.value.initialView === "saved") search.value = bounds;
  attachItems();
  fitIfNeeded();
};

let themeObserver: MutationObserver | undefined;
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const mobileQuery = window.matchMedia(MOBILE_QUERY);
const onThemeChange = (): void => {
  theme.value = resolvedTheme();
};
const onMobileChange = (): void => {
  mobile.value = mobileQuery.matches;
};

onMounted(() => {
  mobile.value = mobileQuery.matches;
  mobileQuery.addEventListener("change", onMobileChange);
  if (!(webgl && container.value)) return;
  if (config.value.workerUrl || !getWorkerUrl()) {
    setWorkerUrl(mapWorkerUrl(getVersion(), config.value.workerUrl));
  }
  const attribution = style.value?.attribution;
  const created = new MapLibreMap({
    container: container.value,
    style: styleSource.value as StyleSpecification | string,
    center: settings.value.center ?? WORLD_CENTER,
    zoom: settings.value.zoom ?? WORLD_ZOOM,
    renderWorldCopies: false,
    attributionControl: { compact: true, ...(attribution ? { customAttribution: attribution } : {}) },
  });
  map.value = created;
  created.on("load", onReady);
  created.on("moveend", onMove);
  // Clicks on the map background close the popup; marker clicks are map clicks too.
  created.on("click", (event) => {
    if (isMapBackgroundClick(event.originalEvent?.target)) selection.value = undefined;
  });
  // A new basemap drops the records' source: add it again.
  created.on("style.load", () => {
    if (ready.value) attachItems();
  });
  themeObserver = new MutationObserver(onThemeChange);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  systemTheme.addEventListener("change", onThemeChange);
});
onBeforeUnmount(() => {
  mobileQuery.removeEventListener("change", onMobileChange);
  systemTheme.removeEventListener("change", onThemeChange);
  themeObserver?.disconnect();
  detachItems?.();
  popup?.remove();
  for (const entry of markerElements.values()) entry.marker.remove();
  markerElements.clear();
  map.value?.remove();
});

watch(styleSource, (next, previous) => {
  if (map.value && JSON.stringify(next) !== JSON.stringify(previous)) {
    map.value.setStyle(next as StyleSpecification | string, { diff: false });
  }
});
watch([markers, () => settings.value.cluster], attachItems);
watch([loading, loadedBounds, queryKey], fitIfNeeded);

// Popup --------------------------------------------------------------------------
const selected = computed(() =>
  markers.value.find((marker) => marker.id === selection.value?.id)
);
const properties = computed(() =>
  selected.value
    ? mapPopupProperties(selected.value.row, settings.value, props.context.columns, props.context.locale)
    : []
);
const focusMarker = (id: string): void => {
  document.querySelector<HTMLElement>(`[data-map-marker="${CSS.escape(id)}"]`)?.focus();
};
const closePopup = (restoreFocus: boolean): void => {
  const id = selection.value?.id;
  selection.value = undefined;
  if (restoreFocus && id) focusMarker(id);
};
watch(selected, async (marker, previous) => {
  if (marker?.id === previous?.id && marker) {
    popup?.setLngLat([marker.lng, marker.lat]);
    return;
  }
  popup?.remove();
  popup = undefined;
  if (!(marker && map.value)) return;
  // Focus moves into the popup only when it was opened from the keyboard.
  const created = new Popup({ offset: 14, closeButton: false, closeOnClick: false, focusAfterOpen: false, maxWidth: "none" })
    .setLngLat([marker.lng, marker.lat])
    .setDOMContent(popupElement)
    .addTo(map.value);
  created.on("close", () => {
    if (popup === created) {
      popup = undefined;
      selection.value = undefined;
    }
  });
  popup = created;
  if (selection.value?.keyboard) {
    await nextTick();
    popupElement.querySelector<HTMLElement>("[data-map-open]")?.focus();
  }
});
const onPopupKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    event.stopPropagation();
    closePopup(true);
  }
};

// Actions --------------------------------------------------------------------------
// A click with no pointer detail comes from Enter or Space.
const selectMarker = (id: string, event: MouseEvent): void => {
  selection.value = { id, keyboard: event.detail === 0 };
};
const expand = (item: ClusterItem): void => {
  if (map.value) expandMapCluster(map.value as unknown as ClusterMap, item).catch(() => undefined);
};
const zoom = (delta: number): void => {
  map.value?.zoomTo(map.value.getZoom() + delta, { duration: 300 });
};
const searchArea = (): void => {
  moved.value = false;
  search.value = viewBounds.value;
};
const showInList = (marker: MapMarker, event: MouseEvent): void => {
  map.value?.flyTo({
    center: [marker.lng, marker.lat],
    zoom: Math.max(map.value.getZoom(), FOCUS_ZOOM),
    duration: 600,
  });
  selection.value = { id: marker.id, keyboard: event.detail === 0 };
};
const inView = computed(() => markersInBounds(markers.value, viewBounds.value));
const listShown = computed(() => inView.value.slice(0, MAX_LIST_ITEMS));
const open = computed(() => listOpen.value ?? !mobile.value);
const canSearchArea = computed(() => ready.value && moved.value && !settings.value.searchOnMove);
const markerColor = (marker: MapMarker) => ({ "--yayaw-map-marker": marker.color ?? MARKER_COLOR });
const pointItems = computed(() => items.value.filter((item): item is Extract<MapItem, { kind: "point" }> => item.kind === "point"));
const clusterItems = computed(() => items.value.filter((item): item is ClusterItem => item.kind === "cluster"));
</script>

<template>
  <output v-if="!settings.locationColumn" class="yayaw-map-empty">{{ label("noLocationColumn") }}</output>
  <div v-else class="yayaw-map" data-map-view="" :data-map-scope="result?.scopeApplied ?? 'none'">
    <div v-if="error" class="yayaw-map-error" role="alert">{{ error }}</div>
    <output v-for="notice in notices" :key="notice" class="yayaw-map-notice">{{ notice }}</output>
    <output v-if="withoutLocation" class="yayaw-map-notice" data-map-without-location="">{{ withoutLocation }}</output>
    <div class="yayaw-map-box">
      <div class="yayaw-map-canvas" data-map-canvas="">
        <div v-if="webgl" ref="container" class="yayaw-map-container" />
        <output v-else class="yayaw-map-unavailable">{{ label("unavailable") }}</output>
        <div v-if="webgl" class="yayaw-map-controls">
          <div class="yayaw-map-control-group">
            <button type="button" :aria-label="label('zoomIn')" :title="label('zoomIn')" @click="zoom(1)"><Plus :size="16" aria-hidden="true" /></button>
            <button type="button" :aria-label="label('zoomOut')" :title="label('zoomOut')" @click="zoom(-1)"><Minus :size="16" aria-hidden="true" /></button>
          </div>
          <div class="yayaw-map-control-group">
            <button type="button" :aria-label="label('fit')" :title="label('fit')" @click="fitToMarkers(true)"><Maximize2 :size="16" aria-hidden="true" /></button>
          </div>
        </div>
        <div class="yayaw-map-top">
          <button v-if="canSearchArea" type="button" class="yayaw-map-pill yayaw-map-pill-button" data-map-search-area="" @click="searchArea">
            <Search :size="14" aria-hidden="true" />{{ label("searchArea") }}
          </button>
          <output v-if="loading" class="yayaw-map-pill"><LoaderCircle :size="14" class="yayaw-spin" aria-hidden="true" />{{ label("searching") }}</output>
        </div>
        <button v-if="!open" type="button" class="yayaw-map-pill yayaw-map-pill-button yayaw-map-show-list" @click="listOpen = true">
          <List :size="14" aria-hidden="true" />{{ label("showList") }}
        </button>
      </div>
      <aside class="yayaw-map-list" :aria-label="label('list')" data-map-list="" :data-open="open ? 'true' : 'false'">
        <div class="yayaw-map-list-header">
          <h3>{{ label("list") }}<span data-map-in-view="">{{ label("inView", { count: inView.length.toLocaleString(context.locale) }) }}</span></h3>
          <button type="button" class="yayaw-icon-button" :aria-expanded="open" :aria-label="open ? label('hideList') : label('showList')" @click="listOpen = !open">
            <ChevronDown v-if="open" :size="16" class="yayaw-map-list-chevron" aria-hidden="true" />
            <ChevronUp v-else :size="16" aria-hidden="true" />
          </button>
        </div>
        <ul v-if="open" class="yayaw-map-list-items">
          <li v-for="marker in listShown" :key="marker.id">
            <button
              type="button"
              :data-map-list-item="marker.id"
              :data-highlighted="highlightId === marker.id ? '' : undefined"
              @click="showInList(marker, $event)"
              @mouseenter="highlightId = marker.id"
              @mouseleave="highlightId = undefined"
              @focus="highlightId = marker.id"
              @blur="highlightId = undefined"
            >
              <span class="yayaw-map-dot" :style="markerColor(marker)" aria-hidden="true" />
              <span class="yayaw-map-list-text">
                <span>{{ marker.title }}</span>
                <span>{{ marker.place }}</span>
              </span>
            </button>
          </li>
          <li v-if="!inView.length" class="yayaw-map-list-empty">{{ label("emptyList") }}</li>
        </ul>
      </aside>
    </div>
    <Teleport v-for="item in pointItems" :key="item.key" :to="elementFor(item.key)">
      <button
        type="button"
        class="yayaw-map-marker"
        :aria-label="label('marker', { title: item.marker.title })"
        :aria-pressed="selection?.id === item.marker.id"
        :title="item.marker.title"
        :data-map-marker="item.marker.id"
        :data-highlighted="highlightId === item.marker.id ? '' : undefined"
        :data-selected="selection?.id === item.marker.id ? '' : undefined"
        :style="markerColor(item.marker)"
        @click="selectMarker(item.marker.id, $event)"
        @mouseenter="highlightId = item.marker.id"
        @mouseleave="highlightId = undefined"
        @focus="highlightId = item.marker.id"
        @blur="highlightId = undefined"
      />
    </Teleport>
    <Teleport v-for="item in clusterItems" :key="item.key" :to="elementFor(item.key)">
      <button
        type="button"
        class="yayaw-map-cluster"
        :data-size="item.size"
        :data-map-cluster="item.count"
        :aria-label="label('cluster', { count: item.count })"
        @click="expand(item)"
      >{{ item.count }}</button>
    </Teleport>
    <Teleport :to="popupElement">
      <section v-if="selected" class="yayaw-map-popup" :aria-label="selected.title" :data-map-popup="selected.id" @keydown="onPopupKeydown">
        <div class="yayaw-map-popup-head">
          <div>
            <h3 data-map-popup-title="">{{ selected.title }}</h3>
            <p>{{ selected.place }}</p>
          </div>
          <button type="button" class="yayaw-icon-button" :aria-label="label('close')" @click="closePopup(true)"><X :size="14" aria-hidden="true" /></button>
        </div>
        <dl v-if="properties.length">
          <div v-for="property in properties" :key="property.id">
            <dt v-if="settings.showPopupLabels">{{ property.label }}</dt>
            <dd>{{ property.text }}</dd>
          </div>
        </dl>
        <button type="button" class="yayaw-button yayaw-button-outline" :data-map-open="selected.id" @click="context.openRow(selected.row, $event)">{{ label("open") }}</button>
      </section>
    </Teleport>
  </div>
</template>
