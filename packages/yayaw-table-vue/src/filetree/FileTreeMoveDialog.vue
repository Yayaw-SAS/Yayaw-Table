<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import { computed, ref, useId } from "vue";
import type { FileTreeController } from "../filetree-controller";
import type { FileTreeLabelKey } from "../filetree-model";
import FileTreeDialog from "./FileTreeDialog.vue";
import FileTreeIcon from "./FileTreeIcon.vue";

/** "Move to…": a searchable tree of folders; invalid targets say why. */
const props = defineProps<{
  controller: FileTreeController;
  ids: string[];
  label: (key: FileTreeLabelKey, params?: Record<string, string | number>) => string;
  version: number;
}>();
const emit = defineEmits<{ close: [] }>();
const titleId = `yayaw-ft-move-${useId()}`;
const query = ref("");
const first = props.ids[0];
const parent = first ? props.controller.parentOf(first) : null;
const expanded = ref(
  new Set<string>(
    parent
      ? props.controller.crumbs(parent).flatMap((crumb) => (crumb.id ? [crumb.id] : []))
      : []
  )
);
const target = ref<string | null | undefined>();
// `version` changes when folders load.
const rows = computed(() =>
  props.version >= 0 ? props.controller.folderRows(expanded.value, query.value) : []
);
const title = computed(() =>
  props.ids.length === 1
    ? props.label("moveOneDialogTitle", { name: props.controller.name(props.ids[0] ?? "") })
    : props.label("moveDialogTitle", { count: props.ids.length })
);
const reason = computed(() =>
  target.value === undefined ? undefined : props.controller.moveReason(props.ids, target.value)
);
const toggle = (id: string): void => {
  const next = new Set(expanded.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
    props.controller.ensureChildren(id);
  }
  expanded.value = next;
};
const moveTo = (id: string | null): void => {
  emit("close");
  props.controller.move(props.ids, id).catch(() => undefined);
};
const move = (): void => {
  if (target.value !== undefined && !reason.value) {
    moveTo(target.value);
  }
};
</script>

<template>
  <FileTreeDialog :labelled-by="titleId" @close="emit('close')">
    <h2 :id="titleId">{{ title }}</h2>
    <input
      v-model="query"
      type="search"
      class="yayaw-ft-dialog-search"
      :aria-label="props.label('searchFolders')"
      :placeholder="props.label('searchFolders')"
    />
    <ul class="yayaw-ft-folders" :aria-label="props.label('folders', { count: rows.length })">
      <li
        v-for="row in rows"
        :key="row.id ?? '__root'"
        class="yayaw-ft-folder"
        :style="{ '--ft-level': row.level }"
      >
        <button
          v-if="row.id !== null && row.hasChildren && !query"
          type="button"
          class="yayaw-ft-toggle"
          :data-expanded="row.expanded"
          :aria-label="props.label(row.expanded ? 'collapse' : 'expand')"
          @click="toggle(row.id ?? '')"
        >
          <ChevronRight aria-hidden="true" />
        </button>
        <span v-else class="yayaw-ft-spacer" />
        <button
          type="button"
          class="yayaw-ft-folder-button"
          :aria-pressed="target === row.id"
          :disabled="Boolean(props.controller.moveReason(props.ids, row.id))"
          :title="props.controller.moveReason(props.ids, row.id)"
          @click="target = row.id"
          @dblclick="!props.controller.moveReason(props.ids, row.id) && moveTo(row.id)"
        >
          <FileTreeIcon :icon="{ kind: 'folder' }" />
          <span>{{ row.name }}<small v-if="row.path"> · {{ row.path }}</small></span>
        </button>
      </li>
    </ul>
    <footer>
      <span v-if="reason" class="yayaw-ft-error">{{ reason }}</span>
      <button type="button" class="yayaw-ft-button" @click="emit('close')">{{ props.label("cancel") }}</button>
      <button
        type="button"
        class="yayaw-ft-button"
        data-variant="primary"
        :disabled="target === undefined || Boolean(reason)"
        @click="move"
      >
        {{ props.label("moveHere") }}
      </button>
    </footer>
  </FileTreeDialog>
</template>
