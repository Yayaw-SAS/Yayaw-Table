<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger, useForwardExpose } from "reka-ui";

defineOptions({ inheritAttrs: false });
defineProps<{ label?: string }>();
// Expose the actual trigger to preserve composed menu anchors and events.
const { forwardRef } = useForwardExpose();
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <TooltipRoot :disabled="!label">
      <TooltipTrigger :ref="forwardRef" data-slot="tooltip-trigger" as-child v-bind="$attrs"><slot /></TooltipTrigger>
      <TooltipPortal>
        <TooltipContent data-slot="tooltip-content" class="yayaw-tooltip" side="top" :side-offset="4" :collision-padding="8">
          {{ label }}
          <TooltipArrow class="yayaw-tooltip-arrow" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
