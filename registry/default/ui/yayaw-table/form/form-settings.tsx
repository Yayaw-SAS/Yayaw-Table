"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  type ViewSettingField,
  ViewSettingsPanel,
} from "../components/toolbar/view-settings-panel";
import type { DisplayModeSettingsContext } from "../types/display-mode-renderer";
import {
  formLanguage,
  formLanguageName,
  resolveFormText,
  uniqueFormLocales,
} from "../utils/form-text";
import {
  addFormConsent,
  addFormHiddenField,
  addFormSection,
  createFormRule,
  type FormColumn,
  type FormConsentQuestion,
  type FormHiddenField,
  type FormHiddenSource,
  type FormHiddenValue,
  type FormItem,
  type FormQuestion,
  type FormSectionBreak,
  type FormTranslate,
  type FormViewSettings,
  formAddableLocales,
  formColumns,
  formDefaultLocale,
  formHiddenChoices,
  formHiddenFieldColumns,
  formHiddenValueFrom,
  formHiddenValueText,
  formItemMissingTranslation,
  formLabel,
  formOrderedItems,
  formQuestionList,
  formRuleFields,
  formRuleIssues,
  formRuleSummary,
  formRulesFor,
  formSettingsRows,
  formViewLocales,
  isFormQuestion,
  mergeFormSettings,
  moveFormQuestion,
  normalizeFormViewConfig,
  removeFormItem,
  removeFormRule,
  resolveFormSettings,
  toggleFormQuestion,
  updateFormHiddenField,
  updateFormQuestion,
  upsertFormRule,
} from "../utils/form-view";
import {
  FORM_HIDDEN_SOURCE_LABELS,
  FormConsentEditor,
  type FormEditingLanguage,
  FormHiddenFieldEditor,
  FormLocalizedText,
  FormMissingTranslation,
  FormQuestionEditor,
  type FormQuestionRules,
  FormSettingSelect,
  FormSettingSwitch,
  type FormSettingsLabel,
  FormSettingText,
} from "./form-editors";
import { FormLanguageSwitch } from "./form-languages";

type Label = FormSettingsLabel;

const NONE = "";
const PREVIEW_LENGTH = 48;
/** The panel an item's editor opens in, under its row. */
const DETAILS_CLASS =
  "mx-1 mb-1 grid gap-3 rounded-md bg-muted/50 p-3 dark:bg-muted/30";

function SettingsHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-1 font-medium text-sm" data-setting-heading>
      {children}
    </h3>
  );
}

interface QuestionRowProps {
  column: FormColumn;
  index: number;
  count: number;
  label: Label;
  editing: FormEditingLanguage;
  question?: FormQuestion;
  rules?: FormQuestionRules;
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
      <EditToggle editing={editing} id={id} label={editLabel} onEdit={onEdit} />
    </>
  );
}

function EditToggle({
  editing,
  id,
  label,
  onEdit,
}: {
  editing: boolean;
  id: string;
  label: string;
  onEdit: () => void;
}) {
  return (
    <Button
      aria-controls={`${id}-details`}
      aria-expanded={editing}
      aria-label={label}
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
  );
}

function RemoveButton({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <Button
      aria-label={label}
      onClick={onRemove}
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      <Trash2 aria-hidden="true" />
    </Button>
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
  editing: language,
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
  const title =
    resolveFormText(question?.label, rules?.locale, language.defaultLocale) ??
    name;
  const missing = question
    ? formItemMissingTranslation(
        question,
        language.locale,
        language.defaultLocale,
        column
      )
    : false;
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
      <FormMissingTranslation label={language.missingLabel} missing={missing} />
      {question && rules && editing ? (
        <div className={DETAILS_CLASS} id={`${id}-details`}>
          <FormQuestionEditor
            column={column}
            editing={language}
            id={id}
            label={label}
            name={title}
            onChange={onChange}
            question={question}
            rules={rules}
          />
        </div>
      ) : null}
    </li>
  );
}

/** A section break: a title and description starting a group (one step in steps). */
function SectionRow({
  count,
  editing: language,
  index,
  label,
  onChange,
  onMove,
  onRemove,
  section,
}: {
  count: number;
  editing: FormEditingLanguage;
  index: number;
  label: Label;
  onChange: (patch: Partial<FormSectionBreak>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
  section: FormSectionBreak;
}) {
  const id = useId();
  const [editing, setEditing] = useState(!section.title);
  const name =
    resolveFormText(section.title, language.locale, language.defaultLocale) ??
    label("untitledSection");
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
        <RemoveButton
          label={label("removeSection", { label: name })}
          onRemove={onRemove}
        />
      </div>
      <FormMissingTranslation
        label={language.missingLabel}
        missing={formItemMissingTranslation(
          section,
          language.locale,
          language.defaultLocale
        )}
      />
      {editing ? (
        <div className={DETAILS_CLASS} id={`${id}-details`}>
          <FormLocalizedText
            editing={language}
            id={`${id}-title`}
            label={label("sectionTitle")}
            onChange={(title) => onChange({ title })}
            text={section.title}
          />
          <FormLocalizedText
            editing={language}
            id={`${id}-description`}
            label={label("sectionDescription")}
            multiline
            onChange={(description) => onChange({ description })}
            text={section.description}
          />
        </div>
      ) : null}
    </li>
  );
}

