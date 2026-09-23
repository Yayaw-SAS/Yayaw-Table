/**
 * Conditions engine shared by every form of the React and Vue editions (Form
 * view, record create/edit forms and bulk edit). Rules show, hide, require or
 * set questions when their conditions match the current answers. It is pure
 * and has no UI dependency, so hosts can run it on their server too.
 *
 * ```ts
 * const rules: FormRule[] = [{
 *   id: "hardware",
 *   when: { join: "and", items: [{ fieldId: "category", operator: "is", value: "Hardware" }] },
 *   then: { action: "show", questionIds: ["serial"] },
 * }];
 * evaluateForm(rules, { category: "Hardware" }, fields).visible.has("serial"); // true
 * ```
 */

/** The value family a condition compares, derived from a column or field type. */
export type ConditionFieldType =
  | "checkbox"
  | "date"
  | "multiSelect"
  | "number"
  | "select"
  | "text";

export type ConditionOperator =
  // text
  | "is"
  | "isNot"
  | "contains"
  | "notContains"
  | "startsWith"
  // number
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  // number and date
  | "between"
  // date
  | "on"
  | "before"
  | "after"
  | "inLast"
  | "inNext"
  // select
  | "isAnyOf"
  | "isNoneOf"
  // multi-select
  | "containsAny"
  | "containsAll"
  | "containsNone"
  // checkbox
  | "isChecked"
  | "isUnchecked"
  // every type but checkbox
  | "isEmpty"
  | "isNotEmpty";

export type ConditionScalar = boolean | number | string;
/** A scalar, a list, or `[from, to]` (an open end is `null`). */
export type ConditionValue =
  | ConditionScalar
  | (ConditionScalar | null)[]
  | null;

/** One comparison: the answer of `fieldId` against `value`. */
export interface Condition {
  fieldId: string;
  operator: ConditionOperator;
  /** A scalar, `[from, to]` for `between`, a list for `isAnyOf`…, days for `inLast`/`inNext`. */
  value?: ConditionValue;
}

/**
 * A code-only condition (not serializable): the legacy `hidden` predicate of
 * record form fields is converted to one when a form loads. It reads the
 * answers as given (hidden ones included), as the predicate always did.
 */
export interface CustomCondition {
  fieldId?: string;
  operator: "custom";
  test: (values: Record<string, unknown>, context?: unknown) => boolean;
}

export type ConditionItem = Condition | ConditionGroup | CustomCondition;

/** Conditions joined by AND or OR; items may be nested groups. */
export interface ConditionGroup {
  join: "and" | "or";
  items: ConditionItem[];
}

export type FormRuleAction = "hide" | "require" | "set" | "show";

export interface FormRuleEffect {
  action: FormRuleAction;
  /** Form view questions (or sections) the rule acts on. */
  questionIds?: string[];
  /** Record form fields the rule acts on. */
  fieldIds?: string[];
  /** The value written by `set`. */
  value?: ConditionValue;
}

export interface FormRule {
  id: string;
  when: ConditionGroup;
  then: FormRuleEffect;
}

/** What the engine needs to know about a question or field. */
export interface ConditionField {
  id: string;
  type: ConditionFieldType;
  label?: string;
  options?: readonly { value: unknown; label: string }[];
  /** Required without any rule. */
  required?: boolean;
}

export interface FormEvaluation {
  visible: Set<string>;
  hidden: Set<string>;
  /** Visible and required, by the field itself or a matching `require` rule. */
  required: Set<string>;
  /** Values written by matching `set` rules, for visible targets. */
  setValues: Record<string, unknown>;
  /** Rule ids whose conditions match. */
  matched: Set<string>;
}

export interface EvaluateOptions {
  /** "Today" for relative dates (defaults to now). */
  now?: Date;
  /** Fields whose value differs across a bulk selection: conditions on them never match. */
  mixed?: Iterable<string>;
  /** Children hidden with their parent, e.g. the questions of a section. */
  groups?: Record<string, readonly string[]>;
  /** Passed to custom conditions. */
  context?: unknown;
}

type ValueKind = "days" | "list" | "none" | "range" | "single";

export const CONDITION_OPERATORS: Record<
  ConditionFieldType,
  readonly ConditionOperator[]
