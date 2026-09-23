"use client";

/**
 * Rule editor of the Form settings: "Show this question when…" with
 * question / comparison / value conditions, an All/Any toggle, one nested
 * group, inline problems and removal. Each condition is a card that stacks
 * its controls in narrow containers (container queries) and lines them up
 * when there is room. Rules are saved with the view (`config.form.rules`);
 * see `utils/form-conditions.ts`.
 */
import { Plus, Trash2, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useDrawerFormPortalContainer } from "../components/forms/drawer-form-portal-context";
import { FormSelectContent } from "../components/forms/fields/form-select-content";
import {
  CONDITION_OPERATORS,
  type Condition,
  type ConditionField,
  type ConditionGroup,
  type ConditionItem,
  type ConditionOperator,
  type ConditionValue,
  type FormRule,
  type FormRuleAction,
  isConditionGroup,
  isCustomCondition,
  operatorValueKind,
  type RuleIssue,
  type RuleIssueCode,
  retargetCondition,
  updateConditionAt,
  withOperator,
} from "../utils/form-conditions";
import {
  type FormLabelKey,
  type FormTranslate,
  formOperatorLabel,
  formRuleInputType,
  formRuleIssueLabel,
  formRuleList,
  formRuleListFrom,
  formRuleRange,
  formRuleValue,
  formRuleValueText,
  type ResolvedFormQuestion,
} from "../utils/form-view";
import { tagAppearance } from "../utils/tag-colors";
import "../utils/tag-colors.css";
import { FormDateField } from "./form-date-field";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

const ACTIONS: { value: FormRuleAction; key: FormLabelKey }[] = [
  { value: "show", key: "actionShow" },
  { value: "hide", key: "actionHide" },
  { value: "require", key: "actionRequire" },
];

const NEW_CONDITION: Condition = { fieldId: "", operator: "is" };

/** Which control of a condition a problem is about. */
const ISSUE_TARGET: Partial<Record<RuleIssueCode, "field" | "operator" | "value">> =
  {
    missingField: "field",
    unknownField: "field",
    selfReference: "field",
    laterQuestion: "field",
    operator: "operator",
    missingValue: "value",
    unknownOption: "value",
  };

interface RuleContext {
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: Label;
  locale: string;
  /** Resolved questions, for option tags. */
  questions?: readonly ResolvedFormQuestion[];
  translate?: FormTranslate;
}

interface RuleOption {
  value: string;
  label: string;
  /** Shown as the table shows it: a tag for tag columns. */
  tag?: ReturnType<typeof tagAppearance>;
}

/** What each control of a condition carries for assistive technologies. */
interface ControlState {
  describedBy?: string;
  invalid?: boolean;
}

function OptionText({ option }: { option: RuleOption }) {
  if (!option.tag) {
    return <span className="truncate">{option.label}</span>;
  }
  return (
    <Badge
      className={cn(
        "yayaw-tag inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-xs",
        option.tag.className
      )}
      data-colored={option.tag.colored}
      style={option.tag.style}
    >
      {option.label}
    </Badge>
  );
}

/** A compact settings select (base-ui), labelled for assistive technologies. */
function RuleSelect({
  describedBy,
  invalid,
  label,
  onChange,
  options,
  placeholder,
  value,
}: ControlState & {
  label: string;
  onChange: (value: string) => void;
  options: RuleOption[];
  placeholder?: string;
  value: string;
}) {
  return (
    <Select
      items={options.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onChange(next);
        }
      }}
      value={value || null}
    >
      <SelectTrigger
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={label}
        className="h-8 w-full min-w-0 bg-background text-xs"
        size="sm"
      >
        <SelectValue placeholder={placeholder}>
          {(selected: string | null) => {
            const option = options.find((item) => item.value === selected);
            return option ? (
              <OptionText option={option} />
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <FormSelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <OptionText option={option} />
          </SelectItem>
        ))}
      </FormSelectContent>
    </Select>
  );
}

