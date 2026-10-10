<script setup lang="ts">
import { onBeforeUnmount, ref, type Component } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { useTableContext } from "../../context";
import type { ResolvedCellAction } from "../../cell-actions";
import TableTooltip from "../toolbar/TableTooltip.vue";

const COPIED_FEEDBACK_MS = 1500;

/** Resolved by CellRenderer, which only mounts this when there is one. */
defineProps<{ actions: ResolvedCellAction<Component>[] }>();
const context = useTableContext();
const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(copiedTimer));

const label = (action: ResolvedCellAction<Component>) =>
  action.copyText !== undefined && copied.value
    ? String(context.translations.value.copied ?? "Copied")
    : action.label;
const icon = (action: ResolvedCellAction<Component>) => {
  if (action.copyText === undefined) return action.icon;
  return copied.value ? Check : Copy;
};

async function run(action: ResolvedCellAction<Component>) {
  // aria-disabled keeps the click here, where it is ignored, instead of on the row.
  if (action.disabled) return;
  if (action.copyText === undefined) {
    await action.run?.();
    return;
  }
  await navigator.clipboard.writeText(action.copyText);
  copied.value = true;
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copied.value = false;
  }, COPIED_FEEDBACK_MS);
}
</script>

<template>
  <!-- Actions keep their clicks: no row click, no inline edit, no drag. -->
  <span
    class="yayaw-cell-actions"
    data-cell-actions=""
    @click.stop
    @dblclick.stop
    @pointerdown.stop
    @keydown.stop
  >
    <TableTooltip v-for="action in actions" :key="action.id" :label="label(action)">
      <a
        v-if="action.href"
        class="yayaw-cell-action"
        :data-cell-action="action.id"
        :data-reveal="action.reveal"
        :data-icon-only="icon(action) && action.count === undefined ? '' : undefined"
        :href="action.href"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="label(action)"
      >
        <component :is="icon(action)" v-if="icon(action)" aria-hidden="true" />
        <span v-else>{{ action.label }}</span>
        <span v-if="action.count !== undefined" class="yayaw-cell-action-count">{{ action.count }}</span>
      </a>
      <button
        v-else
        type="button"
        class="yayaw-cell-action"
        :data-cell-action="action.id"
        :data-reveal="action.reveal"
        :data-icon-only="icon(action) && action.count === undefined ? '' : undefined"
        :aria-disabled="action.disabled || undefined"
        :aria-label="label(action)"
        @click="run(action)"
      >
        <component :is="icon(action)" v-if="icon(action)" aria-hidden="true" />
        <span v-else>{{ action.label }}</span>
        <span v-if="action.count !== undefined" class="yayaw-cell-action-count">{{ action.count }}</span>
      </button>
    </TableTooltip>
  </span>
</template>
