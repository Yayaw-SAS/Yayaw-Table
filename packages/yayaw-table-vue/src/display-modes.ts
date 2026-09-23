/**
 * Display mode registry shared by the React and Vue editions.
 *
 * Every framework-neutral fact about a mode lives here, so adding a mode means
 * one entry in this file plus its renderer and settings panel in each edition.
 */

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
    capabilities: NO_TABLE_CONTROLS,
    configKey: "list",
    maxGroups: 1,
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
