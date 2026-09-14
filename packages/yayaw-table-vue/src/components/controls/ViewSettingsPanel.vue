<script setup lang="ts">
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-vue-next";
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator } from "reka-ui";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
} from "vue";
import { useTableContext } from "../../context";
import { settingsNavigationKey } from "../toolbar/settings-navigation";
import TableSelect from "./TableSelect.vue";
import TableCheckbox from "./TableCheckbox.vue";

interface SettingField {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}
interface SettingProperties {
  label: string;
  value: string[];
  options: { value: string; label: string }[];
  onChange: (value: string[]) => void;
  showLabels: boolean;
  showLabelsLabel: string;
  onShowLabelsChange: (value: boolean) => void;
}
const props = defineProps<{
  fields: SettingField[];
  properties?: SettingProperties;
}>();
const context = useTableContext();
const id = useId();
const screen = ref<string>();
const triggerId = ref("");
const navigation = inject(settingsNavigationKey);
const field = computed(() =>
  props.fields.find((item) => item.id === screen.value),
);
const showProperties = computed(
  () => screen.value === "properties" && props.properties,
);
const open = async (name: string) => {
  triggerId.value = `${id}-${name}`;
  screen.value = name;
  await nextTick();
};
const back = async () => {
  screen.value = undefined;
  await nextTick();
  document.getElementById(triggerId.value)?.focus();
};
const choose = (value: unknown) => {
  if (typeof value !== "string" || !field.value) return;
  field.value.onChange(value);
  back();
};
const toggle = (value: string, checked: boolean) => {
  const properties = props.properties;
  if (!properties) return;
  const remaining = properties.value.filter((item) => item !== value);
  properties.onChange(checked ? [...remaining, value] : remaining);
};
// Reuse the same header and modal boundary instead of opening a nested overlay.
watch([field, showProperties], () => {
  if (navigation)
    navigation.value =
      field.value || showProperties.value
        ? { title: field.value?.label ?? props.properties?.label ?? "", back }
        : undefined;
});
onBeforeUnmount(() => {
  if (navigation) navigation.value = undefined;
});
</script>

<template>
  <div
    v-if="field || showProperties"
    class="yayaw-card-settings"
    :data-view-settings-screen="screen"
  >
    <RadioGroupRoot
      v-if="field"
      :model-value="field.value"
      :aria-label="field.label"
      class="yayaw-settings-choices"
      @update:model-value="choose"
    >
      <label
        v-for="option in field.options"
        :key="option.value"
        class="yayaw-settings-choice"
      >
        <RadioGroupItem :value="option.value" class="yayaw-settings-radio"
          ><RadioGroupIndicator class="yayaw-settings-radio-indicator"
        /></RadioGroupItem>
        <span>{{ option.label }}</span>
      </label>
    </RadioGroupRoot>
    <fieldset v-else-if="properties" class="yayaw-settings-choices">
      <legend class="yayaw-sr-only">{{ properties.label }}</legend>
      <label
        v-for="option in properties.options"
        :key="option.value"
        class="yayaw-settings-choice"
      >
        <TableCheckbox
          :model-value="properties.value.includes(option.value)"
          :label="option.label"
          @update:model-value="toggle(option.value, $event)"
        /><span>{{ option.label }}</span>
      </label>
      <label class="yayaw-settings-choice yayaw-settings-labels">
        <TableCheckbox
          :model-value="properties.showLabels"
          :label="properties.showLabelsLabel"
          @update:model-value="properties.onShowLabelsChange"
        /><span>{{ properties.showLabelsLabel }}</span>
      </label>
    </fieldset>
  </div>
  <div v-else class="yayaw-card-settings" data-view-settings>
    <template v-for="item in fields" :key="item.id">
      <div v-if="context.toolbarCompact.value" class="yayaw-control-field">
        <label :for="`${id}-${item.id}`">{{ item.label }}</label>
        <button
          :id="`${id}-${item.id}`"
          :aria-label="item.label"
          type="button"
          class="yayaw-select-trigger"
          @click="open(item.id)"
        >
          <span>{{
            item.options.find((option) => option.value === item.value)?.label ??
            item.label
          }}</span
          ><ChevronDown :size="16" aria-hidden="true" />
        </button>
      </div>
      <TableSelect
        v-else
        :model-value="item.value"
        :label="item.label"
        :options="item.options"
        @update:model-value="item.onChange"
      />
    </template>
    <button
      v-if="properties"
      :id="`${id}-properties`"
      :aria-label="properties.label"
      type="button"
      class="yayaw-button yayaw-button-outline yayaw-settings-properties"
      @click="open('properties')"
    >
      <SlidersHorizontal :size="16" aria-hidden="true" /><span>{{
        properties.label
      }}</span
      ><ChevronRight :size="16" aria-hidden="true" />
    </button>
    <slot />
  </div>
</template>
