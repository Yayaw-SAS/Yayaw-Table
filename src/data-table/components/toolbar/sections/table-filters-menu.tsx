'use client';

import type { ColumnFiltersState } from '@tanstack/react-table';
import { Filter, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  StackMenuContent,
  StackMenuView,
} from '@/src/components/ui-custom/stack-menu';
import { useTranslations } from '../../../providers/table-provider';
import type {
  AdvancedFiltersState,
  ColumnsFilterConfig,
  FilterActions,
} from '../../../types/filter-types';
import { AdvancedFilterPanel } from '../../filters/advanced-filter-panel';

// Debug flag - activated for debugging advanced filters
const DEBUG = false;

export interface TableFiltersMenuProps {
  columnFilters: ColumnFiltersState;
  columns: {
    canFilter?: boolean;
    canGroup?: boolean;
    canHide?: boolean;
    canSort?: boolean;
    id: string;
    label: string;
  }[];
  invalidateTable: () => Promise<void>;
  setColumnFilters: (state: ColumnFiltersState) => void;
  tableId: string;
  // Props pour filtres avancés (optionnels)
  advancedFilters?: AdvancedFiltersState;
  advancedActions?: FilterActions;
  advancedColumnsConfig?: ColumnsFilterConfig;
  useAdvancedFilters?: boolean;
}

export function TableFiltersMenu({
  columnFilters,
  columns,
  invalidateTable: _invalidateTable,
  setColumnFilters,
  tableId: _tableId,
  advancedFilters = [],
  advancedActions,
  advancedColumnsConfig = {},
  useAdvancedFilters = false,
}: TableFiltersMenuProps) {
  const { t: _t } = useTranslations();

  // Debug logs
  useEffect(() => {
    if (DEBUG) {
      // DEBUG: Filters menu effect triggered
    }
  }, []);

  // Use advanced filters if enabled and we have the proper setup
  const hasAdvancedConfig =
    advancedColumnsConfig && Object.keys(advancedColumnsConfig).length > 0;

  if (DEBUG) {
    console.log('🔍 TableFiltersMenu Advanced Filters Check:', {
      useAdvancedFilters,
      hasAdvancedActions: !!advancedActions,
      advancedColumnsConfig,
      hasAdvancedConfig,
      'config keys': advancedColumnsConfig
        ? Object.keys(advancedColumnsConfig)
        : 'undefined',
    });
  }

  if (useAdvancedFilters && advancedActions && hasAdvancedConfig) {
    return (
      <StackMenuView name="filters">
        <StackMenuContent className="p-0">
          <AdvancedFilterPanel
            actions={{
              ...advancedActions,
              // Override addFilter to create inactive filters by default
              addFilter: (filter) => {
                console.log('🔧 Adding filter (inactive by default):', filter);
                advancedActions.addFilter({
                  ...filter,
                  isActive: false, // Start inactive until user configures it
                });
              },
            }}
            className="border-0"
            columnsConfig={advancedColumnsConfig}
            enableAnimations={true}
            filters={advancedFilters}
            maxVisibleFilters={5}
            popularColumns={['name', 'status', 'category']}
            recentColumns={[]}
            showAddButton={true}
            showClearButton={true}
            showPerformance={false}
            variant="modern"
          />
        </StackMenuContent>
      </StackMenuView>
    );
  }

  // Fallback to legacy filter interface
  return (
    <StackMenuView name="filters">
      <StackMenuContent>
        <div className="space-y-4">
          <div className="py-8 text-center text-muted-foreground">
            <Filter className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Advanced filters not available</p>
            <p className="text-xs">
              Enable advanced filters to use this feature
            </p>
          </div>

          {/* Show legacy column filters if any exist */}
          {columnFilters.length > 0 && (
            <div className="space-y-2">
              <Separator />
              <h4 className="font-medium text-sm">Legacy Filters</h4>
              {columnFilters.map((filter, index) => (
                <div
                  className="flex items-center gap-2 rounded-md border p-2"
                  key={`${filter.id}-${index}`}
                >
                  <span className="font-medium text-sm">{filter.id}</span>
                  <span className="text-muted-foreground text-xs">:</span>
                  <span className="text-sm">{String(filter.value)}</span>
                  <Button
                    className="ml-auto h-6 w-6 p-0"
                    onClick={() => {
                      const newFilters = columnFilters.filter(
                        (_, i) => i !== index
                      );
                      setColumnFilters(newFilters);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </StackMenuContent>
    </StackMenuView>
  );
}
