<script setup lang="ts">
/**
 * A consent's statement, link and version in the language being edited; the
 * built-in statement shows while it is unset. Always required, never hidden
 * by rules.
 */
import { computed } from "vue";
import {
  type FormConsentQuestion,
  type FormLabelKey,
  formLabel,
} from "../form-view";
import FormLocalizedText, {
  type FormEditingLanguage,
} from "./FormLocalizedText.vue";
import FormSettingText from "./FormSettingText.vue";

const props = defineProps<{
  consent: FormConsentQuestion;
  editing: FormEditingLanguage;
  /** Prefix of the editor's control ids. */
  idPrefix: string;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const emit = defineEmits<{ change: [patch: Partial<FormConsentQuestion>] }>();
/** Built-in texts in the language being edited. */
const builtIn = (key: FormLabelKey): string => formLabel(key, props.editing.locale);
const statementKey = computed<FormLabelKey>(() =>
  props.consent.link ? "consentTextLink" : "consentText"
);
</script>

<template>
  <FormLocalizedText
    :id="`${idPrefix}-text`"
    :editing="editing"
    :label="label('consentStatement')"
    :text="consent.text"
    :fallback="builtIn(statementKey)"
    :hint="label('consentLinkHint')"
    multiline
    @change="emit('change', { text: $event })"
  />
  <FormLocalizedText
    :id="`${idPrefix}-link-label`"
    :editing="editing"
    :label="label('linkText')"
    :text="consent.link?.label"
    :fallback="builtIn('consentLinkLabel')"
    @change="emit('change', { link: { ...consent.link, label: $event } })"
  />
  <FormLocalizedText
    :id="`${idPrefix}-link-href`"
    :editing="editing"
    :label="label('linkUrl')"
    :text="consent.link?.href"
    :flag-missing="false"
    type="url"
    @change="emit('change', { link: { ...consent.link, href: $event } })"
  />
  <FormSettingText
    :id="`${idPrefix}-version`"
    :label="label('consentVersion')"
    :value="consent.version ?? ''"
    placeholder="1"
    @commit="emit('change', { version: $event })"
  />
  <p class="yayaw-form-settings-note">{{ label("consentNote") }}</p>
</template>
