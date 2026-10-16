/**
 * The filter menu both editions draw, modelled on Notion's: a Filter button
 * that lists the properties, one chip per rule under the toolbar, an editor
 * per type whose changes filter at once, and an advanced filter for rules
 * joined with "or". This module holds what the editions share (operators per
 * type and their words, rule summaries, relative date choices, the chips a
 * filter state shows); it is copied into the Vue registry and runs on a
 * server too.
 */
import {
  type CalendarDay,
  calendarDay,
  isDateFilterValue,
  isRelativeDateToken,
  type RelativeDateContext,
  type RelativeDateToken,
  type RelativeDateUnit,
  relativeDateLabel,
  relativeDateTokenOf,
  resolveRelativeDate,
} from "./date-filter-days";
import { filterBarDateRuleId } from "./filter-bar";

/** What a filter edits, from the column's data type (`dataTypeFilter`). */
export type FilterMenuType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiSelect"
  | "boolean"
  | "location";

/** A rule as both editions store it. */
export interface FilterMenuRule {
  id: string;
  columnId: string;
  operator: string;
  values?: unknown;
  type?: string;
  isActive?: boolean;
}

const EMPTY_OPERATORS = ["isEmpty", "isNotEmpty"] as const;

/** Operators each type offers, in Notion's order. */
export const FILTER_MENU_OPERATORS: Record<FilterMenuType, readonly string[]> =
  {
    text: [
      "contains",
      "notContains",
      "equals",
      "notEquals",
      "startsWith",
      "endsWith",
      ...EMPTY_OPERATORS,
    ],
    number: [
      "equals",
      "notEquals",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "between",
      ...EMPTY_OPERATORS,
    ],
    date: [
      "equals",
      "before",
      "after",
      "lessThanOrEqual",
      "greaterThanOrEqual",
      "between",
      "notEquals",
      ...EMPTY_OPERATORS,
    ],
    select: ["isAnyOf", "isNoneOf", ...EMPTY_OPERATORS],
    multiSelect: [
      "contains",
      "containsAll",
      "containsNone",
      ...EMPTY_OPERATORS,
    ],
    boolean: ["isTrue", "isFalse"],
    location: ["withinDistance", "withinBounds", ...EMPTY_OPERATORS],
  };

/** Older operators saved views still hold; they stay editable. */
const LEGACY_OPERATORS: Partial<Record<FilterMenuType, readonly string[]>> = {
  text: [],
  number: [],
  date: ["lessThan", "greaterThan"],
  select: ["is", "isNot", "equals", "notEquals", "in", "notIn"],
  multiSelect: ["notContains", "isAnyOf", "isNoneOf", "in", "notIn"],
  boolean: ["is", "isNot", "isEmpty", "isNotEmpty"],
};

/** The operators a rule of `type` may pick; a legacy `current` one stays listed. */
export function filterMenuOperators(
  type: FilterMenuType,
  current?: string
): string[] {
  const operators = [...FILTER_MENU_OPERATORS[type]];
  if (
    current &&
    !operators.includes(current) &&
    LEGACY_OPERATORS[type]?.includes(current)
  ) {
    operators.push(current);
  }
  return operators;
}

/** The operator a new rule of `type` starts with. */
export const defaultFilterOperator = (type: FilterMenuType): string =>
  FILTER_MENU_OPERATORS[type][0] ?? "contains";

/** Operators that compare nothing: the rule is complete without a value. */
export const filterOperatorNeedsValue = (operator: string): boolean =>
  !["isEmpty", "isNotEmpty", "isTrue", "isFalse"].includes(operator);

const MULTIPLE_OPERATORS = new Set([
  "in",
  "notIn",
  "isAnyOf",
  "isNoneOf",
  "containsAll",
  "containsNone",
]);

/** Whether a rule holds a list of values (options, tags). */
export const filterOperatorIsMultiple = (
  type: FilterMenuType,
  operator: string
): boolean =>
  type === "multiSelect" ||
  (type !== "date" && type !== "number" && MULTIPLE_OPERATORS.has(operator));

const LOCATION_SIZES: Record<string, number> = {
  withinDistance: 3,
  withinBounds: 4,
};

