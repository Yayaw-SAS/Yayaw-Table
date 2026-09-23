"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Switch } from "@/src/components/ui/switch";
import { Textarea } from "@/src/components/ui/textarea";
import {
  type ViewSettingField,
  ViewSettingsPanel,
} from "../components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "../types/display-mode-renderer";
import type {
  ConditionField,
  FormRule,
  RuleIssue,
} from "../utils/form-conditions";
import {
  addFormSection,
  createFormRule,
  type FormColumn,
  type FormHiddenValue,
  type FormItem,
  type FormLabelKey,
  type FormQuestion,
  type FormSectionBreak,
  type FormTranslate,
  type FormViewSettings,
  formColumnEditor,
  formColumns,
  formHiddenChoices,
  formHiddenValueFrom,
  formHiddenValueText,
  formLabel,
  formQuestionList,
  formRuleFields,
  formRuleIssues,
  formRuleSummary,
  formRulesFor,
  formSettingsRows,
  isFormSection,
  mergeFormSettings,
  moveFormQuestion,
  normalizeFormViewConfig,
  removeFormRule,
  removeFormSection,
  resolveFormSettings,
  toggleFormQuestion,
  updateFormQuestion,
  upsertFormRule,
} from "../utils/form-view";
import { FormRuleEditor } from "./form-rules";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

const NONE = "";

/** A text setting saved when it loses focus or on Enter, not on every key. */
function CommitText({
  id,
  label,
  multiline,
  onCommit,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
  type?: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
    }
  };
  const onChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setDraft(event.target.value);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-muted-foreground text-sm" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <Textarea
          id={id}
          onBlur={commit}
          onChange={onChange}
          rows={2}
          value={draft}
        />
      ) : (
        <Input
          id={id}
          onBlur={commit}
          onChange={onChange}
          onKeyDown={onKeyDown}
          type={type}
          value={draft}
        />
      )}
    </div>
  );
}

/** A labelled switch, as in the table's settings menus. */
function SwitchSetting({
  checked,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <label className="min-w-0 text-sm" htmlFor={id} id={`${id}-label`}>
        {label}
      </label>
      <Switch
        aria-labelledby={`${id}-label`}
        checked={checked}
        id={id}
        onCheckedChange={(next) => onChange(next)}
      />
    </div>
  );
}

function SettingsHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-1 font-medium text-sm" data-setting-heading>
      {children}
    </h3>
  );
}

/** The rules of one question, as its row edits them. */
interface QuestionRules {
  list: FormRule[];
  fields: ConditionField[];
  issues: RuleIssue[];
  summaries: string[];
  locale: string;
  translate?: FormTranslate;
  onAdd: () => void;
  onChange: (rule: FormRule) => void;
  onRemove: (id: string) => void;
}

function RulesEditor({ label, rules }: { label: Label; rules: QuestionRules }) {
  return (
    <section className="grid gap-2" data-form-rules>
      <h4 className="font-medium text-muted-foreground text-xs">
        {label("conditions")}
      </h4>
      {rules.list.map((rule) => (
        <FormRuleEditor
          fields={rules.fields}
          issues={rules.issues.filter((issue) => issue.ruleId === rule.id)}
          key={rule.id}
          label={label}
          locale={rules.locale}
          onChange={rules.onChange}
          onRemove={() => rules.onRemove(rule.id)}
          rule={rule}
          translate={rules.translate}
        />
      ))}
      <Button
        className="w-fit font-normal"
        disabled={rules.fields.length === 0}
        onClick={rules.onAdd}
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" />
        {label("addRule")}
      </Button>
    </section>
  );
}

function QuestionDetails({
  id,
  label,
  onChange,
  question,
  rules,
  textInput,
}: {
  id: string;
  label: Label;
  onChange: (patch: Partial<FormQuestion>) => void;
  question: FormQuestion;
  rules: QuestionRules;
  textInput: boolean;
}) {
  return (
    <div
      className="mx-1 mb-1 grid gap-3 rounded-md bg-muted/50 p-3 dark:bg-muted/30"
      id={`${id}-details`}
    >
      <CommitText
        id={`${id}-label`}
        label={label("label")}
        onCommit={(value) => onChange({ label: value })}
        value={question.label ?? ""}
      />
      <CommitText
        id={`${id}-help`}
        label={label("help")}
        multiline
        onCommit={(value) => onChange({ help: value })}
        value={question.help ?? ""}
      />
      {textInput ? (
        <CommitText
          id={`${id}-placeholder`}
          label={label("placeholder")}
          onCommit={(value) => onChange({ placeholder: value })}
          value={question.placeholder ?? ""}
        />
      ) : null}
      <SwitchSetting
        checked={question.required === true}
        id={`${id}-required`}
        label={label("requiredToggle")}
        onChange={(required) => onChange({ required })}
      />
      <RulesEditor label={label} rules={rules} />
    </div>
  );
}