> = {
  text: [
    "is",
    "isNot",
    "contains",
    "notContains",
    "startsWith",
    "isEmpty",
    "isNotEmpty",
  ],
  number: [
    "eq",
    "neq",
    "lt",
    "lte",
    "gt",
    "gte",
    "between",
    "isEmpty",
    "isNotEmpty",
  ],
  date: [
    "on",
    "before",
    "after",
    "between",
    "inLast",
    "inNext",
    "isEmpty",
    "isNotEmpty",
  ],
  select: ["is", "isNot", "isAnyOf", "isNoneOf", "isEmpty", "isNotEmpty"],
  multiSelect: [
    "containsAny",
    "containsAll",
    "containsNone",
    "isEmpty",
    "isNotEmpty",
  ],
  checkbox: ["isChecked", "isUnchecked"],
};

const NO_VALUE = new Set<ConditionOperator>([
  "isEmpty",
  "isNotEmpty",
  "isChecked",
  "isUnchecked",
]);
const LIST_VALUE = new Set<ConditionOperator>([
  "isAnyOf",
  "isNoneOf",
  "containsAny",
  "containsAll",
  "containsNone",
]);
const ACTIONS = new Set<FormRuleAction>(["hide", "require", "set", "show"]);
const ALL_OPERATORS = new Set<string>(
  Object.values(CONDITION_OPERATORS).flat()
);
const DAY_MS = 86_400_000;
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** The kind of value an operator takes: none, one, `[from, to]`, a list or a number of days. */
export function operatorValueKind(operator: ConditionOperator): ValueKind {
  if (NO_VALUE.has(operator)) {
    return "none";
  }
  if (LIST_VALUE.has(operator)) {
    return "list";
  }
  if (operator === "between") {
    return "range";
  }
  return operator === "inLast" || operator === "inNext" ? "days" : "single";
}

/** The condition type of a column, question editor or record form field type. */
export function conditionFieldType(
  type: string | undefined
): ConditionFieldType {
  switch (type) {
    case "number":
    case "currency":
    case "percent":
      return "number";
    case "date":
    case "datetime":
      return "date";
    case "select":
    case "radio":
    case "select-with-add-new":
    case "tag":
      return "select";
    case "multiSelect":
    case "tags":
      return "multiSelect";
    case "boolean":
    case "checkbox":
    case "switch":
      return "checkbox";
    default:
      return "text";
  }
}

// Values -----------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isConditionGroup = (item: unknown): item is ConditionGroup =>
  isRecord(item) && Array.isArray(item.items);

export const isCustomCondition = (item: unknown): item is CustomCondition =>
  isRecord(item) &&
  item.operator === "custom" &&
  typeof item.test === "function";

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return typeof value === "string" && value.trim() === "";
}

const toText = (value: unknown): string =>
  isEmptyValue(value) ? "" : String(value).trim().toLocaleLowerCase();

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return Number.NaN;
  }
  return Number(value.trim().replace(",", "."));
}

/** A day number (days since 1970-01-01) for `YYYY-MM-DD…` strings and dates. */
function toDay(value: unknown): number {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? Number.NaN
      : Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) /
          DAY_MS;
  }
  const match = typeof value === "string" ? DATE_PREFIX.exec(value) : null;
  if (!match) {
    return Number.NaN;
  }
  return (
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS
  );
}

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => !isEmptyValue(item)).map(String);
  }
  return isEmptyValue(value) ? [] : [String(value)];
};

const pair = (value: unknown): [unknown, unknown] =>
  Array.isArray(value) ? [value[0], value[1]] : [undefined, undefined];

const isChecked = (value: unknown): boolean =>
  value === true || value === "true";

// Comparisons --------------------------------------------------------------

function compareText(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown
): boolean {
  const left = toText(actual);
  const right = toText(expected);
  switch (operator) {
    case "is":
      return left === right;
    case "isNot":
      return left !== right;
    case "contains":
      return right !== "" && left.includes(right);
    case "notContains":
      return right === "" || !left.includes(right);
    case "startsWith":
      return right !== "" && left.startsWith(right);
    default:
      return false;
  }
}

function inRange(value: number, [from, to]: [number, number]): boolean {
  const low = Number.isNaN(from) ? Number.NEGATIVE_INFINITY : from;
  const high = Number.isNaN(to) ? Number.POSITIVE_INFINITY : to;
  return !Number.isNaN(value) && value >= low && value <= high;
}