/** Whether a rule filters: its operator needs no value, or it has a usable one. */
export function filterRuleComplete(rule: FilterMenuRule): boolean {
  if (!filterOperatorNeedsValue(rule.operator)) {
    return true;
  }
  const values = Array.isArray(rule.values) ? rule.values : [rule.values];
  if (rule.type === "location") {
    return (
      values.length === (LOCATION_SIZES[rule.operator] ?? 0) &&
      values.every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
    );
  }
  if (rule.type === "date" && relativeDateTokenOf(rule.values)) {
    return values.every(isDateFilterValue);
  }
  if (rule.operator === "between" && values.length !== 2) {
    return false;
  }
  if (!values.length) {
    return false;
  }
  return values.every((value) => {
    if (value === undefined || value === null || value === "") {
      return false;
    }
    if (rule.type === "number") {
      return typeof value === "number" && Number.isFinite(value);
    }
    if (rule.type === "date") {
      return isDateFilterValue(value);
    }
    return true;
  });
}

/**
 * The rule with another operator, keeping what still fits: a relative date
 * stays, one value becomes the first of a range, a list keeps its items, and
 * an operator without a value drops it.
 */
export function changeFilterOperator<T extends FilterMenuRule>(
  rule: T,
  operator: string,
  type: FilterMenuType
): T {
  if (!filterOperatorNeedsValue(operator) || type === "location") {
    return { ...rule, operator, values: undefined } as T;
  }
  const token = type === "date" ? relativeDateTokenOf(rule.values) : undefined;
  const previous = Array.isArray(rule.values) ? rule.values : [rule.values];
  const present = previous.filter(
    (value) => value !== undefined && value !== null && value !== ""
  );
  let values: unknown = present[0];
  if (token) {
    values = operator === "between" ? undefined : token;
  } else if (operator === "between") {
    values = present.length
      ? [present[0], present[1] ?? present[0]]
      : undefined;
  } else if (filterOperatorIsMultiple(type, operator)) {
    values = present;
  }
  return { ...rule, operator, values } as T;
}

type Locale = "en" | "fr";
const localeOf = (locale?: string): Locale =>
  locale?.toLowerCase().startsWith("fr") ? "fr" : "en";

const TEXT = {
  en: {
    filter: "Filter",
    addFilter: "Filter",
    filterBy: "Filter by…",
    noProperties: "No matching property",
    addAdvanced: "Add advanced filter",
    toAdvanced: "Add to advanced filter",
    deleteFilter: "Delete filter",
    more: "More actions",
    deleteAdvanced: "Delete filter",
    addRule: "Add filter rule",
    where: "Where",
    and: "And",
    or: "Or",
    rules: "{count} rules",
    rule: "1 rule",
    clear: "Clear",
    relative: "Relative",
    exact: "Exact date",
    range: "Date range",
    custom: "Custom",
    last: "Last",
    next: "Next",
    Days: "days",
    Weeks: "weeks",
    Months: "months",
    Years: "years",
    apply: "OK",
    from: "From",
    to: "To",
    anyDate: "All dates",
    searchOptions: "Search for an option…",
    noOptions: "No options",
    typeValue: "Type a value…",
    operator: "Operator",
    property: "Property",
    value: "Value",
    period: "From {start} to {end}",
    oneDay: "On {start}",
    noPeriod: "No period: every date",
    checked: "Checked",
    unchecked: "Unchecked",
    empty: "Empty",
  },
  fr: {
    filter: "Filtre",
    addFilter: "Filtre",
    filterBy: "Filtrer par…",
    noProperties: "Aucune propriété ne correspond",
    addAdvanced: "Ajouter un filtre avancé",
    toAdvanced: "Ajouter au filtre avancé",
    deleteFilter: "Supprimer le filtre",
    more: "Plus d’actions",
    deleteAdvanced: "Supprimer le filtre",
    addRule: "Ajouter une règle",
    where: "Où",
    and: "Et",
    or: "Ou",
    rules: "{count} règles",
    rule: "1 règle",
    clear: "Effacer",
    relative: "Relative",
    exact: "Date exacte",
    range: "Période",
    custom: "Personnalisé",
    last: "Derniers",
    next: "Prochains",
    Days: "jours",
    Weeks: "semaines",
    Months: "mois",
    Years: "années",
    apply: "OK",
    from: "Du",
    to: "Au",
    anyDate: "Toutes les dates",
    searchOptions: "Rechercher une option…",
    noOptions: "Aucune option",
    typeValue: "Saisir une valeur…",
    operator: "Opérateur",
    property: "Propriété",
    value: "Valeur",
    period: "Du {start} au {end}",
    oneDay: "Le {start}",
    noPeriod: "Aucune période : toutes les dates",
    checked: "Cochée",
    unchecked: "Non cochée",
    empty: "Vide",
  },
} as const;

