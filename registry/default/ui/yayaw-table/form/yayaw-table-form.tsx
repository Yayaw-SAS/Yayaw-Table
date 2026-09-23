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
import {
  type FormColumn,
  type FormDraft,
  type FormLabelKey,
  type FormSubmitResult,
  type FormTranslate,
  type FormViewSettings,
  formDraftValues,
  formLabel,
  formSubmission,
  formTranslateFrom,
  initialFormDraft,
  type ResolvedFormQuestion,
  resolveFormSettings,
  validateFormValues,
} from "../utils/form-view";
import { FormQuestionField } from "./form-question";

export interface YayawTableFormProps {
  /** Table columns; only the asked ones are needed (see `publicFormSnapshot`). */
  columns: readonly FormColumn[];
  /** Form settings, e.g. `formSettingsFromView(view)` or `snapshot.form`. */
  form?: FormViewSettings;
  /** Create the record. Resolve `{ ok: true }`, or `{ errors, message }`. */
  onSubmit: (
    values: Record<string, unknown>,
    meta: { context?: Record<string, unknown> }
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
  }) => void;
  /** Label overrides, as `{ submit }` or `{ "form.submit" }`. */
  translations?: Record<string, string | undefined>;
  /** Label overrides as a function; wins over `translations`. */
  translate?: FormTranslate;
  /** Built-in labels are English, or French for `fr*` locales. */
  locale?: string;
  /** Host data passed to `onSubmit` unchanged (campaign, referrer, …). */
  context?: Record<string, unknown>;
  /** Host fields rendered before the submit button (honeypot, captcha). */
  extraFields?: ReactNode;
  /** Show the closed message instead of the questions. */
  closed?: boolean;
  className?: string;
}

type Status = "idle" | "submitting" | "success";

const errorMessages = (
  codes: Record<string, FormLabelKey>,
  label: (key: FormLabelKey) => string
) =>
  Object.fromEntries(
    Object.entries(codes).map(([columnId, code]) => [columnId, label(code)])
  );

/** The control a question focuses (the first choice of a multi-select). */
const questionControl = (
  form: HTMLElement | null,
  question: ResolvedFormQuestion
) =>
  form?.querySelector<HTMLElement>(
    `[data-form-question="${CSS.escape(question.id)}"] [data-form-focus]`
  );

/** Question ids in order, for focusing the first invalid one. */
const firstInvalid = (
  questions: readonly ResolvedFormQuestion[],
  errors: Record<string, string>
) => questions.find((question) => errors[question.columnId]);

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

async function collectErrors(
  questions: readonly ResolvedFormQuestion[],
  values: Record<string, unknown>,
  label: (key: FormLabelKey) => string,
  validate: YayawTableFormProps["validate"]
): Promise<Record<string, string>> {
  const builtIn = errorMessages(validateFormValues(questions, values), label);
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

/** A form that creates one record per response, from table columns. */
export function YayawTableForm({
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
}: YayawTableFormProps) {
  const id = useId();
  const label = useFormLabels(locale, translate, translations);
  const settings = useMemo(
    () => resolveFormSettings(columns, undefined, form),
    [columns, form]
  );
  const { questions } = settings;
  const [draft, setDraft] = useState<FormDraft>(() =>
    initialFormDraft(questions)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [status, setStatus] = useState<Status>("idle");
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = (question: ResolvedFormQuestion) => `${id}-${question.id}`;

  // Move focus after the errors render, so the invalid field is announced.
  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const question = firstInvalid(questions, errors);
    const target = question
      ? questionControl(formRef.current, question)
      : formRef.current?.querySelector<HTMLElement>("[data-form-message]");
    target?.focus();
  }, [focusRequest, errors, questions]);

  const fail = (next: Record<string, string>, text?: string) => {
    setErrors(next);
    setMessage(text);
    setStatus("idle");
    setFocusRequest((value) => value + 1);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") {
      return;
    }
    setStatus("submitting");
    const values = formDraftValues(questions, draft);
    const found = await collectErrors(questions, values, label, validate);
    if (Object.keys(found).length) {
      fail(found, label("errorSummary", { count: Object.keys(found).length }));
      return;
    }
    try {
      const record = formSubmission(settings, values);
      const result = await onSubmit(record, { context });
      if (result.ok) {
        setErrors({});
        setMessage(undefined);
        setStatus("success");
        onSuccess?.({ values: record, redirectUrl: settings.redirectUrl });
        return;
      }
      fail(result.errors ?? {}, result.message ?? label("submitError"));
    } catch {
      fail({}, label("submitError"));
    }
  };

  const restart = () => {
    setDraft(initialFormDraft(questions));
    setErrors({});
    setMessage(undefined);
    setStatus("idle");
    requestAnimationFrame(() => {
      const first = questions[0];
      if (first) {
        questionControl(formRef.current, first)?.focus();
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
          message={label("closed")}
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
    pickDate: label("pickDate"),
  };
  return (
    <form
      aria-busy={submitting}
      className={shell}
      data-yayaw-form="open"
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      {header}
      {message ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm dark:bg-destructive/10"
          data-form-message
          role="alert"
          tabIndex={-1}
        >
          {message}
        </p>
      ) : null}
      {questions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{label("noQuestions")}</p>
      ) : null}
      <div className="grid gap-6">
        {questions.map((question) => (
          <FormQuestionField
            disabled={submitting}
            error={errors[question.columnId]}
            inputId={inputId(question)}
            key={question.id}
            labels={questionLabels}
            locale={locale}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                [question.columnId]: value,
              }))
            }
            question={question}
            value={draft[question.columnId]}
          />
        ))}
      </div>
      {extraFields}
      <div className="flex justify-end border-t pt-5">
        <Button
          className="w-full sm:w-fit"
          disabled={submitting || questions.length === 0}
          type="submit"
        >
          {submitting
            ? label("submitting")
            : (settings.submitLabel ?? label("submit"))}
        </Button>
      </div>
    </form>
  );
}
