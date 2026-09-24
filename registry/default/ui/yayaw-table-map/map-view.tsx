"use client";

import {
  ChevronDown,
  ChevronUp,
  List,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { MapLibreEvent, Map as MapLibreMap } from "maplibre-gl";
import { getVersion, getWorkerUrl, setWorkerUrl } from "maplibre-gl";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Map as MapCanvas,
  MapMarker,
  MapPopup,
  MarkerContent,
  useMap,
} from "@/components/ui/map";
import { useIsMobile } from "@/components/ui/yayaw-table/hooks/use-mobile";
import type { DisplayModeRenderContext } from "@/components/ui/yayaw-table/types/display-mode-renderer";
import type { LocationBounds } from "@/components/ui/yayaw-table/utils/location-model";
import {
  attachMapItems,
  BLANK_MAP_STYLE,
  boundsFromMap,
  type ClusterMap,
  expandMapCluster,
  isMapBackgroundClick,
  loadMapRows,
  type MapItem,
  type MapLabelKey,
  type MapMarker as MapRecordMarker,
  type MapTableConfig,
  type MapViewSettings,
  mapLabel,
  mapMarkers,
  mapNotices,
  mapPopupProperties,
  mapWorkerUrl,
  markersBounds,
  markersInBounds,
  type ResolvedMapSettings,
  rememberMapViewport,
  resolveMapSettings,
  resolveMapStyle,
  supportsWebGL,
  withoutLocationLabel,
} from "@/components/ui/yayaw-table/utils/map-model";
import {
  DEFAULT_SCOPED_MAX_ROWS,
  type ScopedRowsResult,
} from "@/components/ui/yayaw-table/utils/scoped-rows";
import { cn } from "@/lib/utils";
import "./map.css";

type RowRecord = Record<string, unknown>;
type Label = (
  key: MapLabelKey,
  params?: Record<string, number | string>
) => string;

const FIT_PADDING = 48;
const FIT_MAX_ZOOM = 13;
const FOCUS_ZOOM = 12;
const MAX_LIST_ITEMS = 300;
const WORLD_CENTER: [number, number] = [0, 20];
const WORLD_ZOOM = 1;
const MARKER_COLOR = "#3b82f6";

function useMapRows(
  context: DisplayModeRenderContext,
  locationColumn: string | undefined,
  bounds: LocationBounds | undefined,
  maxRows: number
) {
  const [state, setState] = useState<{
    rows: RowRecord[];
    result?: ScopedRowsResult;
    bounds?: LocationBounds;
    error?: string;
    loading: boolean;
  }>({ rows: [], loading: true });
  const { list, listParams, revision } = context;
  const pageRows = list ? undefined : context.rows;
  useEffect(() => {
    if (!locationColumn || revision < 0) {
      return;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true }));
    loadMapRows({
      list,
      rows: pageRows,
      params: listParams,
      locationColumn,
      bounds,
      maxRows,
      signal: controller.signal,
    })
      .then((result) =>
        setState({ rows: result.rows, result, bounds, loading: false })
      )
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setState((current) => ({
            ...current,
            loading: false,
            error: reason instanceof Error ? reason.message : String(reason),
          }));
        }
      });
    return () => controller.abort();
  }, [bounds, list, listParams, locationColumn, maxRows, pageRows, revision]);
  return state;
}

/** Reports when the map finished loading, and each move the user makes. */
function MapEvents({
  onReady,
  onMove,
  onBackgroundClick,
}: {
  onReady: (map: MapLibreMap) => void;
  onMove: (map: MapLibreMap, byUser: boolean) => void;
  onBackgroundClick: () => void;
}) {
  const { map, isLoaded } = useMap();
  const handlers = useRef({ onReady, onMove, onBackgroundClick });
  handlers.current = { onReady, onMove, onBackgroundClick };
  useEffect(() => {
    if (!(map && isLoaded)) {
      return;
    }
    handlers.current.onReady(map);
    const moved = (event: MapLibreEvent & { originalEvent?: unknown }) =>
      handlers.current.onMove(map, Boolean(event.originalEvent));
    const clicked = (event: MapLibreEvent & { originalEvent?: Event }) => {
      if (isMapBackgroundClick(event.originalEvent?.target)) {
        handlers.current.onBackgroundClick();
      }
    };
    map.on("moveend", moved);
    map.on("click", clicked);
    return () => {
      map.off("moveend", moved);
      map.off("click", clicked);
    };
  }, [isLoaded, map]);
  return null;
}