export type FilterMenuTextKey = keyof (typeof TEXT)["en"];

/** Looks a translation up; returns undefined when the host has none. */
export type FilterMenuTranslate = (key: string) => string | undefined;

/**
 * The menu's words in English or French (`"fr"` locales); `translate` wins
 * for the keys `filters.menu.<key>`.
 */
export function filterMenuText(
  key: FilterMenuTextKey,
  locale?: string,
  translate?: FilterMenuTranslate
): string {
  return translate?.(`filters.menu.${key}`) || TEXT[localeOf(locale)][key];
}

const OPERATOR_WORDS: Record<Locale, Record<string, string>> = {
  en: {
    contains: "Contains",
    notContains: "Does not contain",
    equals: "Is",
    notEquals: "Is not",
    startsWith: "Starts with",
    endsWith: "Ends with",
    is: "Is",
    isNot: "Is not",
    isAnyOf: "Is",
    isNoneOf: "Is not",
    in: "Is",
    notIn: "Is not",
    containsAll: "Contains all",
    containsNone: "Does not contain",
    isEmpty: "Is empty",
    isNotEmpty: "Is not empty",
    isTrue: "Is checked",
    isFalse: "Is not checked",
    withinDistance: "Within a distance",
    withinBounds: "Within an area",
  },
  fr: {
    contains: "Contient",
    notContains: "Ne contient pas",
    equals: "Est",
    notEquals: "N’est pas",
    startsWith: "Commence par",
    endsWith: "Se termine par",
    is: "Est",
    isNot: "N’est pas",
    isAnyOf: "Est",
    isNoneOf: "N’est pas",
    in: "Est",
    notIn: "N’est pas",
    containsAll: "Contient tout",
    containsNone: "Ne contient aucun",
    isEmpty: "Est vide",
    isNotEmpty: "N’est pas vide",
    isTrue: "Est cochée",
    isFalse: "N’est pas cochée",
    withinDistance: "À moins de",
    withinBounds: "Dans la zone",
  },
};

const DATE_OPERATOR_WORDS: Record<Locale, Record<string, string>> = {
  en: {
    before: "Is before",
    lessThan: "Is before",
    after: "Is after",
    greaterThan: "Is after",
    lessThanOrEqual: "Is on or before",
    greaterThanOrEqual: "Is on or after",
    between: "Is between",
  },
  fr: {
    before: "Est avant",
    lessThan: "Est avant",
    after: "Est après",
    greaterThan: "Est après",
    lessThanOrEqual: "Est le ou avant",
    greaterThanOrEqual: "Est le ou après",
    between: "Est entre",
  },
};

/** Numbers read as signs, as in Notion. */
const NUMBER_SIGNS: Record<string, string> = {
  equals: "=",
  notEquals: "≠",
  greaterThan: ">",
  lessThan: "<",
  greaterThanOrEqual: "≥",
  lessThanOrEqual: "≤",
};

const NUMBER_BETWEEN: Record<Locale, string> = { en: "Between", fr: "Entre" };

/**
 * An operator as the menu shows it for a type: "Is before" for a date, "≥"
 * for a number, "Contains" for text. `translate` wins for the keys
 * `filters.menu.operators.<type>.<operator>`, then
 * `filters.menu.operators.<operator>`.
 */
export function filterOperatorLabel(
  type: FilterMenuType,
  operator: string,
  locale?: string,
  translate?: FilterMenuTranslate
): string {
  const custom =
    translate?.(`filters.menu.operators.${type}.${operator}`) ||
    translate?.(`filters.menu.operators.${operator}`);
  if (custom) {
    return custom;
  }
  const language = localeOf(locale);
  if (type === "number") {
    const sign = NUMBER_SIGNS[operator];
    if (sign) {
      return sign;
    }
    if (operator === "between") {
      return NUMBER_BETWEEN[language];
    }
  }
  if (type === "date") {
    const word = DATE_OPERATOR_WORDS[language][operator];
    if (word) {
      return word;
    }
  }
  return OPERATOR_WORDS[language][operator] ?? operator;
}

/** The relative choices the date editor shows first, as rows of three. */
export const DATE_PRESET_ROWS: readonly (readonly RelativeDateToken[])[] = [
  ["$today", "$yesterday", "$tomorrow"],
  ["$thisWeek", "$lastWeek", "$nextWeek"],
  ["$thisMonth", "$lastMonth", "$nextMonth"],
  ["$thisYear", "$lastYear", "$nextYear"],
  ["$last7Days", "$last30Days", "$last90Days"],
];

