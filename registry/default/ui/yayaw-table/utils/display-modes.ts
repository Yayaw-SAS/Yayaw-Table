/**
 * Display mode registry shared by the React and Vue editions.
 *
 * Every framework-neutral fact about a mode lives here, so adding a mode means
 * one entry in this file plus its renderer and settings panel in each edition.
 */
import { type ListViewSettings, normalizeListViewConfig } from "./list-view";

export interface DisplayModeDefinition {
  /** Table-only presentation controls offered by the view menu. */
  capabilities: {
    calculations: boolean;
    columns: boolean;
    density: boolean;
  };
  /** Saved-view and URL key holding the mode's own settings (`${tableId}-${configKey}`). */
  configKey?: string;
  /** Grouping levels the mode can render; 0 hides the grouping control. */
  maxGroups: number;
  /** The mode renders nothing useful without a planning session. */
  requiresPlanning?: boolean;
  /**
   * Saved views, URLs and table state handle the settings generically with
   * this normalizer. Kanban, gallery and Gantt keep dedicated code for their
   * historical migrations.
   */
  normalizeConfig?: (value: unknown) => object | undefined;
}

const NO_TABLE_CONTROLS = {
  calculations: false,
  columns: false,
  density: false,
} as const;

export const DISPLAY_MODES = {
  table: {
    capabilities: { calculations: true, columns: true, density: true },
    maxGroups: 2,
  },
  list: {
    capabilities: { calculations: false, columns: false, density: true },
    configKey: "list",
    maxGroups: 1,
    normalizeConfig: normalizeListViewConfig,
  },
  kanban: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "kanban",
    maxGroups: 1,
  },
  gallery: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "gallery",
    maxGroups: 1,
  },
  gantt: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "gantt",
    maxGroups: 0,
    requiresPlanning: true,
  },
} as const satisfies Record<string, DisplayModeDefinition>;

export type TableDisplayMode = keyof typeof DISPLAY_MODES;

export const DISPLAY_MODE_IDS = Object.keys(
  DISPLAY_MODES
) as TableDisplayMode[];

/** Keys of per-mode settings in saved views and URLs, in registry order. */
export const DISPLAY_MODE_CONFIG_KEYS = DISPLAY_MODE_IDS.flatMap((mode) => {
  const definition: DisplayModeDefinition = DISPLAY_MODES[mode];
  return definition.configKey ? [definition.configKey] : [];
});

export function isTableDisplayMode(value: unknown): value is TableDisplayMode {
  return typeof value === "string" && Object.hasOwn(DISPLAY_MODES, value);
}

export interface DisplayModeContext {
  /** Whether a planning session can feed planning modes such as Gantt. */
  planning?: boolean;
}

/**
 * Configured modes, deduplicated and restricted to known modes. With a context,
 * modes that cannot render yet are withheld; the table mode is the last resort.
 */
export function resolveDisplayModes(
  displayModes: readonly unknown[] | undefined,
  context?: DisplayModeContext
): TableDisplayMode[] {
  const known = (displayModes ?? []).filter(
    (mode, index, modes): mode is TableDisplayMode =>
      isTableDisplayMode(mode) && modes.indexOf(mode) === index
  );
  const usable = context
    ? known.filter(
        (mode) =>
          !(
            (DISPLAY_MODES[mode] as DisplayModeDefinition).requiresPlanning &&
            !context.planning
          )
      )
    : known;
  return usable.length ? usable : ["table"];
}

/** The requested mode when it is offered, otherwise the default, otherwise the first offered mode. */
export function resolveDisplayMode({
  allowed,
  fallback,
  requested,
}: {
  allowed: readonly TableDisplayMode[];
  fallback?: unknown;
  requested?: unknown;
}): TableDisplayMode {
  if (isTableDisplayMode(requested) && allowed.includes(requested)) {
    return requested;
  }
  if (isTableDisplayMode(fallback) && allowed.includes(fallback)) {
    return fallback;
  }
  return allowed[0] ?? "table";
}

export function displayModeMaxGroups(mode: TableDisplayMode): number {
  return DISPLAY_MODES[mode].maxGroups;
}

/** View settings of the modes handled generically, by config key. */
export interface GenericModeViewConfigs {
  list?: ListViewSettings;
}

export type GenericModeConfigKey = keyof GenericModeViewConfigs;

/** Config keys whose settings are stored and restored generically. */
export const GENERIC_MODE_CONFIG_KEYS = DISPLAY_MODE_IDS.flatMap((mode) => {
  const definition: DisplayModeDefinition = DISPLAY_MODES[mode];
  return definition.configKey && definition.normalizeConfig
    ? [definition.configKey as GenericModeConfigKey]
    : [];
});

function genericNormalizer(key: GenericModeConfigKey) {
  const mode = DISPLAY_MODE_IDS.find(
    (id) => (DISPLAY_MODES[id] as DisplayModeDefinition).configKey === key
  );
  return mode
    ? (DISPLAY_MODES[mode] as DisplayModeDefinition).normalizeConfig
    : undefined;
}

/** One mode's settings, normalized; unknown or empty values are dropped. */
export function normalizeModeConfig(
  key: GenericModeConfigKey,
  value: unknown
): object | undefined {
  return genericNormalizer(key)?.(value);
}

/** Every generic mode's settings found in a saved view or state object. */
export function normalizeGenericModeConfigs(
  source: Record<string, unknown>
): GenericModeViewConfigs {
  const normalized: Record<string, object> = {};
  for (const key of GENERIC_MODE_CONFIG_KEYS) {
    const value = normalizeModeConfig(key, source[key]);
    if (value) {
      normalized[key] = value;
    }
  }
  return normalized as GenericModeViewConfigs;
}

/** The generic per-mode settings of a table config, for passing it along. */
export function pickGenericModeConfigs(source: object): GenericModeViewConfigs {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(
    GENERIC_MODE_CONFIG_KEYS.flatMap((key) =>
      record[key] === undefined ? [] : [[key, record[key]]]
    )
  ) as GenericModeViewConfigs;
}
