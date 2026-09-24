<script setup lang="ts">
/**
 * The steps layout of a form, built on the shadcn-vue Questionnaire: one
 * question, or one section, per step; conditional steps are skipped by the
 * rules; Back, Next and Skip (optional steps); a progress text; an optional
 * review step. Questions keep the table's own controls, so navigation and
 * validation are ours: the Questionnaire only validates its native answers.
 * Consents show on the step they are placed in, or on the last step (the
 * review, when there is one).
 */
import { computed, nextTick, ref, watch } from "vue";
import Questionnaire from "../components/questionnaire/Questionnaire.vue";
import QuestionnaireActions from "../components/questionnaire/QuestionnaireActions.vue";
import QuestionnaireDescription from "../components/questionnaire/QuestionnaireDescription.vue";
import QuestionnaireItem from "../components/questionnaire/QuestionnaireItem.vue";
import QuestionnaireNext from "../components/questionnaire/QuestionnaireNext.vue";
import QuestionnairePrevious from "../components/questionnaire/QuestionnairePrevious.vue";
import QuestionnaireProgress from "../components/questionnaire/QuestionnaireProgress.vue";
import QuestionnaireSkip from "../components/questionnaire/QuestionnaireSkip.vue";
import QuestionnaireSubmit from "../components/questionnaire/QuestionnaireSubmit.vue";
import QuestionnaireTitle from "../components/questionnaire/QuestionnaireTitle.vue";
import type { FormEvaluation } from "../form-conditions";
import {
  type FormDraft,
  type FormLabelKey,
  type FormStep,
  formAnswerText,
  formStepOptional,
  formStepPlan,
  type ResolvedFormConsent,
  type ResolvedFormQuestion,
  type ResolvedFormSettings,
  validateFormConsents,
  validateFormValues,
} from "../form-view";
import FormConsent from "./FormConsent.vue";
import FormQuestion from "./FormQuestion.vue";

const REVIEW_STEP = "review";

const props = defineProps<{
  settings: ResolvedFormSettings;
  evaluation: FormEvaluation;
  draft: FormDraft;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  step?: string;
  disabled: boolean;
  locale: string;
  label: (key: FormLabelKey, params?: Record<string, number | string>) => string;
  labels: { choose: string; pickDate: string; clearDate: string; newTab?: string };
  message?: string;
  submitText: string;
  inputId: (item: { id: string }) => string;
}>();
const emit = defineEmits<{
  /** An answer, by column id, or a consent, by its id. */
  answer: [key: string, value: FormDraft[string]];
  errors: [errors: Record<string, string>];
  step: [step: string];
  submit: [];
}>();
defineSlots<{ "extra-fields"?: () => unknown }>();

const root = ref<{ $el: HTMLFormElement }>();
const form = computed(() => root.value?.$el);
defineExpose({ form });

const plan = computed(() => formStepPlan(props.settings, props.evaluation));
const steps = computed(() => plan.value.steps);
const reviewConsents = computed(() => plan.value.reviewConsents);
const ids = computed(() => [
  ...steps.value.map((item) => item.id),
  ...(props.settings.review ? [REVIEW_STEP] : []),
]);
const active = computed(() =>
  props.step && ids.value.includes(props.step) ? props.step : (ids.value[0] ?? "")
);
const index = computed(() => ids.value.indexOf(active.value));
/** The active step; the review is one too, for its consents. */
const current = computed<FormStep | undefined>(() =>
  active.value === REVIEW_STEP
    ? { id: REVIEW_STEP, questions: [], consents: reviewConsents.value }
    : steps.value.find((item) => item.id === active.value)
);
/** Error keys a step owns: its questions' columns and its consents. */
const stepKeys = (item: FormStep): string[] => [
  ...item.questions.map((question) => question.columnId),
  ...(item.consents ?? []).map((consent) => consent.id),
];
/** The step showing the error of `key`: its question's or consent's step, or the review. */
const failedStep = (key: string | undefined): string | undefined => {
  if (!key) return;
  const found = steps.value.find((item) => stepKeys(item).includes(key));
  if (found) return found.id;
  return reviewConsents.value.some((consent: ResolvedFormConsent) => consent.id === key)
    ? REVIEW_STEP
    : undefined;
};
const last = computed(() => index.value === ids.value.length - 1);
const progress = computed(() =>
  props.label("stepProgress", { current: index.value + 1, total: ids.value.length })
);
const words = computed(() => ({ yes: props.label("yes"), no: props.label("no") }));

