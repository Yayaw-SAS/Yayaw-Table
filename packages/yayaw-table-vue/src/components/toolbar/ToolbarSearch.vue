<script setup lang="ts">
import { Search, X } from "lucide-vue-next";
import { nextTick, ref } from "vue";

const props = defineProps<{ label: string; compact?: boolean }>();
const search = defineModel<string>({ required: true });
const input = ref<HTMLInputElement>();
// Touch layouts show a search button; the field opens on demand and stays open while it filters.
const expanded = ref(false);
const open = async (): Promise<void> => {
  expanded.value = true;
  await nextTick();
  input.value?.focus();
};
const close = (): void => {
  if (search.value) {
    search.value = "";
    input.value?.focus();
    return;
  }
  expanded.value = false;
};
</script>

<template>
  <button v-if="props.compact && !expanded && !search" type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only" :aria-label="props.label" @click="open">
    <Search :size="16" aria-hidden="true" />
  </button>
  <div v-else class="yayaw-search-field" :data-compact="props.compact">
    <Search :size="16" aria-hidden="true" class="yayaw-search-icon" />
    <input ref="input" v-model="search" type="search" class="yayaw-input yayaw-search" :placeholder="props.label" :aria-label="props.label"
      @keydown.escape="props.compact && close()" />
    <button v-if="props.compact" type="button" class="yayaw-search-clear" :aria-label="props.label" @click="close"><X :size="16" aria-hidden="true" /></button>
  </div>
</template>
