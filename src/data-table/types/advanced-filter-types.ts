/**
 * Advanced Filter Types - Phase 5
 * Extended types for advanced filtering features
 */

import type {
  AdvancedFilterModel,
  ColumnDataType,
  FilterOperators,
} from './filter-types';

/**
 * Filter Logic Operators
 */
export type FilterLogicOperator = 'AND' | 'OR';

/**
 * Filter Group - for complex logic combinations
 */
export interface FilterGroup {
  id: string;
  name?: string;
  logic: FilterLogicOperator;
  filters: (AdvancedFilterModel | FilterGroup)[];
  isActive: boolean;
  isCollapsed?: boolean;
}

/**
 * Advanced Filter State with groups and logic
 */
export interface AdvancedFilterState {
  version: string;
  groups: FilterGroup[];
  globalLogic: FilterLogicOperator;
  metadata: {
    createdAt: Date;
    modifiedAt: Date;
    appliedCount: number;
    resultCount?: number;
  };
}

/**
 * Filter Preset - saved filter configurations
 */
export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  state: AdvancedFilterState;
  isPublic: boolean;
  isSystem: boolean;
  tags: string[];
  metadata: {
    createdBy: string;
    createdAt: Date;
    modifiedAt: Date;
    usageCount: number;
    lastUsed?: Date;
    version: string;
  };
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
}

/**
 * Faceted filter data with enhanced metadata
 */
export interface FacetedData {
  value: unknown;
  label: string;
  count: number;
  percentage: number;
  isSelected: boolean;
  isDisabled: boolean;
  metadata?: {
    description?: string;
    category?: string;
    priority?: number;
    trending?: boolean;
    new?: boolean;
  };
  children?: FacetedData[];
  parent?: string;
}

/**
 * Enhanced column filter configuration
 */
export interface AdvancedColumnFilterConfig {
  // Base configuration
  type: ColumnDataType;
  filterable: boolean;
  label?: string;
  placeholder?: string;
  description?: string;

  // Faceted options
  faceted: boolean;
  facetedOptions?: {
    maxOptions: number;
    sortBy: 'count' | 'label' | 'value' | 'custom';
    sortOrder: 'asc' | 'desc';
    showCount: boolean;
    showPercentage: boolean;
    searchable: boolean;
    hierarchical: boolean;
    groupBy?: string;
    customSort?: (a: FacetedData, b: FacetedData) => number;
  };

  // Smart suggestions
  suggestions: boolean;
  suggestionsOptions?: {
    maxSuggestions: number;
    sources: ('history' | 'popular' | 'similar' | 'trending')[];
    minUsageCount: number;
    includeEmpty: boolean;
  };

  // Validation and constraints
  validation?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: unknown) => boolean | string;
  };

  // Performance options
  performance?: {
    debounceMs: number;
    cacheResults: boolean;
    preload: boolean;
    virtualizeOptions: boolean;
  };

  // Advanced features
  features?: {
    allowMultiple: boolean;
    allowGroups: boolean;
    allowNegation: boolean;
    allowFuzzySearch: boolean;
    caseSensitive: boolean;
  };
}

/**
 * Filter suggestion
 */
export interface FilterSuggestion {
  id: string;
  type: 'preset' | 'smart' | 'history' | 'popular';
  title: string;
  description?: string;
  icon?: string;
  confidence: number;
  filters: AdvancedFilterModel[];
  metadata: {
    usageCount: number;
    lastUsed?: Date;
    source: string;
    category?: string;
  };
  preview?: {
    resultCount: number;
    sampleData: unknown[];
  };
}

/**
 * Filter analytics and insights
 */
export interface FilterAnalytics {
  performance: {
    averageFilterTime: number;
    slowestFilters: Array<{
      filterId: string;
      averageTime: number;
      usageCount: number;
    }>;
    optimizationSuggestions: string[];
  };
  usage: {
    mostUsedFilters: Array<{
      columnId: string;
      operator: FilterOperators[ColumnDataType];
      usageCount: number;
      lastUsed: Date;
    }>;
    popularPresets: Array<{
      presetId: string;
      usageCount: number;
      averageResultCount: number;
    }>;
    userBehavior: {
      averageFiltersPerSession: number;
      mostCommonCombinations: Array<{
        filters: string[];
        frequency: number;
      }>;
    };
  };
  data: {
    totalRecords: number;
    filteredRecords: number;
    filterEffectiveness: number;
    dataDistribution: Record<
      string,
      {
        uniqueValues: number;
        nullValues: number;
        distribution: Array<{ value: unknown; count: number }>;
      }
    >;
  };
}