interface QuestionRowProps {
  column: FormColumn;
  index: number;
  count: number;
  label: Label;
  question?: FormQuestion;
  rules?: QuestionRules;
  onAsk: (asked: boolean) => void;
  onMove: (offset: -1 | 1) => void;
  onChange: (patch: Partial<FormQuestion>) => void;
}

function RowActions({
  count,
  editing,
  editLabel,
  id,
  index,
  label,
  name,
  onEdit,
  onMove,
}: {
  count: number;
  editing: boolean;
  editLabel: string;
  id: string;
  index: number;
  label: Label;
  name: string;
  onEdit: () => void;
  onMove: (offset: -1 | 1) => void;
}) {
  return (
    <>
      <Button
        aria-label={label("moveUp", { label: name })}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        aria-label={label("moveDown", { label: name })}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        aria-controls={`${id}-details`}
        aria-expanded={editing}
        aria-label={editLabel}
        onClick={onEdit}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform", editing && "rotate-180")}
        />
      </Button>
    </>
  );
}

function RuleSummaries({ summaries }: { summaries: string[] }) {
  return summaries.length ? (
    <ul className="grid gap-0.5 pb-1 pl-7" data-form-rule-summary>
      {summaries.map((summary) => (
        <li className="text-muted-foreground text-xs" key={summary}>
          {summary}
        </li>
      ))}
    </ul>
  ) : null;
}

/** One column: asked or not, its place in the form, its texts and rules. */
function QuestionRow({
  column,
  count,
  index,
  label,
  onAsk,
  onChange,
  onMove,
  question,
  rules,
}: QuestionRowProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const name = column.header;
  const editor = formColumnEditor(column);
  const textInput = editor !== "boolean" && editor !== "multiSelect";
  return (
    <li
      className={cn(
        "grid rounded-md",
        editing && question && "bg-accent/40 dark:bg-accent/20"
      )}
      data-form-setting-question={column.id}
    >
      <div className="flex min-h-9 min-w-0 items-center gap-1 px-1">
        <GripVertical
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground/60",
            !question && "invisible"
          )}
        />
        <label
          className={cn(
            "min-w-0 flex-1 truncate py-1 text-sm",
            !question && "text-muted-foreground"
          )}
          htmlFor={`${id}-ask`}
        >
          {name}
          {question?.required ? (
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
          ) : null}
        </label>
        {question ? (
          <RowActions
            count={count}
            editing={editing}
            editLabel={label("editQuestion", { label: name })}
            id={id}
            index={index}
            label={label}
            name={name}
            onEdit={() => setEditing((value) => !value)}
            onMove={onMove}
          />
        ) : null}
        <Switch
          aria-label={label("ask", { label: name })}
          checked={Boolean(question)}
          className="ml-1"
          id={`${id}-ask`}
          onCheckedChange={(next) => onAsk(next)}
          size="sm"
        />
      </div>
      {question && rules ? <RuleSummaries summaries={rules.summaries} /> : null}
      {question && rules && editing ? (
        <QuestionDetails
          id={id}
          label={label}
          onChange={onChange}
          question={question}
          rules={rules}
          textInput={textInput}
        />
      ) : null}
    </li>
  );
}

/** A section break: a title and description starting a group (one step in steps). */
function SectionRow({
  count,
  index,
  label,
  onChange,
  onMove,
  onRemove,
  section,
}: {
  count: number;
  index: number;
  label: Label;
  onChange: (patch: Partial<FormSectionBreak>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
  section: FormSectionBreak;
}) {
  const id = useId();
  const [editing, setEditing] = useState(!section.title);
  const name = section.title ?? label("untitledSection");
  return (
    <li
      className={cn(
        "mt-1 grid rounded-md border-t pt-1",
        editing && "bg-accent/40 dark:bg-accent/20"
      )}
      data-form-setting-section={section.id}
    >
      <div className="flex min-h-9 min-w-0 items-center gap-1 px-1">
        <GripVertical
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground/60"
        />
        <span className="min-w-0 flex-1 truncate py-1 font-medium text-sm">
          <span className="sr-only">{label("section")}: </span>
          {name}
        </span>
        <RowActions
          count={count}
          editing={editing}
          editLabel={label("editSection", { label: name })}
          id={id}
          index={index}
          label={label}
          name={name}
          onEdit={() => setEditing((value) => !value)}
          onMove={onMove}
        />
        <Button
          aria-label={label("removeSection", { label: name })}
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {editing ? (
        <div
          className="mx-1 mb-1 grid gap-3 rounded-md bg-muted/50 p-3 dark:bg-muted/30"
          id={`${id}-details`}
        >
          <CommitText
            id={`${id}-title`}
            label={label("sectionTitle")}
            onCommit={(title) => onChange({ title })}
            value={section.title ?? ""}
          />
          <CommitText
            id={`${id}-description`}
            label={label("sectionDescription")}
            multiline
            onCommit={(description) => onChange({ description })}
            value={section.description ?? ""}
          />
        </div>
      ) : null}
    </li>
  );
}

function SettingsSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="grid min-w-0 gap-2">
      <SettingsHeading>{title}</SettingsHeading>
      {children}
    </section>
  );
}

