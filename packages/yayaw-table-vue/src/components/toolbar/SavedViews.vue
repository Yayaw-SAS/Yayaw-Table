<script setup lang="ts">
import { Check, ChevronDown, LayoutList, Plus, Save, Trash2, Users } from "lucide-vue-next";
import {
  DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger,
} from "reka-ui";
import { computed, ref, useId } from "vue";
import { useSavedViews } from "../../composables/use-saved-views";
import type { TableView } from "../../types";
import FormDialog from "../forms/FormDialog.vue";

const props = defineProps<{ initialViews: TableView[] }>();
const {
  context, views, active, dirty, editable, busy, loading, loadError, error,
  dialogError, dialogOpen, name, shared, label, select, load, openSave, closeSave, save, update, remove,
} = useSavedViews(() => props.initialViews);
const menuOpen = ref(false);
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const nameInput = ref<HTMLInputElement>();
const returnFocus = ref<HTMLElement>();
const menuTheme = ref<Record<string, string>>({});
const nameId = useId();
const nameErrorId = useId();
const currentLabel = computed(() => active.value?.name ?? (context.state.activeViewId.value
  ? label("views.temporary_view", "temporaryView")
  : label("views.defaultView", "defaultView")));
const openDialog = (): void => {
  returnFocus.value = document.activeElement instanceof HTMLButtonElement ? document.activeElement : trigger.value;
  menuOpen.value = false;
  openSave();
};
const menuChanged = (open: boolean): void => {
  menuOpen.value = open;
  if (!open || !root.value) return;
  // The menu is teleported; preserve table-scoped theme tokens in the overlay.
  const style = getComputedStyle(root.value);
  menuTheme.value = Object.fromEntries([
    "background", "foreground", "muted", "muted-foreground", "border", "primary", "primary-foreground", "danger", "radius", "shadow",
  ].map(token => [`--yayaw-${token}`, style.getPropertyValue(`--yayaw-${token}`)]));
};
const focusName = (event: Event): void => {
  event.preventDefault();
  nameInput.value?.focus();
};
</script>

<template>
  <div ref="root" class="yayaw-view-manager">
    <div class="yayaw-views">
      <DropdownMenuRoot :open="menuOpen" :modal="false" @update:open="menuChanged">
        <DropdownMenuTrigger as-child>
          <button ref="trigger" type="button" class="yayaw-button yayaw-button-outline yayaw-view-trigger"
            :aria-label="`${label('views.current', 'currentView')}: ${currentLabel}`" :title="currentLabel" :disabled="loading || busy">
            <LayoutList :size="16" aria-hidden="true" />
            <span class="yayaw-view-name">{{ currentLabel }}</span>
            <ChevronDown :size="16" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="yayaw-view-menu" :style="menuTheme" align="start" :side-offset="4" :collision-padding="8"
            :aria-label="label('views.title', 'views')"
            @close-auto-focus="event => { if (dialogOpen) event.preventDefault(); }">
            <DropdownMenuGroup>
              <DropdownMenuLabel class="yayaw-view-menu-label">{{ label('views.title', 'views') }}</DropdownMenuLabel>
              <DropdownMenuItem class="yayaw-view-menu-item" :aria-current="!context.state.activeViewId.value ? 'true' : undefined" @select="select()">
                <Check :size="16" aria-hidden="true" :class="{ 'yayaw-view-check-hidden': context.state.activeViewId.value }" />
                {{ label('views.defaultView', 'defaultView') }}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator v-if="views.length" class="yayaw-view-menu-divider" />
            <DropdownMenuGroup v-if="views.length">
              <DropdownMenuItem v-for="view in views" :key="view.id" class="yayaw-view-menu-item" :aria-current="context.state.activeViewId.value === view.id ? 'true' : undefined" @select="select(view)">
                <Check :size="16" aria-hidden="true" :class="{ 'yayaw-view-check-hidden': context.state.activeViewId.value !== view.id }" />
                <span class="yayaw-view-name" :title="view.name">{{ view.name }}</span>
                <Users v-if="view.isGlobal" :size="14" :aria-label="label('views.dialog.save.global', 'shareView')" role="img" />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <template v-if="context.config.table.allowViewSave">
              <DropdownMenuSeparator class="yayaw-view-menu-divider" />
              <DropdownMenuGroup>
                <DropdownMenuItem class="yayaw-view-menu-item" @select="openDialog">
                  <Plus :size="16" aria-hidden="true" />{{ label('views.saveAs', 'saveViewAs') }}
                </DropdownMenuItem>
                <DropdownMenuItem v-if="editable" class="yayaw-view-menu-item yayaw-view-menu-danger" @select="remove">
                  <Trash2 :size="16" aria-hidden="true" />{{ label('views.delete', 'deleteView') }}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </template>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <template v-if="context.config.table.allowViewSave">
        <button type="button" class="yayaw-button yayaw-icon-only" :class="{ 'yayaw-button-outline': !dirty }"
          :disabled="loading || busy || !editable || !dirty" :aria-label="label('views.saveChanges', 'updateView')"
          :title="label('views.saveChangesTooltip', 'updateViewTooltip')" @click="update">
          <Save :size="16" aria-hidden="true" />
        </button>
        <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only" :disabled="loading || busy"
          :aria-label="label('views.add_view', 'addView')" :title="label('views.add_view', 'addView')" @click="openDialog">
          <Plus :size="16" aria-hidden="true" />
        </button>
      </template>
      <span v-if="dirty" class="yayaw-sr-only" role="status">{{ label('views.modified', 'viewModified') }}</span>
    </div>
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
