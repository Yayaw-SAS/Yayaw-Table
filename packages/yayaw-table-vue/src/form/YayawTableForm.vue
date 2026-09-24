<script setup lang="ts">
/**
 * Standalone form that creates a record from table columns. It needs no table
 * state, URL state or provider, so it can be mounted on a public route.
 * Spam protection and hidden context stay with the host: render them in the
 * `extra-fields` slot and pass `context`, which `onSubmit` receives unchanged.
 * Rules (`form.rules`) show, hide and require questions as people answer;
 * `form.layout: "steps"` asks one question (or section) at a time.
 */
import { CircleCheck, Lock } from "lucide-vue-next";
import { computed, nextTick, ref, useId, useSlots } from "vue";
import Empty from "../components/empty/Empty.vue";
import EmptyContent from "../components/empty/EmptyContent.vue";
import EmptyDescription from "../components/empty/EmptyDescription.vue";
import EmptyHeader from "../components/empty/EmptyHeader.vue";
import EmptyMedia from "../components/empty/EmptyMedia.vue";
import EmptyTitle from "../components/empty/EmptyTitle.vue";
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
  formItemId,
  formLabel,
  formPageContext,
  formSubmission,
  formSubmitMeta,
  formTranslateFrom,
  initialFormDraft,
  type ResolvedFormQuestion,
  readFormProgress,
  resolveFormSettings,
  validateFormConsents,
  validateFormValues,
  writeFormProgress,
} from "../form-view";
import FormConsent from "./FormConsent.vue";
import FormQuestion from "./FormQuestion.vue";
import FormSteps from "./FormSteps.vue";

const props = withDefaults(
  defineProps<{
    /** Table columns; only the asked ones are needed (see `publicFormSnapshot`). */
    columns: readonly FormColumn[];
    /** Form settings, e.g. `formSettingsFromView(view)` or `snapshot.form`. */
    form?: FormViewSettings;
    /**
     * Create the record. Resolve `{ ok: true }`, or `{ errors, message }`
     * (errors by column id, or consent id). A public form sends
     * `meta.consents`, `meta.fields` and `meta.locale` to its server with the
     * values, for `acceptPublicFormResponse`.
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
     * its language, the form's default language, then the first available)
     * and built-in labels are English, or French for `fr*` locales.
     */
    locale?: string;
    /** Host data passed to `onSubmit` unchanged (campaign, referrer, …). */
    context?: Record<string, unknown>;
    /** Show the closed message instead of the questions. */
    closed?: boolean;
    /** Controlled answers (raw, by column id), e.g. to resume a saved draft (`v-model:value`). */
    value?: FormDraft;
    /** Controlled current step of the steps layout (`v-model:step`). */
    step?: string;
    /** Keep answers and the current step in the browser's storage under this key until sent. */
    draftStorageKey?: string;
  }>(),
  { locale: "en" }
);
const emit = defineEmits<{
  "update:value": [draft: FormDraft];
  "update:step": [step: string];
}>();
defineSlots<{
  /** Host fields rendered before the submit button (honeypot, captcha). */
  "extra-fields"?: () => unknown;
}>();
const slots = useSlots();

const id = `yayaw-form-${useId()}`;
const override = computed(
  () => props.translate ?? formTranslateFrom(props.translations)
);
const label = (
  key: FormLabelKey,
  params?: Record<string, number | string>
): string => formLabel(key, props.locale, override.value, params);
// Built-in consent statements follow the host's label overrides too.
const settings = computed(() =>
  resolveFormSettings(
    props.columns,
    undefined,
    props.form,
    props.locale,
    override.value
  )
);
const questions = computed(() => settings.value.questions);

// Answers and step: controlled, stored under a key, or local.
const saved = props.draftStorageKey
  ? readFormProgress(props.draftStorageKey)
  : undefined;
const localDraft = ref<FormDraft>({
  ...initialFormDraft(questions.value, settings.value.consents),
  ...saved?.draft,
});
const localStep = ref<string | undefined>(saved?.step);
const draft = computed(() => props.value ?? localDraft.value);
const step = computed(() => props.step ?? localStep.value);
const store = (): void => {
  if (props.draftStorageKey) {
    writeFormProgress(props.draftStorageKey, {
      draft: draft.value,
      step: step.value,
    });
  }
};
const setDraft = (next: FormDraft): void => {
  localDraft.value = next;
  emit("update:value", next);
  if (props.draftStorageKey) {
    writeFormProgress(props.draftStorageKey, { draft: next, step: step.value });
  }
};
const setStep = (next: string): void => {
  localStep.value = next;
  emit("update:step", next);
  store();
};

