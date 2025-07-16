/**
 * Multi-option filter component
 * Provides filtering for multi-option columns with tags and multiple selection
 */
'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ColumnOption, FilterOperators } from '../../types/filter-types';
import {
  DEFAULT_OPERATORS,
  FILTER_OPERATORS_LABELS,
} from '../../types/filter-types';

export interface MultiOptionFilterProps {
  /** Current filter value - array of selected values */
  value: string[];
  /** Current operator */
  operator: FilterOperators['multiOption'];
  /** Available operators (defaults to all multiOption operators) */
  operators?: readonly FilterOperators['multiOption'][];
  /** Available options */
  options: ColumnOption[];
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Callback when the value changes */
  onValueChange: (value: string[]) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators['multiOption']) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Whether to show faceted counts */
  showCounts?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum number of tags to show before showing count */
  maxDisplayedTags?: number;
}

/**
 * Multi-option filter component with operator selection and multiple option picker
 */
export function MultiOptionFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.multiOption,
  options,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  showCounts = true,
  placeholder = 'Select options...',
  maxDisplayedTags = 3,
}: MultiOptionFilterProps) {
  const [internalValue, setInternalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync internal value with prop
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle value change
  const handleValueChange = useCallback(
    (newValue: string[]) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Check if this operator needs a value input
  const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Handle option selection toggle
  const handleOptionToggle = useCallback(
    (optionValue: string) => {
      const newValue = internalValue.includes(optionValue)
        ? internalValue.filter((v) => v !== optionValue)
        : [...internalValue, optionValue];
      handleValueChange(newValue);
    },
    [internalValue, handleValueChange]
  );

  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allValues = filteredOptions.map((opt) => opt.value);
    handleValueChange(allValues);
  }, [filteredOptions, handleValueChange]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    handleValueChange([]);
  }, [handleValueChange]);

  // Get option by value
  const getOptionByValue = useCallback(
    (optionValue: string) => {
      return options.find((opt) => opt.value === optionValue);
    },
    [options]
  );

  // Format selected values for display
  const formatValueForDisplay = useCallback(() => {
    if (internalValue.length === 0) {
      return placeholder;
    }
    if (internalValue.length === 1) {
      const option = getOptionByValue(internalValue[0]);
      return option?.label || internalValue[0];
    }
    return `${internalValue.length} selected`;
  }, [internalValue, placeholder, getOptionByValue]);

  // Get displayed tags
  const displayedTags = useMemo(() => {
    const tags = internalValue.slice(0, maxDisplayedTags);
    const hasMore = internalValue.length > maxDisplayedTags;
    return {
      tags,
      hasMore,
      remainingCount: internalValue.length - maxDisplayedTags,
    };
  }, [internalValue, maxDisplayedTags]);

  return (
    <div className="space-y-3">
      {label && <Label className="font-medium text-sm">{label}</Label>}

      <div className="flex flex-col gap-3">
        {/* Operator selector */}
        {showOperator && (
          <Select
            disabled={disabled}
            onValueChange={(operatorValue) =>
              onOperatorChange(operatorValue as FilterOperators['multiOption'])
            }
            value={operator}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select operator..." />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {FILTER_OPERATORS_LABELS.multiOption[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Option picker */}
        {needsValue && (
          <div className="space-y-2">
            <Popover onOpenChange={setIsOpen} open={isOpen}>
              <PopoverTrigger asChild>
                <Button
                  aria-expanded={isOpen}
                  className="w-full justify-between"
                  disabled={disabled}
                  variant="outline"
                >
                  <span className="truncate">{formatValueForDisplay()}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-full p-0">
                <Command>
                  <CommandInput
                    onValueChange={setSearchTerm}
                    placeholder="Search options..."
                    value={searchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>No options found.</CommandEmpty>
                    <CommandGroup>
                      {/* Select/Clear all buttons */}
                      {filteredOptions.length > 1 && (
                        <>
                          <CommandItem
                            className="justify-center border-b"
                            onSelect={handleSelectAll}
                          >
                            Select All ({filteredOptions.length})
                          </CommandItem>
                          {internalValue.length > 0 && (
                            <CommandItem
                              className="mb-1 justify-center border-b"
                              onSelect={handleClearAll}
                            >
                              Clear All
                            </CommandItem>
                          )}
                        </>
                      )}

                      {filteredOptions.map((option) => {
                        const isSelected = internalValue.includes(option.value);

                        return (
                          <CommandItem
                            key={option.value}
                            onSelect={() => handleOptionToggle(option.value)}
                            value={option.value}
                          >
                            <div className="flex flex-1 items-center gap-2">
                              {option.icon && (
                                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                  {typeof option.icon === 'function' ? (
                                    <option.icon />
                                  ) : (
                                    option.icon
                                  )}
                                </span>
                              )}
                              <span className="flex-1">{option.label}</span>
                              {showCounts && option.count !== undefined && (
                                <Badge className="text-xs" variant="secondary">
                                  {option.count}
                                </Badge>
                              )}
                            </div>
                            <Check
                              className={cn(
                                'ml-auto h-4 w-4',
                                isSelected ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Selected tags display */}
            {internalValue.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {displayedTags.tags.map((selectedValue) => {
                  const option = getOptionByValue(selectedValue);
                  return (
                    <Badge
                      className="text-xs"
                      key={selectedValue}
                      variant="secondary"
                    >
                      {option?.icon && (
                        <span className="mr-1 flex h-3 w-3 items-center justify-center">
                          {typeof option.icon === 'function' ? (
                            <option.icon />
                          ) : (
                            option.icon
                          )}
                        </span>
                      )}
                      {option?.label || selectedValue}
                      <button
                        className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() => handleOptionToggle(selectedValue)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleOptionToggle(selectedValue);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        type="button"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  );
                })}

                {/* Show remaining count if there are more tags */}
                {displayedTags.hasMore && (
                  <Badge className="text-xs" variant="outline">
                    +{displayedTags.remainingCount} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info text for operators that don't need values */}
        {!needsValue && (
          <div className="text-muted-foreground text-sm italic">
            This filter will show rows where the field{' '}
            {operator === 'isEmpty' ? 'is empty' : 'is not empty'}.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact multi-option filter for use in filter chips
 */
export function CompactMultiOptionFilter({
  value,
  operator,
  options,
  onValueChange,
  disabled = false,
  placeholder = 'Select...',
  maxDisplayedTags = 2,
}: Pick<
  MultiOptionFilterProps,
  | 'value'
  | 'operator'
  | 'options'
  | 'onValueChange'
  | 'disabled'
  | 'placeholder'
  | 'maxDisplayedTags'
>) {
  const [internalValue, setInternalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const getOptionByValue = useCallback(
    (optionValue: string) => {
      return options.find((opt) => opt.value === optionValue);
    },
    [options]
  );

  const formatValueForDisplay = useCallback(() => {
    if (internalValue.length === 0) {
      return placeholder;
    }
    if (internalValue.length === 1) {
      const option = getOptionByValue(internalValue[0]);
      return option?.label || internalValue[0];
    }
    return `${internalValue.length} items`;
  }, [internalValue, placeholder, getOptionByValue]);

  const handleOptionToggle = useCallback(
    (optionValue: string) => {
      const newValue = internalValue.includes(optionValue)
        ? internalValue.filter((v) => v !== optionValue)
        : [...internalValue, optionValue];

      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [internalValue, onValueChange]
  );

  const needsValue = !['isEmpty', 'isNotEmpty'].includes(operator);

  if (!needsValue) {
    return (
      <span className="text-muted-foreground text-xs">
        {operator === 'isEmpty' ? 'is empty' : 'is not empty'}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <PopoverTrigger asChild>
          <Button
            className="h-6 max-w-32 justify-between px-2 font-normal text-xs"
            disabled={disabled}
            size="sm"
            variant="ghost"
          >
            <span className="truncate">{formatValueForDisplay()}</span>
            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-0">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = internalValue.includes(option.value);

                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => handleOptionToggle(option.value)}
                      value={option.value}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        {option.icon && (
                          <span className="flex h-3 w-3 flex-shrink-0 items-center justify-center">
                            {typeof option.icon === 'function' ? (
                              <option.icon />
                            ) : (
                              option.icon
                            )}
                          </span>
                        )}
                        <span className="flex-1 text-xs">{option.label}</span>
                      </div>
                      <Check
                        className={cn(
                          'ml-auto h-3 w-3',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Compact tags display */}
      {internalValue.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {internalValue.slice(0, maxDisplayedTags).map((selectedValue) => {
            const option = getOptionByValue(selectedValue);
            return (
              <Badge
                className="h-4 px-1 text-xs"
                key={selectedValue}
                variant="secondary"
              >
                {option?.label || selectedValue}
                <button
                  className="ml-1 rounded-full hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOptionToggle(selectedValue);
                  }}
                  type="button"
                >
                  <X className="h-2 w-2" />
                </button>
              </Badge>
            );
          })}
          {internalValue.length > maxDisplayedTags && (
            <Badge className="h-4 px-1 text-xs" variant="outline">
              +{internalValue.length - maxDisplayedTags}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
