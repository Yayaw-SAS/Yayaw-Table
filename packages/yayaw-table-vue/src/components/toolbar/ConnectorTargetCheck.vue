<script setup lang="ts">
import { CircleCheck, Wrench } from "lucide-vue-next";
import type { SchemaReportView } from "../../connector-flow";

/**
 * "Target check": the issues found in the target, grouped by severity, with
 * "Update mapping" for renamed fields and "Prepare …" for fixable ones.
 */
defineProps<{ view: SchemaReportView; preparing: boolean; prepareOpen: boolean }>();
const emit = defineEmits<{ prepare: []; updateMapping: [] }>();
</script>

<template>
  <section class="yayaw-connector-check" :aria-label="view.title" data-connector-target-check>
    <h3>{{ view.title }}</h3>
    <p v-if="view.checking" class="yayaw-schedule-loading">
      <span class="yayaw-spinner" aria-hidden="true" />{{ view.checking }}
    </p>
    <p v-if="view.prepared" class="yayaw-connector-prepared" data-connector-prepared>
      <CircleCheck :size="14" aria-hidden="true" />{{ view.prepared }}
    </p>
    <div v-for="group in view.groups" :key="group.severity" class="yayaw-connector-check-group"
      :data-schema-group="group.severity">
      <h4 :data-severity="group.severity">{{ group.title }}</h4>
      <ul>
        <li v-for="line in group.lines" :key="line.id" :data-schema-issue="line.code">{{ line.text }}</li>
      </ul>
    </div>
    <div v-if="view.updateMapping || view.prepare" class="yayaw-connector-check-actions">
      <button v-if="view.updateMapping" type="button" class="yayaw-button yayaw-button-outline"
        data-connector-update-mapping @click="emit('updateMapping')">
        {{ view.updateMapping }}
      </button>
      <button v-if="view.prepare" type="button" class="yayaw-button yayaw-button-outline" data-connector-prepare
        :disabled="preparing || prepareOpen" @click="emit('prepare')">
        <Wrench :size="14" aria-hidden="true" />{{ view.prepare }}
      </button>
    </div>
  </section>
</template>
