/**
 * Text filter component
 * Provides filtering for text-based columns with various text operators
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
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

export interface TextFilterProps {
  /** Current filter value */
  value: string;
  /** Current operator */
  operator: FilterOperators["text"];
  /** Available operators (defaults to all text operators) */
  operators?: readonly FilterOperators["text"][];
  /** Placeholder text */
  placeholder?: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Callback when the value changes */
  onValueChange: (value: string) => void;
  /** Callback when the operator changes */
  onOperatorChange: (operator: FilterOperators["text"]) => void;
  /** Optional label */
  label?: string;
  /** Whether to show the operator selector */
  showOperator?: boolean;
  /** Debounce delay for value changes (ms). 0 = no debounce */
  debounceMs?: number;
}

/**
 * Text filter component with operator selection and text input
 */
export function TextFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.text,
  placeholder,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  debounceMs = 300,
}: TextFilterProps) {
  const { t } = useTranslations();
  const effectivePlaceholder =
    placeholder ?? translateWithFallback(t, "filters.value", "Enter text...");
  const [internalValue, setInternalValue] = useState(value);

  // Sync internal value with prop
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Handle value change with debouncing
  const handleValueChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      if (debounceMs <= 0) {
        onValueChange(newValue);
        return () => {
          /* no-op cleanup */
        };
      }
      const timeoutId = setTimeout(() => {
        onValueChange(newValue);
      }, debounceMs);
      return () => clearTimeout(timeoutId);
    },
    [onValueChange, debounceMs]
  );

  // Handle immediate value change for certain operators
  const handleImmediateChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      onValueChange(newValue);
    },
    [onValueChange]
  );

  // Check if this operator needs a value input
  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);

  return (
    <div className="space-y-3">
      {label && <Label className="font-medium text-sm">{label}</Label>}

      <div className="flex flex-col gap-2">
        {/* Operator selector */}
        {showOperator && (
          <Select
            disabled={disabled}
            onValueChange={(operatorValue) =>
              onOperatorChange(operatorValue as FilterOperators["text"])
            }
            value={operator}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("filters.select_operator")}>
                {getTranslatedOperatorLabel(
                  t,
                  operator,
                  FILTER_OPERATORS_LABELS.text[operator]
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {getTranslatedOperatorLabel(
                    t,
                    op,
                    FILTER_OPERATORS_LABELS.text[op]
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Value input - only show if operator needs a value */}
        {needsValue && (
          <Input
            className="w-full"
            disabled={disabled}
            onBlur={(e) => handleImmediateChange(e.target.value)}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder={effectivePlaceholder}
            type="text"
            value={internalValue}
          />
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
 * Compact text filter for use in filter chips
 */
export function CompactTextFilter({
  value,
  operator,
  onValueChange,
  placeholder,
  disabled = false,
}: Pick<
  TextFilterProps,
  "value" | "operator" | "onValueChange" | "placeholder" | "disabled"
>) {
  const { t } = useTranslations();
  const effectivePlaceholder =
    placeholder ?? translateWithFallback(t, "filters.value", "Type...");
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setInternalValue(newValue);
      const timeoutId = setTimeout(() => {
        onValueChange(newValue);
      }, 300);
      return () => clearTimeout(timeoutId);
    },
    [onValueChange]
  );

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
    <Input
      className="h-6 text-xs"
      disabled={disabled}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={effectivePlaceholder}
      type="text"
      value={internalValue}
    />
  );
}
