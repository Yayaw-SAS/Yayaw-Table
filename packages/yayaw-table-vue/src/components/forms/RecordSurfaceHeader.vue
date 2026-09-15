<script setup lang="ts">
import { X } from "lucide-vue-next";
defineProps<{ title: string; description?: string; closeLabel: string; busy?: boolean }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <header class="yayaw-record-header">
    <div class="yayaw-record-heading"><h2>{{ title }}</h2><p v-if="description">{{ description }}</p><slot /></div>
    <button type="button" class="yayaw-icon-button" :aria-label="closeLabel" :disabled="busy" @click="$emit('close')"><X :size="16" aria-hidden="true" /></button>
  </header>
</template>
