/**
 * Option filter component
 * Provides filtering for single-option columns with search and faceted counts
 */
"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "../../providers/table-provider";
import type { ColumnOption, FilterOperators } from "../../types/filter-types";
import {
  DEFAULT_OPERATORS,
  FILTER_OPERATORS_LABELS,
} from "../../types/filter-types";
import {
  getTranslatedOperatorLabel,
  translateWithFallback,
} from "./i18n-utils";

export interface OptionFilterProps {
  /** Current filter value - single value or array for isAnyOf/isNoneOf */
  value: string | string[];
  /** Current operator */
  operator: FilterOperators["option"];
  /** Available operators (defaults to all option operators) */
  operators?: readonly FilterOperators["option"][];
  /** Available options */
  options: ColumnOption[];
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Callback when the value changes */
  onValueChange: (value: string | string[]) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators["option"]) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Whether to show faceted counts */
  showCounts?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Render picker inline instead of popover */
  inline?: boolean;
}

/**
 * Option filter component with operator selection and option picker
 */
export function OptionFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.option,
  options,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  showCounts = true,
  placeholder,
  inline = false,
}: OptionFilterProps) {
  const { t } = useTranslations();
  const effectivePlaceholder =
    placeholder ??
    translateWithFallback(t, "filters.value", "Select option...");
  const [internalValue, setInternalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Sync internal value with prop
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle value change
  const handleValueChange = useCallback(
    (newValue: string | string[]) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Check if this operator needs a value input
  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isMultiple = ["isAnyOf", "isNoneOf"].includes(operator);
  const currentSingleValue = Array.isArray(internalValue)
    ? internalValue[0]
    : internalValue;
  let currentMultipleValue: string[];
  if (Array.isArray(internalValue)) {
    currentMultipleValue = internalValue;
  } else if (internalValue) {
    currentMultipleValue = [internalValue];
  } else {
    currentMultipleValue = [];
  }

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

  // Handle single option selection
  const handleSingleOptionSelect = useCallback(
    (optionValue: string) => {
      handleValueChange(optionValue);
      setIsOpen(false);
    },
    [handleValueChange]
  );

  // Handle multiple option selection
  const handleMultipleOptionToggle = useCallback(
    (optionValue: string) => {
      const newValue = currentMultipleValue.includes(optionValue)
        ? currentMultipleValue.filter((v) => v !== optionValue)
        : [...currentMultipleValue, optionValue];
      handleValueChange(newValue);
    },
    [currentMultipleValue, handleValueChange]
  );

  // Get option by value
  const getOptionByValue = useCallback(
    (optionValue: string) => {
      return options.find((opt) => opt.value === optionValue);
    },
    [options]
  );

  // Format selected values for display
  const formatValueForDisplay = useCallback(() => {
    if (isMultiple) {
      if (currentMultipleValue.length === 0) {
        return effectivePlaceholder;
      }
      if (currentMultipleValue.length === 1) {
        const option = getOptionByValue(currentMultipleValue[0]);
        return option?.label || currentMultipleValue[0];
      }
      return `${currentMultipleValue.length} selected`;
    }
    if (!currentSingleValue) {
      return effectivePlaceholder;
    }
    const option = getOptionByValue(currentSingleValue);
    return option?.label || currentSingleValue;
  }, [
    isMultiple,
    currentMultipleValue,
    currentSingleValue,
    effectivePlaceholder,
    getOptionByValue,
  ]);

  return (
    <div className="space-y-3">
      {label && <Label className="font-medium text-sm">{label}</Label>}

      <div className="flex flex-col gap-3">
        {/* Operator selector */}
        {showOperator && (
          <Select
            disabled={disabled}
            onValueChange={(operatorValue) =>
              onOperatorChange(operatorValue as FilterOperators["option"])
            }
            value={operator}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("filters.select_operator")}>
                {getTranslatedOperatorLabel(
                  t,
                  operator,
                  FILTER_OPERATORS_LABELS.option[operator]
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {getTranslatedOperatorLabel(
                    t,
                    op,
                    FILTER_OPERATORS_LABELS.option[op]
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Option picker */}
        {needsValue && (
          <div className="space-y-2">
            {inline ? (
              <div className="rounded-md border">
                <Command>
                  <CommandInput
                    onValueChange={setSearchTerm}
                    placeholder={t("filters.search", { filter: "options" })}
                    value={searchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>{t("filters.noResults")}</CommandEmpty>
                    <CommandGroup>
                      {filteredOptions.map((option) => {
                        const isSelected = isMultiple
                          ? currentMultipleValue.includes(option.value)
                          : currentSingleValue === option.value;

                        return (
                          <CommandItem
                            key={option.value}
                            onSelect={() => {
                              if (isMultiple) {
                                handleMultipleOptionToggle(option.value);
                              } else {
                                handleSingleOptionSelect(option.value);
                              }
                            }}
                            value={option.value}
                          >
                            <div className="flex flex-1 items-center gap-2">
                              {option.icon && (
                                <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                  {typeof option.icon === "function" ? (
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
                                "ml-auto h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            ) : (
              <Popover onOpenChange={setIsOpen} open={isOpen}>
                <PopoverTrigger>
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
                      placeholder={t("filters.search", { filter: "options" })}
                      value={searchTerm}
                    />
                    <CommandList>
                      <CommandEmpty>{t("filters.noResults")}</CommandEmpty>
                      <CommandGroup>
                        {filteredOptions.map((option) => {
                          const isSelected = isMultiple
                            ? currentMultipleValue.includes(option.value)
                            : currentSingleValue === option.value;

                          return (
                            <CommandItem
                              key={option.value}
                              onSelect={() => {
                                if (isMultiple) {
                                  handleMultipleOptionToggle(option.value);
                                } else {
                                  handleSingleOptionSelect(option.value);
                                }
                              }}
                              value={option.value}
                            >
                              <div className="flex flex-1 items-center gap-2">
                                {option.icon && (
                                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                                    {typeof option.icon === "function" ? (
                                      <option.icon />
                                    ) : (
                                      option.icon
                                    )}
                                  </span>
                                )}
                                <span className="flex-1">{option.label}</span>
                                {showCounts && option.count !== undefined && (
                                  <Badge
                                    className="text-xs"
                                    variant="secondary"
                                  >
                                    {option.count}
                                  </Badge>
                                )}
                              </div>
                              <Check
                                className={cn(
                                  "ml-auto h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
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
            )}

            {/* Selected values display for multiple selection */}
            {isMultiple && currentMultipleValue.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {currentMultipleValue.map((selectedValue) => {
                  const option = getOptionByValue(selectedValue);
                  return (
                    <Badge
                      className="text-xs"
                      key={selectedValue}
                      variant="secondary"
                    >
                      {option?.icon && (
                        <span className="mr-1 flex h-3 w-3 items-center justify-center">
                          {typeof option.icon === "function" ? (
                            <option.icon />
                          ) : (
                            option.icon
                          )}
                        </span>
                      )}
                      {option?.label || selectedValue}
                      <Button
                        className="ml-1 h-5 w-5 rounded-full p-0 outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() =>
                          handleMultipleOptionToggle(selectedValue)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleMultipleOptionToggle(selectedValue);
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Info text for operators that don't need values */}
        {!needsValue && (
          <div className="text-muted-foreground text-sm italic">
            {operator === "isEmpty"
              ? t("filters.operators.empty")
              : t("filters.operators.not_empty")}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact option filter for use in filter chips
 */
export function CompactOptionFilter({
  value,
  operator,
  options,
  onValueChange,
  disabled = false,
  placeholder,
}: Pick<
  OptionFilterProps,
  | "value"
  | "operator"
  | "options"
  | "onValueChange"
  | "disabled"
  | "placeholder"
>) {
  const { t } = useTranslations();
  const effectivePlaceholder =
    placeholder ?? translateWithFallback(t, "filters.value", "Select...");
  const [internalValue, setInternalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleValueChange = useCallback(
    (newValue: string | string[]) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  const getOptionByValue = useCallback(
    (optionValue: string) => {
      return options.find((opt) => opt.value === optionValue);
    },
    [options]
  );

  const isMultiple = ["isAnyOf", "isNoneOf"].includes(operator);
  const currentSingleValue = Array.isArray(internalValue)
    ? internalValue[0]
    : internalValue;
  let currentMultipleValue: string[];
  if (Array.isArray(internalValue)) {
    currentMultipleValue = internalValue;
  } else if (internalValue) {
    currentMultipleValue = [internalValue];
  } else {
    currentMultipleValue = [];
  }

  const formatValueForDisplay = useCallback(() => {
    if (isMultiple) {
      if (currentMultipleValue.length === 0) {
        return effectivePlaceholder;
      }
      if (currentMultipleValue.length === 1) {
        const option = getOptionByValue(currentMultipleValue[0]);
        return option?.label || currentMultipleValue[0];
      }
      return t("filters.selectedCount", { count: currentMultipleValue.length });
    }
    if (!currentSingleValue) {
      return effectivePlaceholder;
    }
    const option = getOptionByValue(currentSingleValue);
    return option?.label || currentSingleValue;
  }, [
    isMultiple,
    currentMultipleValue,
    currentSingleValue,
    effectivePlaceholder,
    getOptionByValue,
    t,
  ]);

  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);

  if (!needsValue) {
    return (
      <span className="text-muted-foreground text-xs">
        {operator === "isEmpty"
          ? t("filters.operators.empty")
          : t("filters.operators.not_empty")}
      </span>
    );
  }

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger>
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
          <CommandInput
            placeholder={t("filters.search", { filter: "options" })}
          />
          <CommandList>
            <CommandEmpty>{t("filters.noResults")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = isMultiple
                  ? currentMultipleValue.includes(option.value)
                  : currentSingleValue === option.value;

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isMultiple) {
                        const newValue = currentMultipleValue.includes(
                          option.value
                        )
                          ? currentMultipleValue.filter(
                              (v) => v !== option.value
                            )
                          : [...currentMultipleValue, option.value];
                        handleValueChange(newValue);
                      } else {
                        handleValueChange(option.value);
                        setIsOpen(false);
                      }
                    }}
                    value={option.value}
                  >
                    <div className="flex flex-1 items-center gap-2">
                      {option.icon && (
                        <span className="flex h-3 w-3 flex-shrink-0 items-center justify-center">
                          {typeof option.icon === "function" ? (
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
                        "ml-auto h-3 w-3",
                        isSelected ? "opacity-100" : "opacity-0"
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
  );
}
