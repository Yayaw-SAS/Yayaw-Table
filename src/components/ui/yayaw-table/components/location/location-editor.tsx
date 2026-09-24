"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  createGeocodeSearch,
  floatingPanelPosition,
  type GeocodeResult,
  type GeocodeSearchState,
  type LocationDraft,
  type LocationValue,
  locationDraftFrom,
  locationFromDraft,
  locationFromGeocode,
} from "../../utils/location-model";
import { useLocationContext } from "./location-context";

export interface LocationEditorProps {
  value: unknown;
  /** Called with each valid value (null once every field is empty). */
  onChange: (value: LocationValue | null) => void;
  /** Inline editing: Enter or Done saves and closes. */
  onDone?: () => void;
  /** Inline editing: Escape or Cancel leaves without saving. */
  onCancel?: () => void;
  /** The field's name, for the group's accessible name. */
  label?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  /** A floating panel (inline editing) rather than a form field. */
  floating?: boolean;
  invalid?: boolean;
  /** Id of the address input, for an outer label. */
  inputId?: string;
  describedBy?: string;
  /** Language of the labels and suggestions; the table's by default. */
  locale?: string;
  /** Inline editing: focus left the editor (saves, as other editors do on blur). */
  onFocusLeave?: () => void;
  /** The cell a floating editor opens from; it floats above the table's overflow. */
  anchor?: HTMLElement | null;
}

const IDLE: GeocodeSearchState = { status: "idle", query: "", results: [] };

