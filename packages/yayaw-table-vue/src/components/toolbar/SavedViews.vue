<script setup lang="ts">
import TableTooltip from "./TableTooltip.vue";
import { Check, ChevronDown, LayoutList, CopyPlus, ListRestart, Save, Star, Trash2, Users } from "lucide-vue-next";
import ToolbarMenu from "./ToolbarMenu.vue";
import { areViewSettingsEqual } from "../../view-menu";
import { computed, ref, useId, watch } from "vue";
import { useSavedViews } from "../../composables/use-saved-views";
import type { TableView } from "../../types";
import FormDialog from "../forms/FormDialog.vue";

const props = defineProps<{ initialViews: TableView[]; enabled?: boolean; compact?: boolean; open?: boolean; panel?: boolean; panelTitle?: string }>();
const emit = defineEmits<{ "update:open": [open: boolean]; back: [] }>();
const {
  context, views, active, dirty, editable, busy, loading, loadError, error,
  dialogError, dialogOpen, name, shared, label, select, load, openSave, closeSave, save, update, remove,
  favorite, favoriteViewId, toggleFavorite,
} = useSavedViews(() => props.initialViews, () => props.enabled !== false);
const menuOpen = ref(false);
const trigger = ref<HTMLButtonElement>();
const nameInput = ref<HTMLInputElement>();
const returnFocus = ref<HTMLElement>();
watch(() => props.open, (open) => { if (open !== undefined) menuOpen.value = open; });
const viewEnabled = computed(() => props.enabled !== false);
const resetDisabled = computed(() => busy.value || (active.value ? !dirty.value : areViewSettingsEqual(context.state.resolveView(context.state.snapshot.value), context.state.resolveView({}))));
const resetView = () => {
  if (resetDisabled.value) return;
  if (active.value) context.state.applyView(active.value.config, active.value.id);
  else context.state.reset();
};
const nameId = useId();
const nameErrorId = useId();
const favoriteLabel = computed(() => {
  if (!favorite.value) return label("views.setFavorite", "setFavoriteView");
  return active.value
    ? label("views.removeFavorite", "removeFavoriteView")
    : label("views.favorite", "favoriteView");
});
const currentLabel = computed(() => active.value?.name ?? (context.state.activeViewId.value
  ? label("views.temporary_view", "temporaryView")
  : label("views.defaultView", "defaultView")));
const openDialog = (): void => {
  returnFocus.value = trigger.value;
  menuChanged(false);
  openSave();
};
const menuChanged = (open: boolean): void => { menuOpen.value = open; emit("update:open", open); };
const selectView = (view?: TableView) => { select(view); menuChanged(false); };
const focusName = (event: Event): void => {
  event.preventDefault();
  nameInput.value?.focus();
};
</script>

