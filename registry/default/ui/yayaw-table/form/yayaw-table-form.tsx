"use client";

import { CircleCheck, Lock } from "lucide-react";
/**
 * Standalone form that creates a record from table columns. It needs no
 * table state, URL state or provider, so it can be mounted on a public route:
 *
 * ```tsx
 * <YayawTableForm
 *   columns={snapshot.columns}
 *   form={snapshot.form}
 *   onSubmit={async (values) => (await post(values)).ok ? { ok: true } : { errors }}
 * />
 * ```
 *
 * Spam protection and hidden context stay with the host: render them through
 * `extraFields` and pass `context`, which `onSubmit` receives unchanged.
 * Rules (`form.rules`) show, hide and require questions as people answer;
 * `form.layout: "steps"` asks one question (or section) at a time.
 */
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { FormEvaluation } from "../utils/form-conditions";
import {
  collectFormHiddenFields,
  evaluateFormView,
  type FormColumn,
  type FormDraft,
  type FormLabelKey,
  type FormResponseMetadata,
  type FormSubmitMeta,
  type FormSubmitResult,
  type FormTranslate,
  type FormViewSettings,
  formDraftValues,
  formFirstError,
  formLabel,
  formPageContext,
  formSubmission,
  formSubmitMeta,
  formTranslateFrom,
  initialFormDraft,
  type ResolvedFormItem,
  type ResolvedFormQuestion,
  type ResolvedFormSettings,
  readFormProgress,
  resolveFormSettings,
  validateFormConsents,
  validateFormValues,
  writeFormProgress,
} from "../utils/form-view";
import {
  FormConsentField,
  FormQuestionField,
  type FormQuestionLabels,
} from "./form-question";
import { FormSteps } from "./form-steps";

export interface YayawTableFormProps {
  /** Table columns; only the asked ones are needed (see `publicFormSnapshot`). */
  columns: readonly FormColumn[];
  /** Form settings, e.g. `formSettingsFromView(view)` or `snapshot.form`. */
  form?: FormViewSettings;
  /**
   * Create the record. Resolve `{ ok: true }`, or `{ errors, message }`
   * (errors by column id, or consent id). A public form sends `meta.consents`,
   * `meta.fields` and `meta.locale` to its server with the values, for
   * `acceptPublicFormResponse`.
   */
  onSubmit: (
    values: Record<string, unknown>,
    meta: FormSubmitMeta
  ) => FormSubmitResult | Promise<FormSubmitResult>;
  /** Extra checks after the built-in ones, e.g. on the host's server; return errors by column id. */
  validate?: (
    values: Record<string, unknown>
  ) =>
    | Record<string, string>
    | undefined
    | Promise<Record<string, string> | undefined>;
  /** Called after a success with the settings' redirect URL; the host decides whether to follow it. */
  onSuccess?: (info: {
    values: Record<string, unknown>;
    redirectUrl?: string;
    metadata?: FormResponseMetadata;
  }) => void;
  /** Label overrides, as `{ submit }` or `{ "form.submit" }`. */
  translations?: Record<string, string | undefined>;
  /** Label overrides as a function; wins over `translations`. */
  translate?: FormTranslate;
  /**
   * The reader's language: the form's texts are shown in it (exact locale,
   * its language, the form's default language, then the first available) and
   * built-in labels are English, or French for `fr*` locales.
   */
  locale?: string;
  /** Host data passed to `onSubmit` unchanged (campaign, referrer, …). */
  context?: Record<string, unknown>;
  /** Host fields rendered before the submit button (honeypot, captcha). */
  extraFields?: ReactNode;
  /** Show the closed message instead of the questions. */
  closed?: boolean;
  className?: string;
  /** Controlled answers (raw, by column id), e.g. to resume a saved draft. */
  value?: FormDraft;
  onValueChange?: (draft: FormDraft) => void;
  /** Controlled current step of the steps layout (a question or section id, or `"review"`). */
  step?: string;
  onStepChange?: (step: string) => void;
  /** Keep answers and the current step in the browser's storage under this key until sent. */
  draftStorageKey?: string;
}

type Status = "idle" | "submitting" | "success";

