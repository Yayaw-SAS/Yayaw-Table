"use client";

/**
 * Rule editor of the Form settings: "Show this question when…" with
 * question / comparison / value rows, an All/Any toggle, one nested group,
 * inline problems and removal. Rules are saved with the view
 * (`config.form.rules`); see `utils/form-conditions.ts`.
 */
import { Plus, Trash2, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "../utils/form-view";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

const ACTIONS: { value: FormRuleAction; key: FormLabelKey }[] = [
  { value: "show", key: "actionShow" },
  { value: "hide", key: "actionHide" },
  { value: "require", key: "actionRequire" },
];

const NEW_CONDITION: Condition = { fieldId: "", operator: "is" };

interface RuleContext {
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: Label;
  locale: string;
  translate?: FormTranslate;
}

/** A compact settings select (base-ui), labelled for assistive technologies. */
function RuleSelect({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  value: string;
}) {
  return (
    <Select
      items={options}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onChange(next);
        }
      }}
      value={value || null}
    >
      <SelectTrigger
        aria-label={label}
        className="h-8 w-full min-w-0 bg-background text-xs"
        size="sm"
      >
        <SelectValue placeholder={placeholder}>
          {(selected: string | null) =>
            options.find((option) => option.value === selected)?.label ??
            placeholder
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A value typed in a rule, saved when it loses focus or on Enter. */
function RuleInput({
  label,
  onCommit,
  type,
  value,
}: {
  label: string;
  onCommit: (value: string) => void;
  type: "date" | "number" | "text";
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  return (
    <Input
      aria-label={label}
      className="h-8 min-w-0 bg-background text-xs"
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
      type={type === "date" ? "date" : "text"}
      value={draft}
    />
  );
}

function ListValue({
  condition,
  field,
  label,
  onChange,
}: {
  condition: Condition;
  field: ConditionField | undefined;
  label: Label;
  onChange: (value: ConditionValue) => void;
}) {
  const id = useId();
  const selected = formRuleList(condition.value);
  if (!field?.options?.length) {
    return (
      <RuleInput
        label={label("ruleValue")}
        onCommit={(raw) => onChange(formRuleListFrom(raw))}
        type="text"
        value={selected.join(", ")}
      />
    );
  }
  return (
    <fieldset className="col-span-full grid gap-1.5 rounded-md border bg-background p-2">
      <legend className="sr-only">{label("ruleValue")}</legend>
      {field.options.map((option, index) => {
        const value = String(option.value);
        const checkboxId = `${id}-${index}`;
        return (
          <div className="flex items-center gap-2 text-xs" key={value}>
            <Checkbox
              checked={selected.includes(value)}
              id={checkboxId}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, value]
                    : selected.filter((item) => item !== value)
                )
              }
            />
            <label htmlFor={checkboxId}>{option.label}</label>
          </div>
        );
      })}
    </fieldset>
  );
}

