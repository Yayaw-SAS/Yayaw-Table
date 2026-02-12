import type { ColumnDataType, FilterOperators } from "../../types/filter-types";
import type { TranslationParams } from "../../types/translations";

type TranslateFn = (key: string, params?: TranslationParams) => string;

const OPERATOR_TRANSLATION_KEYS: Record<string, string> = {
  contains: "filters.operators.contains",
  equals: "filters.operators.equals",
  startsWith: "filters.operators.starts_with",
  endsWith: "filters.operators.ends_with",
  notContains: "filters.operators.not_contains",
  isEmpty: "filters.operators.empty",
  isNotEmpty: "filters.operators.not_empty",
  greaterThan: "filters.operators.greater_than",
  lessThan: "filters.operators.less_than",
  greaterThanOrEqual: "filters.operators.greater_than_or_equal",
  lessThanOrEqual: "filters.operators.less_than_or_equal",
  between: "filters.operators.between",
  notEquals: "filters.operators.not_equals",
  is: "filters.operators.is",
  isNot: "filters.operators.is_not",
  isAnyOf: "filters.operators.is_any_of",
  isNoneOf: "filters.operators.is_none_of",
  containsAll: "filters.operators.contains_all",
  containsNone: "filters.operators.contains_none",
  before: "filters.operators.before",
  after: "filters.operators.after",
  onOrBefore: "filters.operators.on_or_before",
  onOrAfter: "filters.operators.on_or_after",
};

export const translateWithFallback = (
  t: TranslateFn,
  key: string,
  fallback: string,
  params?: TranslationParams
): string => {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
};

export const getTranslatedOperatorLabel = (
  t: TranslateFn,
  operator: FilterOperators[ColumnDataType],
  fallback: string
): string => {
  const key = OPERATOR_TRANSLATION_KEYS[operator];
  if (!key) {
    return fallback;
  }

  return translateWithFallback(t, key, fallback);
};
