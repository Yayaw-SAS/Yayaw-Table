<script setup lang="ts">
import { Folder, FolderRoot } from "lucide-vue-next";
import { computed, ref } from "vue";
import { facetKeyTarget } from "../../facets-model";
import {
  type FolderDirectory,
  type FolderEntry,
  folderLocationText,
  searchFolders,
} from "../../folder-directory";

/**
 * A searchable list of the table's folders with their locations, the root
 * first: the parent of a new folder, or the folders a filter keeps.
 */
const props = defineProps<{
  directory?: FolderDirectory;
  loading: boolean;
  label: string;
  searchLabel: string;
  loadingLabel: string;
  emptyLabel: string;
  rootLabel: string;
  selected: (id: string | null) => boolean;
  /** Folders that cannot be picked (`null` is the root). */
  disabled?: (entry: FolderEntry | null) => boolean;
}>();
const emit = defineEmits<{ pick: [id: string | null] }>();
const query = ref("");
const searching = computed(() => query.value.trim().length > 0);
const folders = computed(() => searchFolders(props.directory, query.value));
const options = computed<(FolderEntry | null)[]>(() =>
  searching.value ? folders.value : [null, ...folders.value]
);
const moveFocus = (event: KeyboardEvent, index: number): void => {
  const buttons = [
    ...((event.currentTarget as HTMLElement)
      .closest("[data-folder-options]")
      ?.querySelectorAll<HTMLButtonElement>("button[data-folder-option]") ?? []),
  ];
  const target = facetKeyTarget(event.key, index, buttons.length);
  if (target !== undefined) {
    event.preventDefault();
    buttons[target]?.focus();
  }
};
</script>

<template>
  <div class="yayaw-folder-picker" data-folder-picker="">
    <input v-model="query" type="search" class="yayaw-input" data-folder-search="" :aria-label="props.searchLabel" :placeholder="props.searchLabel" />
    <ul class="yayaw-folder-options" data-folder-options="" :aria-label="props.label">
      <li v-for="(entry, index) in options" :key="entry?.id ?? '__root'">
        <button
          type="button"
          class="yayaw-folder-option"
          :aria-pressed="props.selected(entry?.id ?? null)"
          :data-folder-option="entry?.id ?? ''"
          :data-folder-root="entry ? undefined : ''"
          :disabled="props.disabled?.(entry) ?? false"
          :style="searching || !entry ? undefined : { paddingInlineStart: `${0.5 + entry.depth}rem` }"
          @click="emit('pick', entry?.id ?? null)"
          @keydown="moveFocus($event, index)"
        >
          <Folder v-if="entry" :size="16" aria-hidden="true" />
          <FolderRoot v-else :size="16" aria-hidden="true" />
          <span class="yayaw-folder-option-label">
            <span>{{ entry?.name ?? props.rootLabel }}</span>
            <small v-if="entry">{{ folderLocationText(entry, props.rootLabel) }}</small>
          </span>
        </button>
      </li>
    </ul>
    <p v-if="props.loading" class="yayaw-help">{{ props.loadingLabel }}</p>
    <p v-if="!props.loading && searching && !folders.length" class="yayaw-help">{{ props.emptyLabel }}</p>
  </div>
</template>