function compareOrdered(
  operator: ConditionOperator,
  left: number,
  right: number
): boolean {
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return operator === "neq" && !Number.isNaN(right);
  }
  switch (operator) {
    case "eq":
    case "on":
      return left === right;
    case "neq":
      return left !== right;
    case "lt":
    case "before":
      return left < right;
    case "lte":
      return left <= right;
    case "gt":
    case "after":
      return left > right;
    case "gte":
      return left >= right;
    default:
      return false;
  }
}

function compareNumber(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown
): boolean {
  const value = toNumber(actual);
  if (operator === "between") {
    const [from, to] = pair(expected);
    return inRange(value, [toNumber(from), toNumber(to)]);
  }
  return compareOrdered(operator, value, toNumber(expected));
}

function compareDate(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown,
  now: Date
): boolean {
  const day = toDay(actual);
  if (operator === "between") {
    const [from, to] = pair(expected);
    return inRange(day, [toDay(from), toDay(to)]);
  }
  if (operator === "inLast" || operator === "inNext") {
    const today = toDay(now);
    const days = Math.max(0, toNumber(expected));
    if (Number.isNaN(days)) {
      return false;
    }
    return operator === "inLast"
      ? inRange(day, [today - days, today])
      : inRange(day, [today, today + days]);
  }
  return compareOrdered(operator, day, toDay(expected));
}

function compareSelect(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown
): boolean {
  const value = isEmptyValue(actual) ? undefined : String(actual);
  switch (operator) {
    case "is":
      return value !== undefined && value === String(expected);
    case "isNot":
      return value !== String(expected);
    case "isAnyOf":
      return value !== undefined && toList(expected).includes(value);
    case "isNoneOf":
      return value === undefined || !toList(expected).includes(value);
    default:
      return false;
  }
}

function compareMulti(
  operator: ConditionOperator,
  actual: unknown,
  expected: unknown
): boolean {
  const values = toList(actual);
  const wanted = toList(expected);
  switch (operator) {
    case "containsAny":
      return wanted.some((item) => values.includes(item));
    case "containsAll":
      return wanted.length > 0 && wanted.every((item) => values.includes(item));
    case "containsNone":
      return !wanted.some((item) => values.includes(item));
    default:
      return false;
  }
}

/** Whether one answer satisfies a condition, for a field of the given type. */
export function matchCondition(
  type: ConditionFieldType,
  condition: Pick<Condition, "operator" | "value">,
  actual: unknown,
  now: Date = new Date()
): boolean {
  const { operator, value } = condition;
  if (operator === "isEmpty") {
    return isEmptyValue(actual);
  }
  if (operator === "isNotEmpty") {
    return !isEmptyValue(actual);
  }
  switch (type) {
    case "checkbox":
      return operator === "isChecked" ? isChecked(actual) : !isChecked(actual);
    case "number":
      return compareNumber(operator, actual, value);
    case "date":
      return compareDate(operator, actual, value, now);
    case "select":
      return compareSelect(operator, actual, value);
    case "multiSelect":
      return compareMulti(operator, actual, value);
    default:
      return compareText(operator, actual, value);
  }
}

// Evaluation ---------------------------------------------------------------

interface MatchScope {
  types: Map<string, ConditionFieldType>;
  values: Record<string, unknown>;
  /** The answers as given: custom (legacy) conditions read them unchanged. */
  input: Record<string, unknown>;
  mixed: Set<string>;
  now: Date;
  context: unknown;
}

function matchItem(item: ConditionItem, scope: MatchScope): boolean {
  if (isConditionGroup(item)) {
    return matchGroup(item, scope);
  }
  if (isCustomCondition(item)) {
    return item.test(scope.input, scope.context);
  }
  const type = scope.types.get(item.fieldId);
  if (!type || scope.mixed.has(item.fieldId)) {
    return false;
  }
  return matchCondition(type, item, scope.values[item.fieldId], scope.now);
}

/** An empty group matches nothing, so an unfinished rule never acts. */
function matchGroup(group: ConditionGroup, scope: MatchScope): boolean {
  if (group.items.length === 0) {
    return false;
  }
  return group.join === "or"
    ? group.items.some((item) => matchItem(item, scope))
    : group.items.every((item) => matchItem(item, scope));
}

