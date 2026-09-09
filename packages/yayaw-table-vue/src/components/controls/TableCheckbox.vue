<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";

defineProps<{ label: string; disabled?: boolean }>();
const checked = defineModel<boolean>({ default: false });
</script>

<template>
  <CheckboxRoot
    :model-value="checked"
    :disabled="disabled"
    :aria-label="label"
    class="yayaw-checkbox"
    data-slot="checkbox"
    @update:model-value="checked = $event === true"
  >
    <CheckboxIndicator class="yayaw-checkbox-indicator">
      <Check :size="14" aria-hidden="true" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
