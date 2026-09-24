/**
 * Display mode registry shared by the React and Vue editions.
 *
 * Every framework-neutral fact about a mode lives here, so adding a mode means
 * one entry in this file plus its renderer and settings panel in each edition.
 */
import {
  type CalendarViewSettings,
  normalizeCalendarViewConfig,
} from "./calendar-model";
import {
  type ChartViewSettings,
  normalizeChartViewConfig,
} from "./chart-model";
import {
  type FeedTableSettings,
  type FeedViewSettings,
  normalizeFeedViewConfig,
} from "./feed-view";
import {
  type FileTreeTableConfig,
  type FileTreeViewSettings,
  normalizeFileTreeViewConfig,
} from "./filetree-model";
import { type FormViewSettings, normalizeFormViewConfig } from "./form-view";
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
   * The mode is rendered by an optional registry item (its library stays out
   * of the base block); it is offered only when that renderer is plugged in.
   */
  requiresRenderer?: boolean;
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
  filetree: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "filetree",
    maxGroups: 0,
    normalizeConfig: normalizeFileTreeViewConfig,
    // The table plugs its built-in file tree in when a parent column exists.
    requiresRenderer: true,
  },
  calendar: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "calendar",
    maxGroups: 0,
    normalizeConfig: normalizeCalendarViewConfig,
    requiresRenderer: true,
  },
  chart: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "chart",
    maxGroups: 0,
    normalizeConfig: normalizeChartViewConfig,
    requiresRenderer: true,
  },
  feed: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "feed",
    maxGroups: 1,
    normalizeConfig: normalizeFeedViewConfig,
    // The table plugs its built-in feed renderer in unless `table.feed: false`.
    requiresRenderer: true,
  },
  form: {
    capabilities: NO_TABLE_CONTROLS,
    configKey: "form",
    maxGroups: 0,
    normalizeConfig: normalizeFormViewConfig,
    // The table plugs its built-in form renderer in when it can create records.
    requiresRenderer: true,
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
  /** Modes whose optional renderer is plugged into the table. */
  renderers?: readonly string[];
}

function isModeUsable(
  mode: TableDisplayMode,
  context: DisplayModeContext
): boolean {
  const definition: DisplayModeDefinition = DISPLAY_MODES[mode];
  if (definition.requiresPlanning && !context.planning) {
    return false;
  }
  return !(definition.requiresRenderer && !context.renderers?.includes(mode));
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
    ? known.filter((mode) => isModeUsable(mode, context))
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
  filetree?: FileTreeViewSettings;
  calendar?: CalendarViewSettings;
  chart?: ChartViewSettings;
  feed?: FeedViewSettings;
  form?: FormViewSettings;
}

/**
 * Table-level defaults of the generic modes; `form: false` also turns the Form
 * mode off, `chart: false` the Chart mode, `feed: false` the Feed mode and
 * `filetree: false` the File tree.
 */
export interface GenericModeTableConfigs
  extends Omit<GenericModeViewConfigs, "chart" | "feed" | "filetree" | "form"> {
  chart?: boolean | ChartViewSettings;
  /** Feed defaults, plus the runtime `renderBody` hook; `false` turns the mode off. */
  feed?: boolean | FeedTableSettings;
  filetree?: boolean | FileTreeTableConfig;
  form?: boolean | FormViewSettings;
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
export function pickGenericModeConfigs(
  source: object
): GenericModeTableConfigs {
  const record = source as Record<string, unknown>;
  return Object.fromEntries(
    GENERIC_MODE_CONFIG_KEYS.flatMap((key) =>
      record[key] === undefined ? [] : [[key, record[key]]]
    )
  ) as GenericModeTableConfigs;
}

/** Table defaults usable as initial mode settings; flags such as `form: true` are left out. */
export function pickGenericModeSettings(
  source: object
): GenericModeViewConfigs {
  return Object.fromEntries(
    Object.entries(pickGenericModeConfigs(source)).filter(
      ([, value]) => Boolean(value) && typeof value === "object"
    )
  ) as GenericModeViewConfigs;
}

/**
 * Renderers of the modes a table turns off with `false` (`table.chart: false`),
 * left out so the mode is not offered. The Form mode keeps its own gate.
 */
export function withoutDisabledModeRenderers<T extends object>(
  renderers: T | undefined,
  table: object
): T | undefined {
  if (!renderers) {
    return renderers;
  }
  const flags = table as Record<string, unknown>;
  const disabled = Object.keys(renderers).filter(
    (mode) => mode !== "form" && flags[mode] === false
  );
  if (!disabled.length) {
    return renderers;
  }
  const rest = { ...renderers } as Record<string, unknown>;
  for (const mode of disabled) {
    Reflect.deleteProperty(rest, mode);
  }
  return rest as T;
}

/** A mode's table defaults when they are settings, not an on/off flag. */
export function modeDefaultsOf(
  table: object,
  mode: string
): Record<string, unknown> {
  const value = (table as Record<string, unknown>)[mode];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const RECORD_MODES: readonly TableDisplayMode[] = ["table", "list"];

/** Where a view shows the records of a clicked group: the table, else the list, else another offered mode. */
export function recordsDisplayMode(
  offered: readonly TableDisplayMode[],
  current: TableDisplayMode
): TableDisplayMode {
  return (
    RECORD_MODES.find((mode) => offered.includes(mode)) ??
    offered.find((mode) => mode !== current) ??
    current
  );
}
