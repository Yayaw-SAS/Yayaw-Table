<script setup lang="ts">
import { Lock } from "lucide-vue-next";
import type { ConnectorConflictRulesView } from "../../connector-flow";

/** "Rules set by your app": the conflict rules the host applies in code. */
defineProps<{ view: ConnectorConflictRulesView }>();
</script>

<template>
  <section class="yayaw-connector-rules" :aria-label="view.title" data-connector-app-rules
    :data-locked="view.locked || undefined">
    <h3>
      <Lock v-if="view.locked" :size="14" aria-hidden="true" data-connector-lock />{{ view.title }}
    </h3>
    <ul v-if="view.rules.length">
      <li v-for="rule in view.rules" :key="rule.columnId" :data-connector-rule="rule.columnId">{{ rule.text }}</li>
    </ul>
    <p v-if="view.hint" class="yayaw-schedule-muted" data-connector-rules-hint>{{ view.hint }}</p>
  </section>
</template>