function ValueEditor({
  condition,
  field,
  label,
  onChange,
}: {
  condition: Condition;
  field: ConditionField | undefined;
  label: Label;
  onChange: (value: ConditionValue) => void;
}) {
  const kind = operatorValueKind(condition.operator);
  if (kind === "none") {
    return null;
  }
  if (kind === "list") {
    return (
      <ListValue
        condition={condition}
        field={field}
        label={label}
        onChange={onChange}
      />
    );
  }
  if (kind === "range") {
    const [from, to] = Array.isArray(condition.value)
      ? condition.value
      : [null, null];
    const set = (index: 0 | 1, raw: string) =>
      onChange(formRuleRange(field, condition.value, index, raw));
    return (
      <div className="col-span-full grid grid-cols-2 gap-2">
        <RuleInput
          label={label("ruleFrom")}
          onCommit={(raw) => set(0, raw)}
          type={formRuleInputType(field)}
          value={formRuleValueText(from)}
        />
        <RuleInput
          label={label("ruleTo")}
          onCommit={(raw) => set(1, raw)}
          type={formRuleInputType(field)}
          value={formRuleValueText(to)}
        />
      </div>
    );
  }
  if (kind === "single" && field?.type === "select" && field.options?.length) {
    return (
      <div className="col-span-full">
        <RuleSelect
          label={label("ruleValue")}
          onChange={(value) => onChange(value)}
          options={field.options.map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
          placeholder={label("ruleValue")}
          value={formRuleValueText(condition.value)}
        />
      </div>
    );
  }
  return (
    <div className="col-span-full">
      <RuleInput
        label={kind === "days" ? label("ruleDays") : label("ruleValue")}
        onCommit={(raw) => onChange(formRuleValue(field, raw, kind === "days"))}
        type={kind === "days" ? "number" : formRuleInputType(field)}
        value={formRuleValueText(condition.value)}
      />
    </div>
  );
}

const samePath = (left: readonly number[] | undefined, right: number[]) =>
  JSON.stringify(left ?? []) === JSON.stringify(right);

function IssueText({ issues, label }: { issues: RuleIssue[]; label: Label }) {
  const first = issues[0];
  return first ? (
    <p
      className="col-span-full text-destructive text-xs"
      data-rule-issue={first.code}
    >
      {label(formRuleIssueLabel(first.code))}
    </p>
  ) : null;
}

function ConditionRow({
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
  const { fields, issues, label, locale, translate } = rule;
  const field = fields.find((item) => item.id === condition.fieldId);
  const operators = field ? CONDITION_OPERATORS[field.type] : [];
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1.5"
      data-rule-condition={path.join(".")}
    >
      <RuleSelect
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
      <RuleSelect
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
      <Button
        aria-label={label("removeCondition")}
        onClick={onRemove}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" />
      </Button>
      {field ? (
        <ValueEditor
          condition={condition}
          field={field}
          label={label}
          onChange={(value) => onChange({ ...condition, value })}
        />
      ) : null}
      <IssueText
        issues={issues.filter((issue) => samePath(issue.path, path))}
        label={label}
      />
    </div>
  );
}

function JoinSelect({
  group,
  label,
  onChange,
}: {
  group: ConditionGroup;
  label: Label;
  onChange: (join: "and" | "or") => void;
}) {
  return (
    <RuleSelect
      label={label("ruleJoin")}
      onChange={(value) => onChange(value === "or" ? "or" : "and")}
      options={[
        { value: "and", label: label("joinAnd") },
        { value: "or", label: label("joinOr") },
      ]}
      value={group.join}
    />
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
          <ConditionRow
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
  return (
    <fieldset
      className="grid gap-1.5 rounded-md border border-dashed p-2"
      data-rule-group={path.join(".")}
    >
      <legend className="px-1 text-muted-foreground text-xs">
        {label("ruleGroup")}
      </legend>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <JoinSelect
          group={group}
          label={label}
          onChange={(join) => onChange({ ...group, join })}
        />
        <Button
          aria-label={label("removeGroup")}
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
        issues={issues.filter(
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
    </fieldset>
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
  rule,
  translate,
}: {
  rule: FormRule;
  fields: readonly ConditionField[];
  issues: readonly RuleIssue[];
  label: Label;
  locale: string;
  translate?: FormTranslate;
  onChange: (rule: FormRule) => void;
  onRemove: () => void;
}) {
  const context: RuleContext = { fields, issues, label, locale, translate };
  const setWhen = (when: ConditionGroup) => onChange({ ...rule, when });
  const ruleIssues = issues.filter(
    (issue) =>
      !issue.path || (issue.code === "emptyGroup" && samePath(issue.path, []))
  );
  const hasGroup = rule.when.items.some(isConditionGroup);
  return (
    <div
      className="grid gap-2 rounded-md border bg-background/60 p-2"
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
        <JoinSelect
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
      <IssueText issues={ruleIssues} label={label} />
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
