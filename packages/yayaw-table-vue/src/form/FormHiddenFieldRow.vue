<script setup lang="ts">
/** A hidden field of the Form settings: where its value comes from and where it is saved. */
import { ChevronDown, Trash2 } from "lucide-vue-next";
import { computed, useId } from "vue";
import type {
  FormColumn,
  FormHiddenField,
  FormHiddenSource,
  FormHiddenSourceType,
  FormLabelKey,
} from "../form-view";
import FormRuleSelect from "./FormRuleSelect.vue";
import FormSettingText from "./FormSettingText.vue";

/** "Save in" choice of a value kept in the response details. */
const DETAILS = "__details";
const SOURCE_LABELS: Record<FormHiddenSourceType, FormLabelKey> = {
  urlParam: "sourceUrlParam",
  pageUrl: "sourcePageUrl",
  referrer: "sourceReferrer",
  locale: "sourceLocale",
  static: "sourceStatic",
};

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
const sourceName = computed(() => props.label(SOURCE_LABELS[props.field.source.type]));
const paramName = computed(() =>
  props.field.source.type === "urlParam" ? props.field.source.name : ""
);
const staticValue = computed(() =>
  props.field.source.type === "static" ? props.field.source.value : ""
);
const name = computed(() => paramName.value || sourceName.value);
const saved = computed(
  () =>
    props.columns.find((column) => column.id === props.field.columnId)?.header ??
    props.label("responseDetails")
);
const sourceOptions = computed(() =>
  Object.entries(SOURCE_LABELS).map(([value, key]) => ({
    value,
    label: props.label(key),
  }))
);
const columnOptions = computed(() => [
  { value: DETAILS, label: props.label("responseDetails") },
  ...props.columns.map((column) => ({ value: column.id, label: column.header })),
]);
/** A source of another type, keeping what it can of the current one. */
const sourceOfType = (type: string): FormHiddenSource => {
  switch (type as FormHiddenSourceType) {
    case "urlParam":
      return { type: "urlParam", name: "utm_source" };
    case "static":
      return { type: "static", value: props.field.id };
    case "pageUrl":
      return { type: "pageUrl" };
    case "referrer":
      return { type: "referrer" };
    default:
      return { type: "locale" };
  }
};
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
      <div class="yayaw-form-setting">
        <span class="yayaw-form-setting-label" aria-hidden="true">{{ label("hiddenSource") }}</span>
        <FormRuleSelect
          :label="label('hiddenSource')"
          :value="field.source.type"
          :options="sourceOptions"
          @change="emit('change', { source: sourceOfType($event) })"
        />
      </div>
      <FormSettingText
        v-if="field.source.type === 'urlParam'"
        :id="`${id}-param`"
        :label="label('paramName')"
        :value="paramName"
        @commit="emit('change', { source: { type: 'urlParam', name: $event } })"
      />
      <FormSettingText
        v-if="field.source.type === 'static'"
        :id="`${id}-static`"
        :label="label('staticValue')"
        :value="staticValue"
        @commit="emit('change', { source: { type: 'static', value: $event } })"
      />
      <div class="yayaw-form-setting">
        <span class="yayaw-form-setting-label" aria-hidden="true">{{ label("saveIn") }}</span>
        <FormRuleSelect
          :label="label('saveIn')"
          :value="field.columnId ?? DETAILS"
          :options="columnOptions"
          @change="emit('change', { columnId: $event === DETAILS ? undefined : $event })"
        />
      </div>
    </div>
  </li>
</template>
