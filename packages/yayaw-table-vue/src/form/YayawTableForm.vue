<script setup lang="ts">
/**
 * Standalone form that creates a record from table columns. It needs no table
 * state, URL state or provider, so it can be mounted on a public route.
 * Spam protection and hidden context stay with the host: render them in the
 * `extra-fields` slot and pass `context`, which `onSubmit` receives unchanged.
 */
import { computed, nextTick, ref, useId } from "vue";
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
} from "../form-view";
import FormQuestion from "./FormQuestion.vue";

const props = withDefaults(
  defineProps<{
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
    /** Show the closed message instead of the questions. */
    closed?: boolean;
  }>(),
  { locale: "en" }
);
defineSlots<{
  /** Host fields rendered before the submit button (honeypot, captcha). */
  "extra-fields"?: () => unknown;
}>();

const id = `yayaw-form-${useId()}`;
const override = computed(
  () => props.translate ?? formTranslateFrom(props.translations)
);
const label = (
  key: FormLabelKey,
  params?: Record<string, number | string>
): string => formLabel(key, props.locale, override.value, params);
const settings = computed(() =>
  resolveFormSettings(props.columns, undefined, props.form)
);
const questions = computed(() => settings.value.questions);
const draft = ref<FormDraft>(initialFormDraft(questions.value));
const errors = ref<Record<string, string>>({});
const message = ref<string>();
const status = ref<"idle" | "submitting" | "success">("idle");
const formElement = ref<HTMLFormElement>();
const inputId = (question: ResolvedFormQuestion): string =>
  `${id}-${question.id}`;

const setAnswer = (columnId: string, value: FormDraft[string]): void => {
  draft.value = { ...draft.value, [columnId]: value };
};

const collectErrors = async (
  values: Record<string, unknown>
): Promise<Record<string, string>> => {
  const builtIn = Object.fromEntries(
    Object.entries(validateFormValues(questions.value, values)).map(
      ([columnId, code]) => [columnId, label(code)]
    )
  );
  if (Object.keys(builtIn).length || !props.validate) return builtIn;
  return (await props.validate(values)) ?? {};
};

/** Show the errors, then move focus to the first invalid question. */
const fail = async (next: Record<string, string>, text?: string) => {
  errors.value = next;
  message.value = text;
  status.value = "idle";
  await nextTick();
  const question = questions.value.find((item) => next[item.columnId]);
  const target = question
    ? document.getElementById(inputId(question))
    : formElement.value?.querySelector<HTMLElement>("[data-form-message]");
  target?.focus();
};

const submit = async (): Promise<void> => {
  if (status.value === "submitting") return;
  status.value = "submitting";
  const values = formDraftValues(questions.value, draft.value);
  const found = await collectErrors(values);
  if (Object.keys(found).length) {
    await fail(found, label("errorSummary", { count: Object.keys(found).length }));
    return;
  }
  try {
    const record = formSubmission(settings.value, values);
    const result = await props.onSubmit(record, { context: props.context });
    if (result.ok) {
      errors.value = {};
      message.value = undefined;
      status.value = "success";
      props.onSuccess?.({ values: record, redirectUrl: settings.value.redirectUrl });
      return;
    }
    await fail(result.errors ?? {}, result.message ?? label("submitError"));
  } catch {
    await fail({}, label("submitError"));
  }
};

const restart = async (): Promise<void> => {
  draft.value = initialFormDraft(questions.value);
  errors.value = {};
  message.value = undefined;
  status.value = "idle";
  await nextTick();
  const first = questions.value[0];
  if (first) document.getElementById(inputId(first))?.focus();
};
</script>

<template>
  <section v-if="closed" class="yayaw-form-root" data-yayaw-form="closed">
    <header v-if="settings.title || settings.description" class="yayaw-form-intro">
      <h2 v-if="settings.title" class="yayaw-form-title">{{ settings.title }}</h2>
      <p v-if="settings.description" class="yayaw-form-description">{{ settings.description }}</p>
    </header>
    <p class="yayaw-form-panel" role="status">{{ label("closed") }}</p>
  </section>
  <section v-else-if="status === 'success'" class="yayaw-form-root" data-yayaw-form="success">
    <header v-if="settings.title || settings.description" class="yayaw-form-intro">
      <h2 v-if="settings.title" class="yayaw-form-title">{{ settings.title }}</h2>
      <p v-if="settings.description" class="yayaw-form-description">{{ settings.description }}</p>
    </header>
    <div class="yayaw-form-panel" data-form-success>
      <p role="status">{{ settings.successMessage ?? label("success") }}</p>
      <button
        v-if="settings.allowAnotherResponse"
        type="button"
        class="yayaw-button yayaw-button-outline yayaw-form-action"
        @click="restart"
      >
        {{ label("another") }}
      </button>
    </div>
  </section>
  <form
    v-else
    ref="formElement"
    class="yayaw-form-root"
    data-yayaw-form="open"
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
      <FormQuestion
        v-for="question in questions"
        :key="question.id"
        :question="question"
        :input-id="inputId(question)"
        :value="draft[question.columnId]"
        :error="errors[question.columnId]"
        :disabled="status === 'submitting'"
        :choose-label="label('choose')"
        @change="setAnswer(question.columnId, $event)"
      />
    </div>
    <slot name="extra-fields" />
    <div>
      <button
        type="submit"
        class="yayaw-button yayaw-form-action"
        :disabled="status === 'submitting' || questions.length === 0"
      >
        {{ status === "submitting" ? label("submitting") : (settings.submitLabel ?? label("submit")) }}
      </button>
    </div>
  </form>
</template>
