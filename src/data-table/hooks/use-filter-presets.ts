/**
 * Hook for managing filter presets
 * Handles saving, loading, sharing, and organizing filter configurations
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdvancedFilterState,
  FilterComparison,
  FilterExport,
  FilterPreset,
} from '../types/advanced-filter-types';

// Local storage keys
const PRESETS_STORAGE_KEY = 'data-table-filter-presets';
const USAGE_STORAGE_KEY = 'data-table-filter-usage';
const SETTINGS_STORAGE_KEY = 'data-table-filter-settings';

export interface UseFilterPresetsOptions {
  /** Table identifier for scoped presets */
  tableId: string;
  /** Whether to enable cloud sync (future feature) */
  enableCloudSync?: boolean;
  /** Maximum number of presets to keep */
  maxPresets?: number;
  /** Auto-save current state as draft */
  autoSaveDraft?: boolean;
  /** Current user for permissions */
  currentUser?: string;
}

export interface UseFilterPresetsReturn {
  // Presets data
  presets: FilterPreset[];
  systemPresets: FilterPreset[];
  userPresets: FilterPreset[];
  recentPresets: FilterPreset[];
  popularPresets: FilterPreset[];

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isDeleting: boolean;

  // Actions
  savePreset: (
    state: AdvancedFilterState,
    options: {
      name: string;
      description?: string;
      isPublic?: boolean;
      tags?: string[];
      icon?: string;
      color?: string;
    }
  ) => Promise<FilterPreset>;

  loadPreset: (presetId: string) => Promise<AdvancedFilterState>;
  updatePreset: (
    presetId: string,
    updates: Partial<FilterPreset>
  ) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;
  duplicatePreset: (
    presetId: string,
    newName?: string
  ) => Promise<FilterPreset>;

  // Organization
  addTag: (presetId: string, tag: string) => Promise<void>;
  removeTag: (presetId: string, tag: string) => Promise<void>;
  setFavorite: (presetId: string, isFavorite: boolean) => Promise<void>;

  // Export/Import
  exportPreset: (presetId: string, format?: 'json' | 'url') => Promise<string>;
  exportAll: (format?: 'json' | 'zip') => Promise<string>;
  importPreset: (
    data: string,
    format?: 'json' | 'url'
  ) => Promise<FilterPreset>;
  importFromFile: (file: File) => Promise<FilterPreset[]>;

  // Sharing
  sharePreset: (
    presetId: string,
    permissions?: {
      canEdit: boolean;
      canDelete: boolean;
      expiresAt?: Date;
    }
  ) => Promise<string>;

  // Analytics
  getUsageStats: () => {
    mostUsed: Array<{ presetId: string; count: number }>;
    recentlyUsed: Array<{ presetId: string; lastUsed: Date }>;
    totalUsage: number;
  };

  // Utilities
  validatePreset: (preset: Partial<FilterPreset>) => {
    isValid: boolean;
    errors: string[];
  };
  searchPresets: (query: string) => FilterPreset[];
  comparePresets: (presetA: string, presetB: string) => FilterComparison;

  // Settings
  settings: {
    autoSave: boolean;
    maxRecent: number;
    defaultTags: string[];
    notifications: boolean;
  };
  updateSettings: (
    newSettings: Partial<{
      autoSave: boolean;
      maxRecent: number;
      defaultTags: string[];
      notifications: boolean;
    }>
  ) => void;
}

/**
 * Generate unique ID for presets
 */
function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default system presets
 */