/** Question or field ids a rule acts on. */
export const ruleTargets = (rule: Pick<FormRule, "then">): string[] => [
  ...(rule.then.questionIds ?? []),
  ...(rule.then.fieldIds ?? []),
];

/** Field ids a condition group reads (custom conditions read none). */
export function conditionFieldIds(group: ConditionGroup): string[] {
  const ids: string[] = [];
  const walk = (item: ConditionItem) => {
    if (isConditionGroup(item)) {
      for (const child of item.items) {
        walk(child);
      }
    } else if (!isCustomCondition(item) && item.fieldId) {
      ids.push(item.fieldId);
    }
  };
  walk(group);
  return [...new Set(ids)];
}

function hiddenTargets(
  rules: readonly FormRule[],
  matched: Set<string>
): Set<string> {
  const showable = new Set<string>();
  const shown = new Set<string>();
  const hidden = new Set<string>();
  for (const rule of rules) {
    const hit = matched.has(rule.id);
    for (const target of ruleTargets(rule)) {
      if (rule.then.action === "show") {
        showable.add(target);
        if (hit) {
          shown.add(target);
        }
      } else if (rule.then.action === "hide" && hit) {
        hidden.add(target);
      }
    }
  }
  for (const target of showable) {
    if (!shown.has(target)) {
      hidden.add(target);
    }
  }
  return hidden;
}

function withGroups(
  hidden: Set<string>,
  groups: Record<string, readonly string[]> | undefined
): Set<string> {
  for (const [parent, children] of Object.entries(groups ?? {})) {
    if (hidden.has(parent)) {
      for (const child of children) {
        hidden.add(child);
      }
    }
  }
  return hidden;
}

function setValuesOf(
  rules: readonly FormRule[],
  matched: Set<string>,
  hidden: Set<string>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const rule of rules) {
    if (rule.then.action !== "set" || !matched.has(rule.id)) {
      continue;
    }
    for (const target of ruleTargets(rule)) {
      if (!hidden.has(target)) {
        values[target] = rule.then.value ?? null;
      }
    }
  }
  return values;
}

const sameSet = (left: Set<string>, right: Set<string>) =>
  left.size === right.size && [...left].every((item) => right.has(item));

/** Answers as rules read them: set values applied, hidden answers cleared. */
function effectiveValues(
  values: Record<string, unknown>,
  setValues: Record<string, unknown>,
  hidden: Set<string>
): Record<string, unknown> {
  const effective = { ...values, ...setValues };
  for (const id of hidden) {
    effective[id] = undefined;
  }
  return effective;
}

function requiredIds(
  rules: readonly FormRule[],
  fields: readonly ConditionField[],
  matched: Set<string>,
  visible: Set<string>
): Set<string> {
  const required = new Set(
    fields.filter((field) => field.required).map((field) => field.id)
  );
  for (const rule of rules) {
    if (rule.then.action === "require" && matched.has(rule.id)) {
      for (const target of ruleTargets(rule)) {
        required.add(target);
      }
    }
  }
  return new Set([...required].filter((id) => visible.has(id)));
}

/**
 * Which questions are visible and required, and the values `set` rules write.
 * Hidden answers never satisfy another condition, so chains (A shows B, B
 * shows C) settle; the loop is bounded so malformed cycles cannot hang.
 */
export function evaluateForm(
  rules: readonly FormRule[],
  values: Record<string, unknown>,
  fields: readonly ConditionField[],
  options: EvaluateOptions = {}
): FormEvaluation {
  const scope: MatchScope = {
    types: new Map(fields.map((field) => [field.id, field.type])),
    values,
    input: values,
    mixed: new Set(options.mixed ?? []),
    now: options.now ?? new Date(),
    context: options.context,
  };
  let hidden = new Set<string>();
  let setValues: Record<string, unknown> = {};
  let matched = new Set<string>();
  const limit = fields.length + rules.length + 2;
  for (let round = 0; round < limit; round += 1) {
    scope.values = effectiveValues(values, setValues, hidden);
    matched = new Set(
      rules
        .filter((rule) => matchGroup(rule.when, scope))
        .map((rule) => rule.id)
    );
    const nextHidden = withGroups(
      hiddenTargets(rules, matched),
      options.groups
    );
    const nextSet = setValuesOf(rules, matched, nextHidden);
    const stable =
      sameSet(hidden, nextHidden) &&
      JSON.stringify(setValues) === JSON.stringify(nextSet);
    hidden = nextHidden;
    setValues = nextSet;
    if (stable) {
      break;
    }
  }
  const ids = new Set([
    ...fields.map((field) => field.id),
    ...rules.flatMap(ruleTargets),
    ...Object.values(options.groups ?? {}).flat(),
  ]);
  const visible = new Set([...ids].filter((id) => !hidden.has(id)));
  return {
    visible,
    hidden,
    required: requiredIds(rules, fields, matched, visible),
    setValues,
    matched,
  };
}

