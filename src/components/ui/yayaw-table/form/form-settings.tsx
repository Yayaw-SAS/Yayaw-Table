"use client";

import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from "lucide-react";
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

function QuestionActions({
  count,
  editing,
  id,
  index,
  label,
  name,
  onEdit,
  onMove,
}: {
  count: number;
  editing: boolean;
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
        aria-label={label("editQuestion", { label: name })}
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

/** One column: asked or not, its place in the form and its texts. */
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
          <QuestionActions
            count={count}
            editing={editing}
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
  const choiceFields = notAsked.flatMap((column) => {
    const field = choiceField(column, label, hiddenValues[column.id], (value) =>
      setHidden(column.id, value)
    );
    return field ? [field] : [];
  });
  const typedFixed = notAsked.filter((column) => !formHiddenChoices(column));

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
      <SettingsSection title={label("questions")}>
        <ul className="-mx-1 grid gap-0.5">
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