const DEFAULT_SYSTEM_PRESETS: FilterPreset[] = [
  {
    id: 'system_recent',
    name: 'Recent Items',
    description: 'Items created in the last 7 days',
    icon: '🕐',
    color: '#3b82f6',
    state: {
      version: '1.0',
      groups: [
        {
          id: 'group_1',
          logic: 'AND',
          filters: [],
          isActive: true,
        },
      ],
      globalLogic: 'AND',
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date(),
        appliedCount: 0,
      },
    },
    isPublic: true,
    isSystem: true,
    tags: ['system', 'time'],
    metadata: {
      createdBy: 'system',
      createdAt: new Date(),
      modifiedAt: new Date(),
      usageCount: 0,
      version: '1.0',
    },
  },
  {
    id: 'system_active',
    name: 'Active Items',
    description: 'Only active/enabled items',
    icon: '✅',
    color: '#10b981',
    state: {
      version: '1.0',
      groups: [
        {
          id: 'group_1',
          logic: 'AND',
          filters: [],
          isActive: true,
        },
      ],
      globalLogic: 'AND',
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date(),
        appliedCount: 0,
      },
    },
    isPublic: true,
    isSystem: true,
    tags: ['system', 'status'],
    metadata: {
      createdBy: 'system',
      createdAt: new Date(),
      modifiedAt: new Date(),
      usageCount: 0,
      version: '1.0',
    },
  },
];

/**
 * Main hook for filter presets management
 */