/** Answers to submit: hidden ones removed, `set` values applied. */
export function applyFormEvaluation(
  values: Record<string, unknown>,
  evaluation: Pick<FormEvaluation, "hidden" | "setValues">
): Record<string, unknown> {
  const output: Record<string, unknown> = {
    ...values,
    ...evaluation.setValues,
  };
  for (const id of evaluation.hidden) {
    Reflect.deleteProperty(output, id);
  }
  return output;
}

/** Fields whose rules read one of `ids` (e.g. the mixed values of a bulk selection). */
export function rulesReading(
  rules: readonly FormRule[],
  target: string,
  ids: Iterable<string>
): string[] {
  const wanted = new Set(ids);
  return [
    ...new Set(
      rules
        .filter((rule) => ruleTargets(rule).includes(target))
        .flatMap((rule) => conditionFieldIds(rule.when))
        .filter((id) => wanted.has(id))
    ),
  ];
}

// Structure and validation -------------------------------------------------

const isScalar = (value: unknown): value is ConditionScalar =>
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value));

function sanitizeValue(value: unknown): ConditionValue | undefined {
  if (value === null || isScalar(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item === null || isScalar(item));
  }
}

const idList = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && item.trim() !== ""
          )
        ),
      ]
    : undefined;

function sanitizeCondition(
  value: Record<string, unknown>
): Condition | undefined {
  if (
    typeof value.operator !== "string" ||
    !ALL_OPERATORS.has(value.operator)
  ) {
    return;
  }
  const condition: Condition = {
    fieldId: typeof value.fieldId === "string" ? value.fieldId : "",
    operator: value.operator as ConditionOperator,
  };
  const sanitized = sanitizeValue(value.value);
  if (sanitized !== undefined) {
    condition.value = sanitized;
  }
  return condition;
}

function sanitizeGroup(
  value: unknown,
  depth: number
): ConditionGroup | undefined {
  if (!isConditionGroup(value) || depth > 8) {
    return;
  }
  const items = (value.items as unknown[]).flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    const child = isConditionGroup(item)
      ? sanitizeGroup(item, depth + 1)
      : sanitizeCondition(item);
    return child ? [child] : [];
  });
  return { join: value.join === "or" ? "or" : "and", items };
}

function sanitizeEffect(value: unknown): FormRuleEffect | undefined {
  if (!(isRecord(value) && ACTIONS.has(value.action as FormRuleAction))) {
    return;
  }
  const effect: FormRuleEffect = { action: value.action as FormRuleAction };
  const questionIds = idList(value.questionIds);
  const fieldIds = idList(value.fieldIds);
  if (questionIds) {
    effect.questionIds = questionIds;
  }
  if (fieldIds) {
    effect.fieldIds = fieldIds;
  }
  const setValue = sanitizeValue(value.value);
  if (effect.action === "set" && setValue !== undefined) {
    effect.value = setValue;
  }
  return effect;
}

function sanitizeRule(
  item: unknown,
  index: number,
  ids: Set<string>
): FormRule | undefined {
  if (!isRecord(item)) {
    return;
  }
  const when = sanitizeGroup(item.when, 0);
  const then = sanitizeEffect(item.then);
  if (!(when && then)) {
    return;
  }
  let id =
    typeof item.id === "string" && item.id.trim()
      ? item.id.trim()
      : `rule-${index + 1}`;
  while (ids.has(id)) {
    id = `${id}-${index + 1}`;
  }
  ids.add(id);
  return { id, when, then };
}

/**
 * Keep the structure of saved rules (JSON-safe, unique ids), even unfinished
 * ones a settings editor is still building. `normalizeRules` decides which
 * rules can act.
 */
