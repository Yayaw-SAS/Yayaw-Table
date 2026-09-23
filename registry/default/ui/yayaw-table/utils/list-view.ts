/**
 * List view settings shared by the React and Vue editions.
 */

export interface ListViewSettings {
  /** Column used as the line title. */
  titleColumn?: string;
  /** Properties shown after the title, in order. */
  cardColumnIds?: string[];
  /** Show each property's column name before its value. */
  showCardLabels?: boolean;
  /** Let the title wrap onto several lines instead of truncating it. */
  wrap?: boolean;
  /** Show the row actions menu at the end of each line. */
  showActions?: boolean;
  /** Where properties sit: right after the title, or at the end of the line. */
  propertyAlign?: "end" | "start";
  /** Properties shown at most on every screen; unset shows them all. */
  maxProperties?: number;
  /** Properties shown at most on narrow screens (below 768px). */
  mobileMaxProperties?: number;
}

type ListDisplayDefaults = Required<
  Pick<
    ListViewSettings,
    "propertyAlign" | "showActions" | "showCardLabels" | "wrap"
  >
>;

export const LIST_VIEW_DEFAULTS: ListDisplayDefaults = {
  propertyAlign: "end",
  showActions: true,
  showCardLabels: false,
  wrap: false,
};

/** Widths below this use `mobileMaxProperties`, matching the other mobile layouts. */
export const LIST_MOBILE_BREAKPOINT = 768;

const cleanIds = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;

const cleanCount = (value: unknown): number | undefined => {
  const count = Number(value);
  return value !== undefined && Number.isInteger(count) && count >= 0
    ? count
    : undefined;
};

/** Keep only valid list settings; unknown or malformed values are dropped. */
export function normalizeListViewConfig(
  value: unknown
): ListViewSettings | undefined {
  if (!value || typeof value !== "object") {
    return;
  }
  const input = value as Record<string, unknown>;
  const normalized: ListViewSettings = {};
  const title =
    typeof input.titleColumn === "string" ? input.titleColumn.trim() : "";
  if (title) {
    normalized.titleColumn = title;
  }
  const ids = cleanIds(input.cardColumnIds);
  if (ids) {
    normalized.cardColumnIds = ids;
  }
  for (const key of ["showCardLabels", "wrap", "showActions"] as const) {
    if (typeof input[key] === "boolean") {
      normalized[key] = input[key] as boolean;
    }
  }
  if (input.propertyAlign === "start" || input.propertyAlign === "end") {
    normalized.propertyAlign = input.propertyAlign;
  }
  const max = cleanCount(input.maxProperties);
  if (max !== undefined) {
    normalized.maxProperties = max;
  }
  const mobileMax = cleanCount(input.mobileMaxProperties);
  if (mobileMax !== undefined) {
    normalized.mobileMaxProperties = mobileMax;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

/** Table defaults, then the view's own settings. */
export function resolveListSettings(
  defaults: ListViewSettings | undefined,
  view: ListViewSettings | undefined
): ListViewSettings & ListDisplayDefaults {
  return { ...LIST_VIEW_DEFAULTS, ...defaults, ...view };
}

/** The properties a line shows at this width. */
export function visibleListProperties(
  ids: readonly string[],
  settings: Pick<ListViewSettings, "maxProperties" | "mobileMaxProperties">,
  isMobile: boolean
): string[] {
  const limits = [settings.maxProperties];
  if (isMobile) {
    limits.push(settings.mobileMaxProperties);
  }
  const limit = Math.min(
    ...limits.filter((item): item is number => item !== undefined)
  );
  return Number.isFinite(limit) ? ids.slice(0, limit) : [...ids];
}
