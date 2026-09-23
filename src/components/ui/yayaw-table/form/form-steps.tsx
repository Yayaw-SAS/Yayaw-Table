"use client";

/**
 * The steps layout of a form, built on the shadcn Questionnaire (Base UI
 * flavour): one question, or one section, per step; conditional steps are
 * skipped by the rules; Back, Next and Skip (optional steps); a progress
 * text; an optional review step. Questions keep the table's own controls
 * (selects with tags, the date picker, number formats), so navigation and
 * validation are ours: the Questionnaire only validates its native answers.
 */
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/src/components/ui/questionnaire";
import { Button } from "@/src/components/ui/button";
import type { FormEvaluation } from "../utils/form-conditions";
import {
  type FormDraft,
  type FormLabelKey,
  type FormStep,
  formAnswerText,
  formStepOptional,
  formSteps,
  type ResolvedFormQuestion,
  type ResolvedFormSettings,
  validateFormValues,
} from "../utils/form-view";
import { FormQuestionField, type FormQuestionLabels } from "./form-question";

export const REVIEW_STEP = "review";

type Label = (
  key: FormLabelKey,
  params?: Record<string, number | string>
) => string;

interface FormStepsProps {
  settings: ResolvedFormSettings;
  evaluation: FormEvaluation;
  draft: FormDraft;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  step?: string;
  disabled: boolean;
  locale: string;
  label: Label;
  labels: FormQuestionLabels;
  header: ReactNode;
  alert: ReactNode;
  extraFields?: ReactNode;
  submitText: string;
  className: string;
  formRef: RefObject<HTMLFormElement | null>;
  inputId: (question: ResolvedFormQuestion) => string;
  onAnswer: (columnId: string, value: FormDraft[string]) => void;
  onErrors: (errors: Record<string, string>) => void;
  onStepChange: (step: string) => void;
  onSubmit: () => Promise<void>;
}

const emptyAnswer = (question: ResolvedFormQuestion): FormDraft[string] => {
  if (question.editor === "boolean") {
    return false;
  }
  return question.editor === "multiSelect" ? [] : "";
};

/** Enter in a single-line input goes to the next step instead of submitting. */
const advancesOnEnter = (event: KeyboardEvent<HTMLFormElement>) => {
  const target = event.target as HTMLElement;
  return (
    event.key === "Enter" &&
    !(event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) &&
    !event.nativeEvent.isComposing &&
    target instanceof HTMLInputElement &&
    !["checkbox", "radio", "button", "submit"].includes(target.type)
  );
};

const stepOf = (steps: readonly FormStep[], columnId: string) =>
  steps.find((item) =>
    item.questions.some((question) => question.columnId === columnId)
  );