const values = computed(() => formDraftValues(questions.value, draft.value));
const evaluation = computed(() => evaluateFormView(settings.value, values.value));
const errors = ref<Record<string, string>>({});
const message = ref<string>();
const status = ref<"idle" | "submitting" | "success">("idle");
const formElement = ref<HTMLFormElement>();
const stepsElement = ref<{ form: HTMLFormElement | undefined }>();
const root = (): HTMLFormElement | undefined =>
  formElement.value ?? stepsElement.value?.form;
const inputId = (item: { id: string }): string => `${id}-${item.id}`;
/** The control a question or consent focuses (the first choice of a multi-select). */
const itemControl = (item: { kind: "consent" | "question"; id: string }) =>
  root()?.querySelector<HTMLElement>(
    `[data-form-${item.kind}="${CSS.escape(item.id)}"] [data-form-focus]`
  );
const questionLabels = computed(() => ({
  choose: label("choose"),
  clearDate: label("clearDate"),
  newTab: label("newTab"),
  pickDate: label("pickDate"),
}));
/** A question as the rules make it: required by a `require` rule too. */
const ruled = (question: ResolvedFormQuestion): ResolvedFormQuestion => ({
  ...question,
  required: evaluation.value.required.has(question.id),
});
const visible = (itemId: string): boolean => !evaluation.value.hidden.has(itemId);
const steps = computed(
  () => settings.value.layout === "steps" && questions.value.length > 0
);
const submitText = computed(() =>
  status.value === "submitting"
    ? label("submitting")
    : (settings.value.submitLabel ?? label("submit"))
);

/** An answer, by column id, or a consent, by its id. */
const setAnswer = (key: string, value: FormDraft[string]): void =>
  setDraft({ ...draft.value, [key]: value });

const collectErrors = async (
  current: Record<string, unknown>
): Promise<Record<string, string>> => {
  const builtIn = Object.fromEntries(
    Object.entries({
      ...validateFormValues(questions.value, current, evaluation.value),
      ...validateFormConsents(settings.value.consents, draft.value),
    }).map(([key, code]) => [key, label(code)])
  );
  if (Object.keys(builtIn).length || !props.validate) return builtIn;
  return (await props.validate(current)) ?? {};
};

/** Show the errors, then move focus to the first invalid question. */
const fail = async (next: Record<string, string>, text?: string) => {
  errors.value = next;
  message.value = text;
  status.value = "idle";
  await nextTick();
  if (steps.value) return;
  const first = formFirstError(settings.value.items, next);
  const target = first
    ? itemControl(first)
    : root()?.querySelector<HTMLElement>("[data-form-message]");
  target?.focus();
};

const submit = async (): Promise<void> => {
  if (status.value === "submitting") return;
  status.value = "submitting";
  const current = values.value;
  const found = await collectErrors(current);
  if (Object.keys(found).length) {
    await fail(found, label("errorSummary", { count: Object.keys(found).length }));
    return;
  }
  try {
    // Hidden fields read the page as it is when the response is sent.
    const fields = collectFormHiddenFields(
      settings.value.hiddenFields,
      formPageContext(settings.value.locale ?? props.locale)
    );
    const record = formSubmission(settings.value, current, fields);
    const meta = formSubmitMeta(settings.value, fields, props.locale, props.context);
    const result = await props.onSubmit(record, meta);
    if (result.ok) {
      errors.value = {};
      message.value = undefined;
      status.value = "success";
      if (props.draftStorageKey) {
        writeFormProgress(props.draftStorageKey, undefined);
      }
      props.onSuccess?.({
        values: record,
        redirectUrl: settings.value.redirectUrl,
        metadata: meta.metadata,
      });
      return;
    }
    await fail(result.errors ?? {}, result.message ?? label("submitError"));
  } catch {
    await fail({}, label("submitError"));
  }
};

const restart = async (): Promise<void> => {
  setDraft(initialFormDraft(questions.value, settings.value.consents));
  errors.value = {};
  message.value = undefined;
  status.value = "idle";
  await nextTick();
  const first = questions.value[0];
  if (first) itemControl({ kind: "question", id: first.id })?.focus();
};
</script>

