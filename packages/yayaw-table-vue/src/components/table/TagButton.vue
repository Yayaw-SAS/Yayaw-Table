<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator } from "reka-ui";
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch, type Component } from "vue";
import { useOverlayTheme } from "../../composables/use-overlay-theme";
import { useTableContext } from "../../context";
import { resolveTagActions, tagActionMenuZIndex, type TagActionDefinition, type TagItem, type tagItemAppearance } from "../../tag-items";
import type { TableRecord } from "../../types";

const props = defineProps<{
  value: unknown;
  row: TableRecord;
  appearance: TagItem<Component> & ReturnType<typeof tagItemAppearance> & { label: string };
  actions?: TagActionDefinition<TableRecord, Component>[];
  onTagClick?: (value: unknown, row: TableRecord) => unknown;
}>();
const context = useTableContext();
const trigger = useTemplateRef<HTMLElement>("trigger");
const triggerId = useId();
const menuId = useId();
const menuOpen = ref(false);
const portalTarget = ref<HTMLElement>();
const { overlayStyle, updateOpen } = useOverlayTheme(trigger);
const actions = computed(() => resolveTagActions(props.actions, props.value, props.row));
const interactive = computed(() => Boolean(props.onTagClick || actions.value.length));
const interactedOutside = ref(false);
let selectedAction: (typeof actions.value)[number] | undefined;
let longPressTimer: ReturnType<typeof setTimeout> | undefined;
let touchOrigin: { x: number; y: number } | undefined;
let suppressClick = false;

const cancelLongPress = () => {
  clearTimeout(longPressTimer);
  touchOrigin = undefined;
};
onBeforeUnmount(cancelLongPress);
const changeOpen = (open: boolean) => {
  menuOpen.value = open && actions.value.length > 0;
  if (menuOpen.value) interactedOutside.value = false;
  updateOpen(menuOpen.value);
  if (!menuOpen.value) return;
  // Native dialogs require their portal in the browser's top layer; other surfaces use body to escape clipping.
  portalTarget.value = trigger.value?.closest<HTMLElement>("dialog[open]") ?? undefined;
  overlayStyle.value.zIndex = String(tagActionMenuZIndex(trigger.value, 90));
};
watch(() => actions.value.length, (length) => {
  if (length) return;
  cancelLongPress();
  changeOpen(false);
});
const stop = (event: Event) => event.stopPropagation();
const click = (event: MouseEvent) => {
  stop(event);
  if (suppressClick || event.ctrlKey || event.button !== 0) {
    event.preventDefault();
    suppressClick = false;
    return;
  }
  if (props.onTagClick) props.onTagClick(props.value, props.row);
  else changeOpen(!menuOpen.value);
};
const keydown = (event: KeyboardEvent) => {
  stop(event);
  suppressClick = false;
  if (!actions.value.length) return;
  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10") || (!props.onTagClick && ["Enter", " ", "ArrowDown"].includes(event.key))) {
    event.preventDefault();
    changeOpen(true);
  }
};
const contextmenu = (event: MouseEvent) => {
  if (!actions.value.length) return;
  stop(event);
  event.preventDefault();
  cancelLongPress();
  changeOpen(true);
};
const pointerdown = (event: PointerEvent) => {
  stop(event);
  cancelLongPress();
  suppressClick = false;
  if (event.pointerType !== "touch" || !actions.value.length) return;
  touchOrigin = { x: event.clientX, y: event.clientY };
  longPressTimer = setTimeout(() => {
    suppressClick = true;
    changeOpen(true);
  }, 500);
};
const pointermove = (event: PointerEvent) => {
  if (touchOrigin && Math.hypot(event.clientX - touchOrigin.x, event.clientY - touchOrigin.y) > 10) cancelLongPress();
};
const listeners = computed(() => interactive.value ? {
  click, keydown, keyup: stop, dblclick: stop, pointerdown, pointermove,
  pointerup: cancelLongPress, pointercancel: cancelLongPress, pointerleave: cancelLongPress,
  mousedown: stop, contextmenu,
  dragstart: (event: Event) => { stop(event); event.preventDefault(); },
} : {});
const select = (action: (typeof actions.value)[number]) => {
  if (action.disabled) return;
  selectedAction = action;
  changeOpen(false);
};
const menuKeydown = (event: KeyboardEvent) => {
  stop(event);
  // Reka's document listener cannot receive Escape after propagation is stopped.
  if (event.key === "Escape") { event.preventDefault(); changeOpen(false); }
};
const interactOutside = (event: Event) => {
  if (trigger.value?.contains(event.target as Node)) event.preventDefault();
  else interactedOutside.value = true;
};
const closeAutoFocus = (event: Event) => {
  event.preventDefault();
  if (!interactedOutside.value) trigger.value?.focus();
  const action = selectedAction;
  selectedAction = undefined;
  if (!action) return;
  // The menu must finish restoring focus before the callback opens a dialog.
  nextTick(async () => {
    try { await action.run(); }
    catch (error) { context.status.value = { type: "error", message: error instanceof Error ? error.message : String(error) }; }
  });
};
</script>

<template>
  <component :is="interactive ? 'button' : 'span'" :id="triggerId" ref="trigger"
    :type="interactive ? 'button' : undefined" class="yayaw-tag" :class="appearance.className"
    :style="appearance.style" :title="appearance.title" :data-colored="appearance.colored"
    :data-custom-color="appearance.className ? '' : undefined" :data-tag-button="interactive ? '' : undefined"
    :aria-haspopup="actions.length ? 'menu' : undefined" :aria-expanded="actions.length ? menuOpen : undefined"
    :aria-controls="menuOpen ? menuId : undefined" v-on="listeners">
    <component :is="appearance.icon" v-if="appearance.icon" aria-hidden="true" />{{ appearance.label }}
  </component>
  <DropdownMenuRoot v-if="actions.length" :open="menuOpen" :modal="false" @update:open="changeOpen">
    <DropdownMenuPortal :to="portalTarget ?? 'body'">
      <DropdownMenuContent :id="menuId" :aria-labelledby="triggerId" :reference="trigger ?? undefined"
        class="yayaw-row-actions-menu" :style="overlayStyle" align="start" :side-offset="4" :collision-padding="8"
        @click.stop @dblclick.stop @pointerdown.stop @mousedown.stop @keydown="menuKeydown" @keyup.stop @contextmenu.stop.prevent @dragstart.stop.prevent
        @interact-outside="interactOutside" @close-auto-focus="closeAutoFocus">
        <template v-for="(action, index) in actions" :key="action.id">
          <DropdownMenuSeparator v-if="action.destructive && index > 0 && !actions[index - 1]?.destructive" class="yayaw-row-actions-divider" />
          <DropdownMenuItem as-child :disabled="action.disabled" @select="select(action)">
            <button type="button" class="yayaw-row-action-item" :class="{ 'yayaw-row-action-danger': action.destructive }" :disabled="action.disabled">
              <component :is="action.icon" v-if="action.icon" :size="16" aria-hidden="true" />{{ action.label }}
            </button>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