const ROLLING = /^\$(last|next)(\d+)(Days|Weeks|Months|Years)$/;

/** A rolling period's parts: `"$last30Days"` is last, 30, Days. */
export interface RollingDate {
  direction: "last" | "next";
  count: number;
  unit: RelativeDateUnit;
}

/** The parts of a rolling token, or undefined for another value. */
export function rollingDateOf(value: unknown): RollingDate | undefined {
  if (!isRelativeDateToken(value)) {
    return;
  }
  const match = ROLLING.exec(value);
  return match
    ? {
        direction: match[1] as RollingDate["direction"],
        count: Number(match[2]),
        unit: match[3] as RelativeDateUnit,
      }
    : undefined;
}

/** The token of a rolling period, or undefined when out of range. */
export function rollingDateToken({
  direction,
  count,
  unit,
}: RollingDate): RelativeDateToken | undefined {
  const token = `$${direction}${Math.trunc(count)}${unit}`;
  return isRelativeDateToken(token) ? token : undefined;
}

/** How a date rule names its days in the editor. */
export type DateRuleMode = "relative" | "exact" | "range";

/** The editor's mode for a date rule: a token is relative, `between` days a range. */
export function dateRuleMode(rule: FilterMenuRule): DateRuleMode {
  if (relativeDateTokenOf(rule.values)) {
    return "relative";
  }
  if (rule.operator === "between") {
    return "range";
  }
  const day = Array.isArray(rule.values) ? rule.values[0] : rule.values;
  return day === undefined || day === null || day === "" ? "relative" : "exact";
}

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** A calendar day in words: "16 Oct 2026", without a time zone shift. */
export function filterDayText(
  day: CalendarDay,
  locale?: string,
  withYear = true
): string {
  const key = `${locale ?? ""}|${withYear}`;
  let format = dayFormats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(locale || undefined, {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
      });
    } catch {
      format = new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
    }
    dayFormats.set(key, format);
  }
  return format.format(new Date(`${day}T12:00:00Z`));
}

/**
 * The days a relative token or day stands for today, in short words: "1 –
 * 31 Oct" (the year shows when it is not the current one), or one day.
 */
export function filterPeriodDates(
  value: unknown,
  locale?: string,
  context: RelativeDateContext = {}
): string {
  const range = isRelativeDateToken(value)
    ? resolveRelativeDate(value, context)
    : undefined;
  const single = range ? undefined : calendarDay(value);
  const start = range?.start ?? single;
  const end = range?.end ?? single;
  if (!(start && end)) {
    return "";
  }
  const thisYear = String(new Date().getFullYear());
  const withYear =
    start.slice(0, 4) !== thisYear || end.slice(0, 4) !== thisYear;
  if (start === end) {
    return filterDayText(start, locale, withYear);
  }
  return `${filterDayText(start, locale, withYear)} – ${filterDayText(end, locale, withYear)}`;
}

/** What a column is to the menu: its name, type, options and formats. */
export interface FilterMenuColumn {
  id: string;
  header: string;
  type: FilterMenuType;
  options?: readonly { value: unknown; label: string }[];
  /** Shows a number value in the column's format. */
  formatNumber?: (value: number) => string;
}

/** Two values, then "+N" for the others. */
const listText = (items: string[]): string => {
  const shown = items.slice(0, 2).join(", ");
  const rest = items.length - 2;
  return rest > 0 ? `${shown} +${rest}` : shown;
};

/** One value of a rule in words: a relative date, a day, an option label. */
function valueText(
  value: unknown,
  column: FilterMenuColumn,
  locale?: string,
  translate?: FilterMenuTranslate
): string {
  if (column.type === "date") {
    if (isRelativeDateToken(value)) {
      return relativeDateLabel(value, locale, translate);
    }
    const day = calendarDay(value);
    return day ? filterDayText(day, locale) : String(value ?? "");
  }
  if (column.type === "number" && typeof value === "number") {
    return column.formatNumber?.(value) ?? value.toLocaleString(locale);
  }
  const option = column.options?.find(
    (item) => String(item.value) === String(value)
  );
  if (option) {
    return option.label;
  }
  if (typeof value === "boolean") {
    return filterMenuText(value ? "checked" : "unchecked", locale, translate);
  }
  return String(value ?? "");
}