/** Fixed position of a floating editor under its cell, kept in view on scroll. */
function useFloatingStyle(
  anchor: HTMLElement | null | undefined,
  panel: RefObject<HTMLElement | null>
): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useLayoutEffect(() => {
    if (!anchor) {
      return;
    }
    const place = () => {
      const rect = panel.current?.getBoundingClientRect();
      const { top, left } = floatingPanelPosition(
        anchor.getBoundingClientRect(),
        { width: rect?.width ?? 0, height: rect?.height ?? 0 },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setStyle({ position: "fixed", top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, panel]);
  return style;
}

/**
 * Address search with the host's geocoder, plus a name and coordinates. Used
 * by inline editing, record forms and the Form view.
 */
export function LocationEditor({
  value,
  onChange,
  onDone,
  onCancel,
  label,
  autoFocus = false,
  disabled = false,
  floating = false,
  invalid = false,
  inputId,
  describedBy,
  locale,
  onFocusLeave,
  anchor,
}: LocationEditorProps) {
  const location = useLocationContext(locale);
  const generatedId = useId();
  const id = inputId ?? generatedId;
  const addressId = inputId ?? `${id}-address`;
  const [draft, setDraft] = useState<LocationDraft>(() =>
    locationDraftFrom(value)
  );
  const [search, setSearch] = useState<GeocodeSearchState>(IDLE);
  const [error, setError] = useState<string>();
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLFieldSetElement>(null);
  const floatingStyle = useFloatingStyle(floating ? anchor : undefined, containerRef);
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null;
    if (onFocusLeave && !containerRef.current?.contains(next)) {
      onFocusLeave();
    }
  };
  const searcher = useMemo(
    () =>
      createGeocodeSearch({
        geocode: location.geocode,
        locale: location.locale,
        onChange: setSearch,
      }),
    [location.geocode, location.locale]
  );
  useEffect(() => () => searcher.cancel(), [searcher]);

  const apply = (next: LocationDraft) => {
    setDraft(next);
    const result = locationFromDraft(next);
    if ("value" in result) {
      setError(undefined);
      onChange(result.value);
    }
  };
  const choose = (suggestion: GeocodeResult) => {
    // Keep focus in the editor: the suggestion list is about to disappear.
    document.getElementById(addressId)?.focus();
    searcher.cancel();
    setSearch(IDLE);
    const chosen = locationFromGeocode(suggestion);
    setDraft(locationDraftFrom(chosen));
    setError(undefined);
    onChange(chosen);
  };
  const done = () => {
    const result = locationFromDraft(draft);
    if ("error" in result) {
      setError(location.label(result.error));
      return;
    }
    onDone?.();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    } else if (
      event.key === "Enter" &&
      onDone &&
      event.target instanceof HTMLInputElement
    ) {
      event.preventDefault();
      event.stopPropagation();
      done();
    }
  };
  const onAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && search.results.length) {
      event.preventDefault();
      suggestionsRef.current?.querySelector("button")?.focus();
      return;
    }
    onKeyDown(event);
  };
  const onButtonKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      onKeyDown(event);
    }
  };
  const onSuggestionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const item = event.currentTarget.closest("li");
    const sibling =
      event.key === "ArrowDown"
        ? item?.nextElementSibling
        : event.key === "ArrowUp" && item?.previousElementSibling;
    if (sibling) {
      event.preventDefault();
      sibling.querySelector("button")?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSearch(IDLE);
      document.getElementById(addressId)?.focus();
    }
  };
  const statusText = (() => {
    if (search.status === "searching") {
      return location.label("searching");
    }
    if (search.status === "error") {
      return location.label("searchFailed");
    }
    return search.status === "done" && !search.results.length
      ? location.label("noResults")
      : "";
  })();

  const editor = (
    <fieldset
      aria-label={label ?? location.label("location")}
      className={cn(
        "m-0 grid min-w-0 gap-2 border-0 p-0",
        floating &&
          "absolute top-full left-0 z-50 mt-1 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md",
        floatingStyle && "mt-0"
      )}
      data-location-editor=""
      disabled={disabled}
      ref={containerRef}
      style={floatingStyle}
    >
      <label className="grid gap-1 text-sm" htmlFor={addressId}>
        <span className="text-muted-foreground text-xs">
          {location.geocode
            ? location.label("search")
            : location.label("address")}
        </span>
        <span className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-describedby={describedBy}
            aria-invalid={invalid || Boolean(error)}
            autoComplete="off"
            autoFocus={autoFocus}
            className="h-8 pl-7 text-sm"
            data-form-focus
            id={addressId}
            onBlur={onBlur}
            onChange={(event) => {
              apply({ ...draft, address: event.target.value });
              searcher.search(event.target.value);
            }}
            onKeyDown={onAddressKeyDown}
            placeholder={location.label("coordinatesHint")}
            value={draft.address}
          />
        </span>
      </label>
      {search.results.length ? (
        <ul
          aria-label={location.label("suggestions")}
          className="m-0 grid max-h-48 list-none gap-0.5 overflow-auto rounded-md border p-1"
          data-location-suggestions=""
          ref={suggestionsRef}
        >
          {search.results.map((suggestion) => (
            <li key={`${suggestion.lat},${suggestion.lng},${suggestion.label}`}>
              <Button
                className="h-auto w-full justify-start gap-2 px-2 py-1.5 text-left font-normal"
                onBlur={onBlur}
                onClick={() => choose(suggestion)}
                onKeyDown={onSuggestionKeyDown}
                type="button"
                variant="ghost"
              >
                <MapPin
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
                <span className="grid min-w-0">
                  <span className="truncate text-sm">{suggestion.label}</span>
                  {suggestion.address ? (
                    <span className="truncate text-muted-foreground text-xs">
                      {suggestion.address}
                    </span>
                  ) : null}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <output
        aria-live="polite"
        className="flex items-center gap-1 text-muted-foreground text-xs empty:hidden"
      >
        {search.status === "searching" ? (
          <Loader2 aria-hidden="true" className="size-3 animate-spin" />
        ) : null}
        {statusText}
      </output>
      <label className="grid gap-1 text-sm" htmlFor={`${id}-label`}>
        <span className="text-muted-foreground text-xs">
          {location.label("label")}
        </span>
        <Input
          className="h-8 text-sm"
          id={`${id}-label`}
          onBlur={onBlur}
          onChange={(event) => apply({ ...draft, label: event.target.value })}
          onKeyDown={onKeyDown}
          value={draft.label}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm" htmlFor={`${id}-lat`}>
          <span className="text-muted-foreground text-xs">
            {location.label("latitude")}
          </span>
          <Input
            aria-invalid={Boolean(error)}
            className="h-8 text-sm"
            id={`${id}-lat`}
            inputMode="decimal"
            onBlur={onBlur}
            onChange={(event) => apply({ ...draft, lat: event.target.value })}
            onKeyDown={onKeyDown}
            value={draft.lat}
          />
        </label>
        <label className="grid gap-1 text-sm" htmlFor={`${id}-lng`}>
          <span className="text-muted-foreground text-xs">
            {location.label("longitude")}
          </span>
          <Input
            aria-invalid={Boolean(error)}
            className="h-8 text-sm"
            id={`${id}-lng`}
            inputMode="decimal"
            onBlur={onBlur}
            onChange={(event) => apply({ ...draft, lng: event.target.value })}
            onKeyDown={onKeyDown}
            value={draft.lng}
          />
        </label>
      </div>
      {error ? (
        <p className="m-0 text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          onBlur={onBlur}
          onClick={() => apply({ label: "", address: "", lat: "", lng: "" })}
          onKeyDown={onButtonKeyDown}
          size="sm"
          type="button"
          variant="ghost"
        >
          {location.label("clear")}
        </Button>
        {onCancel ? (
          <Button
            onBlur={onBlur}
            onClick={onCancel}
            onKeyDown={onButtonKeyDown}
            size="sm"
            type="button"
            variant="outline"
          >
            {location.label("cancel")}
          </Button>
        ) : null}
        {onDone ? (
          <Button
            onBlur={onBlur}
            onClick={done}
            onKeyDown={onButtonKeyDown}
            size="sm"
            type="button"
          >
            {location.label("done")}
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
  // Inline, the editor floats above the table so its overflow does not clip it.
  return floating && anchor ? createPortal(editor, document.body) : editor;
}