/**
 * Filter export/import formats
 */
export interface FilterExport {
  version: string;
  type: 'preset' | 'state' | 'analytics';
  name: string;
  description?: string;
  data: FilterPreset | AdvancedFilterState | FilterAnalytics;
  metadata: {
    exportedBy: string;
    exportedAt: Date;
    sourceSystem: string;
    compatibility: string[];
  };
}

/**
 * Bulk filter operations
 */
export interface BulkFilterOperation {
  id: string;
  type: 'apply' | 'remove' | 'toggle' | 'update';
  filters: string[]; // filter IDs
  options: {
    logic?: FilterLogicOperator;
    preserveExisting?: boolean;
    validate?: boolean;
    silent?: boolean;
  };
  progress?: {
    total: number;
    completed: number;
    errors: string[];
  };
}

/**
 * Filter comparison for A/B testing
 */
export interface FilterComparison {
  id: string;
  name: string;
  stateA: AdvancedFilterState;
  stateB: AdvancedFilterState;
  metrics: {
    resultsA: number;
    resultsB: number;
    performanceA: number;
    performanceB: number;
    userPreference?: 'A' | 'B' | 'neither';
  };
  status: 'draft' | 'running' | 'completed' | 'archived';
  duration: {
    startDate: Date;
    endDate?: Date;
    plannedDuration: number;
  };
}

/**
 * Advanced filter hooks return type
 */
export interface AdvancedFilterHookReturn {
  // State
  state: AdvancedFilterState;
  presets: FilterPreset[];
  suggestions: FilterSuggestion[];
  analytics: FilterAnalytics;

  // Actions
  actions: {
    // State management
    setState: (state: AdvancedFilterState) => void;
    updateState: (updates: Partial<AdvancedFilterState>) => void;
    resetState: () => void;

    // Group management
    addGroup: (group: Omit<FilterGroup, 'id'>) => void;
    updateGroup: (groupId: string, updates: Partial<FilterGroup>) => void;
    removeGroup: (groupId: string) => void;
    moveFilter: (filterId: string, targetGroupId: string) => void;

    // Logic operations
    setGlobalLogic: (logic: FilterLogicOperator) => void;
    setGroupLogic: (groupId: string, logic: FilterLogicOperator) => void;

    // Presets
    savePreset: (
      preset: Omit<FilterPreset, 'id' | 'metadata'>
    ) => Promise<FilterPreset>;
    loadPreset: (presetId: string) => Promise<void>;
    deletePreset: (presetId: string) => Promise<void>;
    updatePreset: (
      presetId: string,
      updates: Partial<FilterPreset>
    ) => Promise<void>;

    // Export/Import
    exportState: (format: 'json' | 'url' | 'csv') => Promise<string>;
    importState: (
      data: string,
      format: 'json' | 'url' | 'csv'
    ) => Promise<void>;

    // Bulk operations
    bulkApply: (
      filters: AdvancedFilterModel[],
      logic?: FilterLogicOperator
    ) => Promise<void>;
    bulkRemove: (filterIds: string[]) => Promise<void>;
    bulkToggle: (filterIds: string[]) => Promise<void>;

    // Analytics
    refreshAnalytics: () => Promise<void>;
    trackUsage: (action: string, metadata?: Record<string, unknown>) => void;
  };

  // Computed
  computed: {
    hasActiveFilters: boolean;
    activeFiltersCount: number;
    isValidState: boolean;
    canUndo: boolean;
    canRedo: boolean;
    estimatedResultCount: number;
    performanceScore: number;
  };

  // Utils
  utils: {
    validateState: (state: AdvancedFilterState) => {
      isValid: boolean;
      errors: string[];
    };
    optimizeState: (state: AdvancedFilterState) => AdvancedFilterState;
    compareStates: (
      stateA: AdvancedFilterState,
      stateB: AdvancedFilterState
    ) => FilterComparison;
    generateShareUrl: (state: AdvancedFilterState) => string;
    cloneState: (state: AdvancedFilterState) => AdvancedFilterState;
  };
}
