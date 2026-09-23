/**
 * Date display preset options for table rendering.
 * Presets are strict and locale-aware where applicable.
 */
import type { DateDisplayPreset as SharedDateDisplayPreset } from "../utils/value-format";

// biome-ignore lint/performance/noBarrelFile: the preset list keeps its historical import path.
export { DATE_DISPLAY_PRESETS } from "../utils/value-format";

export type DateDisplayPreset = SharedDateDisplayPreset;

export const DEFAULT_DATE_DISPLAY_PRESET: DateDisplayPreset = "localized-short";
