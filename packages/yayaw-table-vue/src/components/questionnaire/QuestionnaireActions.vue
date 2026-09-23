<!-- shadcn-vue Questionnaire (https://www.shadcn-vue.com/docs/components/questionnaire), vendored: behaviour unchanged, styled with the registry's CSS classes. -->
<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"

const props = withDefaults(defineProps<PrimitiveProps & {
  class?: HTMLAttributes["class"]
}>(), {
  as: "div",
})
</script>

<template>
  <Primitive
    data-slot="questionnaire-actions"
    :as="props.as"
    :as-child="props.asChild"
    :class="['yayaw-questionnaire-actions', props.class]"
  >
    <slot />
  </Primitive>
</template>
