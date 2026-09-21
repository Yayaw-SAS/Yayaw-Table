<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { mountPlanningSurface, type PlanningSurfaceOptions } from "../../planning/surface";
import "../../planning/styles.css";
const props = defineProps<PlanningSurfaceOptions>();
const root = ref<HTMLDivElement>();
let surface: ReturnType<typeof mountPlanningSurface> | undefined;
onMounted(() => { if (root.value) surface = mountPlanningSurface(root.value, {...props}); });
watch(() => ({...props}), (options) => surface?.update(options), {deep: false});
onBeforeUnmount(() => surface?.destroy());
</script>
<template><div ref="root" data-planning-surface="overlay" /></template>
