/**
 * Filter value input component
 * Central component that routes to the appropriate filter input based on data type
 */
'use client';

import { useCallback } from 'react';
import type {
  ColumnDataType,
  ColumnFilterConfig,
  FilterOperators,
  FilterValues,
} from '../../types/filter-types';

import { CompactDateFilter, DateFilter } from './date-filter';
import {
  CompactMultiOptionFilter,
  MultiOptionFilter,
} from './multi-option-filter';
import { CompactNumberFilter, NumberFilter } from './number-filter';
import { CompactOptionFilter, OptionFilter } from './option-filter';
import { CompactTextFilter, TextFilter } from './text-filter';

export interface FilterValueInputProps<
  TType extends ColumnDataType = ColumnDataType,
> {
  /** The column data type */
  type: TType;
  /** Current filter value */
  value: FilterValues<TType>;
  /** Current operator */
  operator: FilterOperators[TType];
  /** Column configuration */
  config: ColumnFilterConfig<TType>;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Callback when the value changes */
  onValueChange: (value: FilterValues<TType>) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators[TType]) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Whether to use compact mode */
  compact?: boolean;
  /** Render value pickers inline (no popovers) */
  inline?: boolean;
}

/**
 * Filter value input component that routes to the appropriate filter based on data type
 */
export function FilterValueInput<TType extends ColumnDataType>({
  type,
  value,
  operator,
  config,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  compact = false,
  inline = false,
}: FilterValueInputProps<TType>) {
  // Type-safe value change handler
  const handleValueChange = useCallback(
    (newValue: unknown) => {
      onValueChange(newValue as FilterValues<TType>);
    },
    [onValueChange]
  );

  // Type-safe operator change handler
  const handleOperatorChange = useCallback(
    (newOperator: unknown) => {
      onOperatorChange(newOperator as FilterOperators[TType]);
    },
    [onOperatorChange]
  );

  // Route to the appropriate filter component based on type
  switch (type) {
    case 'text': {
      const textValue = value as string;
      const textOperator = operator as FilterOperators['text'];

      if (compact) {
        return (
          <CompactTextFilter
            disabled={disabled}
            onValueChange={handleValueChange}
            operator={textOperator}
            placeholder={config.placeholder}
            value={textValue}
          />
        );
      }

      return (
        <TextFilter
          disabled={disabled}
          label={label}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
          operator={textOperator}
          operators={config.operators as readonly FilterOperators['text'][]}
          placeholder={config.placeholder}
          debounceMs={0}
          showOperator={showOperator}
          value={textValue}
        />
      );
    }

    case 'number': {
      const numberValue = value as number | [number, number];
      const numberOperator = operator as FilterOperators['number'];

      if (compact) {
        return (
          <CompactNumberFilter
            disabled={disabled}
            onValueChange={handleValueChange}
            operator={numberOperator}
            placeholder={config.placeholder}
            value={numberValue}
          />
        );
      }

      return (
        <NumberFilter
          disabled={disabled}
          label={label}
          max={config.max}
          min={config.min}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
          operator={numberOperator}
          operators={config.operators as readonly FilterOperators['number'][]}
          placeholder={config.placeholder}
          showOperator={showOperator}
          value={numberValue}
        />
      );
    }

    case 'date': {
      const dateValue = value as Date | [Date, Date];
      const dateOperator = operator as FilterOperators['date'];

      if (compact) {
        return (
          <CompactDateFilter
            disabled={disabled}
            onValueChange={handleValueChange}
            operator={dateOperator}
            value={dateValue}
          />
        );
      }

      return (
        <DateFilter
          inline={inline}
          disabled={disabled}
          label={label}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
          operator={dateOperator}
          operators={config.operators as readonly FilterOperators['date'][]}
          showOperator={showOperator}
          value={dateValue}
        />
      );
    }

    case 'option': {
      const optionValue = value as string | string[];
      const optionOperator = operator as FilterOperators['option'];

      if (!config.options) {
        return null;
      }

      if (compact) {
        return (
          <CompactOptionFilter
            disabled={disabled}
            onValueChange={handleValueChange}
            operator={optionOperator}
            options={config.options}
            placeholder={config.placeholder}
            value={optionValue}
          />
        );
      }

      return (
        <OptionFilter
          inline={inline}
          disabled={disabled}
          label={label}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
          operator={optionOperator}
          operators={config.operators as readonly FilterOperators['option'][]}
          options={config.options}
          placeholder={config.placeholder}
          showCounts={config.faceted}
          showOperator={showOperator}
          value={optionValue}
        />
      );
    }

    case 'multiOption': {
      const multiOptionValue = value as string[];
      const multiOptionOperator = operator as FilterOperators['multiOption'];

      if (!config.options) {
        return null;
      }

      if (compact) {
        return (
          <CompactMultiOptionFilter
            disabled={disabled}
            onValueChange={handleValueChange}
            operator={multiOptionOperator}
            options={config.options}
            placeholder={config.placeholder}
            value={multiOptionValue}
          />
        );
      }

      return (
        <MultiOptionFilter
          inline={inline}
          disabled={disabled}
          label={label}
          onOperatorChange={handleOperatorChange}
          onValueChange={handleValueChange}
          operator={multiOptionOperator}
          operators={
            config.operators as readonly FilterOperators['multiOption'][]
          }
          options={config.options}
          placeholder={config.placeholder}
          showCounts={config.faceted}
          showOperator={showOperator}
          value={multiOptionValue}
        />
      );
    }

    default:
      return null;
  }
}

