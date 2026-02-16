/**
 * Date display preset options for table rendering.
 * Presets are strict and locale-aware where applicable.
 */
export const DATE_DISPLAY_PRESETS = [
  "localized-short",
  "localized-medium",
  "localized-long",
  "month-name-long",
  "month-year",
  "dmy-numeric",
  "dmy-short",
  "mdy-numeric",
  "mdy-short",
  "iso-date",
] as const;

export type DateDisplayPreset = (typeof DATE_DISPLAY_PRESETS)[number];

export const DEFAULT_DATE_DISPLAY_PRESET: DateDisplayPreset =
  "localized-short";