/** A value typed in a rule, saved when it loses focus or on Enter. */
function RuleInput({
  describedBy,
  invalid,
  label,
  onCommit,
  type,
  unit,
  value,
}: ControlState & {
  label: string;
  onCommit: (value: string) => void;
  type: "number" | "text";
  /** Shown after the input, e.g. "days". */
  unit?: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  const input = (
    <Input
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-label={label}
      autoComplete="off"
      className={cn(
        "h-8 min-w-0 bg-background text-xs",
        type === "number" && "tabular-nums"
      )}
      inputMode={type === "number" ? "decimal" : undefined}
      onBlur={commit}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        setDraft(event.target.value)
      }
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      type="text"
      value={draft}
    />
  );
  if (!unit) {
    return input;
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {input}
      <span aria-hidden="true" className="shrink-0 text-muted-foreground text-xs">
        {unit}
      </span>
    </div>
  );
}

/** A date in a rule: the table's calendar popover, in the table's language. */
function RuleDate({
  describedBy,
  invalid,
  label,
  locale,
  onChange,
  ruleLabel,
  value,
}: ControlState & {
  label: string;
  locale: string;
  onChange: (value: string) => void;
  ruleLabel: Label;
  value: string;
}) {
  const id = useId();
  const portalContainer = useDrawerFormPortalContainer();
  return (
    <div className="min-w-0 [&_button]:h-8 [&_button]:bg-background [&_button]:text-xs">
      <span className="sr-only" id={`${id}-label`}>
        {label}
      </span>
      <FormDateField
        clearLabel={ruleLabel("clearDate")}
        describedBy={describedBy}
        id={id}
        invalid={invalid}
        labelId={`${id}-label`}
        locale={locale}
        onChange={onChange}
        placeholder={ruleLabel("pickDate")}
        portalContainer={portalContainer}
        value={value}
      />
    </div>
  );
}

