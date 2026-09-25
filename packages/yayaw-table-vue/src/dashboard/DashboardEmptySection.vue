<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import type { DashboardLabel } from "./dashboard-types";

/** An empty section in edit mode: a dashed placeholder offering to add a widget. */
const props = defineProps<{ label: DashboardLabel }>();
const emit = defineEmits<{ addWidget: [] }>();
</script>

<template>
  <div class="yayaw-dashboard-section-empty" data-section-empty="">
    <p>{{ props.label("emptySection") }}</p>
    <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('addWidget')">
      <Plus :size="16" aria-hidden="true" />{{ props.label("addWidgetHere") }}
    </button>
  </div>
</template>