function markerStyle(color: string | undefined): CSSProperties {
  return { "--yayaw-map-marker": color ?? MARKER_COLOR } as CSSProperties;
}

function RecordMarkerButton({
  marker,
  highlighted,
  selected,
  label,
  onSelect,
  onHighlight,
}: {
  marker: MapRecordMarker;
  highlighted: boolean;
  selected: boolean;
  label: Label;
  onSelect: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onHighlight: (id: string | undefined) => void;
}) {
  return (
    <MapMarker anchor="center" latitude={marker.lat} longitude={marker.lng}>
      <MarkerContent>
        <button
          aria-label={label("marker", { title: marker.title })}
          aria-pressed={selected}
          className={cn(
            "block size-4 rounded-full border-2 border-white bg-[var(--yayaw-map-marker)] shadow-md outline-none transition-transform",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            (highlighted || selected) &&
              "scale-150 ring-2 ring-[var(--yayaw-map-marker)]/40"
          )}
          data-highlighted={highlighted ? "" : undefined}
          data-map-marker={marker.id}
          onBlur={() => onHighlight(undefined)}
          onClick={(event) => onSelect(marker.id, event)}
          onFocus={() => onHighlight(marker.id)}
          onMouseEnter={() => onHighlight(marker.id)}
          onMouseLeave={() => onHighlight(undefined)}
          style={markerStyle(marker.color)}
          title={marker.title}
          type="button"
        />
      </MarkerContent>
    </MapMarker>
  );
}

const CLUSTER_SIZES = { sm: "size-8", md: "size-10", lg: "size-12" } as const;

function ClusterMarkerButton({
  item,
  label,
  onExpand,
}: {
  item: Extract<MapItem, { kind: "cluster" }>;
  label: Label;
  onExpand: (item: Extract<MapItem, { kind: "cluster" }>) => void;
}) {
  return (
    <MapMarker anchor="center" latitude={item.lat} longitude={item.lng}>
      <MarkerContent>
        <button
          aria-label={label("cluster", { count: item.count })}
          className={cn(
            "flex items-center justify-center rounded-full border-2 border-white/80 bg-blue-600/85 font-semibold text-white text-xs shadow-md outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            CLUSTER_SIZES[item.size]
          )}
          data-map-cluster={item.count}
          onClick={() => onExpand(item)}
          type="button"
        >
          {item.count}
        </button>
      </MarkerContent>
    </MapMarker>
  );
}

/** Clusters and records in view, as focusable markers. */
function MapItemsLayer({
  markers,
  settings,
  highlightId,
  selectedId,
  label,
  onSelect,
  onHighlight,
}: {
  markers: MapRecordMarker[];
  settings: ResolvedMapSettings;
  highlightId?: string;
  selectedId?: string;
  label: Label;
  onSelect: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  onHighlight: (id: string | undefined) => void;
}) {
  const { map, isLoaded } = useMap();
  const [items, setItems] = useState<MapItem[]>([]);
  useEffect(() => {
    if (!(map && isLoaded)) {
      return;
    }
    return attachMapItems(
      map as unknown as ClusterMap,
      markers,
      settings.cluster,
      setItems
    );
  }, [isLoaded, map, markers, settings.cluster]);
  const expand = useCallback(
    (item: Extract<MapItem, { kind: "cluster" }>) => {
      if (map) {
        expandMapCluster(map as unknown as ClusterMap, item).catch(
          () => undefined
        );
      }
    },
    [map]
  );
  return (
    <>
      {items.map((item) =>
        item.kind === "cluster" ? (
          <ClusterMarkerButton
            item={item}
            key={item.key}
            label={label}
            onExpand={expand}
          />
        ) : (
          <RecordMarkerButton
            highlighted={highlightId === item.marker.id}
            key={item.key}
            label={label}
            marker={item.marker}
            onHighlight={onHighlight}
            onSelect={onSelect}
            selected={selectedId === item.marker.id}
          />
        )
      )}
    </>
  );
}

