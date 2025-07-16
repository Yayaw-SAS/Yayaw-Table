/**
 * Optimized translation cache system
 * Replaces inefficient object traversal with flat Map cache
 */

import type { DataTableTranslations, TranslationParams } from '../types/translations'

// Global cache for translations to avoid recalculation
const translationCaches = new WeakMap<DataTableTranslations, Map<string, string>>()

/**
 * Create a flat cache of all translation keys for O(1) lookup
 */
function createTranslationCache(translations: DataTableTranslations): Map<string, string> {
    // Check if cache already exists for this translations object
    if (translationCaches.has(translations)) {
        return translationCaches.get(translations)!
    }

    const cache = new Map<string, string>()

    const flatten = (obj: any, prefix = '') => {
        Object.keys(obj).forEach((key) => {
            const fullKey = prefix ? `${prefix}.${key}` : key
            if (typeof obj[key] === 'string') {
                cache.set(fullKey, obj[key])
            } else if (obj[key] && typeof obj[key] === 'object') {
                flatten(obj[key], fullKey)
            }
        })
    }

    flatten(translations)

    // Store in WeakMap for future use
    translationCaches.set(translations, cache)

    return cache
}

/**
 * Advanced interpolation function for translations
 * Supports {param} syntax for basic interpolation and pluralization
 * Pluralization syntax: {count, plural, one {singular} other {plural}}
 */
export function interpolate(text: string, params: TranslationParams = {}): string {
    // Handle pluralization first
    text = text.replace(
        /\{(\w+),\s*plural,\s*one\s*\{([^}]+)\}\s*other\s*\{([^}]+)\}\}/g,
        (match, key, singular, plural) => {
            const value = params[key]
            if (value !== undefined) {
                const count = Number(value)
                return count === 1 ? singular : plural
            }
            return match
        }
    )

    // Handle basic interpolation
    return text.replace(/\{(\w+)\}/g, (match, key) => {
        const value = params[key]
        return value !== undefined ? String(value) : match
    })
}

/**
 * Optimized translation getter using flat cache
 */
export function getTranslationOptimized(translations: DataTableTranslations, key: string): string {
    const cache = createTranslationCache(translations)
    return cache.get(key) || key // Return key if translation not found
}

/**
 * Create a memoized translation function for a specific translations object
 */
export function createTranslationFunction(translations: DataTableTranslations) {
    const cache = createTranslationCache(translations)

    return (key: string, params?: TranslationParams): string => {
        const translation = cache.get(key) || key
        return params ? interpolate(translation, params) : translation
    }
}