<template>
  <div class="yayaw-view-manager">
    <ToolbarMenu :open="menuOpen" :compact="compact" :title="panel ? (panelTitle ?? '') : label('views.settings', 'views')" :back="panel"
      :back-label="label('back', 'back')" :close-label="label('views.close', 'close')" @back="emit('back')" @update:open="menuChanged">
      <template #trigger>
        <button ref="trigger" type="button" class="yayaw-button yayaw-button-outline yayaw-view-trigger" :id="`table-options-${context.config.id}`"
          :aria-label="viewEnabled ? `${label('views.current', 'currentView')}: ${currentLabel}` : label('views.settings', 'views')" :disabled="viewEnabled && (loading || busy)">
          <LayoutList :size="16" aria-hidden="true" /><span class="yayaw-view-name">{{ viewEnabled ? currentLabel : label('views.view', 'views') }}</span>
          <span v-if="viewEnabled && dirty" class="yayaw-view-dirty" role="status" :aria-label="label('views.modified', 'viewModified')" />
          <ChevronDown :size="12" aria-hidden="true" />
        </button>
      </template>
      <slot v-if="panel" name="panel" />
      <template v-else>
        <div v-if="viewEnabled" class="yayaw-view-selection">
          <button type="button" class="yayaw-view-menu-item" :aria-current="!context.state.activeViewId.value ? 'true' : undefined" :disabled="busy" @click="selectView()">
            <Check :size="16" aria-hidden="true" :class="{ 'yayaw-view-check-hidden': context.state.activeViewId.value }" />
            <span class="yayaw-view-name">{{ label('views.defaultView', 'defaultView') }}</span>
            <Star v-if="favoriteViewId === null" :size="14" fill="currentColor" role="img" :aria-label="label('views.favorite', 'favoriteView')" />
          </button>
          <button v-for="view in views" :key="view.id" type="button" class="yayaw-view-menu-item" :aria-current="context.state.activeViewId.value === view.id ? 'true' : undefined" :disabled="busy" @click="selectView(view)">
            <Check :size="16" aria-hidden="true" :class="{ 'yayaw-view-check-hidden': context.state.activeViewId.value !== view.id }" />
            <span class="yayaw-view-name" :title="view.name">{{ view.name }}</span>
            <Star v-if="view.id === favoriteViewId" :size="14" fill="currentColor" role="img" :aria-label="label('views.favorite', 'favoriteView')" />
            <Users v-if="view.isGlobal" :size="14" :aria-label="label('views.dialog.save.global', 'shareView')" />
          </button>
        </div>
        <slot name="settings" />
        <div class="yayaw-view-write-actions">
          <TableTooltip v-if="viewEnabled && active && context.config.table.allowViewSave" :label="!editable ? label('views.readOnly', 'views.readOnly') : !dirty ? label('views.upToDate', 'views.upToDate') : label('views.saveChangesTooltip', 'updateViewTooltip')">
            <button type="button" class="yayaw-view-menu-item" :aria-label="label('views.saveChanges', 'updateView')" :aria-disabled="busy || !editable || !dirty" @click="!busy && editable && dirty && update()">
              <Save :size="16" aria-hidden="true" /><span>{{ label('views.saveChanges', 'updateView') }}
                <small v-if="compact && (!editable || !dirty)">{{ label(!editable ? 'views.readOnly' : 'views.upToDate', !editable ? 'views.readOnly' : 'views.upToDate') }}</small>
              </span>
            </button>
          </TableTooltip>
          <button v-if="viewEnabled && context.config.table.allowViewSave" type="button" class="yayaw-view-menu-item" :aria-label="active ? label('views.saveAs', 'saveViewAs') : label('views.saveCurrent', 'saveView')" :disabled="busy" @click="openDialog">
            <CopyPlus :size="16" aria-hidden="true" />{{ active ? label('views.saveAs', 'saveViewAs') : label('views.saveCurrent', 'saveView') }}
          </button>
          <button v-if="viewEnabled && (active || !context.state.activeViewId.value)" type="button" class="yayaw-view-menu-item" :disabled="busy || loading" :aria-label="favoriteLabel" :aria-pressed="favorite" @click="toggleFavorite">
            <Star :size="16" aria-hidden="true" />{{ favoriteLabel }}
          </button>
          <TableTooltip :label="label(active ? 'views.resetSavedDescription' : 'views.resetDefaultDescription', 'reset')">
            <button type="button" class="yayaw-view-menu-item" :aria-label="label('views.reset', 'reset')" :aria-disabled="resetDisabled" @click="resetView">
              <ListRestart :size="16" aria-hidden="true" /><span>{{ label('views.reset', 'reset') }}<small v-if="compact">{{ label(active ? 'views.resetSavedDescription' : 'views.resetDefaultDescription', 'reset') }}</small></span>
            </button>
          </TableTooltip>
          <button v-if="viewEnabled && editable" type="button" class="yayaw-view-menu-item yayaw-view-menu-danger" :disabled="busy" @click="remove"><Trash2 :size="16" aria-hidden="true" />{{ label('views.delete', 'deleteView') }}</button>
        </div>
      </template>
    </ToolbarMenu>
    <div v-if="loadError" class="yayaw-view-error" role="alert">
      {{ loadError }}
      <button type="button" class="yayaw-button yayaw-button-ghost" :disabled="loading" @click="load">{{ label('views.retry', 'retry') }}</button>
    </div>
    <p v-if="error" class="yayaw-view-error" role="alert">{{ error }}</p>
    <FormDialog v-if="dialogOpen" :open="dialogOpen" presentation="modal" width="min(512px, 94vw)"
      :title="label('views.dialog.save.title', 'saveView')" :description="label('views.dialog.save.description', 'saveViewDescription')"
      :close-label="label('views.close', 'close')" :busy="busy" :return-focus="returnFocus"
      @open-auto-focus="focusName" @close="closeSave">
      <form class="yayaw-view-form" @submit.prevent="save">
        <div class="yayaw-view-field">
          <label :for="nameId">{{ label('views.dialog.save.name', 'viewName') }}</label>
          <input :id="nameId" ref="nameInput" v-model="name" class="yayaw-input" :disabled="busy"
            :placeholder="label('views.dialog.save.namePlaceholder', 'viewNamePlaceholder')"
            :aria-invalid="Boolean(dialogError)" :aria-describedby="dialogError ? nameErrorId : undefined" />
          <p v-if="dialogError" :id="nameErrorId" class="yayaw-view-error" role="alert">{{ dialogError }}</p>
        </div>
        <label v-if="context.config.table.allowViewSharing" class="yayaw-view-share">
          <input v-model="shared" type="checkbox" :disabled="busy" />{{ label('views.dialog.save.global', 'shareView') }}
        </label>
        <footer class="yayaw-view-form-footer">
          <button type="button" class="yayaw-button yayaw-button-outline" :disabled="busy" @click="closeSave">{{ label('actions.cancel', 'cancel') }}</button>
          <button type="submit" class="yayaw-button" :disabled="busy">{{ busy ? label('views.dialog.save.saving', 'savingView') : label('views.dialog.save.save', 'save') }}</button>
        </footer>
      </form>
    </FormDialog>
  </div>
</template>
