"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useId } from "react";
import { Button } from "@/src/components/ui/button";
import type {
  FormBuilderController,
  FormBuilderSelection,
  FormBuilderState,
} from "../utils/form-builder";
import { formLanguageName } from "../utils/form-text";
import {
  type FormLabelKey,
  type FormTranslate,
  formHiddenValueFrom,
  formHiddenValueText,
  formLabel,
} from "../utils/form-view";
import {
  FormConsentEditor,
  type FormEditingLanguage,
  FormHiddenFieldEditor,
  FormLocalizedText,
  FormQuestionEditor,
  type FormQuestionRules,
  FormRulesList,
  FormSettingSelect,
  FormSettingSwitch,
  FormSettingText,
} from "./form-editors";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

/** "None" of a fixed value chosen in a list (select options cannot be empty). */
const NONE = "__none";
const NON_WORD = /\W/g;

interface PanelProps {
  controller: FormBuilderController;
  editing: FormEditingLanguage;
  id: string;
  label: Label;
  state: FormBuilderState;
}

function PropertiesSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-3">
      <h3 className="font-medium text-sm" id={id}>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The form's own settings: texts, layout, languages, the end of the form and the view. */
function FormProperties({ controller, editing, id, label, state }: PanelProps) {
  const { form } = state;
  const steps = state.layout === "steps";
  return (
    <>
      <PropertiesSection title={label("settings")}>
        <FormLocalizedText
          editing={editing}
          id={`${id}-title`}
          label={label("title")}
          onChange={(title) => controller.write({ title })}
          text={form.title}
        />
        <FormLocalizedText
          editing={editing}
          id={`${id}-description`}
          label={label("description")}
          multiline
          onChange={(description) => controller.write({ description })}
          text={form.description}
        />
      </PropertiesSection>
      <PropertiesSection title={label("layout")}>
        <FormSettingSwitch
          checked={steps}
          id={`${id}-steps`}
          label={label("layoutSteps")}
          onChange={(next) => controller.setLayout(next ? "steps" : "page")}
        />
        {steps ? (
          <FormSettingSwitch
            checked={form.review === true}
            id={`${id}-review`}
            label={label("review")}
            onChange={(review) => controller.update({ review })}
          />
        ) : null}
      </PropertiesSection>
      {state.languages.length > 1 ? (
        <PropertiesSection title={label("languages")}>
          <FormSettingSelect
            label={label("defaultLanguage")}
            onChange={(locale) => controller.setDefaultLocale(locale)}
            options={state.languages.map((locale) => ({
              value: locale,
              label: formLanguageName(locale),
            }))}
            value={state.defaultLocale}
          />
        </PropertiesSection>
      ) : null}
      <PropertiesSection title={label("afterSubmit")}>
        <FormLocalizedText
          editing={editing}
          fallback={formLabel("submit", editing.locale)}
          id={`${id}-submit`}
          label={label("submitLabel")}
          onChange={(submitLabel) => controller.write({ submitLabel })}
          text={form.submitLabel}
        />
        <FormLocalizedText
          editing={editing}
          fallback={formLabel("success", editing.locale)}
          id={`${id}-success`}
          label={label("successMessage")}
          multiline
          onChange={(successMessage) => controller.write({ successMessage })}
          text={form.successMessage}
        />
        <FormSettingSwitch
          checked={form.allowAnotherResponse !== false}
          id={`${id}-another`}
          label={label("allowAnother")}
          onChange={(allowAnotherResponse) =>
            controller.update({ allowAnotherResponse })
          }
        />
        <FormSettingText
          hint={label("redirectHint")}
          id={`${id}-redirect`}
          label={label("redirectUrl")}
          onCommit={(redirectUrl) => controller.update({ redirectUrl })}
          type="url"
          value={form.redirectUrl ?? ""}
        />
        <FormLocalizedText
          editing={editing}
          fallback={formLabel("closed", editing.locale)}
          id={`${id}-closed`}
          label={label("closedMessage")}
          multiline
          onChange={(closedMessage) => controller.write({ closedMessage })}
          text={form.closedMessage}
        />
      </PropertiesSection>
      <PropertiesSection title={label("inTheView")}>
        <FormSettingSwitch
          checked={form.editButton !== false}
          id={`${id}-edit-button`}
          label={label("editButtonSetting")}
          onChange={(editButton) => controller.update({ editButton })}
        />
        <p className="-mt-2 text-muted-foreground text-xs">
          {label("editButtonHint")}
        </p>
      </PropertiesSection>
      <div className="grid justify-items-start gap-1.5 border-t pt-4">
        <Button
          className="font-normal"
          onClick={() => controller.reset()}
          size="sm"
          type="button"
          variant="outline"
        >
          {label("reset")}
        </Button>
        <p className="text-muted-foreground text-xs">{label("resetHint")}</p>
      </div>
    </>
  );
}