export function sanitizeRules(value: unknown): FormRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = new Set<string>();
  return value.flatMap((item, index) => {
    const rule = sanitizeRule(item, index, ids);
    return rule ? [rule] : [];
  });
}

export type RuleIssueCode =
  | "cycle"
  | "emptyGroup"
  | "laterQuestion"
  | "missingField"
  | "missingValue"
  | "noTargets"
  | "operator"
  | "selfReference"
  | "unknownField"
  | "unknownOption"
  | "unknownTarget";

export interface RuleIssue {
  ruleId: string;
  code: RuleIssueCode;
  /** Indexes from the rule's group down to the condition, e.g. `[1, 0]`. */
  path?: number[];
  fieldId?: string;
}

export interface ValidateRulesOptions {
  /** Ids a rule may act on besides fields, e.g. Form view sections. */
  targets?: readonly string[];
  /** Question order; with `layout: "steps"`, `require` and `set` may not read a later question. */
  order?: readonly string[];
  layout?: "page" | "steps";
}

function valueIssue(
  field: ConditionField,
  condition: Condition
): RuleIssueCode | undefined {
  const kind = operatorValueKind(condition.operator);
  const { value } = condition;
  if (kind === "none") {
    return;
  }
  if (kind === "range") {
    const [from, to] = pair(value);
    return isEmptyValue(from) && isEmptyValue(to) ? "missingValue" : undefined;
  }
  if (kind === "list") {
    return toList(value).length
      ? optionIssue(field, toList(value))
      : "missingValue";
  }
  if (isEmptyValue(value)) {
    return "missingValue";
  }
  return field.type === "select"
    ? optionIssue(field, [String(value)])
    : undefined;
}

function optionIssue(
  field: ConditionField,
  values: string[]
): RuleIssueCode | undefined {
  if (!field.options?.length) {
    return;
  }
  const known = new Set(field.options.map((option) => String(option.value)));
  return values.every((value) => known.has(value))
    ? undefined
    : "unknownOption";
}

function conditionIssue(
  condition: Condition,
  fields: Map<string, ConditionField>
): RuleIssueCode | undefined {
  if (!condition.fieldId) {
    return "missingField";
  }
  const field = fields.get(condition.fieldId);
  if (!field) {
    return "unknownField";
  }
  if (!CONDITION_OPERATORS[field.type].includes(condition.operator)) {
    return "operator";
  }
  return valueIssue(field, condition);
}

function groupIssues(
  group: ConditionGroup,
  fields: Map<string, ConditionField>,
  path: number[]
): Omit<RuleIssue, "ruleId">[] {
  if (group.items.length === 0) {
    return [{ code: "emptyGroup", path }];
  }
  return group.items.flatMap((item, index) => {
    const at = [...path, index];
    if (isConditionGroup(item)) {
      return groupIssues(item, fields, at);
    }
    if (isCustomCondition(item)) {
      return [];
    }
    const code = conditionIssue(item, fields);
    return code ? [{ code, path: at, fieldId: item.fieldId }] : [];
  });
}

function targetIssues(
  rule: FormRule,
  fields: Map<string, ConditionField>,
  options: ValidateRulesOptions
): RuleIssue[] {
  const targets = ruleTargets(rule);
  if (targets.length === 0) {
    return [{ ruleId: rule.id, code: "noTargets" }];
  }
  const extra = new Set(options.targets ?? []);
  const reads = new Set(conditionFieldIds(rule.when));
  return targets.flatMap((target): RuleIssue[] => {
    if (!(fields.has(target) || extra.has(target))) {
      return [{ ruleId: rule.id, code: "unknownTarget", fieldId: target }];
    }
    return reads.has(target)
      ? [{ ruleId: rule.id, code: "selfReference", fieldId: target }]
      : [];
  });
}

/** In steps, a `require` or `set` rule cannot depend on a later question. */
function orderIssues(
  rule: FormRule,
  options: ValidateRulesOptions
): RuleIssue[] {
  if (
    options.layout !== "steps" ||
    !options.order ||
    rule.then.action === "show" ||
    rule.then.action === "hide"
  ) {
    return [];
  }
  const position = new Map(options.order.map((id, index) => [id, index]));
  const first = Math.min(
    ...ruleTargets(rule).map(
      (id) => position.get(id) ?? Number.POSITIVE_INFINITY
    )
  );
  return conditionFieldIds(rule.when)
    .filter((id) => (position.get(id) ?? -1) > first)
    .map((fieldId) => ({ ruleId: rule.id, code: "laterQuestion", fieldId }));
}