/** Focus the first invalid (or first) control of the visible step. */
const focusStep = async (): Promise<void> => {
  await nextTick();
  requestAnimationFrame(() => {
    const item = form.value?.querySelector<HTMLElement>(
      '[data-slot="questionnaire-item"]:not([hidden])'
    );
    const invalid = item?.querySelector<HTMLElement>(
      '[aria-invalid="true"][data-form-focus], [data-invalid] [data-form-focus]'
    );
    (invalid ?? item?.querySelector<HTMLElement>("[data-form-focus]"))?.focus();
  });
};
const go = (next: string | undefined): void => {
  if (!next) return;
  emit("step", next);
  void focusStep();
};

// A failed submission jumps to the first step with an error.
watch(
  () => props.errors,
  (errors) => {
    const failed = failedStep(Object.keys(errors)[0]);
    const here = current.value
      ? stepKeys(current.value).some((key) => errors[key])
      : false;
    if (failed && !here) go(failed);
  }
);

const stepErrors = (item: FormStep): Record<string, string> =>
  Object.fromEntries(
    Object.entries({
      ...validateFormValues(item.questions, props.values, props.evaluation),
      ...validateFormConsents(item.consents ?? [], props.draft),
    }).map(([key, code]) => [key, props.label(code)])
  );

const next = (event?: Event): void => {
  event?.preventDefault();
  const item = current.value;
  if (item) {
    const found = stepErrors(item);
    const keys = stepKeys(item);
    const others = Object.fromEntries(
      Object.entries(props.errors).filter(([key]) => !keys.includes(key))
    );
    emit("errors", { ...others, ...found });
    if (Object.keys(found).length) {
      void focusStep();
      return;
    }
  }
  if (last.value) {
    emit("submit");
    return;
  }
  go(ids.value[index.value + 1]);
};
const back = (event: Event): void => {
  event.preventDefault();
  go(ids.value[index.value - 1]);
};
const skip = (event: Event): void => {
  event.preventDefault();
  for (const question of current.value?.questions ?? []) {
    let empty: FormDraft[string] = "";
    if (question.editor === "boolean") empty = false;
    else if (question.editor === "multiSelect") empty = [];
    emit("answer", question.columnId, empty);
  }
  if (last.value) {
    emit("submit");
    return;
  }
  go(ids.value[index.value + 1]);
};
/** Enter in a single-line input goes to the next step instead of submitting. */
const onKeydown = (event: KeyboardEvent): void => {
  const target = event.target;
  if (
    event.key === "Enter" &&
    !(event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) &&
    !event.isComposing &&
    target instanceof HTMLInputElement &&
    !["checkbox", "radio", "button", "submit"].includes(target.type)
  ) {
    event.preventDefault();
    next();
  }
};
const ruled = (question: ResolvedFormQuestion): ResolvedFormQuestion => ({
  ...question,
  required: props.evaluation.required.has(question.id),
});
const hasError = (item: FormStep): boolean =>
  stepKeys(item).some((key) => props.errors[key]);
</script>

