<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from "reka-ui";

defineProps<{ label?: string }>();
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <TooltipRoot :disabled="!label">
      <TooltipTrigger as-child><slot /></TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="yayaw-tooltip" side="top" :side-offset="4" :collision-padding="8">
          {{ label }}
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
