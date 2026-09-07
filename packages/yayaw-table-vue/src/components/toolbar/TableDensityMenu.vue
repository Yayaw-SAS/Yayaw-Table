<script setup lang="ts">
import TableTooltip from "./TableTooltip.vue";
import { Check, Rows3 } from "lucide-vue-next";
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "reka-ui";
import { computed } from "vue";
import { useTableContext } from "../../context";
import { isTableDensity, TABLE_DENSITY_OPTIONS } from "../../table-contracts";

const context = useTableContext();
const label = computed(() => String(context.translations.value.density ?? "Table density"));
const size = computed(() => TABLE_DENSITY_OPTIONS.find(
  (option) => option.value === context.state.density.value
)?.label);
const setDensity = (value: unknown): void => {
  if (isTableDensity(value)) {
    context.state.density.value = value;
  }
};
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <TableTooltip :label="`${label}: ${size}`">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="yayaw-button yayaw-button-outline yayaw-icon-only"
          :aria-label="`${label}: ${size}`"
        >
          <Rows3 :size="16" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
    </TableTooltip>
    <DropdownMenuPortal>
      <DropdownMenuContent class="yayaw-column-menu yayaw-density-menu" align="end" :side-offset="4" :aria-label="label">
        <DropdownMenuLabel class="yayaw-density-label">{{ label }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup :model-value="context.state.density.value" @update:model-value="setDensity">
          <DropdownMenuRadioItem
            v-for="option in TABLE_DENSITY_OPTIONS"
            :key="option.value"
            :value="option.value"
            class="yayaw-column-menu-item yayaw-density-option"
          >
            {{ option.label }}
            <DropdownMenuItemIndicator><Check :size="16" aria-hidden="true" /></DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
