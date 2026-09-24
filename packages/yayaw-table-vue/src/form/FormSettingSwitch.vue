<script setup lang="ts">
/** A labelled switch, as in the table's settings menus. */
import { SwitchRoot, SwitchThumb } from "reka-ui";

defineProps<{ id: string; label: string; checked: boolean }>();
const emit = defineEmits<{ change: [checked: boolean] }>();
</script>

<template>
  <div class="yayaw-form-switch-setting">
    <label :id="`${id}-label`" class="yayaw-form-switch-label" :for="id">{{ label }}</label>
    <SwitchRoot
      :id="id"
      class="yayaw-switch-root"
      :model-value="checked"
      :aria-labelledby="`${id}-label`"
      @update:model-value="emit('change', $event === true)"
    >
      <SwitchThumb class="yayaw-switch-thumb" />
    </SwitchRoot>
  </div>
</template>