const preview = (text: string) =>
  text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;

/** A consent: its statement, link and version; always required, never hidden by rules. */
function ConsentRow({
  consent,
  count,
  editing: language,
  index,
  label,
  onChange,
  onMove,
  onRemove,
}: {
  consent: FormConsentQuestion;
  count: number;
  editing: FormEditingLanguage;
  index: number;
  label: Label;
  onChange: (patch: Partial<FormConsentQuestion>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const statement =
    resolveFormText(consent.text, language.locale, language.defaultLocale) ??
    formLabel(
      consent.link ? "consentTextLink" : "consentText",
      language.locale
    );
  const name = `${label("consent")}: ${preview(statement)}`;
  return (
    <li
      className={cn(
        "grid rounded-md",
        editing && "bg-accent/40 dark:bg-accent/20"
      )}
      data-form-setting-consent={consent.id}
    >
      <div className="flex min-h-9 min-w-0 items-center gap-1 px-1">
        <GripVertical
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground/60"
        />
        <span className="min-w-0 flex-1 truncate py-1 text-sm">
          <span className="font-medium">{label("consent")}</span>
          <span className="text-muted-foreground"> · {preview(statement)}</span>
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
        <RemoveButton
          label={label("removeSection", { label: name })}
          onRemove={onRemove}
        />
      </div>
      <FormMissingTranslation
        label={language.missingLabel}
        missing={formItemMissingTranslation(
          consent,
          language.locale,
          language.defaultLocale
        )}
      />
      {editing ? (
        <div className={DETAILS_CLASS} id={`${id}-details`}>
          <FormConsentEditor
            consent={consent}
            editing={language}
            id={id}
            label={label}
            onChange={onChange}
          />
        </div>
      ) : null}
    </li>
  );
}

/** A hidden field: where its value comes from and where it is saved. */
function HiddenFieldRow({
  columns,
  field,
  label,
  onChange,
  onRemove,
  onToggle,
  open,
}: {
  columns: readonly FormColumn[];
  field: FormHiddenField;
  label: Label;
  onChange: (patch: { source?: FormHiddenSource; columnId?: string }) => void;
  onRemove: () => void;
  onToggle: () => void;
  open: boolean;
}) {
  const id = useId();
  const source = label(FORM_HIDDEN_SOURCE_LABELS[field.source.type]);
  const column = columns.find((item) => item.id === field.columnId);
  const name = field.source.type === "urlParam" ? field.source.name : source;
  const saved = column ? column.header : label("responseDetails");
  return (
    <li
      className={cn(
        "grid rounded-md",
        open && "bg-accent/40 dark:bg-accent/20"
      )}
      data-form-setting-hidden={field.id}
    >
      <div className="flex min-h-9 min-w-0 items-center gap-1 px-1">
        <span className="min-w-0 flex-1 truncate py-1 pl-1 text-sm">
          <span className="sr-only">{label("hiddenField")}: </span>
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground"> → {saved}</span>
        </span>
        <EditToggle
          editing={open}
          id={id}
          label={label("editSection", { label: name })}
          onEdit={onToggle}
        />
        <RemoveButton
          label={label("removeSection", { label: name })}
          onRemove={onRemove}
        />
      </div>
      {open ? (
        <div className={DETAILS_CLASS} id={`${id}-details`}>
          <FormHiddenFieldEditor
            columns={columns}
            field={field}
            id={id}
            label={label}
            onChange={onChange}
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
): (questionId: string) => FormQuestionRules {
  const fields = formRuleFields(context.columns, merged, context.locale);
  const issues = formRuleIssues(context.columns, merged);
  const resolved = resolveFormSettings(
    context.columns,
    undefined,
    { ...merged, rules: [] },
    context.locale
  );
  const rules = merged.rules ?? [];
  return (questionId) => {
    const list = formRulesFor(rules, questionId);
    return {
      list,
      fields: fields.filter((field) => field.id !== questionId),
      issues: issues.filter((issue) =>
        list.some((rule) => rule.id === issue.ruleId)
      ),
      questions: resolved.questions,
      summaries: list.map((rule) =>
        formRuleSummary(rule, resolved.questions, context.locale, translate)
      ),
      locale: context.locale,
      translate,
      onAdd: () =>
        update({
          rules: upsertFormRule(rules, createFormRule(rules, questionId)),
        }),
      onChange: (rule) => update({ rules: upsertFormRule(rules, rule) }),
      onRemove: (ruleId) => update({ rules: removeFormRule(rules, ruleId) }),
    };
  };
}

/** The form's languages and the one being edited, with "Add language". */
function useFormLanguages(
  context: DisplayModeSettingsContext,
  merged: FormViewSettings,
  update: (patch: FormViewSettings) => void
) {
  const fallback = formLanguage(context.locale) || "en";
  const pinned = formDefaultLocale(merged);
  const defaultLocale = pinned ?? fallback;
  const languages = formViewLocales(
    context.defaults,
    context.settings,
    fallback
  );
  const [choice, setChoice] = useState<string>();
  const locale = choice && languages.includes(choice) ? choice : defaultLocale;
  return {
    defaultLocale,
    languages,
    locale,
    setLocale: setChoice,
    addable: formAddableLocales(context.defaults, languages),
    /** Texts written in another language pin the default one, so plain texts keep theirs. */
    pin: pinned ? {} : { defaultLocale },
    add: (added: string) => {
      update({
        locales: uniqueFormLocales([...languages, added]),
        defaultLocale,
      });
      setChoice(added);
    },
  };
}

/** View → Form settings: languages, texts, layout, questions, sections, consents and rules, hidden fields, fixed values and the end of the form. */
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
  const count = formOrderedItems(questions).length;
  const asked = new Set(
    questions.filter(isFormQuestion).map((item) => item.columnId)
  );
  const update = (patch: FormViewSettings) =>
    context.updateSettings(
      normalizeFormViewConfig({ ...view, ...patch }) as
        | Record<string, unknown>
        | undefined
    );
  const languages = useFormLanguages(context, merged, update);
  /** Texts are written in the language being edited. */
  const write = (patch: FormViewSettings) =>
    update(
      languages.locale === languages.defaultLocale
        ? patch
        : { ...patch, ...languages.pin }
    );
  const editing: FormEditingLanguage = {
    locale: languages.locale,
    defaultLocale: languages.defaultLocale,
    missingLabel: label("missingTranslation"),
  };
  const setQuestions = (next: FormItem[]) => write({ questions: next });
  const rulesOf = useQuestionRules(context, merged, update, translate);
  const [openHidden, setOpenHidden] = useState<string | null>(null);
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
  const hiddenRows = rows.flatMap((row) =>
    row.kind === "hidden" ? [row] : []
  );
  const changeHidden = (
    field: FormHiddenField,
    patch: { source?: FormHiddenSource; columnId?: string }
  ) => {
    const next = updateFormHiddenField(questions, field.id, patch);
    setOpenHidden(next.id);
    update({ questions: next.questions });
  };
  const addHidden = () => {
    const next = addFormHiddenField(questions);
    setOpenHidden(next.id);
    update({ questions: next.questions });
  };

  const intro = (
    <>
      <div className="grid gap-1.5">
        <FormLanguageSwitch
          addable={languages.addable}
          addLabel={label("addLanguage")}
          label={label("editingLanguage")}
          languages={languages.languages}
          onAdd={languages.add}
          onChange={languages.setLocale}
          value={languages.locale}
        />
        {languages.locale === languages.defaultLocale ? null : (
          <p
            className="text-muted-foreground text-xs"
            data-form-translation-hint
          >
            {label("translationHint", {
              language: formLanguageName(
                languages.defaultLocale,
                context.locale
              ),
            })}
          </p>
        )}
        {languages.languages.length > 1 ? (
          // Texts written without a language (plain texts) are in this one.
          <FormSettingSelect
            label={label("defaultLanguage")}
            onChange={(defaultLocale) => update({ defaultLocale })}
            options={languages.languages.map((locale) => ({
              value: locale,
              label: formLanguageName(locale),
            }))}
            value={languages.defaultLocale}
          />
        ) : null}
      </div>
      <SettingsSection title={label("settings")}>
        <FormLocalizedText
          editing={editing}
          id={`${id}-title`}
          label={label("title")}
          onChange={(title) => write({ title })}
          text={merged.title}
        />
        <FormLocalizedText
          editing={editing}
          id={`${id}-description`}
          label={label("description")}
          multiline
          onChange={(description) => write({ description })}
          text={merged.description}
        />
      </SettingsSection>
      <SettingsSection title={label("layout")}>
        <FormSettingSwitch
          checked={steps}
          id={`${id}-steps`}
          label={label("layoutSteps")}
          onChange={(next) => update({ layout: next ? "steps" : "page" })}
        />
        {steps ? (
          <FormSettingSwitch
            checked={merged.review === true}
            id={`${id}-review`}
            label={label("review")}
            onChange={(review) => update({ review })}
          />
        ) : null}
      </SettingsSection>
      <SettingsSection title={label("questions")}>
        <ul className="-mx-1 grid gap-0.5">
          {rows.map((row) => {
            if (row.kind === "hidden") {
              return null;
            }
            if (row.kind === "section") {
              return (
                <SectionRow
                  count={count}
                  editing={editing}
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
                    update(removeFormItem(merged, row.section.id))
                  }
                  section={row.section}
                />
              );
            }
            if (row.kind === "consent") {
              return (
                <ConsentRow
                  consent={row.consent}
                  count={count}
                  editing={editing}
                  index={row.index}
                  key={row.consent.id}
                  label={label}
                  onChange={(patch) =>
                    setQuestions(
                      updateFormQuestion(questions, row.consent.id, patch)
                    )
                  }
                  onMove={(offset) =>
                    setQuestions(
                      moveFormQuestion(questions, row.consent.id, offset)
                    )
                  }
                  onRemove={() =>
                    update(removeFormItem(merged, row.consent.id))
                  }
                />
              );
            }
            const { question } = row;
            return (
              <QuestionRow
                column={row.column}
                count={count}
                editing={editing}
                index={row.index}
                key={row.column.id}
                label={label}
                onAsk={(next) =>
                  setQuestions(
                    toggleFormQuestion(questions, row.column.id, next)
                  )
                }
                onChange={(patch) =>
                  question &&
                  setQuestions(
                    updateFormQuestion(questions, question.id, patch)
                  )
                }
                onMove={(offset) =>
                  question &&
                  setQuestions(moveFormQuestion(questions, question.id, offset))
                }
                question={question}
                rules={question ? rulesOf(question.id) : undefined}
              />
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
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
          <Button
            className="w-fit font-normal"
            onClick={() => setQuestions(addFormConsent(questions).questions)}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" />
            {label("addConsent")}
          </Button>
        </div>
        {excluded.length ? (
          <p className="text-muted-foreground text-xs">
            {label("excluded", {
              columns: excluded.map((column) => column.header).join(", "),
            })}
          </p>
        ) : null}
      </SettingsSection>
      <SettingsSection title={label("hiddenFields")}>
        <p className="-mt-1 text-muted-foreground text-xs">
          {label("hiddenFieldsHint")}
        </p>
        {hiddenRows.length ? (
          <ul className="-mx-1 grid gap-0.5" data-form-hidden-fields>
            {hiddenRows.map(({ field }) => (
              <HiddenFieldRow
                columns={formHiddenFieldColumns(
                  context.columns,
                  questions,
                  field.id
                )}
                field={field}
                key={field.id}
                label={label}
                onChange={(patch) => changeHidden(field, patch)}
                onRemove={() => update(removeFormItem(merged, field.id))}
                onToggle={() =>
                  setOpenHidden((open) => (open === field.id ? null : field.id))
                }
                open={openHidden === field.id}
              />
            ))}
          </ul>
        ) : null}
        <Button
          className="w-fit font-normal"
          onClick={addHidden}
          size="sm"
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          {label("addHiddenField")}
        </Button>
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
          <FormSettingText
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
          <FormLocalizedText
            editing={editing}
            fallback={formLabel("submit", editing.locale)}
            id={`${id}-submit`}
            label={label("submitLabel")}
            onChange={(submitLabel) => write({ submitLabel })}
            text={merged.submitLabel}
          />
          <FormLocalizedText
            editing={editing}
            fallback={formLabel("success", editing.locale)}
            id={`${id}-success`}
            label={label("successMessage")}
            multiline
            onChange={(successMessage) => write({ successMessage })}
            text={merged.successMessage}
          />
          <FormSettingSwitch
            checked={merged.allowAnotherResponse !== false}
            id={`${id}-another`}
            label={label("allowAnother")}
            onChange={(allowAnotherResponse) =>
              update({ allowAnotherResponse })
            }
          />
          <FormSettingText
            id={`${id}-redirect`}
            label={label("redirectUrl")}
            onCommit={(redirectUrl) => update({ redirectUrl })}
            type="url"
            value={merged.redirectUrl ?? ""}
          />
          <p className="text-muted-foreground text-xs">
            {label("redirectHint")}
          </p>
          <FormLocalizedText
            editing={editing}
            fallback={formLabel("closed", editing.locale)}
            id={`${id}-closed`}
            label={label("closedMessage")}
            multiline
            onChange={(closedMessage) => write({ closedMessage })}
            text={merged.closedMessage}
          />
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
