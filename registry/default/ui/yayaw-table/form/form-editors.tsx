"use client";

/**
 * Editors of a form's texts and items, shared by the Form settings and
 * reusable on their own (e.g. in a form builder): texts written in the
 * language being edited, a question's properties, a consent and a hidden
 * field. Each edits one value and reports changes; the caller saves them.
 */
import { ListFilter, Plus } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  ConditionField,
  FormRule,
  RuleIssue,
} from "../utils/form-conditions";
import {
  type FormText,
  formTextIn,
  formTextMissing,
  resolveFormText,
  setFormText,
} from "../utils/form-text";
import {
  type FormColumn,
  type FormConsentQuestion,
  type FormHiddenField,
  type FormHiddenSource,
  type FormHiddenSourceType,
  type FormLabelKey,
  type FormQuestion,
  type FormTranslate,
  formColumnEditor,
  formLabel,
  formOptions,
  type ResolvedFormQuestion,
  setFormOptionLabel,
} from "../utils/form-view";
import { FormRuleEditor, RuleSelect } from "./form-rules";
import { FormRulesDialog } from "./form-rules-dialog";

/** Labels of the settings, in the table's language (`form.<key>` overrides applied). */
export type FormSettingsLabel = (
  key: FormLabelKey,
  params?: Record<string, string>
) => string;

/** The language texts are written in, and the form's default language. */
export interface FormEditingLanguage {
  locale: string;
  defaultLocale: string;
  /** "Missing translation", in the table's language. */
  missingLabel: string;
}

const MISSING_CLASS =
  "rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-amber-700 text-xs dark:text-amber-400";

/** "Save in" choice of a hidden field kept in the response details. */
const DETAILS = "__details";

