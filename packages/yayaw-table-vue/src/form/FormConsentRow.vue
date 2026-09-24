<script setup lang="ts">
/** A consent of the Form settings: its statement, link and version; always required, never hidden by rules. */
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Trash2,
} from "lucide-vue-next";
import { computed, ref, useId } from "vue";
import { resolveFormText } from "../form-text";
import {
  type FormConsentQuestion,
  type FormLabelKey,
  formItemMissingTranslation,
  formLabel,
} from "../form-view";
import FormLocalizedText, {
  type FormEditingLanguage,
} from "./FormLocalizedText.vue";
import FormSettingText from "./FormSettingText.vue";

const PREVIEW_LENGTH = 48;

const props = defineProps<{
  consent: FormConsentQuestion;
  /** Place among the ordered items, and their count. */
  index: number;
  count: number;
  editing: FormEditingLanguage;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const emit = defineEmits<{
  change: [patch: Partial<FormConsentQuestion>];
  move: [offset: -1 | 1];
  remove: [];
}>();
const id = `yayaw-form-consent-${useId()}`;
const open = ref(false);
/** Built-in texts in the language being edited. */
const builtIn = (key: FormLabelKey): string => formLabel(key, props.editing.locale);
const statementKey = computed<FormLabelKey>(() =>
  props.consent.link ? "consentTextLink" : "consentText"
);
const statement = computed(
  () =>
    resolveFormText(
      props.consent.text,
      props.editing.locale,
      props.editing.defaultLocale
    ) ?? builtIn(statementKey.value)
);
const preview = computed(() =>
  statement.value.length > PREVIEW_LENGTH
    ? `${statement.value.slice(0, PREVIEW_LENGTH)}…`
    : statement.value
);
const name = computed(() => `${props.label("consent")}: ${preview.value}`);
const missing = computed(() =>
  formItemMissingTranslation(
    props.consent,
    props.editing.locale,
    props.editing.defaultLocale
  )
);
</script>

<template>
  <li
    class="yayaw-form-settings-item"
    :data-editing="open || undefined"
    :data-form-setting-consent="consent.id"
  >
    <div class="yayaw-form-settings-row">
      <GripVertical :size="16" aria-hidden="true" class="yayaw-form-settings-grip" />
      <span class="yayaw-form-settings-name" data-asked>
        <span class="yayaw-form-settings-kind">{{ label("consent") }}</span><span class="yayaw-form-settings-preview"> · {{ preview }}</span>
      </span>
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
        :aria-label="label('moveUp', { label: name })"
        :disabled="index === 0"
        @click="emit('move', -1)"
      >
        <ArrowUp :size="14" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
        :aria-label="label('moveDown', { label: name })"
        :disabled="index === count - 1"
        @click="emit('move', 1)"
      >
        <ArrowDown :size="14" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action yayaw-form-settings-expand"
        :aria-label="label('editSection', { label: name })"
        :aria-expanded="open"
        :aria-controls="`${id}-details`"
        @click="open = !open"
      >
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action"
        :aria-label="label('removeSection', { label: name })"
        @click="emit('remove')"
      >
        <Trash2 :size="14" aria-hidden="true" />
      </button>
    </div>
    <p v-if="missing" class="yayaw-form-missing-line" data-form-missing-translation>
      <span class="yayaw-form-missing">{{ editing.missingLabel }}</span>
    </p>
    <div v-if="open" :id="`${id}-details`" class="yayaw-form-settings-details">
      <FormLocalizedText
        :id="`${id}-text`"
        :editing="editing"
        :label="label('consentStatement')"
        :text="consent.text"
        :fallback="builtIn(statementKey)"
        :hint="label('consentLinkHint')"
        multiline
        @change="emit('change', { text: $event })"
      />
      <FormLocalizedText
        :id="`${id}-link-label`"
        :editing="editing"
        :label="label('linkText')"
        :text="consent.link?.label"
        :fallback="builtIn('consentLinkLabel')"
        @change="emit('change', { link: { ...consent.link, label: $event } })"
      />
      <FormLocalizedText
        :id="`${id}-link-href`"
        :editing="editing"
        :label="label('linkUrl')"
        :text="consent.link?.href"
        :flag-missing="false"
        type="url"
        @change="emit('change', { link: { ...consent.link, href: $event } })"
      />
      <FormSettingText
        :id="`${id}-version`"
        :label="label('consentVersion')"
        :value="consent.version ?? ''"
        placeholder="1"
        @commit="emit('change', { version: $event })"
      />
      <p class="yayaw-form-settings-note">{{ label("consentNote") }}</p>
    </div>
  </li>
</template>
