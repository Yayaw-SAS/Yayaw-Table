/**
 * Optimized translation cache system
 * Replaces inefficient object traversal with flat Map cache
 */

import type { DataTableUiStrings } from "../atoms/i18n-atoms";
import { translationKeysMap } from "../atoms/i18n-atoms";
import type {
  DataTableTranslations,
  TranslationParams,
} from "../types/translations";

// Global cache for translations to avoid recalculation
const translationCaches = new WeakMap<
  DataTableTranslations,
  Map<string, string>
>();

/**
 * Create a flat cache of all translation keys for O(1) lookup
 */
function createTranslationCache(
  translations: DataTableTranslations
): Map<string, string> {
  // Check if cache already exists for this translations object
  const existingCache = translationCaches.get(translations);
  if (existingCache) {
    return existingCache;
  }

  const cache = new Map<string, string>();

  const flatten = (obj: Record<string, unknown>, prefix = "") => {
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === "string") {
        cache.set(fullKey, obj[key] as string);
      } else if (obj[key] && typeof obj[key] === "object") {
        flatten(obj[key] as Record<string, unknown>, fullKey);
      }
    }
  };

  flatten(translations as unknown as Record<string, unknown>);

  // Store in WeakMap for future use
  translationCaches.set(translations, cache);

  return cache;
}

/**
 * Advanced interpolation function for translations
 * Supports {param} syntax for basic interpolation and pluralization
 * Pluralization syntax: {count, plural, one {singular} other {plural}}
 */
export function interpolate(
  text: string,
  params: TranslationParams = {}
): string {
  // Handle pluralization first
  const processedText = text.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]+)\}\s*other\s*\{([^}]+)\}\}/g,
    (match, key, singular, plural) => {
      const value = params[key];
      if (value !== undefined) {
        const count = Number(value);
        return count === 1 ? singular : plural;
      }
      return match;
    }
  );

  // Handle basic interpolation
  return processedText.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Optimized translation getter using flat cache
 */
export function getTranslationOptimized(
  translations: DataTableTranslations,
  key: string
): string {
  const cache = createTranslationCache(translations);
  return cache.get(key) || key; // Return key if translation not found
}

/**
 * Create a memoized translation function for a specific translations object
 */
export function createTranslationFunction(translations: DataTableTranslations) {
  const cache = createTranslationCache(translations);

  return (key: string, params?: TranslationParams): string => {
    const translation = cache.get(key) || key;
    return params ? interpolate(translation, params) : translation;
  };
}

/**
 * Resolve nested DataTableTranslations to flat DataTableUiStrings for the UI provider
 */
export function resolveTranslationsToUiStrings(
  translations: DataTableTranslations
): DataTableUiStrings {
  const cache = createTranslationCache(translations);
  const result = {} as DataTableUiStrings;
  for (const key of Object.keys(
    translationKeysMap
  ) as (keyof DataTableUiStrings)[]) {
    result[key] = cache.get(translationKeysMap[key]) ?? key;
  }
  return result;
}