/**
 * Helper to get the default value for a filter type
 */
export function getDefaultFilterValue<TType extends ColumnDataType>(
  type: TType,
  operator: FilterOperators[TType]
): FilterValues<TType> {
  switch (type) {
    case 'text':
      return '' as FilterValues<TType>;

    case 'number': {
      const numOperator = operator as FilterOperators['number'];
      if (numOperator === 'between') {
        return [0, 100] as FilterValues<TType>;
      }
      return 0 as FilterValues<TType>;
    }

    case 'date': {
      const dateOperator = operator as FilterOperators['date'];
      if (dateOperator === 'between') {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return [now, tomorrow] as FilterValues<TType>;
      }
      return new Date() as FilterValues<TType>;
    }

    case 'option': {
      const optOperator = operator as FilterOperators['option'];
      if (['isAnyOf', 'isNoneOf'].includes(optOperator)) {
        return [] as FilterValues<TType>;
      }
      return '' as FilterValues<TType>;
    }

    case 'multiOption':
      return [] as FilterValues<TType>;

    default:
      return '' as FilterValues<TType>;
  }
}

/**
 * Helper to get the default operator for a filter type
 */
export function getDefaultFilterOperator<TType extends ColumnDataType>(
  type: TType
): FilterOperators[TType] {
  switch (type) {
    case 'text':
      return 'contains' as FilterOperators[TType];
    case 'number':
      return 'equals' as FilterOperators[TType];
    case 'date':
      return 'equals' as FilterOperators[TType];
    case 'option':
      return 'is' as FilterOperators[TType];
    case 'multiOption':
      return 'contains' as FilterOperators[TType];
    default:
      return 'equals' as FilterOperators[TType];
  }
}

/**
 * Helper to validate a filter value for a given type and operator
 */
export function isValidFilterValue<TType extends ColumnDataType>(
  type: TType,
  operator: FilterOperators[TType],
  value: FilterValues<TType>
): boolean {
  // Operators that don't need values are always valid
  if (['isEmpty', 'isNotEmpty'].includes(operator as string)) {
    return true;
  }

  switch (type) {
    case 'text':
      return typeof value === 'string';

    case 'number': {
      if (operator === 'between') {
        return (
          Array.isArray(value) &&
          value.length === 2 &&
          typeof value[0] === 'number' &&
          typeof value[1] === 'number'
        );
      }
      return typeof value === 'number' && !Number.isNaN(value);
    }

    case 'date': {
      if (operator === 'between') {
        return (
          Array.isArray(value) &&
          value.length === 2 &&
          value[0] instanceof Date &&
          value[1] instanceof Date
        );
      }
      return (
        value != null &&
        Object.prototype.toString.call(value) === '[object Date]' &&
        !Number.isNaN((value as Date).getTime())
      );
    }

    case 'option': {
      if (['isAnyOf', 'isNoneOf'].includes(operator as string)) {
        return Array.isArray(value);
      }
      return typeof value === 'string';
    }

    case 'multiOption':
      return Array.isArray(value);

    default:
      return false;
  }
}
