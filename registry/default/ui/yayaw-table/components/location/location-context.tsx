"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import {
  type GeocodeAction,
  type LocationLabelKey,
  type LocationTranslate,
  locationLabel,
} from "../../utils/location-model";

interface LocationContextValue {
  /** The host's `actions.geocode`, for address suggestions. */
  geocode?: GeocodeAction;
  locale: string;
  /** `location.<key>` overrides. */
  translate?: LocationTranslate;
}

const LocationContext = createContext<LocationContextValue>({ locale: "en" });

/** Location editors below it suggest places with the host's geocoder. */
export function LocationProvider({
  children,
  geocode,
  locale,
  translate,
}: LocationContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ geocode, locale, translate }),
    [geocode, locale, translate]
  );
  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

/** The geocoder and labels of location editors and cells. */
export function useLocationContext(locale?: string) {
  const context = useContext(LocationContext);
  return useMemo(() => {
    const language = locale ?? context.locale;
    return {
      ...context,
      locale: language,
      label: (
        key: LocationLabelKey,
        params?: Record<string, number | string>
      ) => locationLabel(key, language, context.translate, params),
    };
  }, [context, locale]);
}