function ListValue({
  condition,
  control,
  field,
  label,
  onChange,
  options,
}: {
  condition: Condition;
  control: ControlState;
  field: ConditionField | undefined;
  label: Label;
  onChange: (value: ConditionValue) => void;
  options: RuleOption[];
}) {
  const id = useId();
  const selected = formRuleList(condition.value);
  if (!options.length) {
    return (
      <RuleInput
        {...control}
        label={label("ruleValue")}
        onCommit={(raw) => onChange(formRuleListFrom(raw))}
        type={field?.type === "number" ? "number" : "text"}
        value={selected.join(", ")}
      />
    );
  }
  return (
    <fieldset
      aria-describedby={control.describedBy}
      className="grid min-w-0 gap-1.5 rounded-md border bg-background p-2"
    >
      <legend className="sr-only">{label("ruleValue")}</legend>
      {options.map((option, index) => {
        const checkboxId = `${id}-${index}`;
        return (
          <div className="flex min-w-0 items-center gap-2 text-xs" key={option.value}>
            <Checkbox
              checked={selected.includes(option.value)}
              id={checkboxId}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value)
                )
              }
            />
            <label className="min-w-0" htmlFor={checkboxId}>
              <OptionText option={option} />
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}

function RangeValue({
  condition,
  control,
  field,
  label,
  locale,
  onChange,
}: {
  condition: Condition;
  control: ControlState;
  field: ConditionField | undefined;
  label: Label;
  locale: string;
  onChange: (value: ConditionValue) => void;
}) {
  const [from, to] = Array.isArray(condition.value)
    ? condition.value
    : [null, null];
  const set = (index: 0 | 1, raw: string) =>
    onChange(formRuleRange(field, condition.value, index, raw));
  const ends = [
    { index: 0 as const, key: "ruleFrom" as const, value: from },
    { index: 1 as const, key: "ruleTo" as const, value: to },
  ];
  return (
    <div className="grid min-w-0 grid-cols-2 gap-1.5">
      {ends.map((end) =>
        formRuleInputType(field) === "date" ? (
          <RuleDate
            {...control}
            key={end.key}
            label={label(end.key)}
            locale={locale}
            onChange={(raw) => set(end.index, raw)}
            ruleLabel={label}
            value={formRuleValueText(end.value)}
          />
        ) : (
          <RuleInput
            {...control}
            key={end.key}
            label={label(end.key)}
            onCommit={(raw) => set(end.index, raw)}
            type={formRuleInputType(field) === "number" ? "number" : "text"}
            value={formRuleValueText(end.value)}
          />
        )
      )}
    </div>
  );
}

function ValueEditor({
  condition,
  control,
  field,
  onChange,
  options,
  rule,
}: {
  condition: Condition;
  control: ControlState;
  field: ConditionField | undefined;
  onChange: (value: ConditionValue) => void;
  options: RuleOption[];
  rule: RuleContext;
}) {
  const { label, locale } = rule;
  const kind = operatorValueKind(condition.operator);
  if (kind === "list") {
    return (
      <ListValue
        condition={condition}
        control={control}
        field={field}
        label={label}
        onChange={onChange}
        options={options}
      />
    );
  }
  if (kind === "range") {
    return (
      <RangeValue
        condition={condition}
        control={control}
        field={field}
        label={label}
        locale={locale}
        onChange={onChange}
      />
    );
  }
  if (kind === "single" && field?.type === "select" && options.length) {
    return (
      <RuleSelect
        {...control}
        label={label("ruleValue")}
        onChange={(value) => onChange(value)}
        options={options}
        placeholder={label("choose")}
        value={formRuleValueText(condition.value)}
      />
    );
  }
  if (kind === "single" && formRuleInputType(field) === "date") {
    return (
      <RuleDate
        {...control}
        label={label("ruleValue")}
        locale={locale}
        onChange={(raw) => onChange(formRuleValue(field, raw))}
        ruleLabel={label}
        value={formRuleValueText(condition.value)}
      />
    );
  }
  const days = kind === "days";
  return (
    <RuleInput
      {...control}
      label={days ? label("ruleDays") : label("ruleValue")}
      onCommit={(raw) => onChange(formRuleValue(field, raw, days))}
      type={days || field?.type === "number" ? "number" : "text"}
      unit={days ? label("ruleDaysUnit") : undefined}
      value={formRuleValueText(condition.value)}
    />
  );
}

const samePath = (left: readonly number[] | undefined, right: number[]) =>
  JSON.stringify(left ?? []) === JSON.stringify(right);

function IssueText({
  id,
  issue,
  label,
}: {
  id?: string;
  issue: RuleIssue | undefined;
  label: Label;
}) {
  return issue ? (
    <p
      className="col-span-full text-destructive text-xs"
      data-rule-issue={issue.code}
      id={id}
    >
      {label(formRuleIssueLabel(issue.code))}
    </p>
  ) : null;
}

/** The value's options, as tags when the question shows its options as tags. */
function valueOptions(
  field: ConditionField | undefined,
  questions: readonly ResolvedFormQuestion[] | undefined
): RuleOption[] {
  const question = questions?.find((item) => item.id === field?.id);
  return (field?.options ?? []).map((option) => {
    const value = String(option.value);
    return {
      value,
      label: option.label,
      tag: question?.tags
        ? tagAppearance(value, question.coloredTags)
        : undefined,
    };
  });
}

function ConditionCard({
  condition,
  onChange,
  onRemove,
  path,
  rule,
}: {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
  path: number[];
  rule: RuleContext;
}) {
  const id = useId();
  const { fields, issues, label, locale, translate } = rule;
  const field = fields.find((item) => item.id === condition.fieldId);
  const operators = field ? CONDITION_OPERATORS[field.type] : [];
  const kind = operatorValueKind(condition.operator);
  const issue = issues.find((item) => samePath(item.path, path));
  const target = issue ? ISSUE_TARGET[issue.code] : undefined;
  const issueId = issue ? `${id}-issue` : undefined;
  const control = (name: "field" | "operator" | "value"): ControlState => ({
    describedBy: issueId,
    invalid: target === name,
  });
  const hasValue = Boolean(field) && kind !== "none";
  // Lists and ranges need the width of the card below 34rem.
  const wideValue = kind === "list" || kind === "range";
  return (
    <div className="@container min-w-0" data-rule-condition={path.join(".")}>
      <div className="relative grid gap-1.5 rounded-md border bg-background p-2 pr-9 @min-[34rem]:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_minmax(0,1.25fr)] @min-[34rem]:items-start">
        <Button
          aria-label={label("removeCondition")}
          className="absolute top-3 right-1.5"
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
        <RuleSelect
          {...control("field")}
          label={label("ruleField")}
          onChange={(fieldId) =>
            onChange(
              retargetCondition(
                condition,
                fields.find((item) => item.id === fieldId)
              )
            )
          }
          options={fields.map((item) => ({
            value: item.id,
            label: item.label ?? item.id,
          }))}
          placeholder={label("chooseQuestion")}
          value={condition.fieldId}
        />
        <div className="grid min-w-0 gap-1.5 @min-[18rem]:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] @min-[34rem]:contents">
          <div
            className={cn(
              "min-w-0",
              !hasValue && "col-span-full @min-[34rem]:col-span-2",
              hasValue && wideValue && "@max-[34rem]:col-span-full"
            )}
          >
            <RuleSelect
              {...control("operator")}
              label={label("ruleOperator")}
              onChange={(operator) =>
                onChange(withOperator(condition, operator as ConditionOperator))
              }
              options={operators.map((operator) => ({
                value: operator,
                label: formOperatorLabel(operator, locale, translate),
              }))}
              value={field ? condition.operator : ""}
            />
          </div>
          {hasValue ? (
            <div
              className={cn("min-w-0", wideValue && "@max-[34rem]:col-span-full")}
            >
              <ValueEditor
                condition={condition}
                control={control("value")}
                field={field}
                onChange={(value) => onChange({ ...condition, value })}
                options={valueOptions(field, rule.questions)}
                rule={rule}
              />
            </div>
          ) : null}
        </div>
        <IssueText id={issueId} issue={issue} label={label} />
      </div>
    </div>
  );
}

/** All/Any as a segmented control: two radios, arrow keys switch. */
function JoinToggle({
  group,
  label,
  onChange,
  quietLegend = false,
}: {
  group: ConditionGroup;
  label: Label;
  onChange: (join: "and" | "or") => void;
  /** The group already names itself; its "Match" legend is for screen readers. */
  quietLegend?: boolean;
}) {
  const name = useId();
  const choices = [
    { value: "and" as const, text: label("joinAll"), title: label("joinAnd") },
    { value: "or" as const, text: label("joinAny"), title: label("joinOr") },
  ];
  return (
    <fieldset className="flex min-w-0 items-center gap-2" data-rule-join>
      <legend
        className={
          quietLegend ? "sr-only" : "float-left mr-2 text-muted-foreground text-xs"
        }
      >
        {label("ruleJoin")}
      </legend>
      <div className="inline-flex rounded-md border bg-muted/60 p-0.5">
        {choices.map((choice) => (
          <label
            className="relative inline-flex h-6 cursor-pointer items-center rounded-[calc(var(--radius-md)-2px)] px-2.5 text-muted-foreground text-xs transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50 dark:has-checked:bg-input/60"
            key={choice.value}
            title={choice.title}
          >
            <input
              checked={group.join === choice.value}
              className="sr-only"
              name={name}
              onChange={() => onChange(choice.value)}
              type="radio"
              value={choice.value}
            />
            {choice.text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function GroupItems({
  group,
  onChange,
  path,
  rule,
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  path: number[];
  rule: RuleContext;
}) {
  const update = (at: number[], next: ConditionItem | undefined) =>
    onChange(updateConditionAt(group, at, () => next));
  return (
    <>
      {group.items.map((item, index) => {
        const at = [...path, index];
        const key = `${at.join(".")}-${isConditionGroup(item) ? "group" : "condition"}`;
        if (isConditionGroup(item)) {
          return (
            <NestedGroup
              group={item}
              key={key}
              onChange={(next) => update([index], next)}
              onRemove={() => update([index], undefined)}
              path={at}
              rule={rule}
            />
          );
        }
        if (isCustomCondition(item)) {
          return null;
        }
        return (
          <ConditionCard
            condition={item}
            key={key}
            onChange={(next) => update([index], next)}
            onRemove={() => update([index], undefined)}
            path={at}
            rule={rule}
          />
        );
      })}
    </>
  );
}

/** A nested group: an indented card with its own All/Any toggle. */
function NestedGroup({
  group,
  onChange,
  onRemove,
  path,
  rule,
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  onRemove: () => void;
  path: number[];
  rule: RuleContext;
}) {
  const { issues, label } = rule;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="ml-2 grid min-w-0 gap-1.5 rounded-md border border-l-2 border-l-primary/40 bg-muted/40 p-2 dark:bg-muted/20"
      data-rule-group={path.join(".")}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 pr-7 relative">
        <span className="font-medium text-xs" id={titleId}>
          {label("ruleGroup")}
        </span>
        <JoinToggle
          group={group}
          label={label}
          onChange={(join) => onChange({ ...group, join })}
          quietLegend
        />
        <Button
          aria-label={label("removeGroup")}
          className="absolute top-0 right-0"
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <GroupItems group={group} onChange={onChange} path={path} rule={rule} />
      <IssueText
        issue={issues.find(
          (issue) => issue.code === "emptyGroup" && samePath(issue.path, path)
        )}
        label={label}
      />
      <Button
        className="w-fit font-normal"
        onClick={() =>
          onChange({ ...group, items: [...group.items, { ...NEW_CONDITION }] })
        }
        size="xs"
        type="button"
        variant="ghost"
      >
        <Plus aria-hidden="true" />
        {label("addCondition")}
      </Button>
    </section>
  );
}

/** One rule of a question: its action, its conditions and their problems. */
export function FormRuleEditor({
  fields,
  issues,
  label,
  locale,
  onChange,
  onRemove,
  questions,
  rule,
  translate,
}: {
  rule: FormRule;
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: Label;
  locale: string;
  questions?: readonly ResolvedFormQuestion[];
  translate?: FormTranslate;
  onChange: (rule: FormRule) => void;
  onRemove: () => void;
}) {
  const context: RuleContext = {
    fields,
    issues,
    label,
    locale,
    questions,
    translate,
  };
  const setWhen = (when: ConditionGroup) => onChange({ ...rule, when });
  const ruleIssue = issues.find(
    (issue) =>
      !issue.path || (issue.code === "emptyGroup" && samePath(issue.path, []))
  );
  const hasGroup = rule.when.items.some(isConditionGroup);
  return (
    <div
      className="grid min-w-0 gap-2 rounded-lg border bg-card p-2 text-card-foreground"
      data-form-rule={rule.id}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <RuleSelect
          label={label("ruleAction")}
          onChange={(action) => {
            const then = { ...rule.then, action: action as FormRuleAction };
            onChange({ ...rule, then });
          }}
          options={ACTIONS.map((action) => ({
            value: action.value,
            label: label(action.key),
          }))}
          value={rule.then.action}
        />
        <Button
          aria-label={label("removeRule")}
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {rule.when.items.length > 1 ? (
        <JoinToggle
          group={rule.when}
          label={label}
          onChange={(join) => setWhen({ ...rule.when, join })}
        />
      ) : null}
      <GroupItems
        group={rule.when}
        onChange={setWhen}
        path={[]}
        rule={context}
      />
      <IssueText issue={ruleIssue} label={label} />
      <div className="flex flex-wrap gap-1">
        <Button
          className="font-normal"
          onClick={() =>
            setWhen({
              ...rule.when,
              items: [...rule.when.items, { ...NEW_CONDITION }],
            })
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          <Plus aria-hidden="true" />
          {label("addCondition")}
        </Button>
        {hasGroup ? null : (
          <Button
            className="font-normal"
            onClick={() =>
              setWhen({
                ...rule.when,
                items: [
                  ...rule.when.items,
                  {
                    join: rule.when.join === "and" ? "or" : "and",
                    items: [{ ...NEW_CONDITION }],
                  },
                ],
              })
            }
            size="xs"
            type="button"
            variant="ghost"
          >
            <Plus aria-hidden="true" />
            {label("addGroup")}
          </Button>
        )}
      </div>
    </div>
  );
}
