<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from "reka-ui";
import { ref } from "vue";

const props = defineProps<{ src: string; alt: string; editable?: boolean }>();
defineEmits<{ error: [] }>();
const open = ref(false);
function preview(event: MouseEvent) {
  if (props.editable) return;
  event.stopPropagation();
  open.value = true;
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <TooltipRoot v-model:open="open" :disable-closing-trigger="!editable">
      <TooltipTrigger :as="editable ? 'span' : 'button'" :type="editable ? undefined : 'button'" class="yayaw-cell-image-trigger" data-image-preview-trigger="" @click="preview">
        <img
          :src="src"
          :alt="alt"
          class="yayaw-cell-image"
          loading="lazy"
          @error="$emit('error')"
        />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent class="yayaw-image-preview" data-image-preview="" side="right" :side-offset="4" :collision-padding="8">
          <img :src="src" :alt="alt" width="288" height="256" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
