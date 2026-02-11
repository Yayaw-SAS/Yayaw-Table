/**
 * Number filter component
 * Provides filtering for numeric columns with various numeric operators and range slider
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useTranslations } from "../../providers/table-provider";
import type { FilterOperators } from "../../types/filter-types";
import {
  DEFAULT_OPERATORS,
  FILTER_OPERATORS_LABELS,
} from "../../types/filter-types";
import {
  getTranslatedOperatorLabel,
  translateWithFallback,
} from "./i18n-utils";

export interface NumberFilterProps {
  /** Current filter value - single number or [min, max] for between */
  value: number | [number, number];
  /** Current operator */
  operator: FilterOperators["number"];
  /** Available operators (defaults to all number operators) */
  operators?: readonly FilterOperators["number"][];
  /** Minimum value for slider/validation */
  min?: number;
  /** Maximum value for slider/validation */
  max?: number;
  /** Step size for slider */
  step?: number;
  /** Placeholder text for inputs */
  placeholder?: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Callback when the value changes */
  onValueChange: (value: number | [number, number]) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators["number"]) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Whether to show slider for range operations */
  showSlider?: boolean;
}

/**
 * Number filter component with operator selection and numeric input/slider
 */
export function NumberFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.number,
  min = 0,
  max = 100,
  step = 1,
  placeholder,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  showSlider = true,
}: NumberFilterProps) {
  const { t } = useTranslations();
  const effectivePlaceholder =
    placeholder ?? translateWithFallback(t, "filters.value", "Enter number...");
  const [internalValue, setInternalValue] = useState(value);

  // Sync internal value with prop
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle value change with debouncing
  const handleValueChange = useCallback(
    (newValue: number | [number, number]) => {
      setInternalValue(newValue);

      // Debounce the callback
      const timeoutId = setTimeout(() => {
        onValueChange(newValue);
      }, 300);

      return () => clearTimeout(timeoutId);
    },
    [onValueChange]
  );

  // Handle immediate value change
  const handleImmediateChange = useCallback(
    (newValue: number | [number, number]) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Check if this operator needs a value input
  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isBetween = operator === "between";
  const currentSingleValue = Array.isArray(internalValue)
    ? internalValue[0]
    : internalValue;
  const currentRangeValue = Array.isArray(internalValue)
    ? internalValue
    : [min, max];

  // Handle single number input change
  const handleSingleInputChange = useCallback(
    (inputValue: string) => {
      const numValue = Number.parseFloat(inputValue);
      if (!Number.isNaN(numValue)) {
        handleValueChange(numValue);
      }
    },
    [handleValueChange]
  );

  // Handle range input changes
  const handleRangeMinChange = useCallback(
    (inputValue: string) => {
      const numValue = Number.parseFloat(inputValue);
      if (!Number.isNaN(numValue)) {
        const [, maxVal] = currentRangeValue;
        handleValueChange([numValue, maxVal]);
      }
    },
    [currentRangeValue, handleValueChange]
  );

  const handleRangeMaxChange = useCallback(
    (inputValue: string) => {
      const numValue = Number.parseFloat(inputValue);
      if (!Number.isNaN(numValue)) {
        const [minVal] = currentRangeValue;
        handleValueChange([minVal, numValue]);
      }
    },
    [currentRangeValue, handleValueChange]
  );

  // Handle slider change
  const handleSliderChange = useCallback(
    (values: number[]) => {
      if (isBetween) {
        handleImmediateChange([values[0], values[1]]);
      } else {
        handleImmediateChange(values[0]);
      }
    },
    [isBetween, handleImmediateChange]
  );

  return (
    <div className="space-y-3">
      {label && <Label className="font-medium text-sm">{label}</Label>}

      <div className="flex flex-col gap-3">
        {/* Operator selector */}
        {showOperator && (
          <Select
            disabled={disabled}
            onValueChange={(operatorValue) =>
              onOperatorChange(operatorValue as FilterOperators["number"])
            }
            value={operator}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("filters.select_operator")}>
                {getTranslatedOperatorLabel(
                  t,
                  operator,
                  FILTER_OPERATORS_LABELS.number[operator]
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {getTranslatedOperatorLabel(
                    t,
                    op,
                    FILTER_OPERATORS_LABELS.number[op]
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Value inputs */}
        {needsValue && (
          <div className="space-y-2">
            {isBetween ? (
              <>
                {/* Range inputs */}
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    disabled={disabled}
                    max={max}
                    min={min}
                    onChange={(e) => handleRangeMinChange(e.target.value)}
                    placeholder={t("filters.value")}
                    step={step}
                    type="number"
                    value={currentRangeValue[0]}
                  />
                  <span className="text-muted-foreground text-sm">-</span>
                  <Input
                    className="flex-1"
                    disabled={disabled}
                    max={max}
                    min={min}
                    onChange={(e) => handleRangeMaxChange(e.target.value)}
                    placeholder={t("filters.value_to")}
                    step={step}
                    type="number"
                    value={currentRangeValue[1]}
                  />
                </div>

                {/* Range slider */}
                {showSlider && (
                  <div className="px-2">
                    <Slider
                      className="w-full"
                      disabled={disabled}
                      max={max}
                      min={min}
                      onValueChange={(value) =>
                        handleSliderChange(
                          Array.isArray(value) ? [...value] : [value as number]
                        )
                      }
                      step={step}
                      value={currentRangeValue}
                    />
                    <div className="mt-1 flex justify-between text-muted-foreground text-xs">
                      <span>{min}</span>
                      <span>{max}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Single number input */}
                <Input
                  className="w-full"
                  disabled={disabled}
                  max={max}
                  min={min}
                  onChange={(e) => handleSingleInputChange(e.target.value)}
                  placeholder={effectivePlaceholder}
                  step={step}
                  type="number"
                  value={currentSingleValue || ""}
                />

                {/* Single value slider */}
                {showSlider && (
                  <div className="px-2">
                    <Slider
                      className="w-full"
                      disabled={disabled}
                      max={max}
                      min={min}
                      onValueChange={(value) =>
                        handleSliderChange(
                          Array.isArray(value) ? [...value] : [value as number]
                        )
                      }
                      step={step}
                      value={[currentSingleValue || min]}
                    />
                    <div className="mt-1 flex justify-between text-muted-foreground text-xs">
                      <span>{min}</span>
                      <span>{max}</span>
                    </div>
                  </div>
                )}
              </>
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
 * Compact number filter for use in filter chips
 */
export function CompactNumberFilter({
  value,
  operator,
  onValueChange,
  placeholder,
  disabled = false,
}: Pick<
  NumberFilterProps,
  "value" | "operator" | "onValueChange" | "placeholder" | "disabled"
>) {
  const { t } = useTranslations();
  const effectivePlaceholder =
    placeholder ?? translateWithFallback(t, "filters.value", "0");
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: number | [number, number]) => {
      setInternalValue(newValue);
      const timeoutId = setTimeout(() => {
        onValueChange(newValue);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [onValueChange]
  );

  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isBetween = operator === "between";

  if (!needsValue) {
    return (
      <span className="text-muted-foreground text-xs">
        {operator === "isEmpty"
          ? t("filters.operators.empty")
          : t("filters.operators.not_empty")}
      </span>
    );
  }

  if (isBetween && Array.isArray(internalValue)) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="h-6 w-16 text-xs"
          disabled={disabled}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            if (!Number.isNaN(val)) {
              handleChange([val, internalValue[1]]);
            }
          }}
          type="number"
          value={internalValue[0]}
        />
        <span className="text-xs">-</span>
        <Input
          className="h-6 w-16 text-xs"
          disabled={disabled}
          onChange={(e) => {
            const val = Number.parseFloat(e.target.value);
            if (!Number.isNaN(val)) {
              handleChange([internalValue[0], val]);
            }
          }}
          type="number"
          value={internalValue[1]}
        />
      </div>
    );
  }

  const singleValue = Array.isArray(internalValue)
    ? internalValue[0]
    : internalValue;

  return (
    <Input
      className="h-6 w-20 text-xs"
      disabled={disabled}
      onChange={(e) => {
        const val = Number.parseFloat(e.target.value);
        if (!Number.isNaN(val)) {
          handleChange(val);
        }
      }}
      placeholder={effectivePlaceholder}
      type="number"
      value={singleValue || ""}
    />
  );
}
