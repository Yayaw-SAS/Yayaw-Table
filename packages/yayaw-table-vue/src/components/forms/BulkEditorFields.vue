<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { Plus, X } from "lucide-vue-next";
import { ListboxContent, ListboxFilter, ListboxItem, ListboxRoot, PopoverContent, PopoverRoot, PopoverTrigger } from "reka-ui";
import type { BulkEditorMessages } from "../../bulk-editor";
import { formValuesEqual } from "../../form-runtime";
import type { FormFieldDefinition, TableRecord } from "../../types";

const props = defineProps<{
  fields: FormFieldDefinition[]; available: FormFieldDefinition[];
  clearValues: TableRecord; values: TableRecord; messages: BulkEditorMessages; disabled: boolean;
}>();
const emit = defineEmits<{ add: [name: string]; remove: [name: string]; clear: [name: string, value: unknown] }>();
const open = ref(false);
const search = ref("");
const trigger = ref<HTMLButtonElement>();
const options = computed(() => props.available.filter(field => field.label.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
const add = (name: unknown): void => {
  if (props.disabled || typeof name !== "string" || !props.available.some(field => field.name === name)) return;
  emit("add", name);
  open.value = false;
};
const remove = async (name: string): Promise<void> => {
  emit("remove", name);
  await nextTick();
  trigger.value?.focus();
};
</script>

<template>
  <div class="yayaw-bulk-fields">
    <p v-if="!fields.length" class="yayaw-help yayaw-bulk-empty">{{ messages.empty }}</p>
    <div v-for="field in fields" :key="field.name" class="yayaw-bulk-field" :data-bulk-field="field.name">
      <slot name="field" :field="field" />
      <button type="button" class="yayaw-icon-button yayaw-bulk-remove" :aria-label="messages.removeField.replace('{field}', field.label)" :disabled="disabled" @click="remove(field.name)"><X :size="16" aria-hidden="true" /></button>
      <button v-if="Object.hasOwn(clearValues, field.name)" type="button" class="yayaw-bulk-clear" :disabled="disabled || formValuesEqual(values[field.name], clearValues[field.name])" @click="emit('clear', field.name, clearValues[field.name])">{{ messages.clearValue }}</button>
    </div>
    <PopoverRoot :open="open && !disabled" @update:open="open = $event; search = ''">
      <PopoverTrigger as-child>
        <button ref="trigger" type="button" class="yayaw-button yayaw-button-outline" :disabled="disabled || !available.length"><Plus :size="16" aria-hidden="true" />{{ messages.addField }}</button>
      </PopoverTrigger>
      <PopoverContent class="yayaw-bulk-picker" align="start" :side-offset="4" :collision-padding="16" :aria-label="messages.addField">
        <ListboxRoot @update:model-value="add">
          <ListboxFilter v-model="search" class="yayaw-input" :aria-label="messages.searchFields" :placeholder="messages.searchFields" auto-focus />
          <ListboxContent class="yayaw-bulk-picker-list" :aria-label="messages.addField">
            <ListboxItem v-for="field in options" :key="field.name" :value="field.name" :data-bulk-option="field.name" class="yayaw-bulk-picker-option">{{ field.label }}</ListboxItem>
            <p v-if="!options.length" class="yayaw-help" role="status">{{ messages.noFields }}</p>
          </ListboxContent>
        </ListboxRoot>
      </PopoverContent>
    </PopoverRoot>
  </div>
</template>