/** Directed edges: a condition field influences each target of its rule. */
function ruleEdges(rules: readonly FormRule[]): Map<string, Set<string>> {
  const edges = new Map<string, Set<string>>();
  for (const rule of rules) {
    for (const from of conditionFieldIds(rule.when)) {
      const next = edges.get(from) ?? new Set<string>();
      for (const target of ruleTargets(rule)) {
        next.add(target);
      }
      edges.set(from, next);
    }
  }
  return edges;
}

function reaches(
  edges: Map<string, Set<string>>,
  from: string,
  to: string
): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const current = stack.pop() as string;
    if (current === to) {
      return true;
    }
    if (!seen.has(current)) {
      seen.add(current);
      stack.push(...(edges.get(current) ?? []));
    }
  }
  return false;
}

/** Whether a rule closes a loop with the others: a target that reads itself back. */
function closesCycle(rule: FormRule, others: readonly FormRule[]): boolean {
  const edges = ruleEdges(others);
  return ruleTargets(rule).some((target) =>
    conditionFieldIds(rule.when).some(
      (from) => from === target || reaches(edges, target, from)
    )
  );
}

/** Rule ids that close a loop, in rule order (the earlier rules are kept). */
export function detectRuleCycles(rules: readonly FormRule[]): string[] {
  const kept: FormRule[] = [];
  const cyclic: string[] = [];
  for (const rule of rules) {
    if (closesCycle(rule, kept)) {
      cyclic.push(rule.id);
    } else {
      kept.push(rule);
    }
  }
  return cyclic;
}

/** Every problem of a rule set: unknown fields, operator/type mismatches, missing values, cycles. */
export function validateRules(
  rules: readonly FormRule[],
  fields: readonly ConditionField[],
  options: ValidateRulesOptions = {}
): RuleIssue[] {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const issues = rules.flatMap((rule) => [
    ...groupIssues(rule.when, byId, []).map((issue) => ({
      ...issue,
      ruleId: rule.id,
    })),
    ...targetIssues(rule, byId, options),
    ...orderIssues(rule, options),
  ]);
  const cycles = detectRuleCycles(rules).map(
    (ruleId): RuleIssue => ({ ruleId, code: "cycle" })
  );
  return [...issues, ...cycles];
}

export interface DroppedRule {
  id: string;
  reason: RuleIssueCode | "invalid";
}

/**
 * Rules that can act: structurally valid, every condition complete and
 * matching its field's type, known targets and no cycle. Broken rules are
 * dropped with their reason instead of throwing.
 */
export function normalizeRules(
  value: unknown,
  fields: readonly ConditionField[],
  options: ValidateRulesOptions = {}
): { rules: FormRule[]; dropped: DroppedRule[] } {
  const input = Array.isArray(value) ? value : [];
  const dropped: DroppedRule[] = [];
  const ids = new Set<string>();
  const sanitized: FormRule[] = [];
  for (const [index, item] of input.entries()) {
    const rule = sanitizeRule(item, index, ids);
    if (rule) {
      sanitized.push(rule);
    } else {
      const id = isRecord(item) && typeof item.id === "string" ? item.id : "";
      dropped.push({ id: id || `rule-${index + 1}`, reason: "invalid" });
    }
  }
  const issues = validateRules(sanitized, fields, options).filter(
    (issue) => issue.code !== "cycle"
  );
  const broken = new Map(issues.map((issue) => [issue.ruleId, issue.code]));
  const candidates = sanitized.filter((rule) => {
    const reason = broken.get(rule.id);
    if (reason) {
      dropped.push({ id: rule.id, reason });
    }
    return !reason;
  });
  const cyclic = new Set(detectRuleCycles(candidates));
  for (const id of cyclic) {
    dropped.push({ id, reason: "cycle" });
  }
  return {
    rules: candidates.filter((rule) => !cyclic.has(rule.id)),
    dropped,
  };
}

/**
 * A rule from a code predicate: how the legacy `hidden: (context) => boolean`
 * of record form fields joins the engine (`action: "hide"`).
 */
