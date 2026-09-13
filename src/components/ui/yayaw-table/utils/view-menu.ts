import {
  normalizeFilterEnvelope,
  normalizeViewAliases,
} from "./table-contracts";

/** These capabilities describe presentation, before catalogue permissions apply. */
export function getViewModeCapabilities(mode: "table" | "kanban" | "gallery") {
  return {
    columns: mode === "table",
    density: mode === "table",
    calculations: mode === "table",
    kanban: mode === "kanban",
    gallery: mode === "gallery",
    maxGroups: mode === "table" ? 2 : 1,
  } as const;
}

const VIEW_SETTING_KEYS = [
  "advancedFilters",
  "columnFilters",
  "columnOrder",
  "columnPinning",
  "columnSizing",
  "columnVisibility",
  "density",
  "displayMode",
  "footerCalculationsVisible",
  "gallery",
  "globalSearch",
  "grouping",
  "kanban",
  "pageSize",
  "sorting",
] as const;

function canonicalValue(value: unknown, field?: string): unknown {
  if (value instanceof Date) {
    return value.toJSON() ?? undefined;
  }
  if (Array.isArray(value)) {
    return value.length || field === "cardColumnIds"
      ? value.map((item) => canonicalValue(item))
      : undefined;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const normalized = canonicalValue(
        (value as Record<string, unknown>)[key],
        key
      );
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }
    return Object.keys(result).length ? result : undefined;
  }
  return value === null || (value === "" && field !== "imageColumn")
    ? undefined
    : value;
}

/** Compare saved settings, excluding transient selection, pages and UI state. */
export function areViewSettingsEqual(left: object, right: object): boolean {
  const normalize = (input: object) => {
    const aliases = normalizeViewAliases(input);
    const settings: Record<string, unknown> = {};
    for (const key of VIEW_SETTING_KEYS) {
      settings[key] = aliases[key];
    }
    // Selection and action columns are positioned by the table, including in legacy views.
    if (Array.isArray(settings.columnOrder)) {
      settings.columnOrder = settings.columnOrder.filter(
        (id) => id !== "select" && id !== "actions"
      );
    }
    // Filter identities and edit timestamps do not change the saved query's meaning.
    settings.advancedFilters = normalizeFilterEnvelope(
      aliases.advancedFilters
    ).filters.map(
      ({
        id: _id,
        label: _label,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...filter
      }) => ({
        ...filter,
        joinOperator: filter.joinOperator === "or" ? "or" : undefined,
      })
    );
    // An explicit visible column has the same meaning as an absent override.
    if (
      settings.columnVisibility &&
      typeof settings.columnVisibility === "object"
    ) {
      settings.columnVisibility = Object.fromEntries(
        Object.entries(settings.columnVisibility).filter(
          ([, visible]) => visible === false
        )
      );
    }
    return canonicalValue(settings);
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export interface PageSharingEnvironment {
  share?: (data: { url: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export type PageShareResult = "shared" | "copied" | "cancelled";

/** Sharing a URL never grants access or changes a saved view's organization scope. */
export async function sharePageUrl(
  url: string,
  native: boolean,
  environment: PageSharingEnvironment = navigator
): Promise<PageShareResult> {
  if (native && typeof environment.share === "function") {
    try {
      await environment.share({ url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      if (!environment.clipboard?.writeText) {
        throw error;
      }
    }
  }
  if (!environment.clipboard?.writeText) {
    throw new Error("Link sharing is unavailable in this browser.");
  }
  await environment.clipboard.writeText(url);
  return "copied";
}