const errorMessages = (
  codes: Record<string, FormLabelKey>,
  label: (key: FormLabelKey) => string
) =>
  Object.fromEntries(
    Object.entries(codes).map(([columnId, code]) => [columnId, label(code)])
  );

/** The control a question or consent focuses (the first choice of a multi-select). */
const itemControl = (
  form: HTMLElement | null,
  item: { kind: "consent" | "question"; id: string }
) =>
  form?.querySelector<HTMLElement>(
    `[data-form-${item.kind}="${CSS.escape(item.id)}"] [data-form-focus]`
  );

function useFormLabels(
  locale: string,
  translate: FormTranslate | undefined,
  translations: Record<string, string | undefined> | undefined
) {
  const override = useMemo(
    () => translate ?? formTranslateFrom(translations),
    [translate, translations]
  );
  return useCallback(
    (key: FormLabelKey, params?: Record<string, number | string>) =>
      formLabel(key, locale, override, params),
    [locale, override]
  );
}

/** Answers (consents included) and step: controlled, stored under a key, or local. */
function useFormProgress(
  settings: Pick<ResolvedFormSettings, "consents" | "questions">,
  props: Pick<
    YayawTableFormProps,
    "draftStorageKey" | "onStepChange" | "onValueChange" | "step" | "value"
  >
) {
  const { draftStorageKey, onStepChange, onValueChange } = props;
  const [saved] = useState(() =>
    draftStorageKey ? readFormProgress(draftStorageKey) : undefined
  );
  const [localDraft, setLocalDraft] = useState<FormDraft>(() => ({
    ...initialFormDraft(settings.questions, settings.consents),
    ...saved?.draft,
  }));
  const [localStep, setLocalStep] = useState<string | undefined>(saved?.step);
  const draft = props.value ?? localDraft;
  const step = props.step ?? localStep;
  const latest = useRef({ draft, step });
  latest.current = { draft, step };
  const setDraft = useCallback(
    (next: FormDraft) => {
      setLocalDraft(next);
      onValueChange?.(next);
      if (draftStorageKey) {
        writeFormProgress(draftStorageKey, {
          draft: next,
          step: latest.current.step,
        });
      }
    },
    [draftStorageKey, onValueChange]
  );
  const setStep = useCallback(
    (next: string) => {
      setLocalStep(next);
      onStepChange?.(next);
      if (draftStorageKey) {
        writeFormProgress(draftStorageKey, {
          draft: latest.current.draft,
          step: next,
        });
      }
    },
    [draftStorageKey, onStepChange]
  );
  return { draft, setDraft, step, setStep };
}

async function collectErrors(
  settings: Pick<ResolvedFormSettings, "consents" | "questions">,
  draft: FormDraft,
  values: Record<string, unknown>,
  evaluation: FormEvaluation,
  label: (key: FormLabelKey) => string,
  validate: YayawTableFormProps["validate"]
): Promise<Record<string, string>> {
  const builtIn = errorMessages(
    {
      ...validateFormValues(settings.questions, values, evaluation),
      ...validateFormConsents(settings.consents, draft),
    },
    label
  );
  if (Object.keys(builtIn).length || !validate) {
    return builtIn;
  }
  return (await validate(values)) ?? {};
}

