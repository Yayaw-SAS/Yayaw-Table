<script setup lang="ts">
withDefaults(defineProps<{ variant?: "default" | "icon" }>(), { variant: "default" });
</script>

<template>
  <div data-slot="empty-icon" :data-variant="variant" class="yayaw-empty-media">
    <slot />
  </div>
</template>