/** A fixed value chosen from the column's options, as a settings select. */
const choiceField = (
  column: FormColumn,
  label: Label,
  value: FormHiddenValue | undefined,
  onChange: (value: FormHiddenValue | undefined) => void
): ViewSettingField | undefined => {
  const options = formHiddenChoices(column);
  if (!options) {
    return;
  }
  return {
    id: `hidden-${column.id}`,
    label: label("hiddenValue", { label: column.header }),
    value: value === undefined ? NONE : String(value),
    options: [{ value: NONE, label: label("none") }, ...options],
    onChange: (next) => onChange(formHiddenValueFrom(column, next)),
  };
};

/** Everything the question rows need to edit rules, from the saved settings. */
function useQuestionRules(
  context: DisplayModeSettingsContext,
  merged: FormViewSettings,
  update: (patch: FormViewSettings) => void,
  translate: FormTranslate
): (questionId: string) => QuestionRules {
  const fields = formRuleFields(context.columns, merged);
  const issues = formRuleIssues(context.columns, merged);
  const resolved = resolveFormSettings(context.columns, undefined, {
    ...merged,
    rules: [],
  });
  const rules = merged.rules ?? [];
  return (questionId) => {
    const list = formRulesFor(rules, questionId);
    return {
      list,
      fields: fields.filter((field) => field.id !== questionId),
      issues: issues.filter((issue) =>
        list.some((rule) => rule.id === issue.ruleId)
      ),
      summaries: list.map((rule) =>
        formRuleSummary(rule, resolved.questions, context.locale, translate)
      ),
      locale: context.locale,
      translate,
      onAdd: () =>
        update({ rules: upsertFormRule(rules, createFormRule(rules, questionId)) }),
      onChange: (rule) => update({ rules: upsertFormRule(rules, rule) }),
      onRemove: (ruleId) => update({ rules: removeFormRule(rules, ruleId) }),
    };
  };
}