<template>
  <section v-if="closed" class="yayaw-form-root" data-yayaw-form="closed">
    <header v-if="settings.title || settings.description" class="yayaw-form-intro">
      <h2 v-if="settings.title" class="yayaw-form-title">{{ settings.title }}</h2>
      <p v-if="settings.description" class="yayaw-form-description">{{ settings.description }}</p>
    </header>
    <Empty class="yayaw-form-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Lock aria-hidden="true" /></EmptyMedia>
        <output class="yayaw-form-state-text">
          <EmptyDescription>{{ settings.closedMessage ?? label("closed") }}</EmptyDescription>
        </output>
      </EmptyHeader>
    </Empty>
  </section>
  <section v-else-if="status === 'success'" class="yayaw-form-root" data-yayaw-form="success">
    <header v-if="settings.title || settings.description" class="yayaw-form-intro">
      <h2 v-if="settings.title" class="yayaw-form-title">{{ settings.title }}</h2>
      <p v-if="settings.description" class="yayaw-form-description">{{ settings.description }}</p>
    </header>
    <Empty class="yayaw-form-state">
      <EmptyHeader>
        <EmptyMedia variant="icon"><CircleCheck aria-hidden="true" /></EmptyMedia>
        <output class="yayaw-form-state-text">
          <EmptyTitle>{{ label("successTitle") }}</EmptyTitle>
          <EmptyDescription>{{ settings.successMessage ?? label("success") }}</EmptyDescription>
        </output>
      </EmptyHeader>
      <EmptyContent v-if="settings.allowAnotherResponse">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="restart">
          {{ label("another") }}
        </button>
      </EmptyContent>
    </Empty>
  </section>
  <FormSteps
    v-else-if="steps"
    ref="stepsElement"
    :settings="settings"
    :evaluation="evaluation"
    :draft="draft"
    :values="values"
    :errors="errors"
    :step="step"
    :disabled="status === 'submitting'"
    :locale="locale"
    :label="label"
    :labels="questionLabels"
    :message="message"
    :submit-text="submitText"
    :input-id="inputId"
    @answer="setAnswer"
    @errors="errors = $event"
    @step="setStep"
    @submit="submit"
  >
    <template v-if="slots['extra-fields']" #extra-fields>
      <slot name="extra-fields" />
    </template>
  </FormSteps>
  <form
    v-else
    ref="formElement"
    class="yayaw-form-root"
    data-yayaw-form="open"
    data-form-layout="page"
    novalidate
    :aria-busy="status === 'submitting'"
    @submit.prevent="submit"
  >
    <header v-if="settings.title || settings.description" class="yayaw-form-intro">
      <h2 v-if="settings.title" class="yayaw-form-title">{{ settings.title }}</h2>
      <p v-if="settings.description" class="yayaw-form-description">{{ settings.description }}</p>
    </header>
    <p v-if="message" class="yayaw-form-message" data-form-message role="alert" tabindex="-1">
      {{ message }}
    </p>
    <p v-if="questions.length === 0" class="yayaw-form-help">{{ label("noQuestions") }}</p>
    <div class="yayaw-form-questions">
      <template
        v-for="item in settings.items"
        :key="`${item.kind}-${formItemId(item)}`"
      >
        <template v-if="item.kind === 'section'">
          <div
            v-if="visible(item.section.id) && (item.section.title || item.section.description)"
            class="yayaw-form-section-break"
            data-form-section
          >
            <h3 v-if="item.section.title" class="yayaw-form-section-title">{{ item.section.title }}</h3>
            <p v-if="item.section.description" class="yayaw-form-description">{{ item.section.description }}</p>
          </div>
          <hr v-else-if="visible(item.section.id)" class="yayaw-form-section-rule" data-form-section />
        </template>
        <FormConsent
          v-else-if="item.kind === 'consent'"
          :consent="item.consent"
          :input-id="inputId(item.consent)"
          :value="draft[item.consent.id]"
          :error="errors[item.consent.id]"
          :disabled="status === 'submitting'"
          :new-tab-label="questionLabels.newTab"
          @change="setAnswer(item.consent.id, $event)"
        />
        <FormQuestion
          v-else-if="visible(item.question.id)"
          :question="ruled(item.question)"
          :input-id="inputId(item.question)"
          :value="draft[item.question.columnId]"
          :error="errors[item.question.columnId]"
          :disabled="status === 'submitting'"
          :locale="locale"
          :labels="questionLabels"
          @change="setAnswer(item.question.columnId, $event)"
        />
      </template>
    </div>
    <slot name="extra-fields" />
    <div class="yayaw-form-submit-bar">
      <button
        type="submit"
        class="yayaw-button yayaw-form-action"
        :disabled="status === 'submitting' || questions.length === 0"
      >
        {{ submitText }}
      </button>
    </div>
  </form>
</template>