function ReviewStep({
  draft,
  evaluation,
  label,
  locale,
  onChange,
  steps,
}: {
  draft: FormDraft;
  evaluation: FormEvaluation;
  label: Label;
  locale: string;
  onChange: (step: string) => void;
  steps: readonly FormStep[];
}) {
  const words = { yes: label("yes"), no: label("no") };
  return (
    <QuestionnaireItem data-form-review name={REVIEW_STEP} required>
      <QuestionnaireTitle>{label("reviewTitle")}</QuestionnaireTitle>
      <dl className="grid gap-3">
        {steps.flatMap((item) =>
          item.questions.map((question) => {
            const text = formAnswerText(
              question,
              draft[question.columnId],
              locale,
              words
            );
            return (
              <div
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 border-b pb-3 last:border-b-0"
                data-form-review-question={question.id}
                key={question.id}
              >
                <dt className="text-muted-foreground text-sm">
                  {question.label}
                  {evaluation.required.has(question.id) ? " *" : ""}
                </dt>
                <dd className="col-start-1 whitespace-pre-line text-sm">
                  {text ?? (
                    <span className="text-muted-foreground">
                      {label("noAnswer")}
                    </span>
                  )}
                </dd>
                <Button
                  aria-label={label("reviewChange", { label: question.label })}
                  className="col-start-2 row-span-2 row-start-1"
                  onClick={() => onChange(item.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {label("reviewChange", { label: "" }).trim()}
                </Button>
              </div>
            );
          })
        )}
      </dl>
    </QuestionnaireItem>
  );
}

function StepFields({
  disabled,
  draft,
  errors,
  evaluation,
  inputId,
  labels,
  locale,
  onAnswer,
  step,
}: Pick<
  FormStepsProps,
  | "disabled"
  | "draft"
  | "errors"
  | "evaluation"
  | "inputId"
  | "labels"
  | "locale"
  | "onAnswer"
> & { step: FormStep }) {
  return (
    <div className="grid gap-6">
      {step.questions.map((question) => (
        <FormQuestionField
          disabled={disabled}
          error={errors[question.columnId]}
          inputId={inputId(question)}
          key={question.id}
          labels={labels}
          locale={locale}
          onChange={(value) => onAnswer(question.columnId, value)}
          question={{
            ...question,
            required: evaluation.required.has(question.id),
          }}
          value={draft[question.columnId]}
        />
      ))}
    </div>
  );
}

/** One question (or section) at a time, with progress, Back, Next and Skip. */
export function FormSteps(props: FormStepsProps) {
  const {
    alert,
    className,
    disabled,
    draft,
    errors,
    evaluation,
    extraFields,
    formRef,
    header,
    label,
    onErrors,
    onStepChange,
    onSubmit,
    settings,
    submitText,
    values,
  } = props;
  const steps = formSteps(settings, evaluation);
  const ids = [
    ...steps.map((item) => item.id),
    ...(settings.review ? [REVIEW_STEP] : []),
  ];
  const active =
    props.step && ids.includes(props.step) ? props.step : (ids[0] ?? "");
  const index = ids.indexOf(active);
  const current = steps.find((item) => item.id === active);
  const moved = useRef(false);

  // After moving, focus the first invalid (or first) control of the new step.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the active step changes.
  useEffect(() => {
    if (!moved.current) {
      return;
    }
    moved.current = false;
    const item = formRef.current?.querySelector<HTMLElement>(
      '[data-slot="questionnaire-item"]:not([hidden])'
    );
    const invalid = item?.querySelector<HTMLElement>(
      '[aria-invalid="true"][data-form-focus], [data-invalid] [data-form-focus]'
    );
    (invalid ?? item?.querySelector<HTMLElement>("[data-form-focus]"))?.focus();
  }, [active, formRef]);

  // A failed submission jumps to the first step with an error.
  useEffect(() => {
    const columns = Object.keys(errors);
    const failed = columns.length ? stepOf(steps, columns[0] ?? "") : undefined;
    if (
      failed &&
      !current?.questions.some((question) => errors[question.columnId])
    ) {
      moved.current = true;
      onStepChange(failed.id);
    }
  }, [errors, steps, current, onStepChange]);

  const go = (next: string | undefined) => {
    if (next) {
      moved.current = true;
      onStepChange(next);
    }
  };

  const stepErrors = (item: FormStep) =>
    Object.fromEntries(
      Object.entries(
        validateFormValues(item.questions, values, evaluation)
      ).map(([columnId, code]) => [columnId, label(code)])
    );

  const next = (event?: MouseEvent) => {
    event?.preventDefault();
    if (current) {
      const found = stepErrors(current);
      const others = Object.fromEntries(
        Object.entries(errors).filter(
          ([columnId]) =>
            !current.questions.some((question) => question.columnId === columnId)
        )
      );
      onErrors({ ...others, ...found });
      if (Object.keys(found).length) {
        // Stay on this step; focus its first invalid control.
        requestAnimationFrame(() => {
          formRef.current
            ?.querySelector<HTMLElement>(
              '[data-slot="questionnaire-item"]:not([hidden]) [aria-invalid="true"][data-form-focus]'
            )
            ?.focus();
        });
        return;
      }
    }
    if (index === ids.length - 1) {
      onSubmit();
      return;
    }
    go(ids[index + 1]);
  };

  const back = (event: MouseEvent) => {
    event.preventDefault();
    go(ids[index - 1]);
  };

  const skip = (event: MouseEvent) => {
    event.preventDefault();
    for (const question of current?.questions ?? []) {
      props.onAnswer(question.columnId, emptyAnswer(question));
    }
    if (index === ids.length - 1) {
      onSubmit();
      return;
    }
    go(ids[index + 1]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (advancesOnEnter(event)) {
      event.preventDefault();
      next();
    }
  };

  return (
    <Questionnaire
      aria-busy={disabled}
      className={className}
      data-form-layout="steps"
      data-yayaw-form="open"
      item={active}
      onItemChange={go}
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      ref={formRef}
    >
      {header}
      <div className="grid gap-2">
        <QuestionnaireProgress
          aria-label={label("stepProgress", {
            current: index + 1,
            total: ids.length,
          })}
          aria-valuetext={label("stepProgress", {
            current: index + 1,
            total: ids.length,
          })}
          data-form-progress
        >
          {label("stepProgress", { current: index + 1, total: ids.length })}
        </QuestionnaireProgress>
        <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${((index + 1) / Math.max(ids.length, 1)) * 100}%` }}
          />
        </div>
      </div>
      {alert}
      {steps.map((item) => (
        <QuestionnaireItem
          aria-label={
            item.section ? undefined : item.questions[0]?.label
          }
          data-form-step={item.id}
          invalid={item.questions.some((question) => errors[question.columnId])}
          key={item.id}
          name={item.id}
          required={!formStepOptional(item, evaluation)}
        >
          {item.section ? (
            <>
              <QuestionnaireTitle>
                {item.section.title ?? label("untitledSection")}
              </QuestionnaireTitle>
              {item.section.description ? (
                <QuestionnaireDescription className="-mt-3 whitespace-pre-line">
                  {item.section.description}
                </QuestionnaireDescription>
              ) : null}
            </>
          ) : null}
          <StepFields {...props} step={item} />
        </QuestionnaireItem>
      ))}
      {settings.review ? (
        <ReviewStep
          draft={draft}
          evaluation={evaluation}
          label={label}
          locale={props.locale}
          onChange={go}
          steps={steps}
        />
      ) : null}
      {index === ids.length - 1 ? extraFields : null}
      <QuestionnaireActions className="border-t pt-5">
        <QuestionnairePrevious disabled={disabled} onClick={back}>
          {label("back")}
        </QuestionnairePrevious>
        <QuestionnaireSkip disabled={disabled} onClick={skip}>
          {label("skip")}
        </QuestionnaireSkip>
        <QuestionnaireNext disabled={disabled} onClick={next}>
          {label("next")}
        </QuestionnaireNext>
        <QuestionnaireSubmit
          disabled={disabled}
          onClick={(event) => next(event)}
          type="button"
        >
          {submitText}
        </QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  );
}
