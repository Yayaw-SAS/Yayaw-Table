"use client";

import type { ChangeEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import type {
  FormDraft,
  FormEditor,
  ResolvedFormQuestion,
} from "../utils/form-view";

type Answer = FormDraft[string];

export interface FormQuestionFieldProps {
  question: ResolvedFormQuestion;
  /** Id of the question's first control; the form focuses it on errors. */
  inputId: string;
  value: Answer | undefined;
  error?: string;
  disabled?: boolean;
  /** Placeholder of the empty select option. */
  chooseLabel: string;
  onChange: (value: Answer) => void;
}

const INPUT_TYPES: Partial<Record<FormEditor, string>> = {
  date: "date",
  number: "text",
  text: "text",
  url: "url",
};

const SELECT_CLASS =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";
const CHECK_CLASS = "size-4 shrink-0 accent-primary";

const describedBy = (ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

const text = (value: Answer | undefined) =>
  typeof value === "string" ? value : "";

function Choices({
  error,
  inputId,
  onChange,
  question,
  value,
  disabled,
  describedById,
}: FormQuestionFieldProps & { describedById?: string }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="grid gap-2">
      {question.options.map((option, index) => {
        const key = String(option.value);
        const id = index === 0 ? inputId : `${inputId}-${index}`;
        return (
          <label className="flex min-h-9 items-center gap-2 text-sm" htmlFor={id} key={key}>
            <input
              aria-describedby={describedById}
              aria-invalid={error ? true : undefined}
              checked={selected.includes(key)}
              className={CHECK_CLASS}
              disabled={disabled}
              id={id}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, key]
                    : selected.filter((item) => item !== key)
                )
              }
              type="checkbox"
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Control({
  describedById,
  ...props
}: FormQuestionFieldProps & { describedById?: string }) {
  const { chooseLabel, disabled, error, inputId, onChange, question, value } =
    props;
  const common = {
    "aria-describedby": describedById,
    "aria-invalid": error ? true : undefined,
    disabled,
    id: inputId,
    required: question.required,
  };
  const onText = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => onChange(event.target.value);
  switch (question.editor) {
    case "textarea":
      return (
        <Textarea
          {...common}
          onChange={onText}
          placeholder={question.placeholder}
          rows={4}
          value={text(value)}
        />
      );
    case "select":
      return (
        <select
          {...common}
          className={SELECT_CLASS}
          onChange={onText}
          value={text(value)}
        >
          <option value="">{question.placeholder ?? chooseLabel}</option>
          {question.options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "multiSelect":
      return <Choices {...props} describedById={describedById} />;
    case "boolean":
      return null;
    default:
      return (
        <Input
          {...common}
          autoComplete="off"
          inputMode={question.editor === "number" ? "decimal" : undefined}
          onChange={onText}
          placeholder={question.placeholder}
          type={INPUT_TYPES[question.editor] ?? "text"}
          value={text(value)}
        />
      );
  }
}

function RequiredMark({ required }: { required: boolean }) {
  return required ? (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  ) : null;
}

function QuestionFrame({
  children,
  error,
  errorId,
  help,
  helpId,
  label,
  question,
}: {
  children: ReactNode;
  error?: string;
  errorId: string;
  help?: string;
  helpId: string;
  /** Shown first, with the help text right under it. */
  label?: ReactNode;
  question: ResolvedFormQuestion;
}) {
  const helpText = help ? (
    <p className="text-muted-foreground text-sm" id={helpId}>
      {help}
    </p>
  ) : null;
  return (
    <div
      className="grid gap-1.5"
      data-form-question={question.id}
      data-invalid={error ? true : undefined}
    >
      {label}
      {label ? helpText : null}
      {children}
      {label ? null : helpText}
      {error ? (
        <p className="font-medium text-destructive text-sm" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One question: its label, input, help text and error. Rendered on its own
 * so a step-by-step layout can show questions one at a time.
 */
export function FormQuestionField(props: FormQuestionFieldProps) {
  const { disabled, error, inputId, onChange, question, value } = props;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedById = describedBy([
    question.help && helpId,
    error && errorId,
  ]);
  if (question.editor === "boolean") {
    return (
      <QuestionFrame
        error={error}
        errorId={errorId}
        help={question.help}
        helpId={helpId}
        question={question}
      >
        <label className="flex min-h-9 items-center gap-2 font-medium text-sm" htmlFor={inputId}>
          <input
            aria-describedby={describedById}
            aria-invalid={error ? true : undefined}
            checked={value === true}
            className={CHECK_CLASS}
            disabled={disabled}
            id={inputId}
            onChange={(event) => onChange(event.target.checked)}
            required={question.required}
            type="checkbox"
          />
          <span>
            {question.label}
            <RequiredMark required={question.required} />
          </span>
        </label>
      </QuestionFrame>
    );
  }
  if (question.editor === "multiSelect") {
    return (
      <fieldset
        aria-describedby={describedById}
        className={cn("grid min-w-0 gap-1.5 border-0 p-0")}
        data-form-question={question.id}
        data-invalid={error ? true : undefined}
      >
        <legend className="mb-1.5 font-medium text-sm">
          {question.label}
          <RequiredMark required={question.required} />
        </legend>
        {question.help ? (
          <p className="text-muted-foreground text-sm" id={helpId}>
            {question.help}
          </p>
        ) : null}
        <Control {...props} describedById={describedById} />
        {error ? (
          <p className="font-medium text-destructive text-sm" id={errorId}>
            {error}
          </p>
        ) : null}
      </fieldset>
    );
  }
  return (
    <QuestionFrame
      error={error}
      errorId={errorId}
      help={question.help}
      helpId={helpId}
      label={
        <label className="font-medium text-sm" htmlFor={inputId}>
          {question.label}
          <RequiredMark required={question.required} />
        </label>
      }
      question={question}
    >
      <Control
        {...props}
        describedById={describedById}
        disabled={disabled}
        onChange={onChange}
        value={value}
      />
    </QuestionFrame>
  );
}
