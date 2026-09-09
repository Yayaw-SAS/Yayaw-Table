<script setup lang="ts">
import { Check, SlidersHorizontal } from "lucide-vue-next";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "reka-ui";
import { useTemplateRef } from "vue";
import { useOverlayTheme } from "../../composables/use-overlay-theme";

defineProps<{
  label: string;
  showLabelsLabel: string;
  options: { value: string; label: string }[];
}>();
const properties = defineModel<string[]>({ required: true });
const showLabels = defineModel<boolean>("showLabels", { required: true });
const anchor = useTemplateRef<HTMLElement>("anchor");
const { overlayStyle, updateOpen } = useOverlayTheme(anchor);
const toggle = (id: string, checked: boolean | "indeterminate"): void => {
  properties.value = checked === true
    ? [...properties.value.filter((value) => value !== id), id]
    : properties.value.filter((value) => value !== id);
};
</script>

<template>
  <div ref="anchor" class="yayaw-card-properties-control">
    <DropdownMenuRoot :modal="false" @update:open="updateOpen">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="yayaw-button yayaw-button-outline yayaw-card-control-button"
          :aria-label="label"
        >
          <SlidersHorizontal :size="16" aria-hidden="true" />
          {{ label }}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          class="yayaw-column-menu yayaw-card-properties-menu"
          :style="overlayStyle"
          align="start"
          :side-offset="4"
          :collision-padding="8"
          :aria-label="label"
        >
          <DropdownMenuLabel class="yayaw-control-menu-label">{{ label }}</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuCheckboxItem
              v-for="option in options"
              :key="option.value"
              :model-value="properties.includes(option.value)"
              class="yayaw-column-menu-item yayaw-control-check-item"
              @update:model-value="toggle(option.value, $event)"
              @select.prevent
            >
              <DropdownMenuItemIndicator class="yayaw-control-indicator">
                <Check :size="16" aria-hidden="true" />
              </DropdownMenuItemIndicator>
              {{ option.label }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator class="yayaw-column-menu-divider" />
          <DropdownMenuCheckboxItem
            :model-value="showLabels"
            class="yayaw-column-menu-item yayaw-control-check-item"
            @update:model-value="showLabels = $event === true"
            @select.prevent
          >
            <DropdownMenuItemIndicator class="yayaw-control-indicator">
              <Check :size="16" aria-hidden="true" />
            </DropdownMenuItemIndicator>
            {{ showLabelsLabel }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