/** A chip's words: the column, then the operator and value when set. */
export interface FilterRuleSummary {
  /** "Status", or "Status:" when a value follows. */
  property: string;
  /** "Won, Open", "≥ 5,000", "Is before 1 Oct 2026"; empty for an empty rule. */
  value: string;
  /** Whether the rule filters (an incomplete rule shows but filters nothing). */
  complete: boolean;
}

/** Operators a summary leaves unsaid: "Status: Won" reads as "Status is Won". */
const IMPLIED = new Set(["equals", "is", "isAnyOf", "in", "contains"]);

/**
 * What a rule's chip reads, like Notion: "Status: Won, Open", "Amount ≥
 * 5,000", "Due: This week", "Name contains acme", "Client is empty".
 */
export function filterRuleSummary(
  rule: FilterMenuRule,
  column: FilterMenuColumn,
  locale?: string,
  translate?: FilterMenuTranslate
): FilterRuleSummary {
  const complete = filterRuleComplete({ ...rule, type: column.type });
  if (!complete) {
    return { property: column.header, value: "", complete };
  }
  const operator = filterOperatorLabel(
    column.type,
    rule.operator,
    locale,
    translate
  );
  if (!filterOperatorNeedsValue(rule.operator)) {
    return {
      property: column.header,
      value: operator.toLocaleLowerCase(locale),
      complete,
    };
  }
  const values = Array.isArray(rule.values) ? rule.values : [rule.values];
  const words = values.map((value) =>
    valueText(value, column, locale, translate)
  );
  let text = listText(words);
  if (rule.operator === "between") {
    text = words.slice(0, 2).join(" – ");
  }
  if (column.type === "location") {
    text = operator;
  }
  const implied =
    IMPLIED.has(rule.operator) &&
    !(column.type === "text" && rule.operator === "contains") &&
    !(column.type === "number");
  if (implied || column.type === "location") {
    return { property: `${column.header}:`, value: text, complete };
  }
  const lower =
    column.type === "number" ? operator : operator.toLocaleLowerCase(locale);
  return { property: column.header, value: `${lower} ${text}`, complete };
}

/** What a filter state shows under the toolbar. */
export interface FilterChipsLayout<T extends FilterMenuRule> {
  /** Rules shown as their own chips, joined with "and". */
  chips: T[];
  /** Rules of the advanced filter, shown as one chip; empty without one. */
  advanced: T[];
}

/**
 * Splits a filter state into chips: every rule is a chip while all must
 * match, except pinned date rules (the toolbar's period, which shows on its
 * own); a state where any rule may match is the advanced filter, one chip
 * holding every rule, and `advanced` shows the other rules that way too.
 */
export function filterChipsLayout<T extends FilterMenuRule>(
  rules: readonly T[],
  joinOperator: "and" | "or",
  {
    advanced = false,
    pinnedColumns = [],
  }: { advanced?: boolean; pinnedColumns?: readonly string[] } = {}
): FilterChipsLayout<T> {
  if (joinOperator === "or") {
    return { chips: [], advanced: [...rules] };
  }
  const pinned = new Set(pinnedColumns.map(filterBarDateRuleId));
  const unpinned = rules.filter((rule) => !pinned.has(rule.id));
  return advanced
    ? { chips: [], advanced: unpinned }
    : { chips: unpinned, advanced: [] };
}

/** "3 rules" / "1 rule" in the menu's words. */
export function filterRulesCountText(
  count: number,
  locale?: string,
  translate?: FilterMenuTranslate
): string {
  return count === 1
    ? filterMenuText("rule", locale, translate)
    : filterMenuText("rules", locale, translate).replace(
        "{count}",
        String(count)
      );
}

/** Words for a period in full, under the date editor: "From 1 Oct 2026 to 31 Oct 2026". */
export function filterPeriodSentence(
  value: unknown,
  locale?: string,
  translate?: FilterMenuTranslate,
  context: RelativeDateContext = {}
): string {
  const range = isRelativeDateToken(value)
    ? resolveRelativeDate(value, context)
    : undefined;
  const single = range ? undefined : calendarDay(value);
  const start = range?.start ?? single;
  const end = range?.end ?? single;
  if (!(start && end)) {
    return filterMenuText("noPeriod", locale, translate);
  }
  const template =
    start === end
      ? filterMenuText("oneDay", locale, translate)
      : filterMenuText("period", locale, translate);
  return template
    .replace("{start}", filterDayText(start, locale))
    .replace("{end}", filterDayText(end, locale));
}
