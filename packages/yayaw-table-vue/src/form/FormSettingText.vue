<script setup lang="ts">
import { computed, ref, watch } from "vue";

/** A text setting saved when it loses focus or on Enter, not on every key. */
const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    value: string;
    multiline?: boolean;
    type?: string;
    /** Shown while empty, e.g. the text of the default language. */
    placeholder?: string;
    /** Language of the text typed, for spelling and screen readers. */
    lang?: string;
    /** Flags a missing translation next to the label. */
    missing?: boolean;
    missingLabel?: string;
    hint?: string;
  }>(),
  {
    type: "text",
    placeholder: undefined,
    lang: undefined,
    missingLabel: undefined,
    hint: undefined,
  }
);
const emit = defineEmits<{ commit: [value: string] }>();
const draft = ref(props.value);
watch(
  () => props.value,
  (value) => {
    draft.value = value;
  }
);
const commit = (): void => {
  if (draft.value !== props.value) emit("commit", draft.value);
};
const describedBy = computed(
  () =>
    [props.missing && `${props.id}-missing`, props.hint && `${props.id}-hint`]
      .filter(Boolean)
      .join(" ") || undefined
);
</script>

<template>
  <div class="yayaw-form-setting">
    <div class="yayaw-form-setting-head">
      <label class="yayaw-form-setting-label" :for="id">{{ label }}</label>
      <span
        v-if="missing"
        :id="`${id}-missing`"
        class="yayaw-form-missing"
        data-form-missing-translation
      >{{ missingLabel }}</span>
    </div>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="draft"
      class="yayaw-textarea"
      rows="2"
      :lang="lang"
      :placeholder="placeholder"
      :aria-describedby="describedBy"
      @blur="commit"
    />
    <input
      v-else
      :id="id"
      v-model="draft"
      class="yayaw-input"
      :type="type"
      :lang="lang"
      :placeholder="placeholder"
      :aria-describedby="describedBy"
      @blur="commit"
      @keydown.enter.prevent="commit"
    />
    <p v-if="hint" :id="`${id}-hint`" class="yayaw-form-settings-note">{{ hint }}</p>
  </div>
</template>
