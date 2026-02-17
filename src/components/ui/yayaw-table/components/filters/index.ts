/**
 * Export all filter components
 */

export {
  AdvancedFacetedFilter as AdvancedFacetedFilterOriginal,
  CompactFacetedFilter,
} from "./advanced-faceted-filter";
// Keep original exports for backwards compatibility
export {
  AdvancedFilterPanel as AdvancedFilterPanelOriginal,
  CompactFilterPanel,
} from "./advanced-filter-panel";
export type { DateFilterProps } from "./date-filter";
export {
  CompactDateFilter,
  DateFilter,
  DateRangeShortcuts,
} from "./date-filter";
// Lightweight filter components (always loaded)
export { CompactFilterChip, EnhancedFilterChip } from "./enhanced-filter-chip";
export { FilterPresetsPanel as FilterPresetsPanelOriginal } from "./filter-presets-panel";
export type { FilterValueInputProps } from "./filter-value-input";
// Central filter input router
export {
  FilterValueInput,
  getDefaultFilterOperator,
  getDefaultFilterValue,
  isValidFilterValue,
} from "./filter-value-input";

// Heavy components - lazy loaded for performance
export {
  LazyAdvancedFacetedFilter as AdvancedFacetedFilter,
  LazyAdvancedFilterPanel as AdvancedFilterPanel,
  LazyFilterPresetsPanel as FilterPresetsPanel,
  LazyModernAddFilterDropdown as ModernAddFilterDropdown,
} from "./lazy-advanced-filter";
export {
  ModernAddFilterDropdown as ModernAddFilterDropdownOriginal,
  QuickAddFilterButton,
} from "./modern-add-filter-dropdown";
export {
  FilterEmptyState,
  FilterErrorState,
  FilterLoadingState,
  FilterNoResultsState,
  FilterPerformanceIndicator,
  FilterSuccessState,
} from "./modern-filter-states";
export type { MultiSelectFilterProps } from "./multi-select-filter";
export {
  CompactMultiSelectFilter,
  MultiSelectFilter,
} from "./multi-select-filter";
export type { NumberFilterProps } from "./number-filter";
export { CompactNumberFilter, NumberFilter } from "./number-filter";
export type { SelectFilterProps } from "./select-filter";
export { CompactSelectFilter, SelectFilter } from "./select-filter";
// Export types
export type { TextFilterProps } from "./text-filter";
// Main filter components
export { CompactTextFilter, TextFilter } from "./text-filter";
