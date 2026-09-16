<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { attachMediaThumbnail } from "../../media-viewer";
import type { TableMediaSource } from "../../media-contract";
const props = defineProps<{ source?: TableMediaSource; title: string; fit: "cover" | "contain"; hoverPreview?: boolean; previewLabel: string }>();
const emit = defineEmits<{ open: [target: HTMLElement] }>();
const host = ref<HTMLElement>();
watchEffect(onCleanup => {
  const element = host.value;
  if (!element) return;
  onCleanup(attachMediaThumbnail(element, props.source, props.title, { fit: props.fit, hoverPreview: props.hoverPreview, previewLabel: props.previewLabel, onOpen: () => emit("open", element.querySelector("button") ?? element) }));
}, { flush: "post" });
</script>
<template><div ref="host" class="yayaw-gallery-native-media" /></template>
