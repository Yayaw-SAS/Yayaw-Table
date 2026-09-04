import type {
  AdvancedFilter,
  AdvancedFilterOperator,
  ColumnDefinition,
  ColumnType,
} from "./types";

const emptyOperators = ["isEmpty", "isNotEmpty"] as const;
const operators = {
  text: [
    "contains",
    "equals",
    "startsWith",
    "endsWith",
    "notContains",
    ...emptyOperators,
  ],
  number: [
    "equals",
    "greaterThan",
    "lessThan",
    "greaterThanOrEqual",
    "lessThanOrEqual",
    "between",
    "notEquals",
    ...emptyOperators,
  ],
  date: [
    "equals",
    "before",
    "after",
    "between",
    "notEquals",
    ...emptyOperators,
  ],
  select: ["is", "isNot", "isAnyOf", "isNoneOf", ...emptyOperators],
  multiSelect: ["contains", "containsAll", "containsNone", ...emptyOperators],
  boolean: ["isTrue", "isFalse", ...emptyOperators],
} satisfies Record<string, AdvancedFilterOperator[]>;
export const filterType = (
  column?: ColumnDefinition
): keyof typeof operators => {
  if (column?.type && column.type in operators) {
    return column.type as keyof typeof operators;
  }
  return column?.options?.length ? "select" : "text";
};
export const filterOperators = (
  column: ColumnDefinition | undefined,
  current?: AdvancedFilterOperator
): AdvancedFilterOperator[] => {
  const type = filterType(column);
  const values: AdvancedFilterOperator[] = [...operators[type]];
  // Keep historical Vue aliases editable when a saved view uses them.
  const aliases: Partial<
    Record<keyof typeof operators, AdvancedFilterOperator[]>
  > = {
    select: ["equals", "notEquals", "in", "notIn"],
    multiSelect: ["in", "notIn", "notContains", "isAnyOf", "isNoneOf"],
    text: ["notEquals"],
    date: ["greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual"],
  };
  if (current && aliases[type]?.includes(current)) {
    values.push(current);
  }
  return values;
};
export const filterNeedsValue = (operator: AdvancedFilterOperator): boolean =>
  !["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(operator);
export const filterIsMultiple = (
  type: ColumnType | undefined,
  operator: AdvancedFilterOperator
): boolean =>
  type === "multiSelect" ||
  [
    "in",
    "notIn",
    "isAnyOf",
    "isNoneOf",
    "containsAll",
    "containsNone",
  ].includes(operator);
export const newFilter = (column: ColumnDefinition): AdvancedFilter => ({
  id: crypto.randomUUID(),
  columnId: column.id,
  type: filterType(column),
  operator: filterOperators(column)[0] ?? "contains",
  values: undefined,
  isActive: false,
});
export const filterHasValue = (filter: AdvancedFilter): boolean => {
  if (!filterNeedsValue(filter.operator)) {
    return true;
  }
  const values = Array.isArray(filter.values) ? filter.values : [filter.values];
  if (filter.operator === "between" && values.length !== 2) {
    return false;
  }
  if (!values.length) {
    return false;
  }
  return values.every((value) => {
    if (value === undefined || value === null) {
      return false;
    }
    if (filter.type === "number") {
      return typeof value === "number" && Number.isFinite(value);
    }
    if (filter.type === "date") {
      return value !== "" && Number.isFinite(new Date(String(value)).getTime());
    }
    return (
      filter.type === "select" || filter.type === "multiSelect" || value !== ""
    );
  });
};
export const operatorTranslationKeys: Record<AdvancedFilterOperator, string> = {
  contains: "contains",
  notContains: "not_contains",
  equals: "equals",
  notEquals: "not_equals",
  startsWith: "starts_with",
  endsWith: "ends_with",
  is: "is",
  isNot: "is_not",
  isAnyOf: "is_any_of",
  isNoneOf: "is_none_of",
  in: "is_any_of",
  notIn: "is_none_of",
  containsAll: "contains_all",
  containsNone: "contains_none",
  greaterThan: "greater_than",
  greaterThanOrEqual: "greater_than_or_equal",
  lessThan: "less_than",
  lessThanOrEqual: "less_than_or_equal",
  before: "before",
  after: "after",
  between: "between",
  isEmpty: "empty",
  isNotEmpty: "not_empty",
  isTrue: "is_true",
  isFalse: "is_false",
};
