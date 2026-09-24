/**
 * Location filter: empty or not, within N km of a point, or within an area.
 * Values follow the shared contract: `[lat, lng, km]` and
 * `[west, south, east, north]` (see `utils/location-model.ts`).
 */
"use client";

import { useId } from "react";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useLocale, useTranslations } from "../../providers/table-provider";
import type { FilterOperators } from "../../types/filter-types";
import {
  DEFAULT_OPERATORS,
  FILTER_OPERATORS_LABELS,
} from "../../types/filter-types";
import {
  type LocationLabelKey,
  locationLabel,
} from "../../utils/location-model";
import {
  getTranslatedOperatorLabel,
  translateWithFallback,
} from "./i18n-utils";

type LocationOperator = FilterOperators["location"];

const FIELDS: Record<string, LocationLabelKey[]> = {
  withinDistance: ["latitude", "longitude", "distance"],
  withinBounds: ["west", "south", "east", "north"],
};

export interface LocationFilterProps {
  value: number[] | undefined;
  operator: LocationOperator;
  operators?: readonly LocationOperator[];
  disabled?: boolean;
  onValueChange: (value: number[]) => void;
  onOperatorChange: (operator: LocationOperator) => void;
  showOperator?: boolean;
  compact?: boolean;
}

/** The numbers a location rule needs, as labelled inputs. */
export function LocationFilter({
  value,
  operator,
  operators = DEFAULT_OPERATORS.location,
  disabled = false,
  onValueChange,
  onOperatorChange,
  showOperator = true,
  compact = false,
}: LocationFilterProps) {
  const { t } = useTranslations();
  const locale = useLocale();
  const id = useId();
  const label = (key: LocationLabelKey) =>
    translateWithFallback(t, `location.${key}`, locationLabel(key, locale));
  const fields = FIELDS[operator] ?? [];
  const values = Array.isArray(value) ? value : [];
  const setAt = (index: number, text: string) => {
    const typed = text.trim() === "" ? Number.NaN : Number(text);
    onValueChange(
      fields.map((_, position) =>
        position === index ? typed : Number(values[position] ?? Number.NaN)
      )
    );
  };
  return (
    <div className={compact ? "flex flex-wrap gap-1" : "flex flex-col gap-2"}>
      {showOperator ? (
        <Select
          disabled={disabled}
          onValueChange={(next) => {
            onOperatorChange(next as LocationOperator);
            onValueChange([]);
          }}
          value={operator}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("filters.select_operator")}>
              {getTranslatedOperatorLabel(
                t,
                operator,
                FILTER_OPERATORS_LABELS.location[operator]
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {operators.map((item) => (
              <SelectItem key={item} value={item}>
                {getTranslatedOperatorLabel(
                  t,
                  item,
                  FILTER_OPERATORS_LABELS.location[item]
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {fields.length ? (
        <div className="grid grid-cols-2 gap-2" data-location-filter={operator}>
          {fields.map((key, index) => (
            <label
              className="grid gap-1 text-muted-foreground text-xs"
              htmlFor={`${id}-${key}`}
              key={key}
            >
              {label(key)}
              <Input
                className={compact ? "h-6 text-xs" : "h-8"}
                disabled={disabled}
                id={`${id}-${key}`}
                inputMode="decimal"
                onChange={(event) => setAt(index, event.target.value)}
                step="any"
                type="number"
                value={
                  Number.isFinite(values[index]) ? String(values[index]) : ""
                }
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