/** Move up, Move down and Remove, for a question, section or consent. */
function ItemActions({
  controller,
  count,
  id,
  index,
  label,
  name,
  removeLabel,
}: {
  controller: FormBuilderController;
  count: number;
  id: string;
  index: number;
  label: Label;
  name: string;
  /** The remove button's text: "Remove from the form" for questions, else "Remove" (named "Remove <item>"). */
  removeLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
      <Button
        aria-label={label("moveUp", { label: name })}
        disabled={index === 0}
        onClick={() => controller.move(id, -1)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        aria-label={label("moveDown", { label: name })}
        disabled={index === count - 1}
        onClick={() => controller.move(id, 1)}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <ArrowDown aria-hidden="true" />
      </Button>
      <Button
        aria-label={removeLabel ? undefined : label("removeSection", { label: name })}
        className="ml-auto font-normal text-destructive hover:text-destructive"
        onClick={() => controller.remove(id)}
        size="sm"
        type="button"
        variant="outline"
      >
        <Trash2 aria-hidden="true" />
        {removeLabel ?? label("remove")}
      </Button>
    </div>
  );
}

function QuestionProperties({
  controller,
  editing,
  id,
  label,
  locale,
  selection,
  translate,
}: PanelProps & {
  locale: string;
  selection: Extract<FormBuilderSelection, { kind: "question" }>;
  translate?: FormTranslate;
}) {
  const { entry } = selection;
  const rules: FormQuestionRules = {
    ...selection.rules,
    locale,
    translate,
    onAdd: () => controller.addRule(entry.id),
    onChange: (rule) => controller.changeRule(rule),
    onRemove: (ruleId) => controller.removeRule(ruleId),
  };
  return (
    <>
      <FormQuestionEditor
        column={entry.column}
        editing={editing}
        id={id}
        label={label}
        onChange={(patch) => controller.changeItem(entry.id, patch)}
        question={entry.question}
      />
      <section className="grid min-w-0 gap-2" data-form-rules>
        <h3 className="font-medium text-sm">{label("conditions")}</h3>
        {rules.summaries.length ? (
          <ul className="grid gap-0.5" data-form-rule-summary>
            {rules.summaries.map((summary) => (
              <li className="text-muted-foreground text-xs" key={summary}>
                {summary}
              </li>
            ))}
          </ul>
        ) : null}
        <FormRulesList label={label} rules={rules} />
      </section>
      <ItemActions
        controller={controller}
        count={selection.count}
        id={entry.id}
        index={entry.index}
        label={label}
        name={entry.name}
        removeLabel={label("removeQuestion")}
      />
    </>
  );
}

/** A column the form does not ask: ask it, or save a fixed value with every response. */
function ColumnProperties({
  controller,
  id,
  label,
  selection,
}: Omit<PanelProps, "editing" | "state"> & {
  selection: Extract<FormBuilderSelection, { kind: "column" }>;
}) {
  const { column } = selection.entry;
  const value = selection.value;
  const setValue = (next: string) =>
    controller.setFixedValue(
      column.id,
      next === NONE ? undefined : formHiddenValueFrom(column, next)
    );
  return (
    <>
      <p className="text-muted-foreground text-sm">{label("notInFormHint")}</p>
      <Button
        className="w-fit"
        onClick={() => controller.ask(column.id)}
        size="sm"
        type="button"
      >
        <Plus aria-hidden="true" />
        {label("askQuestion")}
      </Button>
      <PropertiesSection title={label("fixedValue")}>
        {selection.choices ? (
          <FormSettingSelect
            label={label("hiddenValue", { label: column.header })}
            onChange={setValue}
            options={[{ value: NONE, label: label("none") }, ...selection.choices]}
            value={value === undefined ? NONE : String(value)}
          />
        ) : (
          <FormSettingText
            id={`${id}-fixed`}
            label={label("hiddenValue", { label: column.header })}
            onCommit={setValue}
            value={formHiddenValueText(value)}
          />
        )}
        <p className="-mt-1 text-muted-foreground text-xs">{label("hiddenHint")}</p>
      </PropertiesSection>
    </>
  );
}

function SelectionProperties(
  props: PanelProps & { locale: string; translate?: FormTranslate }
) {
  const { controller, editing, id, label, state } = props;
  const selection = state.selection;
  switch (selection.kind) {
    case "question":
      return <QuestionProperties {...props} selection={selection} />;
    case "section": {
      const { entry } = selection;
      return (
        <>
          <FormLocalizedText
            editing={editing}
            id={`${id}-title`}
            label={label("sectionTitle")}
            onChange={(title) => controller.changeItem(entry.id, { title })}
            text={entry.section.title}
          />
          <FormLocalizedText
            editing={editing}
            id={`${id}-description`}
            label={label("sectionDescription")}
            multiline
            onChange={(description) =>
              controller.changeItem(entry.id, { description })
            }
            text={entry.section.description}
          />
          <ItemActions
            controller={controller}
            count={selection.count}
            id={entry.id}
            index={entry.index}
            label={label}
            name={entry.name}
          />
        </>
      );
    }
    case "consent": {
      const { entry } = selection;
      return (
        <>
          <FormConsentEditor
            consent={entry.consent}
            editing={editing}
            id={id}
            label={label}
            onChange={(patch) => controller.changeItem(entry.id, patch)}
          />
          <ItemActions
            controller={controller}
            count={selection.count}
            id={entry.id}
            index={entry.index}
            label={label}
            name={entry.name}
          />
        </>
      );
    }
    case "hidden": {
      const { entry } = selection;
      return (
        <>
          <p className="text-muted-foreground text-sm">{label("hiddenFieldsHint")}</p>
          <FormHiddenFieldEditor
            columns={selection.columns}
            field={entry.field}
            id={id}
            label={label}
            onChange={(patch) => controller.changeHidden(entry.id, patch)}
          />
          <div className="flex border-t pt-4">
            <Button
              aria-label={label("removeSection", { label: entry.name })}
              className="ml-auto font-normal text-destructive hover:text-destructive"
              onClick={() => controller.remove(entry.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 aria-hidden="true" />
              {label("remove")}
            </Button>
          </div>
        </>
      );
    }
    case "column":
      return <ColumnProperties {...props} selection={selection} />;
    default:
      return <FormProperties {...props} />;
  }
}

/** The heading of the properties: what is selected, and where it is. */
function selectionTitle(
  selection: FormBuilderSelection,
  label: Label
): { title: string; subtitle?: string } {
  switch (selection.kind) {
    case "question":
      return {
        title: selection.entry.name,
        subtitle: label("columnOf", { label: selection.entry.column.header }),
      };
    case "section":
      return { title: selection.entry.name, subtitle: label("section") };
    case "consent":
      return { title: label("consent"), subtitle: selection.entry.name };
    case "hidden":
      return { title: selection.entry.name, subtitle: label("hiddenField") };
    case "column":
      return { title: selection.entry.name, subtitle: label("notInForm") };
    default:
      return { title: label("settingsTitle") };
  }
}

/**
 * The builder's right column: the properties of the selected entry, written in
 * the language being edited; a question's conditions are edited in place.
 */
export function FormBuilderProperties({
  controller,
  headingId,
  label,
  languageBar,
  locale,
  state,
  translate,
}: {
  controller: FormBuilderController;
  headingId: string;
  label: Label;
  /** The language switcher, above the properties on phones. */
  languageBar?: ReactNode;
  /** The table's language, for rule summaries. */
  locale: string;
  state: FormBuilderState;
  translate?: FormTranslate;
}) {
  const id = useId();
  const editing: FormEditingLanguage = {
    locale: state.locale,
    defaultLocale: state.defaultLocale,
    missingLabel: label("missingTranslation"),
  };
  const { subtitle, title } = selectionTitle(state.selection, label);
  const translation =
    state.locale === state.defaultLocale
      ? undefined
      : label("translationHint", {
          language: formLanguageName(state.defaultLocale, locale),
        });
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-0 flex-col"
      data-form-builder-properties
    >
      <div className="flex min-h-12 min-w-0 flex-col justify-center border-b px-4 py-2">
        <h2 className="truncate font-medium text-sm" id={headingId}>
          <span className="sr-only">{label("builderProperties")}: </span>
          {title}
        </h2>
        {subtitle ? (
          <p className="truncate text-muted-foreground text-xs">{subtitle}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid min-w-0 gap-4 p-4" key={state.selected}>
          {languageBar}
          {translation ? (
            <p className="text-muted-foreground text-xs" data-form-translation-hint>
              {translation}
            </p>
          ) : null}
          <SelectionProperties
            controller={controller}
            editing={editing}
            id={`${id}-${state.selected.replaceAll(NON_WORD, "-")}`}
            label={label}
            locale={locale}
            state={state}
            translate={translate}
          />
        </div>
      </div>
    </section>
  );
}