const describedBy = (ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

/** A text setting saved when it loses focus or on Enter, not on every key. */
export function FormSettingText({
  hint,
  id,
  label,
  lang,
  missing,
  missingLabel,
  multiline,
  onCommit,
  placeholder,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  multiline?: boolean;
  onCommit: (value: string) => void;
  type?: string;
  value: string;
  /** Shown while empty, e.g. the text of the default language. */
  placeholder?: string;
  /** Language of the text typed, for spelling and screen readers. */
  lang?: string;
  /** Flags a missing translation next to the label. */
  missing?: boolean;
  missingLabel?: string;
  hint?: string;
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
  const description = describedBy([
    missing && `${id}-missing`,
    hint && `${id}-hint`,
  ]);
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <label className="text-muted-foreground text-sm" htmlFor={id}>
          {label}
        </label>
        {missing ? (
          <span
            className={MISSING_CLASS}
            data-form-missing-translation
            id={`${id}-missing`}
          >
            {missingLabel}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <Textarea
          aria-describedby={description}
          id={id}
          lang={lang}
          onBlur={commit}
          onChange={onChange}
          placeholder={placeholder}
          rows={2}
          value={draft}
        />
      ) : (
        <Input
          aria-describedby={description}
          id={id}
          lang={lang}
          onBlur={commit}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          type={type}
          value={draft}
        />
      )}
      {hint ? (
        <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A text written in the language being edited: the other languages keep
 * theirs; the default language's text shows as the placeholder while this
 * one is not translated, and "Missing translation" flags it.
 */
export function FormLocalizedText({
  editing,
  fallback,
  flagMissing = true,
  hint,
  id,
  label,
  multiline,
  onChange,
  source,
  text,
  type,
}: {
  editing: FormEditingLanguage;
  id: string;
  label: string;
  text: FormText | undefined;
  onChange: (text: FormText | undefined) => void;
  /** False for texts often the same in every language (an address). */
  flagMissing?: boolean;
  /** What shows while no language has a text (a column name): it needs a translation too. */
  source?: string;
  /** The built-in text shown while empty (it is already translated). */
  fallback?: string;
  multiline?: boolean;
  type?: string;
  hint?: string;
}) {
  const { defaultLocale, locale } = editing;
  const original = resolveFormText(text, defaultLocale) ?? source;
  const placeholder = locale === defaultLocale ? source : original;
  return (
    <FormSettingText
      hint={hint}
      id={id}
      label={label}
      lang={locale}
      missing={
        flagMissing && formTextMissing(text, locale, defaultLocale, source)
      }
      missingLabel={editing.missingLabel}
      multiline={multiline}
      onCommit={(value) =>
        onChange(setFormText(text, locale, value, defaultLocale))
      }
      placeholder={placeholder ?? fallback}
      type={type}
      value={formTextIn(text, locale, defaultLocale)}
    />
  );
}

/** A labelled switch, as in the table's settings menus. */
export function FormSettingSwitch({
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

/** A labelled settings select (the rule editor's compact select). */
export function FormSettingSelect({
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
    <div className="grid min-w-0 gap-1.5">
      <span aria-hidden="true" className="text-muted-foreground text-sm">
        {label}
      </span>
      <RuleSelect
        label={label}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

/** "Missing translation" under a row of an outline, in the language being edited. */
export function FormMissingTranslation({
  label,
  missing,
}: {
  label: string;
  missing: boolean;
}) {
  return missing ? (
    <p className="pb-1 pl-7" data-form-missing-translation>
      <span className={MISSING_CLASS}>{label}</span>
    </p>
  ) : null;
}

/** The rules of one question, as its editor edits them. */
export interface FormQuestionRules {
  list: FormRule[];
  fields: ConditionField[];
  issues: RuleIssue[];
  summaries: string[];
  questions: ResolvedFormQuestion[];
  locale: string;
  translate?: FormTranslate;
  onAdd: () => void;
  onChange: (rule: FormRule) => void;
  onRemove: (id: string) => void;
}

/**
 * A question's conditions: a status line and "Edit conditions", which opens
 * the rules in a dialog (a drawer on phones) where the conditions have room.
 */
export function FormQuestionRulesEditor({
  label,
  name,
  rules,
}: {
  label: FormSettingsLabel;
  name: string;
  rules: FormQuestionRules;
}) {
  const [open, setOpen] = useState(false);
  const status = rules.list.length ? null : label("noConditions");
  return (
    <section className="grid gap-2" data-form-rules>
      <h4 className="font-medium text-muted-foreground text-xs">
        {label("conditions")}
      </h4>
      {status ? (
        <p className="text-muted-foreground text-xs">{status}</p>
      ) : null}
      {rules.issues.length ? (
        <p className="text-destructive text-xs" data-form-rules-problem>
          {label("conditionsProblem")}
        </p>
      ) : null}
      <Button
        className="w-fit font-normal"
        disabled={rules.fields.length === 0 && rules.list.length === 0}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <ListFilter aria-hidden="true" />
        {label("editConditions")}
      </Button>
      <FormRulesDialog
        description={label("conditionsDescription")}
        doneLabel={label("done")}
        onOpenChange={setOpen}
        open={open}
        title={label("conditionsTitle", { label: name })}
      >
        {rules.list.map((rule) => (
          <FormRuleEditor
            fields={rules.fields}
            issues={rules.issues.filter((issue) => issue.ruleId === rule.id)}
            key={rule.id}
            label={label}
            locale={rules.locale}
            onChange={rules.onChange}
            onRemove={() => rules.onRemove(rule.id)}
            questions={rules.questions}
            rule={rule}
            translate={rules.translate}
          />
        ))}
        {rules.list.length ? null : (
          <p className="text-muted-foreground text-sm">
            {label("noConditions")}
          </p>
        )}
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
      </FormRulesDialog>
    </section>
  );
}

/** Option labels of a select question, in the language being edited. */
function OptionLabels({
  column,
  editing,
  id,
  label,
  onChange,
  question,
}: {
  column: FormColumn;
  editing: FormEditingLanguage;
  id: string;
  label: FormSettingsLabel;
  onChange: (patch: Partial<FormQuestion>) => void;
  question: FormQuestion;
}) {
  const options = formOptions(column.options);
  if (!options.length) {
    return null;
  }
  return (
    <fieldset className="grid min-w-0 gap-2" data-form-option-labels>
      <legend className="mb-1 font-medium text-muted-foreground text-xs">
        {label("optionLabels")}
      </legend>
      {options.map((option, index) => {
        const value = String(option.value);
        return (
          <FormLocalizedText
            editing={editing}
            id={`${id}-option-${index}`}
            key={value}
            label={label("optionLabel", { option: option.label })}
            onChange={(text) =>
              onChange({
                optionLabels: setFormOptionLabel(question, value, text),
              })
            }
            source={option.label}
            text={question.optionLabels?.[value]}
          />
        );
      })}
    </fieldset>
  );
}

/**
 * A question's properties in the language being edited: its label (the
 * column name by default), help, placeholder, option labels, "Required" and,
 * with `rules`, its conditions.
 */
export function FormQuestionEditor({
  column,
  editing,
  id,
  label,
  name,
  onChange,
  question,
  rules,
}: {
  column: FormColumn;
  editing: FormEditingLanguage;
  /** Prefix of the editor's control ids. */
  id: string;
  label: FormSettingsLabel;
  /** The question's name, for its conditions dialog. */
  name: string;
  onChange: (patch: Partial<FormQuestion>) => void;
  question: FormQuestion;
  rules?: FormQuestionRules;
}) {
  const editor = formColumnEditor(column);
  const textInput = editor !== "boolean" && editor !== "multiSelect";
  const choices = editor === "select" || editor === "multiSelect";
  return (
    <>
      <FormLocalizedText
        editing={editing}
        id={`${id}-label`}
        label={label("label")}
        onChange={(text) => onChange({ label: text })}
        source={column.header}
        text={question.label}
      />
      <FormLocalizedText
        editing={editing}
        id={`${id}-help`}
        label={label("help")}
        multiline
        onChange={(text) => onChange({ help: text })}
        text={question.help}
      />
      {textInput ? (
        <FormLocalizedText
          editing={editing}
          id={`${id}-placeholder`}
          label={label("placeholder")}
          onChange={(text) => onChange({ placeholder: text })}
          text={question.placeholder}
        />
      ) : null}
      {choices ? (
        <OptionLabels
          column={column}
          editing={editing}
          id={id}
          label={label}
          onChange={onChange}
          question={question}
        />
      ) : null}
      <FormSettingSwitch
        checked={question.required === true}
        id={`${id}-required`}
        label={label("requiredToggle")}
        onChange={(required) => onChange({ required })}
      />
      {rules ? (
        <FormQuestionRulesEditor label={label} name={name} rules={rules} />
      ) : null}
    </>
  );
}

/**
 * A consent's statement, link and version in the language being edited; the
 * built-in statement shows while it is unset. Always required, never hidden
 * by rules.
 */
export function FormConsentEditor({
  consent,
  editing,
  id,
  label,
  onChange,
}: {
  consent: FormConsentQuestion;
  editing: FormEditingLanguage;
  /** Prefix of the editor's control ids. */
  id: string;
  label: FormSettingsLabel;
  onChange: (patch: Partial<FormConsentQuestion>) => void;
}) {
  const builtIn = (key: FormLabelKey) => formLabel(key, editing.locale);
  return (
    <>
      <FormLocalizedText
        editing={editing}
        fallback={builtIn(consent.link ? "consentTextLink" : "consentText")}
        hint={label("consentLinkHint")}
        id={`${id}-text`}
        label={label("consentStatement")}
        multiline
        onChange={(text) => onChange({ text })}
        text={consent.text}
      />
      <FormLocalizedText
        editing={editing}
        fallback={builtIn("consentLinkLabel")}
        id={`${id}-link-label`}
        label={label("linkText")}
        onChange={(text) =>
          onChange({ link: { ...consent.link, label: text } })
        }
        text={consent.link?.label}
      />
      <FormLocalizedText
        editing={editing}
        flagMissing={false}
        id={`${id}-link-href`}
        label={label("linkUrl")}
        onChange={(href) => onChange({ link: { ...consent.link, href } })}
        text={consent.link?.href}
        type="url"
      />
      <FormSettingText
        id={`${id}-version`}
        label={label("consentVersion")}
        onCommit={(version) => onChange({ version })}
        placeholder="1"
        value={consent.version ?? ""}
      />
      <p className="text-muted-foreground text-xs">{label("consentNote")}</p>
    </>
  );
}

/** Labels of the hidden field sources. */
export const FORM_HIDDEN_SOURCE_LABELS: Record<
  FormHiddenSourceType,
  FormLabelKey
> = {
  urlParam: "sourceUrlParam",
  pageUrl: "sourcePageUrl",
  referrer: "sourceReferrer",
  locale: "sourceLocale",
  static: "sourceStatic",
};

/** A source of another type, keeping what it can of the current one. */
function sourceOfType(
  type: FormHiddenSourceType,
  field: FormHiddenField
): FormHiddenSource {
  switch (type) {
    case "urlParam":
      return { type, name: "utm_source" };
    case "static":
      return { type, value: field.id };
    default:
      return { type };
  }
}

/**
 * A hidden field's source (URL parameter, page, referrer, language or fixed
 * text) and where its value is saved: a column, or the response details.
 */
export function FormHiddenFieldEditor({
  columns,
  field,
  id,
  label,
  onChange,
}: {
  /** Columns the field may write (`formHiddenFieldColumns`). */
  columns: readonly FormColumn[];
  field: FormHiddenField;
  /** Prefix of the editor's control ids. */
  id: string;
  label: FormSettingsLabel;
  onChange: (patch: { source?: FormHiddenSource; columnId?: string }) => void;
}) {
  return (
    <>
      <FormSettingSelect
        label={label("hiddenSource")}
        onChange={(type) =>
          onChange({
            source: sourceOfType(type as FormHiddenSourceType, field),
          })
        }
        options={Object.entries(FORM_HIDDEN_SOURCE_LABELS).map(
          ([value, key]) => ({ value, label: label(key) })
        )}
        value={field.source.type}
      />
      {field.source.type === "urlParam" ? (
        <FormSettingText
          id={`${id}-param`}
          label={label("paramName")}
          onCommit={(value) =>
            onChange({ source: { type: "urlParam", name: value } })
          }
          value={field.source.name}
        />
      ) : null}
      {field.source.type === "static" ? (
        <FormSettingText
          id={`${id}-static`}
          label={label("staticValue")}
          onCommit={(value) => onChange({ source: { type: "static", value } })}
          value={field.source.value}
        />
      ) : null}
      <FormSettingSelect
        label={label("saveIn")}
        onChange={(value) =>
          onChange({ columnId: value === DETAILS ? undefined : value })
        }
        options={[
          { value: DETAILS, label: label("responseDetails") },
          ...columns.map((item) => ({ value: item.id, label: item.header })),
        ]}
        value={field.columnId ?? DETAILS}
      />
    </>
  );
}
