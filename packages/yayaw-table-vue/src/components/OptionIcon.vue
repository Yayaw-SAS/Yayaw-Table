<script setup lang="ts">
import { computed } from "vue";
import { getOptionIconUrl, optionIconStyle } from "../option-icon";

const props = defineProps<{ option: unknown }>();
const url = computed(() => getOptionIconUrl(props.option));
</script>

<template>
  <span v-if="url" aria-hidden="true" class="yayaw-option-icon" data-yayaw-option-icon :style="optionIconStyle(url)" />
</template>
