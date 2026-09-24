"use client";

import { type ReactNode, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/src/components/ui/field";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Switch } from "@/src/components/ui/switch";
import { Textarea } from "@/src/components/ui/textarea";
import { FormSelectContent } from "../components/forms/fields/form-select-content";
import { LocationEditor } from "../components/location/location-editor";
import { parseLocation } from "../utils/location-model";
import {
  type FormDraft,
  type FormOption,
  formNumberDisplay,
  type ResolvedFormQuestion,
} from "../utils/form-view";
import { tagAppearance } from "../utils/tag-colors";
import "../utils/tag-colors.css";
import { FormDateField } from "./form-date-field";

type Answer = FormDraft[string];

/** Texts a question shows besides its own. */
export interface FormQuestionLabels {
  /** Placeholder of an empty select. */
  choose: string;
  /** Placeholder of an empty date. */
  pickDate: string;
  /** Removes the picked date. */
  clearDate: string;
}

export interface FormQuestionFieldProps {
  question: ResolvedFormQuestion;
  /** Id of the question's control; its label points at it. */
  inputId: string;
  value: Answer | undefined;
  error?: string;
  disabled?: boolean;
  /** Language of dates and numbers. */
  locale: string;
  labels: FormQuestionLabels;
  onChange: (value: Answer) => void;
}

/** What every control of a question carries for assistive technologies. */
interface ControlProps extends FormQuestionFieldProps {
  describedBy?: string;
  labelId: string;
}

/** An invalid question turns its label red, not the answer typed in it. */
const KEEP_CONTROL_TEXT =
  "min-w-0 [&_:is(input,textarea,button)]:text-foreground";

const describedBy = (ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

const text = (value: Answer | undefined) =>
  typeof value === "string" ? value : "";

/** An option as the table shows it: a tag for tag columns, plain text otherwise. */
function OptionLabel({
  option,
  question,
}: {
  option: FormOption;
  question: ResolvedFormQuestion;
}) {
  if (!question.tags) {
    return <span className="truncate">{option.label}</span>;
  }
  const appearance = tagAppearance(
    String(option.value),
    question.coloredTags
  );
  return (
    <Badge
      className="yayaw-tag inline-flex items-center rounded-md px-2 py-0.5 text-xs"
      data-colored={appearance.colored}
      style={appearance.style}
    >
      {option.label}
    </Badge>
  );
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? (
    <span aria-hidden="true" className="-ml-1 text-destructive">
      *
    </span>
  ) : null;
}

function SelectControl({
  describedBy: description,
  disabled,
  error,
  inputId,
  labelId,
  labels,
  onChange,
  question,
  value,
}: ControlProps) {
  const current = text(value);
  const byValue = new Map(
    question.options.map((option) => [String(option.value), option])
  );
  return (
    <Select
      disabled={disabled}
      items={question.options.map((option) => ({
        label: option.label,
        value: String(option.value),
      }))}
      onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      value={current || null}
    >
      <SelectTrigger
        aria-describedby={description}
        aria-invalid={error ? true : undefined}
        aria-labelledby={labelId}
        aria-required={question.required || undefined}
        className="w-full min-w-0"
        data-form-focus
        id={inputId}
      >
        <SelectValue>
          {(selected: string | null) => {
            const option = selected ? byValue.get(selected) : undefined;
            return option ? (
              <OptionLabel option={option} question={question} />
            ) : (
              <span className="text-muted-foreground">
                {question.placeholder ?? labels.choose}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <FormSelectContent alignItemWithTrigger={false}>
        {question.options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)}>
            <OptionLabel option={option} question={question} />
          </SelectItem>
        ))}
      </FormSelectContent>
    </Select>
  );
}

/** Numbers are typed plainly and shown with the column's number format. */
function NumberControl({
  describedBy: description,
  disabled,
  error,
  inputId,
  locale,
  onChange,
  question,
  value,
}: ControlProps) {
  const [editing, setEditing] = useState(false);
  const raw = text(value);
  const shown = editing
    ? raw
    : (formNumberDisplay(raw, question.numberFormat, locale) ?? raw);
  return (
    <Input
      aria-describedby={description}
      aria-invalid={error ? true : undefined}
      autoComplete="off"
      className="tabular-nums"
      data-form-focus
      disabled={disabled}
      id={inputId}
      inputMode="decimal"
      onBlur={() => setEditing(false)}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setEditing(true)}
      placeholder={question.placeholder}
      required={question.required}
      value={shown}
    />
  );
}