<template>
  <Questionnaire
    ref="root"
    class="yayaw-form-root"
    data-yayaw-form="open"
    data-form-layout="steps"
    :item="active"
    :aria-busy="disabled"
    @update:item="go"
    @keydown="onKeydown"
    @submit.prevent="emit('submit')"
  >
    <header v-if="settings.title || settings.description" class="yayaw-form-intro">
      <h2 v-if="settings.title" class="yayaw-form-title">{{ settings.title }}</h2>
      <p v-if="settings.description" class="yayaw-form-description">{{ settings.description }}</p>
    </header>
    <div class="yayaw-form-progress">
      <QuestionnaireProgress data-form-progress :aria-label="progress" :aria-valuetext="progress">
        {{ progress }}
      </QuestionnaireProgress>
      <div class="yayaw-form-progress-track" aria-hidden="true">
        <div
          class="yayaw-form-progress-bar"
          :style="{ width: `${((index + 1) / Math.max(ids.length, 1)) * 100}%` }"
        />
      </div>
    </div>
    <p v-if="message" class="yayaw-form-message" data-form-message role="alert" tabindex="-1">
      {{ message }}
    </p>
    <QuestionnaireItem
      v-for="item in steps"
      :key="item.id"
      :name="item.id"
      :data-form-step="item.id"
      :aria-label="item.section ? undefined : item.questions[0]?.label"
      :invalid="hasError(item)"
      :required="!formStepOptional(item, evaluation)"
    >
      <template v-if="item.section">
        <QuestionnaireTitle>{{ item.section.title ?? label("untitledSection") }}</QuestionnaireTitle>
        <QuestionnaireDescription v-if="item.section.description" class="yayaw-form-step-description">
          {{ item.section.description }}
        </QuestionnaireDescription>
      </template>
      <div class="yayaw-form-questions">
        <FormQuestion
          v-for="question in item.questions"
          :key="question.id"
          :question="ruled(question)"
          :input-id="inputId(question)"
          :value="draft[question.columnId]"
          :error="errors[question.columnId]"
          :disabled="disabled"
          :locale="locale"
          :labels="labels"
          @change="emit('answer', question.columnId, $event)"
        />
        <FormConsent
          v-for="consent in item.consents ?? []"
          :key="consent.id"
          :consent="consent"
          :input-id="inputId(consent)"
          :value="draft[consent.id]"
          :error="errors[consent.id]"
          :disabled="disabled"
          :new-tab-label="labels.newTab ?? ''"
          @change="emit('answer', consent.id, $event)"
        />
      </div>
    </QuestionnaireItem>
    <QuestionnaireItem
      v-if="settings.review"
      :name="REVIEW_STEP"
      data-form-review
      :invalid="reviewConsents.some((consent) => Boolean(errors[consent.id]))"
      required
    >
      <QuestionnaireTitle>{{ label("reviewTitle") }}</QuestionnaireTitle>
      <dl class="yayaw-form-review">
        <template v-for="item in steps" :key="item.id">
          <div
            v-for="question in item.questions"
            :key="question.id"
            class="yayaw-form-review-row"
            :data-form-review-question="question.id"
          >
            <dt>{{ question.label }}{{ evaluation.required.has(question.id) ? " *" : "" }}</dt>
            <dd>
              <template v-if="formAnswerText(question, draft[question.columnId], locale, words)">
                {{ formAnswerText(question, draft[question.columnId], locale, words) }}
              </template>
              <span v-else class="yayaw-form-help">{{ label("noAnswer") }}</span>
            </dd>
            <button
              type="button"
              class="yayaw-button yayaw-button-ghost yayaw-form-review-change"
              :aria-label="label('reviewChange', { label: question.label })"
              @click="go(item.id)"
            >
              {{ label("reviewChange", { label: "" }).trim() }}
            </button>
          </div>
        </template>
      </dl>
      <div v-if="reviewConsents.length" class="yayaw-form-questions">
        <FormConsent
          v-for="consent in reviewConsents"
          :key="consent.id"
          :consent="consent"
          :input-id="inputId(consent)"
          :value="draft[consent.id]"
          :error="errors[consent.id]"
          :disabled="disabled"
          :new-tab-label="labels.newTab ?? ''"
          @change="emit('answer', consent.id, $event)"
        />
      </div>
    </QuestionnaireItem>
    <slot v-if="last" name="extra-fields" />
    <QuestionnaireActions class="yayaw-form-step-actions">
      <QuestionnairePrevious variant="outline" :disabled="disabled" @click="back">
        {{ label("back") }}
      </QuestionnairePrevious>
      <QuestionnaireSkip variant="outline" :disabled="disabled" @click="skip">
        {{ label("skip") }}
      </QuestionnaireSkip>
      <QuestionnaireNext :disabled="disabled" @click="next">
        {{ label("next") }}
      </QuestionnaireNext>
      <QuestionnaireSubmit type="button" :disabled="disabled" @click="next">
        {{ submitText }}
      </QuestionnaireSubmit>
    </QuestionnaireActions>
  </Questionnaire>
</template>
