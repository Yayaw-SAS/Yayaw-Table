<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import type { PendingConflictResolution, PendingConflictsView } from "../../connector-flow";

/**
 * The conflicts waiting for a person: each with its row, column and both
 * values, kept one by one or all at once through `resolveConflicts`.
 */
const props = defineProps<{
  view: PendingConflictsView;
  busy: boolean;
  error: string | null;
}>();
const emit = defineEmits<{ resolve: [resolutions: PendingConflictResolution[]]; back: [] }>();
const sides = ["table", "target"] as const;
const keepAll = (choice: "table" | "target"): void => {
  emit(
    "resolve",
    props.view.lines.map((line) => ({ rowId: line.rowId, columnId: line.columnId, choice }))
  );
};
</script>

<template>
  <div class="yayaw-connector-conflicts" :aria-busy="busy" data-connector-conflicts>
    <div class="yayaw-connector-conflicts-head">
      <h3>{{ view.title }}</h3>
      <p class="yayaw-connector-hint">{{ view.hint }}</p>
    </div>
    <p v-if="view.lines.length === 0" class="yayaw-schedule-muted" data-connector-conflicts-empty>{{ view.empty }}</p>
    <ul v-else>
      <li v-for="line in view.lines" :key="line.id" :data-pending-conflict="line.id">
        <span class="yayaw-sync-conflict-title">{{ line.title }}</span>
        <span v-for="side in sides" :key="side" class="yayaw-connector-conflict-value">
          <span>{{ line[side].label }}</span><span>{{ line[side].value }}</span>
        </span>
        <div class="yayaw-connector-conflict-actions">
          <button v-for="side in sides" :key="side" type="button" class="yayaw-button yayaw-button-outline"
            :disabled="busy" @click="emit('resolve', [{ rowId: line.rowId, columnId: line.columnId, choice: side }])">
            {{ side === "table" ? line.keepTable : line.keepTarget }}
          </button>
        </div>
      </li>
    </ul>
    <output v-if="busy" class="yayaw-connector-hint">{{ view.resolving }}</output>
    <p v-if="error" class="yayaw-connector-error" data-connector-error role="alert">{{ error }}</p>
    <div v-if="view.lines.length > 1" class="yayaw-connector-conflict-actions">
      <button type="button" class="yayaw-button yayaw-button-outline" :disabled="busy" @click="keepAll('table')">
        {{ view.keepAllTable }}
      </button>
      <button type="button" class="yayaw-button yayaw-button-outline" :disabled="busy" @click="keepAll('target')">
        {{ view.keepAllTarget }}
      </button>
    </div>
    <button type="button" class="yayaw-button yayaw-connector-send" @click="emit('back')">
      <span v-if="busy" class="yayaw-spinner" aria-hidden="true" />
      <ArrowLeft v-else :size="16" aria-hidden="true" />
      {{ view.back }}
    </button>
  </div>
</template>