function RecordPopup({
  context,
  marker,
  settings,
  label,
  focusOnOpen,
  onClose,
}: {
  context: DisplayModeRenderContext;
  marker: MapRecordMarker;
  settings: ResolvedMapSettings;
  label: Label;
  /** Opened from the keyboard: focus moves into the popup. */
  focusOnOpen: boolean;
  onClose: (restoreFocus: boolean) => void;
}) {
  useEffect(() => {
    if (!focusOnOpen) {
      return;
    }
    const timer = setTimeout(() =>
      document
        .querySelector<HTMLElement>(
          `[data-map-open="${CSS.escape(marker.id)}"]`
        )
        ?.focus()
    );
    return () => clearTimeout(timer);
  }, [focusOnOpen, marker.id]);
  const properties = mapPopupProperties(
    marker.row,
    settings,
    context.columns,
    context.locale
  );
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose(true);
    }
  };
  return (
    <MapPopup
      className="w-64 max-w-64"
      // Closed by clicks on the map background only (see MapEvents).
      closeOnClick={false}
      // Focus moves into the popup only when it was opened from the keyboard.
      focusAfterOpen={false}
      latitude={marker.lat}
      longitude={marker.lng}
      offset={14}
      onClose={() => onClose(false)}
    >
      <section
        aria-label={marker.title}
        className="grid gap-2 text-sm"
        data-map-popup={marker.id}
      >
        <div className="flex items-start gap-2">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <h3 className="truncate font-medium" data-map-popup-title>
              {marker.title}
            </h3>
            <p className="m-0 truncate text-muted-foreground text-xs">
              {marker.place}
            </p>
          </div>
          <Button
            aria-label={label("close")}
            className="-mt-1 -mr-1 size-6"
            onClick={() => onClose(true)}
            onKeyDown={onKeyDown}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
        {properties.length ? (
          <dl className="m-0 grid gap-1 text-xs">
            {properties.map((property) => (
              <div className="flex min-w-0 gap-2" key={property.id}>
                {settings.showPopupLabels ? (
                  <dt className="shrink-0 text-muted-foreground">
                    {property.label}
                  </dt>
                ) : null}
                <dd className="m-0 min-w-0 truncate">{property.text}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Button
          className="h-7 justify-self-start font-normal"
          data-map-open={marker.id}
          onClick={(event) => context.openRow(marker.row, event)}
          onKeyDown={onKeyDown}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("open")}
        </Button>
      </section>
    </MapPopup>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-8 items-center justify-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset dark:hover:bg-accent/40"
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

/** Zoom and fit controls, styled like mapcn's, with the table's labels. */
function MapButtons({
  mapRef,
  label,
  onFit,
}: {
  mapRef: React.RefObject<MapLibreMap | null>;
  label: Label;
  onFit: () => void;
}) {
  const zoom = (delta: number) => {
    const map = mapRef.current;
    map?.zoomTo(map.getZoom() + delta, { duration: 300 });
  };
  return (
    <div className="absolute right-2 bottom-10 z-10 flex flex-col gap-1.5">
      <div className="flex flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm [&>button:not(:last-child)]:border-border [&>button:not(:last-child)]:border-b">
        <ControlButton label={label("zoomIn")} onClick={() => zoom(1)}>
          <Plus aria-hidden="true" className="size-4" />
        </ControlButton>
        <ControlButton label={label("zoomOut")} onClick={() => zoom(-1)}>
          <Minus aria-hidden="true" className="size-4" />
        </ControlButton>
      </div>
      <div className="flex flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm">
        <ControlButton label={label("fit")} onClick={onFit}>
          <Maximize2 aria-hidden="true" className="size-4" />
        </ControlButton>
      </div>
    </div>
  );
}

function MapListPanel({
  markers,
  open,
  highlightId,
  label,
  locale,
  onToggle,
  onHighlight,
  onFocusMarker,
}: {
  markers: MapRecordMarker[];
  open: boolean;
  highlightId?: string;
  label: Label;
  locale: string;
  onToggle: () => void;
  onHighlight: (id: string | undefined) => void;
  onFocusMarker: (id: string, keyboard: boolean) => void;
}) {
  const shown = markers.slice(0, MAX_LIST_ITEMS);
  return (
    <aside
      aria-label={label("list")}
      className={cn(
        "flex min-h-0 flex-col bg-background",
        "md:w-72 md:shrink-0 md:border-l",
        "max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:max-h-[55%] max-md:rounded-t-lg max-md:border-t max-md:shadow-lg",
        !open && "md:hidden"
      )}
      data-map-list=""
      data-open={open ? "true" : "false"}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h3 className="min-w-0 flex-1 truncate font-medium text-sm">
          {label("list")}
          <span
            className="ml-2 font-normal text-muted-foreground"
            data-map-in-view
          >
            {label("inView", { count: markers.length.toLocaleString(locale) })}
          </span>
        </h3>
        <Button
          aria-expanded={open}
          aria-label={open ? label("hideList") : label("showList")}
          className="size-7"
          onClick={onToggle}
          size="icon"
          type="button"
          variant="ghost"
        >
          {open ? (
            <ChevronDown
              aria-hidden="true"
              className="size-4 md:rotate-[-90deg]"
            />
          ) : (
            <ChevronUp aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
      {open ? (
        <ul className="m-0 min-h-0 flex-1 list-none overflow-auto p-1">
          {shown.map((marker) => (
            <li key={marker.id}>
              <button
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  highlightId === marker.id && "bg-accent"
                )}
                data-highlighted={highlightId === marker.id ? "" : undefined}
                data-map-list-item={marker.id}
                onBlur={() => onHighlight(undefined)}
                onClick={(event) =>
                  onFocusMarker(marker.id, event.detail === 0)
                }
                onFocus={() => onHighlight(marker.id)}
                onMouseEnter={() => onHighlight(marker.id)}
                onMouseLeave={() => onHighlight(undefined)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full bg-[var(--yayaw-map-marker)]"
                  style={markerStyle(marker.color)}
                />
                <span className="grid min-w-0">
                  <span className="truncate">{marker.title}</span>
                  <span className="truncate text-muted-foreground text-xs">
                    {marker.place}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {markers.length ? null : (
            <li className="px-2 py-3 text-muted-foreground text-sm">
              {label("emptyList")}
            </li>
          )}
        </ul>
      ) : null}
    </aside>
  );
}

function useMapLabels(context: DisplayModeRenderContext): Label {
  return useCallback(
    (key, params) =>
      mapLabel(
        key,
        context.locale,
        (name, fallback) => context.translate(`map.${name}`, fallback),
        params
      ),
    [context]
  );
}

function MapStatus({
  label,
  notices,
  error,
  withoutLocation,
  noStyle,
}: {
  label: Label;
  notices: string[];
  error?: string;
  withoutLocation?: string;
  noStyle: boolean;
}) {
  return (
    <>
      {error ? (
        <div className="text-destructive text-sm" role="alert">
          {error}
        </div>
      ) : null}
      {[...notices, ...(noStyle ? [label("noStyle")] : [])].map((notice) => (
        <output className="block text-muted-foreground text-sm" key={notice}>
          {notice}
        </output>
      ))}
      {withoutLocation ? (
        <output
          className="block text-muted-foreground text-sm"
          data-map-without-location
        >
          {withoutLocation}
        </output>
      ) : null}
    </>
  );
}

function configureWorker(config: MapTableConfig) {
  if (config.workerUrl || !getWorkerUrl()) {
    setWorkerUrl(mapWorkerUrl(getVersion(), config.workerUrl));
  }
}

/** Map display mode for YaYaw Table, rendered with mapcn (MapLibre). */
export function MapView({ context }: { context: DisplayModeRenderContext }) {
  const config = context.defaults as MapTableConfig;
  const settings = useMemo(
    () =>
      resolveMapSettings(
        context.columns,
        config,
        context.settings as MapViewSettings
      ),
    [config, context.columns, context.settings]
  );
  const label = useMapLabels(context);
  const isMobile = useIsMobile();
  const [webgl] = useState(supportsWebGL);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState<LocationBounds>();
  const [viewBounds, setViewBounds] = useState<LocationBounds>();
  const [selection, setSelection] = useState<{
    id: string;
    keyboard: boolean;
  }>();
  const selectedId = selection?.id;
  const [moved, setMoved] = useState(false);
  const [highlightId, setHighlightId] = useState<string>();
  const [listOpen, setListOpen] = useState<boolean>();
  const maxRows = config.maxRows ?? DEFAULT_SCOPED_MAX_ROWS;
  const loaded = useMapRows(context, settings.locationColumn, search, maxRows);
  const { markers, withoutLocation } = useMemo(
    () => mapMarkers(loaded.rows, settings, context.columns, context.getRowId),
    [context.columns, context.getRowId, loaded.rows, settings]
  );
  const style = resolveMapStyle(config, context.settings as MapViewSettings);
  const fitted = useRef<string>(undefined);

  // Before the map mounts: its worker is fetched with the first map.
  useState(() => configureWorker(config));

  const fitToMarkers = useCallback(
    (animate: boolean) => {
      const bounds = markersBounds(markers);
      if (!(bounds && mapRef.current)) {
        return;
      }
      mapRef.current.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        {
          padding: FIT_PADDING,
          maxZoom: FIT_MAX_ZOOM,
          duration: animate ? 600 : 0,
        }
      );
    },
    [markers]
  );

  // Fit mode: fit once per query, after the first unscoped load.
  const queryKey = JSON.stringify([
    context.listParams,
    settings.locationColumn,
  ]);
  useEffect(() => {
    const unscoped = !(loaded.loading || loaded.bounds);
    if (
      ready &&
      unscoped &&
      settings.initialView === "fit" &&
      fitted.current !== queryKey
    ) {
      fitted.current = queryKey;
      fitToMarkers(false);
    }
  }, [
    fitToMarkers,
    loaded.bounds,
    loaded.loading,
    queryKey,
    ready,
    settings.initialView,
  ]);

  const onReady = useCallback(
    (map: MapLibreMap) => {
      setReady(true);
      const bounds = boundsFromMap(map.getBounds());
      setViewBounds(bounds);
      if (settings.initialView === "saved") {
        setSearch(bounds);
      }
    },
    [settings.initialView]
  );
  const onMove = useCallback(
    (map: MapLibreMap, byUser: boolean) => {
      const bounds = boundsFromMap(map.getBounds());
      setViewBounds(bounds);
      const center = map.getCenter();
      rememberMapViewport(context.tableId, {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
      });
      if (byUser && settings.searchOnMove) {
        setSearch(bounds);
      } else if (byUser) {
        setMoved(true);
      }
    },
    [context.tableId, settings.searchOnMove]
  );

  const selected = markers.find((marker) => marker.id === selectedId);
  const inView = useMemo(
    () => markersInBounds(markers, viewBounds),
    [markers, viewBounds]
  );
  const open = listOpen ?? !isMobile;
  const canSearchArea = ready && moved && !settings.searchOnMove;
  const searchArea = () => {
    setMoved(false);
    setSearch(viewBounds);
  };

  const selectMarker = useCallback(
    (id: string, event: MouseEvent<HTMLButtonElement>) => {
      // A click with no pointer detail comes from Enter or Space.
      setSelection({ id, keyboard: event.detail === 0 });
    },
    []
  );
  const focusMarker = useCallback(
    (id: string, keyboard: boolean) => {
      const marker = markers.find((item) => item.id === id);
      if (!(marker && mapRef.current)) {
        return;
      }
      mapRef.current.flyTo({
        center: [marker.lng, marker.lat],
        zoom: Math.max(mapRef.current.getZoom(), FOCUS_ZOOM),
        duration: 600,
      });
      setSelection({ id, keyboard });
    },
    [markers]
  );
  const closePopup = useCallback(
    (restoreFocus: boolean) => {
      const id = selectedId;
      setSelection(undefined);
      if (restoreFocus && id) {
        document
          .querySelector<HTMLElement>(`[data-map-marker="${CSS.escape(id)}"]`)
          ?.focus();
      }
    },
    [selectedId]
  );

  if (!settings.locationColumn) {
    return (
      <output className="block rounded-md border p-6 text-muted-foreground text-sm">
        {label("noLocationColumn")}
      </output>
    );
  }

  return (
    <div
      className="grid gap-2"
      data-map-scope={loaded.result?.scopeApplied ?? "none"}
      data-map-view=""
    >
      <MapStatus
        error={loaded.error}
        label={label}
        noStyle={!style}
        notices={mapNotices(
          loaded.result,
          maxRows,
          context.locale,
          (key, fallback) => context.translate(`map.${key}`, fallback)
        )}
        withoutLocation={withoutLocationLabel(
          withoutLocation,
          context.locale,
          (key, fallback) => context.translate(`map.${key}`, fallback)
        )}
      />
      <div className="relative flex h-[32rem] overflow-hidden rounded-md border max-md:h-[70vh]">
        <div className="relative min-w-0 flex-1" data-map-canvas="">
          {webgl ? (
            <MapCanvas
              attributionControl={{
                compact: true,
                ...(style?.attribution
                  ? { customAttribution: style.attribution }
                  : {}),
              }}
              blank={!style}
              center={settings.center ?? WORLD_CENTER}
              ref={mapRef}
              styles={
                style
                  ? { light: style.light as never, dark: style.dark as never }
                  : {
                      light: BLANK_MAP_STYLE as never,
                      dark: BLANK_MAP_STYLE as never,
                    }
              }
              zoom={settings.zoom ?? WORLD_ZOOM}
            >
              <MapEvents
                onBackgroundClick={() => setSelection(undefined)}
                onMove={onMove}
                onReady={onReady}
              />
              <MapItemsLayer
                highlightId={highlightId}
                label={label}
                markers={markers}
                onHighlight={setHighlightId}
                onSelect={selectMarker}
                selectedId={selectedId}
                settings={settings}
              />
              {selected ? (
                <RecordPopup
                  context={context}
                  focusOnOpen={selection?.keyboard === true}
                  key={selected.id}
                  label={label}
                  marker={selected}
                  onClose={closePopup}
                  settings={settings}
                />
              ) : null}
            </MapCanvas>
          ) : (
            <output className="flex h-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
              {label("unavailable")}
            </output>
          )}
          {webgl ? (
            <MapButtons
              label={label}
              mapRef={mapRef}
              onFit={() => fitToMarkers(true)}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center gap-2">
            {canSearchArea ? (
              <Button
                className="pointer-events-auto h-8 gap-1.5 rounded-full shadow-md"
                data-map-search-area=""
                onClick={searchArea}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Search aria-hidden="true" className="size-3.5" />
                {label("searchArea")}
              </Button>
            ) : null}
            {loaded.loading ? (
              <output className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full bg-background px-3 text-muted-foreground text-xs shadow-md">
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                {label("searching")}
              </output>
            ) : null}
          </div>
          {open ? null : (
            <Button
              className="absolute top-2 right-2 z-10 h-8 gap-1.5 shadow-md max-md:hidden"
              onClick={() => setListOpen(true)}
              size="sm"
              type="button"
              variant="secondary"
            >
              <List aria-hidden="true" className="size-3.5" />
              {label("showList")}
            </Button>
          )}
        </div>
        <MapListPanel
          highlightId={highlightId}
          label={label}
          locale={context.locale}
          markers={inView}
          onFocusMarker={focusMarker}
          onHighlight={setHighlightId}
          onToggle={() => setListOpen(!open)}
          open={open}
        />
      </div>
    </div>
  );
}
