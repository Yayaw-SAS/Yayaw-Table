<script setup lang="ts">
import type { FileTreeController } from "../filetree-controller";
import {
  type FileTreeLabelKey,
  type FileTreeVisibleRow,
  indentLevel,
} from "../filetree-model";
import FileTreeIcon from "./FileTreeIcon.vue";
import FileTreeNameInput from "./FileTreeNameInput.vue";

/** Loading, empty, error, "Show more" and new-folder rows. */
const props = defineProps<{
  controller: FileTreeController;
  row: Exclude<FileTreeVisibleRow, { type: "node" }>;
  label: (key: FileTreeLabelKey, params?: Record<string, string | number>) => string;
}>();
</script>

<template>
  <div
    class="yayaw-ft-row"
    role="row"
    :aria-level="props.row.level"
    :data-filetree-status="props.row.type"
    :data-filetree-id="props.row.type === 'more' ? props.row.id : undefined"
    :tabindex="props.row.type === 'more' ? -1 : undefined"
    :style="{ '--ft-level': indentLevel(props.row.level) }"
  >
    <div class="yayaw-ft-cell yayaw-ft-name yayaw-ft-status" role="gridcell" style="grid-column: 1 / -1">
      <span class="yayaw-ft-spacer" />
      <button
        v-if="props.row.type === 'more'"
        type="button"
        class="yayaw-ft-more"
        tabindex="-1"
        @click="props.controller.loadMore(props.row.parentId)"
      >
        {{ props.row.remaining ? props.label("showMore", { count: props.row.remaining }) : props.label("showMoreUnknown") }}
      </button>
      <template v-else-if="props.row.type === 'draft'">
        <span class="yayaw-ft-spacer" />
        <FileTreeIcon :icon="{ kind: 'folder' }" />
        <FileTreeNameInput
          :initial="props.label('newFolderName')"
          :label="props.label('folderName')"
          @cancel="props.controller.cancelCreateFolder()"
          @commit="(value) => props.controller.commitCreateFolder(value).catch(() => undefined)"
        />
      </template>
      <span v-else-if="props.row.type === 'error'" class="yayaw-ft-error">{{ props.row.message }}</span>
      <template v-else>{{ props.row.type === "loading" ? props.label("loading") : props.label("emptyFolder") }}</template>
    </div>
  </div>
</template>
