/**
 * Hook for accessing translations in the DataTable component
 * Provides both direct access to resolved translations and complex formatting capabilities
 */
import { useAtomValue } from "jotai";
import {
  type DataTableUiStrings,
  tableTranslationsAtom,
  translationKeysMap,
  translationsAtom,
  translationsInitializedAtom,
} from "../atoms/i18n-atoms";
import { useTranslations } from "../providers/table-provider";

/**
 * Extended return type for useTableTranslations that includes formatting function
 */
export interface UseTableTranslationsReturn extends DataTableUiStrings {
  /**
   * Format a translation with variables (plurals, dates, rich text, etc.)
   * Leverages next-intl's powerful formatting capabilities
   * @param key - The translation key name from DataTableTranslations
   * @param values - Values to interpolate, including pluralization variables
   */
  format: (
    key: keyof DataTableUiStrings,
    values?: Record<string, string | number | Date>
  ) => string;
}

/**
 * Enhanced hook that provides access to all available translations for DataTable components
 * Along with a format function that leverages next-intl for complex formatting
 * @returns Both direct translations and a format function for complex cases
 */
export function useTableTranslations(
  tableId?: string
): UseTableTranslationsReturn {
  // Get global translations from atom
  const globalTranslations = useAtomValue(translationsAtom);

  // Create a dummy tableId if none is provided to ensure hooks are called consistently
  const safeTableId = tableId || "global";

  // Always call the hook unconditionally
  const tableSpecificTranslations = useAtomValue(
    tableTranslationsAtom(safeTableId)
  );

  // Use table-specific translations if tableId was provided, otherwise use global
  const tableTranslations = tableId
    ? tableSpecificTranslations
    : globalTranslations;

  // Check if translations are initialized
  const isInitialized = useAtomValue(translationsInitializedAtom);

  // Get next-intl's translation function for advanced formatting
  // Specify the 'data-table' namespace to access translations from the correct file
  const { t } = useTranslations();

  // Create a mapping from property name to original translation key
  const keyToOriginalMap = Object.entries(translationKeysMap).reduce(
    (acc, [key, originalKey]) => {
      if (typeof originalKey === "string") {
        acc[key as keyof DataTableUiStrings] = originalKey;
      }
      return acc;
    },
    {} as Record<keyof DataTableUiStrings, string>
  );

  // Format function that leverages next-intl's capabilities for plurals and more
  const format = (
    key: keyof DataTableUiStrings,
    values?: Record<string, string | number | Date>
  ): string => {
    const originalKey = keyToOriginalMap[key];

    // If we can't find the original key, return the stored translation or the key itself
    if (!originalKey) {
      return (
        (
          tableTranslations as Partial<Record<keyof DataTableUiStrings, string>>
        )[key] || String(key)
      );
    }

    try {
      // Use the t function directly with the original translation key and provided values
      // Convert Date objects to strings to match TranslationParams type
      const safeValues = values
        ? Object.fromEntries(
            Object.entries(values).map(([paramKey, value]) => [
              paramKey,
              value instanceof Date ? value.toISOString() : value,
            ])
          )
        : {};

      return t(originalKey, safeValues);
    } catch {
      // Log a warning in development mode only
      if (process.env.NODE_ENV === "development") {
        /* optional dev warning */
      }
      // Return the stored translation or the key itself as a fallback
      return (
        (
          tableTranslations as Partial<Record<keyof DataTableUiStrings, string>>
        )[key] || String(key)
      );
    }
  };

  // If translations aren't initialized yet, return a proxy that uses format for all keys
  if (!isInitialized) {
    return new Proxy({ format } as UseTableTranslationsReturn, {
      get: (target, prop) => {
        if (prop === "format") {
          return target.format;
        }
        return format(prop as keyof DataTableUiStrings);
      },
    });
  }

  // Return all translations plus the format function
  return {
    ...(tableTranslations as Record<string, string>),
    format,
  } as UseTableTranslationsReturn;
}