function Control(props: ControlProps) {
  const {
    describedBy: description,
    disabled,
    error,
    inputId,
    labelId,
    labels,
    locale,
    onChange,
    question,
    value,
  } = props;
  const common = {
    "aria-describedby": description,
    "aria-invalid": error ? true : undefined,
    "data-form-focus": true,
    disabled,
    id: inputId,
    required: question.required,
  };
  switch (question.editor) {
    case "textarea":
      return (
        <Textarea
          {...common}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          rows={4}
          value={text(value)}
        />
      );
    case "select":
      return <SelectControl {...props} />;
    case "number":
      return <NumberControl {...props} />;
    case "location":
      // The draft keeps the place as JSON text; the answer is the parsed place.
      return (
        <LocationEditor
          describedBy={description}
          disabled={disabled}
          inputId={inputId}
          invalid={Boolean(error)}
          label={question.label}
          locale={locale}
          onChange={(place) => onChange(place ? JSON.stringify(place) : "")}
          value={parseLocation(text(value))}
        />
      );
    case "date":
      return (
        <FormDateField
          clearLabel={labels.clearDate}
          describedBy={description}
          disabled={disabled}
          id={inputId}
          invalid={Boolean(error)}
          labelId={labelId}
          locale={locale}
          onChange={onChange}
          placeholder={question.placeholder ?? labels.pickDate}
          required={question.required}
          value={text(value)}
        />
      );
    default:
      return (
        <Input
          {...common}
          autoComplete="off"
          inputMode={question.editor === "url" ? "url" : undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          type={question.editor === "url" ? "url" : "text"}
          value={text(value)}
        />
      );
  }
}

function QuestionError({ error, id }: { error?: string; id: string }) {
  // FieldError's look; the error summary is the only live alert, each error
  // is read with its question.
  return error ? (
    <p
      className="font-normal text-destructive text-sm"
      data-slot="field-error"
      id={id}
    >
      {error}
    </p>
  ) : null;
}

function Choices(props: ControlProps) {
  const {
    describedBy: description,
    disabled,
    error,
    inputId,
    onChange,
    question,
    value,
  } = props;
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="grid gap-2 rounded-md border p-3">
      {question.options.map((option, index) => {
        const key = String(option.value);
        const id = index === 0 ? inputId : `${inputId}-${index}`;
        return (
          <div className="flex min-h-6 items-center gap-2" key={key}>
            <Checkbox
              aria-describedby={description}
              aria-invalid={error ? true : undefined}
              aria-labelledby={`${id}-label`}
              checked={selected.includes(key)}
              data-form-focus={index === 0 ? true : undefined}
              disabled={disabled}
              id={id}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, key]
                    : selected.filter((item) => item !== key)
                )
              }
            />
            <FieldLabel className="font-normal" htmlFor={id} id={`${id}-label`}>
              <OptionLabel option={option} question={question} />
            </FieldLabel>
          </div>
        );
      })}
    </div>
  );
}

function BooleanQuestion(props: ControlProps & { errorId: string; helpId: string }) {
  const {
    describedBy: description,
    disabled,
    error,
    errorId,
    helpId,
    inputId,
    labelId,
    onChange,
    question,
    value,
  } = props;
  return (
    <Field
      data-form-question={question.id}
      data-invalid={error ? true : undefined}
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3 shadow-xs">
        <div className="grid min-w-0 gap-1">
          <FieldLabel htmlFor={inputId} id={labelId}>
            {question.label}
            <RequiredMark required={question.required} />
          </FieldLabel>
          {question.help ? (
            <FieldDescription id={helpId}>{question.help}</FieldDescription>
          ) : null}
        </div>
        <Switch
          aria-describedby={description}
          aria-invalid={error ? true : undefined}
          aria-labelledby={labelId}
          checked={value === true}
          data-form-focus
          disabled={disabled}
          id={inputId}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
      <QuestionError error={error} id={errorId} />
    </Field>
  );
}

function QuestionHeader({
  children,
  help,
  helpId,
}: {
  children: ReactNode;
  help?: string;
  helpId: string;
}) {
  return (
    <div className="grid gap-1">
      {children}
      {help ? <FieldDescription id={helpId}>{help}</FieldDescription> : null}
    </div>
  );
}

/**
 * One question: its label, control, help text and error, with the table's
 * form controls. Rendered on its own so a step-by-step layout can show
 * questions one at a time.
 */
export function FormQuestionField(props: FormQuestionFieldProps) {
  const { error, inputId, question } = props;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const labelId = `${inputId}-label`;
  const control: ControlProps = {
    ...props,
    describedBy: describedBy([question.help && helpId, error && errorId]),
    labelId,
  };
  if (question.editor === "boolean") {
    return <BooleanQuestion {...control} errorId={errorId} helpId={helpId} />;
  }
  if (question.editor === "multiSelect") {
    return (
      <FieldSet
        aria-describedby={control.describedBy}
        className="min-w-0 gap-3"
        data-form-question={question.id}
        data-invalid={error ? true : undefined}
      >
        <FieldLegend
          className="mb-0 flex items-center gap-2"
          id={labelId}
          variant="label"
        >
          {question.label}
          <RequiredMark required={question.required} />
        </FieldLegend>
        {question.help ? (
          <FieldDescription className="-mt-2" id={helpId}>
            {question.help}
          </FieldDescription>
        ) : null}
        <Choices {...control} />
        <QuestionError error={error} id={errorId} />
      </FieldSet>
    );
  }
  return (
    <Field
      className={KEEP_CONTROL_TEXT}
      data-form-question={question.id}
      data-invalid={error ? true : undefined}
    >
      <QuestionHeader help={question.help} helpId={helpId}>
        <FieldLabel htmlFor={inputId} id={labelId}>
          {question.label}
          <RequiredMark required={question.required} />
        </FieldLabel>
      </QuestionHeader>
      <Control {...control} />
      <QuestionError error={error} id={errorId} />
    </Field>
  );
}
