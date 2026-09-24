<script lang="ts">
/** The language texts are written in, and the form's default language. */
export interface FormEditingLanguage {
  locale: string;
  defaultLocale: string;
  missingLabel: string;
}
</script>

<script setup lang="ts">
/**
 * A text written in the language being edited: the other languages keep
 * theirs; the default language's text shows as the placeholder while this
 * one is not translated, and "Missing translation" flags it.
 */
import { computed } from "vue";
import {
  type FormText,
  formTextIn,
  formTextMissing,
  resolveFormText,
  setFormText,
} from "../form-text";
import FormSettingText from "./FormSettingText.vue";

const props = withDefaults(
  defineProps<{
    editing: FormEditingLanguage;
    id: string;
    label: string;
    text?: FormText;
    /** What shows while no language has a text (a column name): it needs a translation too. */
    source?: string;
    /** The built-in text shown while empty (it is already translated). */
    fallback?: string;
    multiline?: boolean;
    type?: string;
    hint?: string;
    /** False for texts often the same in every language (an address). */
    flagMissing?: boolean;
  }>(),
  {
    text: undefined,
    source: undefined,
    fallback: undefined,
    type: "text",
    hint: undefined,
    flagMissing: true,
  }
);
const emit = defineEmits<{ change: [text: FormText | undefined] }>();
const placeholder = computed(() => {
  const { defaultLocale, locale } = props.editing;
  const original = resolveFormText(props.text, defaultLocale) ?? props.source;
  return (locale === defaultLocale ? props.source : original) ?? props.fallback;
});
const value = computed(() =>
  formTextIn(props.text, props.editing.locale, props.editing.defaultLocale)
);
const missing = computed(
  () =>
    props.flagMissing &&
    formTextMissing(
      props.text,
      props.editing.locale,
      props.editing.defaultLocale,
      props.source
    )
);
const commit = (next: string): void =>
  emit(
    "change",
    setFormText(props.text, props.editing.locale, next, props.editing.defaultLocale)
  );
</script>

<template>
  <FormSettingText
    :id="id"
    :label="label"
    :value="value"
    :multiline="multiline"
    :type="type"
    :placeholder="placeholder"
    :lang="editing.locale"
    :missing="missing"
    :missing-label="editing.missingLabel"
    :hint="hint"
    @commit="commit"
  />
</template>
