"use client";

import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DisplayModeSettingsContext } from "../types/display-mode-renderer";
import {
  type FormColumn,
  type FormHiddenValue,
  type FormLabelKey,
  type FormQuestion,
  type FormViewSettings,
  formColumnEditor,
  formColumns,
  formHiddenChoices,
  formHiddenValueFrom,
  formHiddenValueText,
  formLabel,
  formQuestionList,
  formSettingsRows,
  mergeFormSettings,
  moveFormQuestion,
  normalizeFormViewConfig,
  toggleFormQuestion,
  updateFormQuestion,
} from "../utils/form-view";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

const CHECK_CLASS = "size-4 shrink-0 accent-primary";
const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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

function QuestionDetails({
  id,
  label,
  onChange,
  question,
  textInput,
}: {
  id: string;
  label: Label;
  onChange: (patch: Partial<FormQuestion>) => void;
  question: FormQuestion;
  textInput: boolean;
}) {
  return (
    <div className="grid gap-2 border-l-2 pl-3" id={`${id}-details`}>
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
      <label
        className="flex min-h-8 items-center gap-2 text-sm"
        htmlFor={`${id}-required`}
      >
        <input
          checked={question.required === true}
          className={CHECK_CLASS}
          id={`${id}-required`}
          onChange={(event) => onChange({ required: event.target.checked })}
          type="checkbox"
        />
        {label("requiredToggle")}
      </label>
    </div>
  );
}

interface QuestionRowProps {
  column: FormColumn;
  index: number;
  count: number;
  label: Label;
  question?: FormQuestion;
  onAsk: (asked: boolean) => void;
  onMove: (offset: -1 | 1) => void;
  onChange: (patch: Partial<FormQuestion>) => void;
}

function QuestionRow({
  column,
  count,
  index,
  label,
  onAsk,
  onChange,
  onMove,
  question,
}: QuestionRowProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const name = column.header;
  const editor = formColumnEditor(column);
  const textInput = editor !== "boolean" && editor !== "multiSelect";
  return (
    <li className="grid gap-2" data-form-setting-question={column.id}>
      <div className="flex min-w-0 items-center gap-1">
        <input
          aria-label={label("ask", { label: name })}
          checked={Boolean(question)}
          className={CHECK_CLASS}
          id={`${id}-ask`}
          onChange={(event) => onAsk(event.target.checked)}
          type="checkbox"
        />
        <label
          className="min-w-0 flex-1 truncate pl-1 text-sm"
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
          <>
            <Button
              aria-label={label("moveUp", { label: name })}
              disabled={index === 0}
              onClick={() => onMove(-1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label={label("moveDown", { label: name })}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-controls={`${id}-details`}
              aria-expanded={editing}
              aria-label={label("editQuestion", { label: name })}
              onClick={() => setEditing((value) => !value)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
      {question && editing ? (
        <QuestionDetails
          id={id}
          label={label}
          onChange={onChange}
          question={question}
          textInput={textInput}
        />
      ) : null}
    </li>
  );
}

function HiddenValueField({
  column,
  label,
  onChange,
  value,
}: {
  column: FormColumn;
  label: Label;
  onChange: (value: FormHiddenValue | undefined) => void;
  value: FormHiddenValue | undefined;
}) {
  const id = useId();
  const options = formHiddenChoices(column);
  const title = label("hiddenValue", { label: column.header });
  if (options) {
    return (
      <div className="grid min-w-0 gap-1.5">
        <label className="text-muted-foreground text-sm" htmlFor={id}>
          {title}
        </label>
        <select
          className={SELECT_CLASS}
          id={id}
          onChange={(event) =>
            onChange(formHiddenValueFrom(column, event.target.value))
          }
          value={value === undefined ? "" : String(value)}
        >
          <option value="">{label("none")}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <CommitText
      id={id}
      label={title}
      onCommit={(next) => onChange(formHiddenValueFrom(column, next))}
      value={formHiddenValueText(value)}
    />
  );
}

function SettingsSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-2">
      <h3 className="font-medium text-sm">{title}</h3>
      {children}
    </section>
  );
}

/** View → Form settings: texts, questions and their order, fixed values and the end of the form. */
export function FormSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const id = useId();
  const label: Label = (key, params) =>
    formLabel(
      key,
      context.locale,
      (name, fallback) => context.translate(`form.${name}`, fallback),
      params
    );
  const view = (normalizeFormViewConfig(context.settings) ??
    {}) as FormViewSettings;
  const merged = mergeFormSettings(context.defaults, context.settings);
  const { eligible, excluded } = formColumns(context.columns);
  const questions = formQuestionList(context.columns, merged);
  const rows = formSettingsRows(context.columns, merged);
  const asked = new Set(questions.map((question) => question.columnId));
  const update = (patch: FormViewSettings) =>
    context.updateSettings(
      normalizeFormViewConfig({ ...view, ...patch }) as
        | Record<string, unknown>
        | undefined
    );
  const setQuestions = (next: FormQuestion[]) => update({ questions: next });
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

  return (
    <div className="grid min-w-0 gap-4" data-form-settings>
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
      <SettingsSection title={label("questions")}>
        <ul className="grid gap-2">
          {rows.map(({ column, index, question }) => (
            <QuestionRow
              column={column}
              count={questions.length}
              index={index}
              key={column.id}
              label={label}
              onAsk={(next) =>
                setQuestions(toggleFormQuestion(questions, column.id, next))
              }
              onChange={(patch) =>
                question &&
                setQuestions(updateFormQuestion(questions, question.id, patch))
              }
              onMove={(offset) =>
                question &&
                setQuestions(moveFormQuestion(questions, question.id, offset))
              }
              question={question}
            />
          ))}
        </ul>
        {excluded.length ? (
          <p className="text-muted-foreground text-xs">
            {label("excluded", {
              columns: excluded.map((column) => column.header).join(", "),
            })}
          </p>
        ) : null}
      </SettingsSection>
      {notAsked.length ? (
        <SettingsSection title={label("hidden")}>
          <p className="text-muted-foreground text-xs">{label("hiddenHint")}</p>
          {notAsked.map((column) => (
            <HiddenValueField
              column={column}
              key={column.id}
              label={label}
              onChange={(value) => setHidden(column.id, value)}
              value={hiddenValues[column.id]}
            />
          ))}
        </SettingsSection>
      ) : null}
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
        <label
          className="flex min-h-8 items-center gap-2 text-sm"
          htmlFor={`${id}-another`}
        >
          <input
            checked={merged.allowAnotherResponse !== false}
            className={CHECK_CLASS}
            id={`${id}-another`}
            onChange={(event) =>
              update({ allowAnotherResponse: event.target.checked })
            }
            type="checkbox"
          />
          {label("allowAnother")}
        </label>
        <CommitText
          id={`${id}-redirect`}
          label={label("redirectUrl")}
          onCommit={(redirectUrl) => update({ redirectUrl })}
          type="url"
          value={merged.redirectUrl ?? ""}
        />
        <p className="text-muted-foreground text-xs">{label("redirectHint")}</p>
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
    </div>
  );
}
