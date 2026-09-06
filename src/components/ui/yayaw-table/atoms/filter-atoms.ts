/**
 * Filter atoms for DataTable component
 * These atoms manage filter-related state
 */
import type { ColumnFiltersState } from "@/components/ui/yayaw-table/tanstack";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";

import { columnFiltersAtom } from "./table-atoms";

// Regex patterns for column ID extraction - moved to top-level for performance
const ACCESSOR_KEY_PATTERNS = [
  /accessorKey:\s*["']([^"']+)["']/i,
  /accessorKey=\{["']([^"']+)["']\}/i,
  /accessorKey=["']([^"']+)["']/i,
] as const;

// Translation patterns for column ID extraction - moved to top-level for performance
const TRANSLATION_PATTERNS = [
  /title:\s*t\(["']([^"']+)["']\)/i,
  /title=\{t\(["']([^"']+)["']\)\}/i,
  /header:\s*t\(["']([^"']+)["']\)/i,
  /header=\{t\(["']([^"']+)["']\)\}/i,
  /t\(["']([^"']+)["']\)/i, // Generic t() call
  /\{t\(["']([^"']+)["']\)\}/i, // Generic {t()} call
] as const;

// ID patterns for column ID extraction - moved to top-level for performance
const ID_PATTERNS = [
  /id:\s*["']([^"']+)["']/i,
  /id=\{["']([^"']+)["']\}/i,
  /id=["']([^"']+)["']/i,
] as const;

// Header component pattern - moved to top-level for performance
const HEADER_COMPONENT_PATTERN = /header:\s*\(\{[^}]*\}\)\s*=>\s*<([^>]+)/;

/**
 * Interface for a filter preset
 * Represents a saved filter configuration
 */
export interface FilterPreset {
  filters: ColumnFiltersState;
  id: string;
  isDefault?: boolean;
  name: string;
  tableId: string;
}

// Helper function to check if columnId needs cleaning
const needsCleaning = (columnId: string): boolean => {
  return (
    columnId.includes("__TURBOPACK_") ||
    columnId.includes("(") ||
    columnId.includes(")")
  );
};

// Helper function to extract accessor key
const extractAccessorKey = (columnId: string): string | null => {
  for (const pattern of ACCESSOR_KEY_PATTERNS) {
    const match = columnId.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

// Helper function to extract translation key
const extractTranslationKey = (columnId: string): string | null => {
  for (const pattern of TRANSLATION_PATTERNS) {
    const match = columnId.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

// Helper function to extract ID
const extractId = (columnId: string): string | null => {
  for (const pattern of ID_PATTERNS) {
    const match = columnId.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

// Helper function to extract header component name
const extractHeaderComponent = (columnId: string): string | null => {
  const match = columnId.match(HEADER_COMPONENT_PATTERN);
  if (match?.[1]) {
    return match[1].split(" ")[0];
  }
  return null;
};

// Helper function to clean path and remove special characters
const cleanPath = (columnId: string): string => {
  const parts = columnId.split("/");
  const lastPart = parts.at(-1);

  return (lastPart || columnId)
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\{.*?\}/g, "")
    .replace(/".*?"/g, "")
    .replace(/__TURBOPACK__.*?__/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim();
};

/**
 * Helper function to clean Turbopack references from column IDs
 * @param columnId Column ID that might contain Turbopack references
 * @returns Cleaned column ID
 */
export function cleanColumnId(columnId: string): string {
  if (typeof columnId !== "string") {
    return String(columnId);
  }

  // If it doesn't need cleaning, return as is
  if (!needsCleaning(columnId)) {
    return columnId;
  }

  // Try different extraction methods in order of preference
  const accessorKey = extractAccessorKey(columnId);
  if (accessorKey) {
    return accessorKey;
  }

  const translationKey = extractTranslationKey(columnId);
  if (translationKey) {
    return translationKey;
  }

  const id = extractId(columnId);
  if (id) {
    return id;
  }

  const headerComponent = extractHeaderComponent(columnId);
  if (headerComponent) {
    return headerComponent;
  }

  // If all else fails, clean the path
  const cleaned = cleanPath(columnId);
  return cleaned || "column";
}

/**
 * Atom family for storing filter presets for a specific table
 * Keyed by tableId
 */
export const filterPresetsAtom = atomFamily((_tableId: string) =>
  atom<FilterPreset[]>([])
);

/**
 * Atom family for storing the active filter preset ID
 * Keyed by tableId
 */
export const activeFilterPresetIdAtom = atomFamily((_tableId: string) =>
  atom<null | string>(null)
);

/**
 * Atom family for storing whether the filter panel is open
 * Keyed by tableId
 */
export const isFilterPanelOpenAtom = atomFamily((_tableId: string) =>
  atom<boolean>(false)
);

/**
 * Derived atom family that returns the active filter preset
 * Keyed by tableId
 */
export const activeFilterPresetAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const presetId = get(activeFilterPresetIdAtom(tableId));
    const presets = get(filterPresetsAtom(tableId));

    if (!presetId) {
      return null;
    }
    return presets.find((preset) => preset.id === presetId) || null;
  })
);

/**
 * Atom family for tracking whether filters have been modified
 * Compares current filters with the active preset
 * Keyed by tableId
 */
export const hasFilterChangesAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const activePreset = get(activeFilterPresetAtom(tableId));
    const currentFilters = get(columnFiltersAtom(tableId));

    if (!activePreset) {
      return currentFilters.length > 0;
    }

    // Simple comparison - in a real app you might want a deeper comparison
    return (
      JSON.stringify(activePreset.filters) !== JSON.stringify(currentFilters)
    );
  })
);

/**
 * Atom family that provides normalized column filters with cleaned IDs
 * This helps prevent issues with Turbopack references in column IDs
 * Keyed by tableId
 */
export const normalizedColumnFiltersAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const columnFilters = get(columnFiltersAtom(tableId));

    // Normalize column filters by cleaning their IDs
    return columnFilters.map((filter) => ({
      ...filter,
      id: cleanColumnId(filter.id as string),
    }));
  })
);

/**
 * Atom family for storing a mapping between original column IDs and their cleaned versions
 * This helps maintain consistency when applying filters
 * Keyed by tableId
 */
export const columnIdMappingAtom = atomFamily((tableId: string) =>
  atom((get) => {
    const columnFilters = get(columnFiltersAtom(tableId));

    // Create a mapping of original IDs to cleaned IDs
    const mapping = new Map<string, string>();

    for (const filter of columnFilters) {
      const originalId = filter.id as string;
      const cleanedId = cleanColumnId(originalId);

      if (originalId !== cleanedId) {
        mapping.set(originalId, cleanedId);
        mapping.set(cleanedId, originalId); // Bidirectional mapping
      }
    }

    return mapping;
  })
);
