/**
 * Type definitions for column footer calculations
 * Mirrors Notion's column calculation options
 */

export const CALCULATION_TYPES = {
  none: "none",

  // Count (Quantité)
  count_all: "count_all",
  count_values: "count_values",
  count_unique: "count_unique",
  count_empty: "count_empty",
  count_not_empty: "count_not_empty",
  count_true: "count_true",
  count_false: "count_false",

  // Percentage (Pourcentage)
  percent_empty: "percent_empty",
  percent_not_empty: "percent_not_empty",
  percent_true: "percent_true",
  percent_false: "percent_false",

  // Numeric (Plus d'options)
  sum: "sum",
  average: "average",
  median: "median",
  min: "min",
  max: "max",
  range: "range",
} as const;

export type CalculationType =
  (typeof CALCULATION_TYPES)[keyof typeof CALCULATION_TYPES];

/**
 * Column types that support numeric calculations (sum, average, median, min, max, range)
 */
const NUMERIC_COLUMN_TYPES = new Set(["number"]);

/**
 * Column types that support date-specific calculations (earliest, latest, range)
 */
const DATE_COLUMN_TYPES = new Set(["date"]);

/**
 * Column types that support boolean-specific calculations.
 */
const BOOLEAN_COLUMN_TYPES = new Set(["boolean"]);

/**
 * Calculations that only apply to numeric columns.
 */
const NUMERIC_ONLY: ReadonlySet<CalculationType> = new Set([
  "sum",
  "average",
  "median",
]);

/**
 * Calculations that apply to numeric and date columns (comparable values).
 */
const COMPARABLE_ONLY: ReadonlySet<CalculationType> = new Set([
  "min",
  "max",
  "range",
]);

/**
 * Calculations that only apply to boolean columns.
 */
const BOOLEAN_ONLY: ReadonlySet<CalculationType> = new Set([
  "count_true",
  "count_false",
  "percent_true",
  "percent_false",
]);

/**
 * Returns the allowed calculation types for a given column type.
 */
export const getAvailableCalculations = (
  columnType?: string
): CalculationType[] => {
  const base: CalculationType[] = [
    "none",
    "count_all",
    "count_values",
    "count_unique",
    "count_empty",
    "count_not_empty",
    "percent_empty",
    "percent_not_empty",
  ];

  if (columnType && BOOLEAN_COLUMN_TYPES.has(columnType)) {
    return [
      ...base,
      "count_true",
      "count_false",
      "percent_true",
      "percent_false",
    ];
  }

  if (columnType && NUMERIC_COLUMN_TYPES.has(columnType)) {
    return [...base, "sum", "average", "median", "min", "max", "range"];
  }

  if (columnType && DATE_COLUMN_TYPES.has(columnType)) {
    return [...base, "min", "max", "range"];
  }

  return base;
};

/**
 * Checks whether a given calculation type is valid for a given column type.
 * Used to validate `defaultCalculation` from config and guard against
 * incompatible choices (e.g. "sum" on a text column).
 */
export const isCalculationValidForColumn = (
  calculation: CalculationType,
  columnType?: string
): boolean => {
  if (calculation === "none") {
    return true;
  }

  if (NUMERIC_ONLY.has(calculation)) {
    return columnType !== undefined && NUMERIC_COLUMN_TYPES.has(columnType);
  }

  if (BOOLEAN_ONLY.has(calculation)) {
    return columnType !== undefined && BOOLEAN_COLUMN_TYPES.has(columnType);
  }

  if (COMPARABLE_ONLY.has(calculation)) {
    return (
      columnType !== undefined &&
      (NUMERIC_COLUMN_TYPES.has(columnType) ||
        DATE_COLUMN_TYPES.has(columnType))
    );
  }

  return true;
};

/**
 * Grouping of calculation types for the menu UI
 */
export interface CalculationGroup {
  key: string;
  labelKey: string;
  items: CalculationType[];
}

export const getCalculationGroups = (
  columnType?: string
): CalculationGroup[] => {
  const groups: CalculationGroup[] = [
    {
      key: "none",
      labelKey: "calcNone",
      items: ["none"],
    },
    {
      key: "count",
      labelKey: "calcCount",
      items: [
        "count_all",
        "count_values",
        "count_unique",
        "count_empty",
        "count_not_empty",
      ],
    },
    {
      key: "percent",
      labelKey: "calcPercent",
      items: ["percent_empty", "percent_not_empty"],
    },
  ];

  const isNumeric = columnType && NUMERIC_COLUMN_TYPES.has(columnType);
  const isDate = columnType && DATE_COLUMN_TYPES.has(columnType);
  const isBoolean = columnType && BOOLEAN_COLUMN_TYPES.has(columnType);

  if (isBoolean) {
    return [
      {
        key: "none",
        labelKey: "calcNone",
        items: ["none"],
      },
      {
        key: "count",
        labelKey: "calcCount",
        items: [
          "count_all",
          "count_values",
          "count_unique",
          "count_empty",
          "count_not_empty",
          "count_true",
          "count_false",
        ],
      },
      {
        key: "percent",
        labelKey: "calcPercent",
        items: [
          "percent_empty",
          "percent_not_empty",
          "percent_true",
          "percent_false",
        ],
      },
    ];
  }

  if (isNumeric) {
    groups.push({
      key: "more",
      labelKey: "calcMore",
      items: ["sum", "average", "median", "min", "max", "range"],
    });
  } else if (isDate) {
    groups.push({
      key: "more",
      labelKey: "calcMore",
      items: ["min", "max", "range"],
    });
  }

  return groups;
};
