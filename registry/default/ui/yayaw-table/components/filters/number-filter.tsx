/**
 * Number filter component
 * Provides filtering for numeric columns with various numeric operators and range slider
 */
"use client";

import { type ComponentProps, useState } from "react";
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

/** Keep incomplete numeric text local; the parent owns the filter commit. */
function NumericDraftInput({
  value,
  onNumberChange,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number;
  onNumberChange: (value: number) => void;
}) {
  const [previousValue, setPreviousValue] = useState(value);
  const [text, setText] = useState(() =>
    Number.isFinite(value) ? String(value) : ""
  );
  if (!Object.is(previousValue, value)) {
    setPreviousValue(value);
    setText(Number.isFinite(value) ? String(value) : "");
  }
  return (
    <Input
      step="any"
      {...props}
      onChange={(event) => {
        const raw = event.target.value;
        const next = raw === "" ? Number.NaN : Number(raw);
        // A decimal separator or an empty field must not be replaced by an old value.
        setText(raw);
        setPreviousValue(next);
        onNumberChange(next);
      }}
      type="number"
      value={text}
    />
  );
}

function NumericSlider({
  values,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onChange,
}: {
  values: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled: boolean;
  onChange: (values: number[]) => void;
}) {
  const endpoints = [min, max];
  const resolved = values.map((value, index) =>
    Number.isFinite(value) ? value : endpoints[index]
  );
  return (
    <div className="px-2">
      <Slider
        disabled={disabled}
        max={max}
        min={min}
        onValueChange={(value) =>
          onChange(Array.isArray(value) ? [...value] : [value])
        }
        step={step}
        value={resolved}
      />
      <div className="mt-1 flex justify-between text-muted-foreground text-xs">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

/** Numeric fields update the editor immediately; only its form applies a filter. */
export function NumberFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.number,
  min,
  max,
  step,
  placeholder,
  disabled = false,
  onValueChange,
  onOperatorChange,
  label,
  showOperator = true,
  showSlider = false,
}: NumberFilterProps) {
  const { t } = useTranslations();
  const needsValue = !["isEmpty", "isNotEmpty"].includes(operator);
  const isBetween = operator === "between";
  const singleValue = Array.isArray(value) ? value[0] : value;
  const range: [number, number] = Array.isArray(value)
    ? value
    : [Number.NaN, Number.NaN];
  const values = isBetween ? range : [singleValue];
  const changeEndpoint = (index: number, next: number) => {
    if (!isBetween) {
      onValueChange(next);
      return;
    }
    const nextRange: [number, number] = [...range];
    nextRange[index] = next;
    onValueChange(nextRange);
  };
  return (
    <div className="space-y-3">
      {label && <Label className="font-medium text-sm">{label}</Label>}
      {showOperator && (
        <Select
          disabled={disabled}
          onValueChange={(next) =>
            onOperatorChange(next as FilterOperators["number"])
          }
          value={operator}
        >
          <SelectTrigger
            aria-label={t("filters.select_operator")}
            className="w-full"
          >
            <SelectValue>
              {getTranslatedOperatorLabel(
                t,
                operator,
                FILTER_OPERATORS_LABELS.number[operator]
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {operators.map((item) => (
              <SelectItem key={item} value={item}>
                {getTranslatedOperatorLabel(
                  t,
                  item,
                  FILTER_OPERATORS_LABELS.number[item]
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {needsValue ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {values.map((entry, index) => (
              <NumericDraftInput
                // Endpoint identity stays stable while its text changes.
                aria-label={
                  index === 0 ? t("filters.value") : t("filters.value_to")
                }
                className="min-w-0 flex-1"
                disabled={disabled}
                key={index === 0 ? "from" : "to"}
                max={max}
                min={min}
                onNumberChange={(next) => changeEndpoint(index, next)}
                placeholder={placeholder ?? t("filters.value")}
                step={step ?? "any"}
                value={entry}
              />
            ))}
          </div>
          {showSlider && (
            <NumericSlider
              disabled={disabled}
              max={max}
              min={min}
              onChange={(next) =>
                onValueChange(isBetween ? [next[0], next[1]] : next[0])
              }
              step={step}
              values={values}
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {operator === "isEmpty"
            ? t("filters.operators.empty")
            : t("filters.operators.not_empty")}
        </p>
      )}
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

  if (isBetween && Array.isArray(value)) {
    return (
      <div className="flex items-center gap-1">
        <NumericDraftInput
          className="h-6 w-16 text-xs"
          disabled={disabled}
          onNumberChange={(next) => onValueChange([next, value[1]])}
          type="number"
          value={value[0]}
        />
        <span className="text-xs">-</span>
        <NumericDraftInput
          className="h-6 w-16 text-xs"
          disabled={disabled}
          onNumberChange={(next) => onValueChange([value[0], next])}
          type="number"
          value={value[1]}
        />
      </div>
    );
  }

  const singleValue = Array.isArray(value) ? value[0] : value;

  return (
    <NumericDraftInput
      aria-label={t("filters.value")}
      className="h-6 w-20 text-xs"
      disabled={disabled}
      onNumberChange={onValueChange}
      placeholder={effectivePlaceholder}
      type="number"
      value={singleValue}
    />
  );
}