export function predicateRule(
  id: string,
  targetId: string,
  test: CustomCondition["test"],
  action: FormRuleAction = "hide"
): FormRule {
  const when: ConditionGroup = {
    join: "and",
    items: [{ fieldId: targetId, operator: "custom", test }],
  };
  const then: FormRuleEffect = { action, fieldIds: [targetId] };
  return { id, when, then };
}

// Summaries ----------------------------------------------------------------

/** Words of a summary; `form-view.ts` provides English and French. */
export type ConditionWords = (
  key: string,
  params?: Record<string, number | string>
) => string;

function valueText(field: ConditionField | undefined, value: unknown): string {
  const label = (item: unknown) =>
    field?.options?.find((option) => String(option.value) === String(item))
      ?.label ?? String(item);
  if (Array.isArray(value)) {
    return value.map(label).join(", ");
  }
  return isEmptyValue(value) ? "…" : label(value);
}

function describeCondition(
  condition: Condition,
  fields: Map<string, ConditionField>,
  words: ConditionWords
): string {
  const field = fields.get(condition.fieldId);
  const name = field?.label ?? (condition.fieldId || "…");
  const kind = operatorValueKind(condition.operator);
  const [from, to] = pair(condition.value);
  return words(`op.${condition.operator}`, {
    field: name,
    value: kind === "range" ? "" : valueText(field, condition.value),
    from: valueText(field, from),
    to: valueText(field, to),
  });
}

function describeGroup(
  group: ConditionGroup,
  fields: Map<string, ConditionField>,
  words: ConditionWords,
  nested: boolean
): string {
  const parts = group.items.map((item) => {
    if (isConditionGroup(item)) {
      return describeGroup(item, fields, words, true);
    }
    return isCustomCondition(item)
      ? words("custom")
      : describeCondition(item, fields, words);
  });
  const text = parts.join(` ${words(group.join)} `);
  return nested && parts.length > 1 ? `(${text})` : text;
}

/** "Shown when Category is Hardware and Budget > 1000". */
export function describeRule(
  rule: FormRule,
  fields: readonly ConditionField[],
  words: ConditionWords
): string {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const condition = describeGroup(rule.when, byId, words, false);
  const target = byId.get(ruleTargets(rule)[0] ?? "");
  return words(`then.${rule.then.action}`, {
    condition,
    value: valueText(target, rule.then.value),
  });
}

// Editing ------------------------------------------------------------------

/** The first operator of a type: what a new condition on that field starts with. */
export const defaultOperator = (type: ConditionFieldType): ConditionOperator =>
  CONDITION_OPERATORS[type][0] ?? "isNotEmpty";

/** The item at `path` (indexes from the root group). */
export function conditionAt(
  group: ConditionGroup,
  path: readonly number[]
): ConditionItem | undefined {
  let item: ConditionItem | undefined = group;
  for (const index of path) {
    item = isConditionGroup(item) ? item.items[index] : undefined;
  }
  return item;
}

/** Replace (or remove, with `undefined`) the item at `path`; other items are kept. */
export function updateConditionAt(
  group: ConditionGroup,
  path: readonly number[],
  update: (item: ConditionItem) => ConditionItem | undefined
): ConditionGroup {
  const [index, ...rest] = path;
  if (index === undefined) {
    return group;
  }
  const items = group.items.flatMap((item, position) => {
    if (position !== index) {
      return [item];
    }
    const next =
      rest.length && isConditionGroup(item)
        ? updateConditionAt(item, rest, update)
        : update(item);
    return next ? [next] : [];
  });
  return { ...group, items };
}

/**
 * A condition pointed at another field: the operator is kept when that
 * field's type offers it, the value is cleared.
 */
export function retargetCondition(
  condition: Condition,
  field: ConditionField | undefined
): Condition {
  if (!field) {
    return { fieldId: "", operator: condition.operator };
  }
  const operators = CONDITION_OPERATORS[field.type];
  return {
    fieldId: field.id,
    operator: operators.includes(condition.operator)
      ? condition.operator
      : defaultOperator(field.type),
  };
}

/** A condition with another operator; the value is kept while it still fits. */
export function withOperator(
  condition: Condition,
  operator: ConditionOperator
): Condition {
  const same =
    operatorValueKind(operator) === operatorValueKind(condition.operator);
  return same && operatorValueKind(operator) !== "none"
    ? { ...condition, operator }
    : { fieldId: condition.fieldId, operator };
}
