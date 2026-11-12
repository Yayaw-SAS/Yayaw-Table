<script setup lang="ts">
import { Check, History, LayoutGrid, Plus, Rows3, Send, Undo2 } from "lucide-vue-next";
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger,
} from "reka-ui";
import { computed } from "vue";
import type { DashboardSectionType } from "./dashboard-schema";
import type { DashboardLabel } from "./dashboard-types";

/**
 * Edit mode's banner: the screen's state ("Draft", what editing changes) and
 * every action on the document in one place: add a widget or a section, the
 * host's history and default screen when it has them, save and publish.
 */
const props = defineProps<{
  label: DashboardLabel;
  canAddSection: boolean;
  /** "Done" (or "Save draft" beside "Publish") is saving. */
  saving: boolean;
  /** "Publish" is running. */
  publishing: boolean;
  /** The host has a version history: its button shows. */
  history: boolean;
  /** The host has a default screen to go back to: its button shows. */
  resettable: boolean;
  /** The host publishes: "Done" becomes "Save draft" beside "Publish". */
  publishable: boolean;
}>();
const emit = defineEmits<{
  addWidget: [];
  addSection: [type: DashboardSectionType];
  done: [];
  history: [];
  reset: [];
  publish: [];
}>();
const busy = computed(() => props.saving || props.publishing);
const doneLabel = computed(() => {
  if (props.saving) return props.label("saving");
  return props.label(props.publishable ? "saveDraft" : "done");
});
</script>

<template>
  <section class="yayaw-dashboard-edit-banner" :aria-label="props.label('draft')" data-dashboard-edit-banner="">
    <span class="yayaw-dashboard-draft" data-dashboard-draft="">{{ props.label("draft") }}</span>
    <p class="yayaw-dashboard-edit-notice">{{ props.label(props.publishable ? "editNoticePublish" : "editNotice") }}</p>
    <div class="yayaw-dashboard-actions">
      <button type="button" class="yayaw-button yayaw-button-outline" data-add-widget="" @click="emit('addWidget')">
        <Plus :size="16" aria-hidden="true" />{{ props.label("addWidget") }}
      </button>
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <button type="button" class="yayaw-button yayaw-button-outline" data-add-section="" :disabled="!props.canAddSection">
            <Plus :size="16" aria-hidden="true" />{{ props.label("addSection") }}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-row-actions-menu yayaw-dashboard-menu" align="end" :side-offset="4" :collision-padding="8">
            <DropdownMenuItem as-child @select="emit('addSection', 'grid')">
              <button type="button" class="yayaw-row-action-item"><LayoutGrid :size="16" aria-hidden="true" />{{ props.label("sectionGrid") }}</button>
            </DropdownMenuItem>
            <DropdownMenuItem as-child @select="emit('addSection', 'flow')">
              <button type="button" class="yayaw-row-action-item"><Rows3 :size="16" aria-hidden="true" />{{ props.label("sectionFlow") }}</button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <button v-if="props.history" type="button" class="yayaw-button yayaw-button-ghost" data-dashboard-history="" @click="emit('history')">
        <History :size="16" aria-hidden="true" />{{ props.label("history") }}
      </button>
      <button v-if="props.resettable" type="button" class="yayaw-button yayaw-button-ghost" data-dashboard-reset="" :disabled="busy" @click="emit('reset')">
        <Undo2 :size="16" aria-hidden="true" />{{ props.label("resetToDefault") }}
      </button>
      <button
        type="button"
        class="yayaw-button"
        :class="{ 'yayaw-button-outline': props.publishable }"
        data-dashboard-done=""
        :disabled="busy"
        @click="emit('done')"
      >
        <Check :size="16" aria-hidden="true" />{{ doneLabel }}
      </button>
      <button v-if="props.publishable" type="button" class="yayaw-button" data-dashboard-publish="" :disabled="busy" @click="emit('publish')">
        <Send :size="16" aria-hidden="true" />{{ props.publishing ? props.label("publishing") : props.label("publish") }}
      </button>
    </div>
  </section>
</template>
