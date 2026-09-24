"use client";

import { MapPin } from "lucide-react";
import {
  formatCoordinates,
  formatLocation,
  parseLocation,
} from "../../utils/location-model";

/** A place: a small pin and its name, else its address, else its coordinates. */
export function LocationCell({ value }: { value: unknown }) {
  const location = parseLocation(value);
  if (!location) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1"
      data-location-cell=""
      title={
        location.label || location.address
          ? `${formatLocation(location)} (${formatCoordinates(location)})`
          : undefined
      }
    >
      <MapPin
        aria-hidden="true"
        className="size-3.5 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{formatLocation(location)}</span>
    </span>
  );
}
