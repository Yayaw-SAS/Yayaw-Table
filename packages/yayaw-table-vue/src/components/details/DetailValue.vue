<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRight, FileText } from "lucide-vue-next";
import { detailDisplay, type DetailField, type DetailLabels, type DetailRecord } from "../../record-details";

const props = defineProps<{ field: DetailField; value: unknown; row: DetailRecord; locale: string; labels: DetailLabels }>();
const display = computed(() => detailDisplay(props.field, props.value, props.row, props.locale, props.labels));
</script>

<template>
  <span v-if="display.kind === 'empty'" class="yayaw-detail-empty">{{ display.text }}</span>
  <pre v-else-if="display.kind === 'code'" class="yayaw-detail-code"><code>{{ display.text }}</code></pre>
  <span v-else-if="display.kind === 'badges'" class="yayaw-detail-badges"><span v-for="item in display.items" :key="item.id" class="yayaw-detail-badge">{{ item.text }}</span></span>
  <a v-else-if="display.kind === 'link'" :href="display.href" target="_blank" rel="noopener noreferrer" class="yayaw-detail-link">{{ display.text }}<ArrowUpRight :size="14" aria-hidden="true" /></a>
  <a v-else-if="display.kind === 'image'" :href="display.href" target="_blank" rel="noopener noreferrer"><img :src="display.href" :alt="field.label" class="yayaw-detail-image" loading="lazy" /></a>
  <ul v-else-if="display.kind === 'items'" class="yayaw-detail-items"><li v-for="item in display.items" :key="item.id"><FileText :size="16" aria-hidden="true" /><a v-if="item.href" :href="item.href" target="_blank" rel="noopener noreferrer">{{ item.text }}</a><span v-else>{{ item.text }}</span></li></ul>
  <span v-else class="yayaw-detail-text">{{ display.text }}</span>
</template>