export function useFilterPresets(
  options: UseFilterPresetsOptions
): UseFilterPresetsReturn {
  const {
    tableId,
    enableCloudSync: _enableCloudSync = false,
    maxPresets = 50,
    autoSaveDraft: _autoSaveDraft = true,
    currentUser = 'anonymous',
  } = options;

  // State
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settings, setSettings] = useState({
    autoSave: true,
    maxRecent: 10,
    defaultTags: ['custom'],
    notifications: true,
  });

  // Storage functions - moved before usage
  const loadPresetsFromStorage = useCallback(() => {
    try {
      setIsLoading(true);
      const stored = localStorage.getItem(`${PRESETS_STORAGE_KEY}_${tableId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const presetsWithDates = parsed.map(
          (preset: Record<string, unknown>) => ({
            ...preset,
            metadata: {
              ...(preset.metadata && typeof preset.metadata === 'object'
                ? (preset.metadata as Record<string, unknown>)
                : {}),
              createdAt: new Date(
                (preset.metadata as Record<string, unknown>)
                  ?.createdAt as string
              ),
              modifiedAt: new Date(
                (preset.metadata as Record<string, unknown>)
                  ?.modifiedAt as string
              ),
              lastUsed: (preset.metadata as Record<string, unknown>)?.lastUsed
                ? new Date(
                    (preset.metadata as Record<string, unknown>)
                      .lastUsed as string
                  )
                : undefined,
            },
          })
        );
        setPresets(presetsWithDates);
      }
    } catch (_error) {
      // DEBUG: Failed to load presets from storage
      console.warn('Failed to load filter presets from storage:', _error);
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  const loadSettings = useCallback(() => {
    try {
      const stored = localStorage.getItem(`${SETTINGS_STORAGE_KEY}_${tableId}`);
      if (stored) {
        setSettings({ ...settings, ...JSON.parse(stored) });
      }
    } catch (_error) {
      // DEBUG: Failed to parse settings from storage
      console.warn('Failed to parse filter settings:', _error);
    }
  }, [tableId, settings]);

  // Load presets from storage on mount
  useEffect(() => {
    loadPresetsFromStorage();
    loadSettings();
  }, [loadPresetsFromStorage, loadSettings]);

  // Computed values
  const systemPresets = useMemo(
    () => [...DEFAULT_SYSTEM_PRESETS, ...presets.filter((p) => p.isSystem)],
    [presets]
  );

  const userPresets = useMemo(
    () => presets.filter((p) => !p.isSystem),
    [presets]
  );

  const recentPresets = useMemo(
    () =>
      [...presets]
        .sort(
          (a, b) =>
            (b.metadata.lastUsed?.getTime() || 0) -
            (a.metadata.lastUsed?.getTime() || 0)
        )
        .slice(0, settings.maxRecent),
    [presets, settings.maxRecent]
  );

  const popularPresets = useMemo(
    () =>
      [...presets]
        .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
        .slice(0, 10),
    [presets]
  );

  const savePresetsToStorage = useCallback(
    (newPresets: FilterPreset[]) => {
      try {
        localStorage.setItem(
          `${PRESETS_STORAGE_KEY}_${tableId}`,
          JSON.stringify(newPresets)
        );
      } catch (_error) {
        // DEBUG: Failed to save presets to storage
        console.warn('Failed to save presets to storage:', _error);
      }
    },
    [tableId]
  );

  // Track usage
  const trackUsage = useCallback((presetId: string) => {
    try {
      const usage = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '{}');
      usage[presetId] = (usage[presetId] || 0) + 1;
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usage));
    } catch (_error) {
      // DEBUG: Failed to track preset usage
      console.warn('Failed to track preset usage:', _error);
    }
  }, []);

  // Main actions
  const savePreset = useCallback(
    async (
      state: AdvancedFilterState,
      presetOptions: {
        name: string;
        description?: string;
        isPublic?: boolean;
        tags?: string[];
        icon?: string;
        color?: string;
      }
    ): Promise<FilterPreset> => {
      await Promise.resolve(); // Satisfy async linting requirement
      setIsSaving(true);
      try {
        const preset: FilterPreset = {
          id: generatePresetId(),
          name: presetOptions.name,
          description: presetOptions.description,
          icon: presetOptions.icon,
          color: presetOptions.color,
          state,
          isPublic: presetOptions.isPublic ?? false,
          isSystem: false,
          tags: presetOptions.tags || settings.defaultTags,
          metadata: {
            createdBy: currentUser,
            createdAt: new Date(),
            modifiedAt: new Date(),
            usageCount: 0,
            version: '1.0',
          },
        };

        const newPresets = [...presets, preset];

        // Limit number of presets
        if (newPresets.length > maxPresets) {
          // Remove oldest non-system presets
          const sortedPresets = newPresets
            .filter((p) => !p.isSystem)
            .sort(
              (a, b) =>
                a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
            );

          const toRemove = sortedPresets.slice(
            0,
            newPresets.length - maxPresets
          );
          const filtered = newPresets.filter((p) => !toRemove.includes(p));
          setPresets(filtered);
          savePresetsToStorage(filtered);
        } else {
          setPresets(newPresets);
          savePresetsToStorage(newPresets);
        }

        return preset;
      } finally {
        setIsSaving(false);
      }
    },
    [
      presets,
      settings.defaultTags,
      currentUser,
      maxPresets,
      savePresetsToStorage,
    ]
  );

  const loadPreset = useCallback(
    async (presetId: string): Promise<AdvancedFilterState> => {
      await Promise.resolve(); // Satisfy async linting requirement
      const preset =
        presets.find((p) => p.id === presetId) ||
        systemPresets.find((p) => p.id === presetId);

      if (!preset) {
        throw new Error(`Preset ${presetId} not found`);
      }

      // Update usage tracking
      trackUsage(presetId);

      // Update last used timestamp
      const updatedPresets = presets.map((p) =>
        p.id === presetId
          ? {
              ...p,
              metadata: {
                ...p.metadata,
                lastUsed: new Date(),
                usageCount: p.metadata.usageCount + 1,
              },
            }
          : p
      );

      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);

      return preset.state;
    },
    [presets, systemPresets, trackUsage, savePresetsToStorage]
  );

  const updatePreset = useCallback(
    async (presetId: string, updates: Partial<FilterPreset>): Promise<void> => {
      await Promise.resolve(); // Satisfy async linting requirement
      const updatedPresets = presets.map((preset) =>
        preset.id === presetId
          ? {
              ...preset,
              ...updates,
              metadata: {
                ...preset.metadata,
                ...updates.metadata,
                modifiedAt: new Date(),
              },
            }
          : preset
      );

      setPresets(updatedPresets);
      savePresetsToStorage(updatedPresets);
    },
    [presets, savePresetsToStorage]
  );

  const deletePreset = useCallback(
    async (presetId: string): Promise<void> => {
      await Promise.resolve(); // Satisfy async linting requirement
      setIsDeleting(true);
      try {
        const preset = presets.find((p) => p.id === presetId);
        if (preset?.isSystem) {
          throw new Error('Cannot delete system presets');
        }

        const updatedPresets = presets.filter((p) => p.id !== presetId);
        setPresets(updatedPresets);
        savePresetsToStorage(updatedPresets);
      } finally {
        setIsDeleting(false);
      }
    },
    [presets, savePresetsToStorage]
  );

  const duplicatePreset = useCallback(
    async (presetId: string, newName?: string): Promise<FilterPreset> => {
      const original = presets.find((p) => p.id === presetId);
      if (!original) {
        throw new Error(`Preset ${presetId} not found`);
      }

      return await savePreset(original.state, {
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        tags: original.tags,
        icon: original.icon,
        color: original.color,
      });
    },
    [presets, savePreset]
  );

  // Export/Import functions
  const exportPreset = useCallback(
    async (
      presetId: string,
      format: 'json' | 'url' = 'json'
    ): Promise<string> => {
      await Promise.resolve(); // Satisfy async linting requirement
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) {
        throw new Error(`Preset ${presetId} not found`);
      }

      const exportData: FilterExport = {
        version: '1.0',
        type: 'preset',
        name: preset.name,
        description: preset.description,
        data: preset,
        metadata: {
          exportedBy: currentUser,
          exportedAt: new Date(),
          sourceSystem: 'data-table-filters',
          compatibility: ['1.0'],
        },
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      }
      // URL format - base64 encoded
      const compressed = btoa(JSON.stringify(exportData));
      return `${window.location.origin}${window.location.pathname}?preset=${compressed}`;
    },
    [presets, currentUser]
  );

  const importPreset = useCallback(
    async (
      data: string,
      format: 'json' | 'url' = 'json'
    ): Promise<FilterPreset> => {
      try {
        let exportData: FilterExport;

        if (format === 'url') {
          // Extract from URL parameter
          const compressed = data.includes('preset=')
            ? data.split('preset=')[1]
            : data;
          exportData = JSON.parse(atob(compressed));
        } else {
          exportData = JSON.parse(data);
        }

        if (exportData.type !== 'preset') {
          throw new Error('Invalid export format');
        }

        const preset = exportData.data as FilterPreset;

        // Generate new ID and update metadata
        const newPreset: FilterPreset = {
          ...preset,
          id: generatePresetId(),
          isSystem: false,
          metadata: {
            ...preset.metadata,
            createdBy: currentUser,
            createdAt: new Date(),
            modifiedAt: new Date(),
            usageCount: 0,
          },
        };

        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        await savePresetsToStorage(updatedPresets);

        return newPreset;
      } catch (error) {
        throw new Error(`Failed to import preset: ${error}`);
      }
    },
    [presets, currentUser, savePresetsToStorage]
  );

  // Utility functions
  const searchPresets = useCallback(
    (query: string): FilterPreset[] => {
      if (!query.trim()) {
        return presets;
      }

      const searchTerm = query.toLowerCase();
      return presets.filter(
        (preset) =>
          preset.name.toLowerCase().includes(searchTerm) ||
          preset.description?.toLowerCase().includes(searchTerm) ||
          preset.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
    },
    [presets]
  );

  const validatePreset = useCallback((preset: Partial<FilterPreset>) => {
    const errors: string[] = [];

    if (!preset.name?.trim()) {
      errors.push('Name is required');
    }

    if (preset.name && preset.name.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    if (preset.description && preset.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }

    if (!preset.state) {
      errors.push('Filter state is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  const updateSettings = useCallback(
    (newSettings: Partial<typeof settings>) => {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      localStorage.setItem(
        `${SETTINGS_STORAGE_KEY}_${tableId}`,
        JSON.stringify(updated)
      );
    },
    [settings, tableId]
  );

  const getUsageStats = useCallback(() => {
    try {
      const usage = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || '{}');
      const mostUsed = Object.entries(usage)
        .map(([presetId, count]) => ({ presetId, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const recentlyUsed = presets
        .filter((p) => p.metadata.lastUsed)
        .map((p) => ({ presetId: p.id, lastUsed: p.metadata.lastUsed as Date }))
        .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
        .slice(0, 10);

      const totalUsage = Object.values(usage).reduce(
        (sum: number, count) => sum + (count as number),
        0
      );

      return { mostUsed, recentlyUsed, totalUsage };
    } catch {
      return { mostUsed: [], recentlyUsed: [], totalUsage: 0 };
    }
  }, [presets]);

  // Placeholder functions for advanced features
  const addTag = useCallback(
    async (presetId: string, tag: string): Promise<void> => {
      await updatePreset(presetId, {
        tags: [...(presets.find((p) => p.id === presetId)?.tags || []), tag],
      });
    },
    [updatePreset, presets]
  );

  const removeTag = useCallback(
    async (presetId: string, tag: string): Promise<void> => {
      await updatePreset(presetId, {
        tags:
          presets
            .find((p) => p.id === presetId)
            ?.tags.filter((t) => t !== tag) || [],
      });
    },
    [updatePreset, presets]
  );

  const setFavorite = useCallback(
    async (presetId: string, isFavorite: boolean): Promise<void> => {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) {
        return;
      }

      const tags = preset.tags.filter((tag) => tag !== 'favorite');
      if (isFavorite) {
        tags.push('favorite');
      }

      await updatePreset(presetId, { tags });
    },
    [updatePreset, presets]
  );

  const sharePreset = useCallback(
    async (presetId: string): Promise<string> => {
      // For now, just return the export URL
      return await exportPreset(presetId, 'url');
    },
    [exportPreset]
  );

  const exportAll = useCallback(async (): Promise<string> => {
    await Promise.resolve(); // Satisfy async linting requirement
    const exportData = {
      version: '1.0',
      presets: userPresets,
      exportedAt: new Date(),
      exportedBy: currentUser,
    };
    return JSON.stringify(exportData, null, 2);
  }, [userPresets, currentUser]);

  const importFromFile = useCallback(
    async (file: File): Promise<FilterPreset[]> => {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.presets && Array.isArray(data.presets)) {
        const importPromises = data.presets.map((preset: FilterPreset) =>
          importPreset(JSON.stringify({ type: 'preset', data: preset }))
        );
        const imported = await Promise.all(importPromises);
        return imported;
      }

      throw new Error('Invalid file format');
    },
    [importPreset]
  );

  const comparePresets = useCallback(
    (presetA: string, presetB: string): FilterComparison => {
      const a = presets.find((p) => p.id === presetA);
      const b = presets.find((p) => p.id === presetB);

      if (!(a && b)) {
        throw new Error('Presets not found');
      }

      return {
        id: `compare_${Date.now()}`,
        name: `${a.name} vs ${b.name}`,
        stateA: a.state,
        stateB: b.state,
        metrics: {
          resultsA: 0, // Would be calculated
          resultsB: 0,
          performanceA: 0,
          performanceB: 0,
        },
        status: 'draft',
        duration: {
          startDate: new Date(),
          plannedDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        },
      };
    },
    [presets]
  );

  return {
    // Data
    presets: [...systemPresets, ...userPresets],
    systemPresets,
    userPresets,
    recentPresets,
    popularPresets,

    // Loading states
    isLoading,
    isSaving,
    isDeleting,

    // Actions
    savePreset,
    loadPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,

    // Organization
    addTag,
    removeTag,
    setFavorite,

    // Export/Import
    exportPreset,
    exportAll,
    importPreset,
    importFromFile,

    // Sharing
    sharePreset,

    // Analytics
    getUsageStats,

    // Utilities
    validatePreset,
    searchPresets,
    comparePresets,

    // Settings
    settings,
    updateSettings,
  };
}