/** View → Form settings: texts, layout, questions, sections and rules, fixed values and the end of the form. */
export function FormSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const id = useId();
  const translate: FormTranslate = (name, fallback) =>
    context.translate(`form.${name}`, fallback);
  const label: Label = (key, params) =>
    formLabel(key, context.locale, translate, params);
  const view = (normalizeFormViewConfig(context.settings) ??
    {}) as FormViewSettings;
  const merged = mergeFormSettings(context.defaults, context.settings);
  const { eligible, excluded } = formColumns(context.columns);
  const questions = formQuestionList(context.columns, merged);
  const rows = formSettingsRows(context.columns, merged);
  const asked = new Set(
    questions.flatMap((item) => (isFormSection(item) ? [] : [item.columnId]))
  );
  const update = (patch: FormViewSettings) =>
    context.updateSettings(
      normalizeFormViewConfig({ ...view, ...patch }) as
        | Record<string, unknown>
        | undefined
    );
  const setQuestions = (next: FormItem[]) => update({ questions: next });
  const rulesOf = useQuestionRules(context, merged, update, translate);
  const hiddenValues = merged.hiddenValues ?? {};
  const setHidden = (columnId: string, value: FormHiddenValue | undefined) => {
    const next = { ...hiddenValues };
    if (value === undefined) {
      Reflect.deleteProperty(next, columnId);
    } else {
      next[columnId] = value;
    }
    update({ hiddenValues: next });
  };
  const notAsked = eligible.filter((column) => !asked.has(column.id));
  const choiceFields = notAsked.flatMap((column) => {
    const field = choiceField(column, label, hiddenValues[column.id], (value) =>
      setHidden(column.id, value)
    );
    return field ? [field] : [];
  });
  const typedFixed = notAsked.filter((column) => !formHiddenChoices(column));
  const steps = merged.layout === "steps";

  const intro = (
    <>
      <SettingsSection title={label("settings")}>
        <CommitText
          id={`${id}-title`}
          label={label("title")}
          onCommit={(title) => update({ title })}
          value={merged.title ?? ""}
        />
        <CommitText
          id={`${id}-description`}
          label={label("description")}
          multiline
          onCommit={(description) => update({ description })}
          value={merged.description ?? ""}
        />
      </SettingsSection>
      <SettingsSection title={label("layout")}>
        <SwitchSetting
          checked={steps}
          id={`${id}-steps`}
          label={label("layoutSteps")}
          onChange={(next) => update({ layout: next ? "steps" : "page" })}
        />
        {steps ? (
          <SwitchSetting
            checked={merged.review === true}
            id={`${id}-review`}
            label={label("review")}
            onChange={(review) => update({ review })}
          />
        ) : null}
      </SettingsSection>
      <SettingsSection title={label("questions")}>
        <ul className="-mx-1 grid gap-0.5">
          {rows.map((row) =>
            row.kind === "section" ? (
              <SectionRow
                count={questions.length}
                index={row.index}
                key={row.section.id}
                label={label}
                onChange={(patch) =>
                  setQuestions(
                    updateFormQuestion(questions, row.section.id, patch)
                  )
                }
                onMove={(offset) =>
                  setQuestions(
                    moveFormQuestion(questions, row.section.id, offset)
                  )
                }
                onRemove={() =>
                  update(removeFormSection(merged, row.section.id))
                }
                section={row.section}
              />
            ) : (
              <QuestionRow
                column={row.column}
                count={questions.length}
                index={row.index}
                key={row.column.id}
                label={label}
                onAsk={(next) =>
                  setQuestions(
                    toggleFormQuestion(questions, row.column.id, next)
                  )
                }
                onChange={(patch) =>
                  row.question &&
                  setQuestions(
                    updateFormQuestion(questions, row.question.id, patch)
                  )
                }
                onMove={(offset) =>
                  row.question &&
                  setQuestions(
                    moveFormQuestion(questions, row.question.id, offset)
                  )
                }
                question={row.question}
                rules={row.question ? rulesOf(row.question.id) : undefined}
              />
            )
          )}
        </ul>
        <Button
          className="w-fit font-normal"
          onClick={() => setQuestions(addFormSection(questions).questions)}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          {label("addSection")}
        </Button>
        {excluded.length ? (
          <p className="text-muted-foreground text-xs">
            {label("excluded", {
              columns: excluded.map((column) => column.header).join(", "),
            })}
          </p>
        ) : null}
      </SettingsSection>
      {notAsked.length ? (
        <div className="grid gap-1">
          <SettingsHeading>{label("hidden")}</SettingsHeading>
          <p className="text-muted-foreground text-xs">{label("hiddenHint")}</p>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="grid min-w-0" data-form-settings>
      <ViewSettingsPanel fields={choiceFields} intro={intro}>
        {typedFixed.map((column) => (
          <CommitText
            id={`${id}-hidden-${column.id}`}
            key={column.id}
            label={label("hiddenValue", { label: column.header })}
            onCommit={(next) =>
              setHidden(column.id, formHiddenValueFrom(column, next))
            }
            value={formHiddenValueText(hiddenValues[column.id])}
          />
        ))}
        <SettingsSection title={label("afterSubmit")}>
          <CommitText
            id={`${id}-submit`}
            label={label("submitLabel")}
            onCommit={(submitLabel) => update({ submitLabel })}
            value={merged.submitLabel ?? ""}
          />
          <CommitText
            id={`${id}-success`}
            label={label("successMessage")}
            multiline
            onCommit={(successMessage) => update({ successMessage })}
            value={merged.successMessage ?? ""}
          />
          <SwitchSetting
            checked={merged.allowAnotherResponse !== false}
            id={`${id}-another`}
            label={label("allowAnother")}
            onChange={(allowAnotherResponse) =>
              update({ allowAnotherResponse })
            }
          />
          <CommitText
            id={`${id}-redirect`}
            label={label("redirectUrl")}
            onCommit={(redirectUrl) => update({ redirectUrl })}
            type="url"
            value={merged.redirectUrl ?? ""}
          />
          <p className="text-muted-foreground text-xs">
            {label("redirectHint")}
          </p>
        </SettingsSection>
        <Button
          className="font-normal"
          disabled={Object.keys(view).length === 0}
          onClick={() => context.updateSettings(undefined)}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("reset")}
        </Button>
      </ViewSettingsPanel>
    </div>
  );
}
