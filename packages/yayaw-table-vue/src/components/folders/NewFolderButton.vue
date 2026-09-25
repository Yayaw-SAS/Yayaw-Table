<script setup lang="ts">
import { FolderPlus, X } from "lucide-vue-next";
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";
import { computed, nextTick, ref, useId } from "vue";
import { fileTreeHooksOf } from "../../composables/use-folder-directory";
import { useTableContext } from "../../context";
import { type FileTreeLabelKey, fileTreeLabel } from "../../filetree-model";
import {
  canCreateFolderUnder,
  createFolderRecord,
  defaultNewFolderParent,
  type FolderCreation,
  folderTableOptions,
  newFolderName,
  newFolderShownIn,
  rootFolderLabel,
} from "../../folder-directory";
import { formSubmitResultFrom } from "../../form-view";
import TableTooltip from "../toolbar/TableTooltip.vue";
import FolderPicker from "./FolderPicker.vue";

/**
 * "New folder" in the toolbar of the views other than the File tree, for
 * tables whose rows form a file tree and that can create folders
 * (`actions.tree.createFolder`, else `create`), unless
 * `table.filetree.newFolderAction` is false. The parent is picked in a
 * searchable list of the table's folders; the name follows the File tree's
 * rule (trimmed, else "New folder") and the host's errors stay in the dialog.
 */
const props = defineProps<{ compact: boolean; actionsAsIcons: boolean }>();
const context = useTableContext();
const nameId = useId();
const translate = (key: string, fallback: string): string => {
  const value = context.translations.value[`filetree.${key}`];
  return typeof value === "string" ? value : fallback;
};
const label = (key: FileTreeLabelKey, params?: Record<string, number | string>): string =>
  fileTreeLabel(key, context.locale, translate, params);
const tree = context.folders.tree;
const creation = computed<FolderCreation>(() => {
  const create = context.actions.value?.create;
  const canCreate = context.config.table.allowCreate !== false && Boolean(create);
  return {
    tree: context.actions.value?.tree,
    canCreate,
    createRecord: create
      ? async (values) => {
          const result = formSubmitResultFrom(await create(values as never));
          return result.ok ? { success: true } : { success: false, error: result.message };
        }
      : undefined,
    hooks: fileTreeHooksOf(context.config.table.filetree),
  };
});
const available = computed(
  () =>
    Boolean(tree) &&
    folderTableOptions(context.config.table.filetree).newFolderAction &&
    newFolderShownIn(context.state.displayMode.value) &&
    Boolean(creation.value.tree?.createFolder ?? (creation.value.canCreate && creation.value.createRecord))
);
const open = ref(false);
const name = ref("");
const parent = ref<string | null>(null);
const error = ref<string>();
const busy = ref(false);
const input = ref<HTMLInputElement>();
const start = async (): Promise<void> => {
  name.value = label("newFolderName");
  parent.value = tree ? defaultNewFolderParent(context.state.advancedFilters.value, tree.parentColumn) : null;
  error.value = undefined;
  context.folders.use();
  open.value = true;
  await nextTick();
  input.value?.select();
};
const submit = async (): Promise<void> => {
  if (!tree || busy.value) return;
  const folderName = newFolderName(name.value, context.locale, translate);
  busy.value = true;
  error.value = undefined;
  try {
    await createFolderRecord({ ...creation.value, settings: tree, parentId: parent.value, name: folderName, failure: label("createFailed") });
    context.status.value = { type: "success", message: label("created", { name: folderName }) };
    open.value = false;
    await context.refresh();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : label("createFailed");
  } finally {
    busy.value = false;
  }
};
const iconOnly = computed(() => props.compact || props.actionsAsIcons);
</script>

<template>
  <template v-if="available">
    <TableTooltip :label="iconOnly ? label('newFolder') : undefined">
      <button type="button" class="yayaw-button yayaw-button-outline" :class="{ 'yayaw-icon-only': iconOnly }" data-new-folder="" :aria-label="iconOnly ? label('newFolder') : undefined" @click="start">
        <FolderPlus :size="16" aria-hidden="true" />
        <span v-if="!iconOnly">{{ label("newFolder") }}</span>
      </button>
    </TableTooltip>
    <DialogRoot v-model:open="open">
      <DialogPortal>
        <DialogOverlay class="yayaw-folder-dialog-backdrop" />
        <DialogContent class="yayaw-folder-dialog" data-new-folder-dialog="" :aria-describedby="undefined">
          <DialogTitle as="h2">{{ label("newFolder") }}</DialogTitle>
          <DialogClose class="yayaw-icon-button yayaw-folder-dialog-close" :aria-label="label('close')"><X :size="16" aria-hidden="true" /></DialogClose>
          <form class="yayaw-folder-form" @submit.prevent="submit">
            <div class="yayaw-folder-field">
              <label :for="nameId">{{ label("folderName") }}</label>
              <input :id="nameId" ref="input" v-model="name" class="yayaw-input" data-new-folder-name="" :aria-invalid="error ? true : undefined" />
            </div>
            <fieldset class="yayaw-folder-field">
              <legend>{{ label("parentFolder") }}</legend>
              <FolderPicker
                :directory="context.folders.directory.value"
                :loading="context.folders.loading.value"
                :label="label('parentFolder')"
                :search-label="label('searchFolders')"
                :loading-label="label('loading')"
                :empty-label="label('noFolders')"
                :root-label="rootFolderLabel(context.locale, translate)"
                :selected="(id) => id === parent"
                :disabled="(entry) => !canCreateFolderUnder(entry?.row ?? null, creation)"
                @pick="parent = $event"
              />
            </fieldset>
            <p v-if="error" class="yayaw-folder-error" role="alert">{{ error }}</p>
            <footer class="yayaw-folder-dialog-footer">
              <button type="button" class="yayaw-button yayaw-button-outline" @click="open = false">{{ label("cancel") }}</button>
              <button type="submit" class="yayaw-button" data-new-folder-create="" :disabled="busy">{{ label("create") }}</button>
            </footer>
          </form>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </template>
</template>