function FormHeader({
  description,
  title,
}: {
  description?: string;
  title?: string;
}) {
  if (!(title || description)) {
    return null;
  }
  return (
    <header className="grid gap-1.5 border-b pb-5">
      {title ? (
        <h2 className="font-semibold text-lg leading-tight tracking-tight">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="whitespace-pre-line text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}
    </header>
  );
}

/** The end states (sent, closed), styled like the table's empty states. */
function FormState({
  action,
  icon,
  message,
  title,
}: {
  action?: ReactNode;
  icon: ReactNode;
  message: string;
  title?: string;
}) {
  return (
    <Empty className="gap-5 p-0 py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <output className="grid gap-2">
          {title ? <EmptyTitle>{title}</EmptyTitle> : null}
          <EmptyDescription>{message}</EmptyDescription>
        </output>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/** A section break of the page layout: a titled group of the next questions. */
export function FormSectionHeading({
  description,
  title,
}: {
  description?: string;
  title?: string;
}) {
  if (!(title || description)) {
    return <hr className="border-border" data-form-section />;
  }
  return (
    <div
      className="grid gap-1 border-t pt-5 first:border-t-0 first:pt-0"
      data-form-section
    >
      {title ? <h3 className="font-medium text-base">{title}</h3> : null}
      {description ? (
        <p className="whitespace-pre-line text-muted-foreground text-sm">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** A question as the rules make it: required by a `require` rule too. */
export const ruledQuestion = (
  question: ResolvedFormQuestion,
  evaluation: FormEvaluation
): ResolvedFormQuestion => ({
  ...question,
  required: evaluation.required.has(question.id),
});

interface PageBodyProps {
  settings: ResolvedFormSettings;
  evaluation: FormEvaluation;
  draft: FormDraft;
  errors: Record<string, string>;
  disabled: boolean;
  locale: string;
  labels: FormQuestionLabels;
  inputId: (item: { id: string }) => string;
  onAnswer: (key: string, value: FormDraft[string]) => void;
}

/** A section heading, or nothing while the rules hide it. */
function PageSection({
  evaluation,
  item,
}: {
  evaluation: FormEvaluation;
  item: Extract<ResolvedFormItem, { kind: "section" }>;
}) {
  return evaluation.hidden.has(item.section.id) ? null : (
    <FormSectionHeading
      description={item.section.description}
      title={item.section.title}
    />
  );
}

/** Every visible question at once, with section headings and consents. */
function FormPageBody({
  disabled,
  draft,
  errors,
  evaluation,
  inputId,
  labels,
  locale,
  onAnswer,
  settings,
}: PageBodyProps) {
  return (
    <div className="grid gap-6">
      {settings.items.map((item) => {
        if (item.kind === "section") {
          return (
            <PageSection
              evaluation={evaluation}
              item={item}
              key={item.section.id}
            />
          );
        }
        if (item.kind === "consent") {
          const { consent } = item;
          return (
            <FormConsentField
              consent={consent}
              disabled={disabled}
              error={errors[consent.id]}
              inputId={inputId(consent)}
              key={consent.id}
              newTabLabel={labels.newTab ?? ""}
              onChange={(checked) => onAnswer(consent.id, checked)}
              value={draft[consent.id]}
            />
          );
        }
        const { question } = item;
        if (evaluation.hidden.has(question.id)) {
          return null;
        }
        return (
          <FormQuestionField
            disabled={disabled}
            error={errors[question.columnId]}
            inputId={inputId(question)}
            key={question.id}
            labels={labels}
            locale={locale}
            onChange={(value) => onAnswer(question.columnId, value)}
            question={ruledQuestion(question, evaluation)}
            value={draft[question.columnId]}
          />
        );
      })}
    </div>
  );
}

/** A form that creates one record per response, from table columns. */
export function YayawTableForm(props: YayawTableFormProps) {
  const {
    className,
    closed,
    columns,
    context,
    extraFields,
    form,
    locale = "en",
    onSubmit,
    onSuccess,
    translate,
    translations,
    validate,
  } = props;
  const id = useId();
  const label = useFormLabels(locale, translate, translations);
  const settings = useMemo(
    () => resolveFormSettings(columns, undefined, form, locale),
    [columns, form, locale]
  );
  const { questions } = settings;
  const { draft, setDraft, step, setStep } = useFormProgress(settings, props);
  const values = useMemo(
    () => formDraftValues(questions, draft),
    [questions, draft]
  );
  const evaluation = useMemo(
    () => evaluateFormView(settings, values),
    [settings, values]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [status, setStatus] = useState<Status>("idle");
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = (item: { id: string }) => `${id}-${item.id}`;
  const steps = settings.layout === "steps";

  // Move focus after the errors render, so the invalid field is announced.
  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const first = formFirstError(settings.items, errors);
    const target = first
      ? itemControl(formRef.current, first)
      : formRef.current?.querySelector<HTMLElement>("[data-form-message]");
    target?.focus();
  }, [focusRequest, errors, settings.items]);

  const fail = (next: Record<string, string>, text?: string) => {
    setErrors(next);
    setMessage(text);
    setStatus("idle");
    setFocusRequest((value) => value + 1);
  };

  const answer = (key: string, value: FormDraft[string]) =>
    setDraft({ ...draft, [key]: value });

  const send = async () => {
    if (status === "submitting") {
      return;
    }
    setStatus("submitting");
    const found = await collectErrors(
      settings,
      draft,
      values,
      evaluation,
      label,
      validate
    );
    if (Object.keys(found).length) {
      fail(found, label("errorSummary", { count: Object.keys(found).length }));
      return;
    }
    try {
      // Hidden fields read the page as it is when the response is sent.
      const fields = collectFormHiddenFields(
        settings.hiddenFields,
        formPageContext(settings.locale ?? locale)
      );
      const record = formSubmission(settings, values, fields);
      const meta = formSubmitMeta(settings, fields, locale, context);
      const result = await onSubmit(record, meta);
      if (result.ok) {
        setErrors({});
        setMessage(undefined);
        setStatus("success");
        if (props.draftStorageKey) {
          writeFormProgress(props.draftStorageKey, undefined);
        }
        onSuccess?.({
          values: record,
          redirectUrl: settings.redirectUrl,
          metadata: meta.metadata,
        });
        return;
      }
      fail(result.errors ?? {}, result.message ?? label("submitError"));
    } catch {
      fail({}, label("submitError"));
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await send();
  };

  const restart = () => {
    setDraft(initialFormDraft(questions, settings.consents));
    setErrors({});
    setMessage(undefined);
    setStatus("idle");
    requestAnimationFrame(() => {
      const first = questions[0];
      if (first) {
        itemControl(formRef.current, {
          kind: "question",
          id: first.id,
        })?.focus();
      }
    });
  };

  const header = (
    <FormHeader description={settings.description} title={settings.title} />
  );
  const shell = cn(
    "mx-auto grid w-full min-w-0 max-w-[640px] gap-6 rounded-xl border bg-card px-5 py-6 text-card-foreground shadow-xs sm:px-8 sm:py-8",
    className
  );

  if (closed) {
    return (
      <section className={shell} data-yayaw-form="closed">
        {header}
        <FormState
          icon={<Lock aria-hidden="true" />}
          message={settings.closedMessage ?? label("closed")}
        />
      </section>
    );
  }
  if (status === "success") {
    return (
      <section className={shell} data-yayaw-form="success">
        {header}
        <FormState
          action={
            settings.allowAnotherResponse ? (
              <Button onClick={restart} type="button" variant="outline">
                {label("another")}
              </Button>
            ) : undefined
          }
          icon={<CircleCheck aria-hidden="true" />}
          message={settings.successMessage ?? label("success")}
          title={label("successTitle")}
        />
      </section>
    );
  }
  const submitting = status === "submitting";
  const questionLabels = {
    choose: label("choose"),
    clearDate: label("clearDate"),
    newTab: label("newTab"),
    pickDate: label("pickDate"),
  };
  const alert = message ? (
    <p
      className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm dark:bg-destructive/10"
      data-form-message
      role="alert"
      tabIndex={-1}
    >
      {message}
    </p>
  ) : null;
  const submitText = submitting
    ? label("submitting")
    : (settings.submitLabel ?? label("submit"));

  if (steps && questions.length) {
    return (
      <FormSteps
        alert={alert}
        className={shell}
        disabled={submitting}
        draft={draft}
        errors={errors}
        evaluation={evaluation}
        extraFields={extraFields}
        formRef={formRef}
        header={header}
        inputId={inputId}
        label={label}
        labels={questionLabels}
        locale={locale}
        onAnswer={answer}
        onErrors={setErrors}
        onStepChange={setStep}
        onSubmit={send}
        settings={settings}
        step={step}
        submitText={submitText}
        values={values}
      />
    );
  }
  return (
    <form
      aria-busy={submitting}
      className={shell}
      data-form-layout="page"
      data-yayaw-form="open"
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      {header}
      {alert}
      {questions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{label("noQuestions")}</p>
      ) : null}
      <FormPageBody
        disabled={submitting}
        draft={draft}
        errors={errors}
        evaluation={evaluation}
        inputId={inputId}
        labels={questionLabels}
        locale={locale}
        onAnswer={answer}
        settings={settings}
      />
      {extraFields}
      <div className="flex justify-end border-t pt-5">
        <Button
          className="w-full sm:w-fit"
          disabled={submitting || questions.length === 0}
          type="submit"
        >
          {submitText}
        </Button>
      </div>
    </form>
  );
}
