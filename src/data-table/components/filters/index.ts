/**
 * Export all filter components
 */

// Main filter components
export { TextFilter, CompactTextFilter } from './text-filter'
export { NumberFilter, CompactNumberFilter } from './number-filter'
export { DateFilter, CompactDateFilter, DateRangeShortcuts } from './date-filter'
export { OptionFilter, CompactOptionFilter } from './option-filter'
export { MultiOptionFilter, CompactMultiOptionFilter } from './multi-option-filter'

// Central filter input router
export { 
    FilterValueInput,
    getDefaultFilterValue,
    getDefaultFilterOperator,
    isValidFilterValue
} from './filter-value-input'

// Lightweight filter components (always loaded)
export { EnhancedFilterChip, CompactFilterChip } from './enhanced-filter-chip'
export { 
    FilterLoadingState, 
    FilterEmptyState, 
    FilterErrorState,
    FilterSuccessState,
    FilterNoResultsState,
    FilterPerformanceIndicator 
} from './modern-filter-states'

// Heavy components - lazy loaded for performance
export {
    LazyAdvancedFilterPanel as AdvancedFilterPanel,
    LazyFilterPresetsPanel as FilterPresetsPanel,
    LazyAdvancedFacetedFilter as AdvancedFacetedFilter,
    LazyModernAddFilterDropdown as ModernAddFilterDropdown
} from './lazy-advanced-filter'

// Keep original exports for backwards compatibility
export { AdvancedFilterPanel as AdvancedFilterPanelOriginal, CompactFilterPanel } from './advanced-filter-panel'
export { ModernAddFilterDropdown as ModernAddFilterDropdownOriginal, QuickAddFilterButton } from './modern-add-filter-dropdown'
export { FilterPresetsPanel as FilterPresetsPanelOriginal } from './filter-presets-panel'
export { AdvancedFacetedFilter as AdvancedFacetedFilterOriginal, CompactFacetedFilter } from './advanced-faceted-filter'

// Export types
export type { TextFilterProps } from './text-filter'
export type { NumberFilterProps } from './number-filter'
export type { DateFilterProps } from './date-filter'
export type { OptionFilterProps } from './option-filter'
export type { MultiOptionFilterProps } from './multi-option-filter'
export type { FilterValueInputProps } from './filter-value-input' 