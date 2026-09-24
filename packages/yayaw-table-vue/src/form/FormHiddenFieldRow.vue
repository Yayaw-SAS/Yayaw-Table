<script setup lang="ts">
/** A hidden field of the Form settings: where its value comes from and where it is saved. */
import { ChevronDown, Trash2 } from "lucide-vue-next";
import { computed, useId } from "vue";
import type {
  FormColumn,
  FormHiddenField,
  FormHiddenSource,
  FormLabelKey,
} from "../form-view";
import FormHiddenFieldEditor, {
  FORM_HIDDEN_SOURCE_LABELS,
} from "./FormHiddenFieldEditor.vue";

const props = defineProps<{
  field: FormHiddenField;
  /** Columns the field may write. */
  columns: readonly FormColumn[];
  open: boolean;
  label: (key: FormLabelKey, params?: Record<string, string>) => string;
}>();
const emit = defineEmits<{
  change: [patch: { source?: FormHiddenSource; columnId?: string }];
  remove: [];
  toggle: [];
}>();
const id = `yayaw-form-hidden-${useId()}`;
const name = computed(() =>
  props.field.source.type === "urlParam"
    ? props.field.source.name
    : props.label(FORM_HIDDEN_SOURCE_LABELS[props.field.source.type])
);
const saved = computed(
  () =>
    props.columns.find((column) => column.id === props.field.columnId)?.header ??
    props.label("responseDetails")
);
</script>

<template>
  <li
    class="yayaw-form-settings-item"
    :data-editing="open || undefined"
    :data-form-setting-hidden="field.id"
  >
    <div class="yayaw-form-settings-row">
      <span class="yayaw-form-settings-name yayaw-form-hidden-name" data-asked>
        <span class="yayaw-sr-only">{{ label("hiddenField") }}: </span><span class="yayaw-form-settings-kind">{{ name }}</span><span class="yayaw-form-settings-preview"> → {{ saved }}</span>
      </span>
      <button
        type="button"
        class="yayaw-button yayaw-button-ghost yayaw-icon-only yayaw-form-settings-action yayaw-form-settings-expand"
        :aria-label="label('editSection', { label: name })"
        :aria-expanded="open"
        :aria-controls="`${id}-details`"
        @click="emit('toggle')"
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
    <div v-if="open" :id="`${id}-details`" class="yayaw-form-settings-details">
      <FormHiddenFieldEditor
        :field="field"
        :columns="columns"
        :id-prefix="id"
        :label="label"
        @change="emit('change', $event)"
      />
    </div>
  </li>
</template>
