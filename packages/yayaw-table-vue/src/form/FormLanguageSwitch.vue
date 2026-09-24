<script setup lang="ts">
/**
 * A form's languages as a segmented control (radios: arrow keys switch),
 * each named in itself ("English", "Français"), with "Add language" when
 * `canAdd`. Used by the Form settings ("Editing") and the Form view's
 * preview ("Language").
 */
import { computed, useId } from "vue";
import { formLanguageName } from "../form-text";
import FormRuleSelect from "./FormRuleSelect.vue";

const props = withDefaults(
  defineProps<{
    /** The legend: "Editing", "Language". */
    label: string;
    languages: readonly string[];
    value: string;
    /** Languages "Add language" offers. */
    addable?: readonly string[];
    addLabel?: string;
    canAdd?: boolean;
  }>(),
  { addable: () => [], addLabel: undefined, canAdd: false }
);
const emit = defineEmits<{ change: [locale: string]; add: [locale: string] }>();
const name = useId();
const addOptions = computed(() =>
  props.addable.map((locale) => ({ value: locale, label: formLanguageName(locale) }))
);
</script>

<template>
  <div class="yayaw-form-languages" data-form-languages>
    <fieldset class="yayaw-form-language-set">
      <legend class="yayaw-form-language-legend">{{ label }}</legend>
      <span class="yayaw-form-language-options">
        <label
          v-for="locale in languages"
          :key="locale"
          class="yayaw-form-language"
          :data-form-language="locale"
          :lang="locale"
        >
          <input
            class="yayaw-sr-only"
            type="radio"
            :name="name"
            :value="locale"
            :checked="value === locale"
            @change="emit('change', locale)"
          />{{ formLanguageName(locale) }}
        </label>
      </span>
    </fieldset>
    <div v-if="canAdd && addLabel && addable.length" class="yayaw-form-language-add">
      <FormRuleSelect
        :label="addLabel"
        :placeholder="addLabel"
        value=""
        :options="addOptions"
        @change="emit('add', $event)"
      />
    </div>
  </div>
</template>
