<!-- shadcn-vue Questionnaire (https://www.shadcn-vue.com/docs/components/questionnaire), vendored: behaviour unchanged, styled with the registry's CSS classes. -->
<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { ComponentPublicInstance, HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { onBeforeUnmount, onMounted, ref, useId } from "vue"
import { injectQuestionnaireItemContext } from "./useQuestionnaire"

const props = withDefaults(defineProps<PrimitiveProps & {
  class?: HTMLAttributes["class"]
  id?: string
}>(), {
  as: "legend",
})

const item = injectQuestionnaireItemContext()

const primitiveRef = ref<ComponentPublicInstance | null>(null)
const fallbackId = props.id ?? useId()

let unregisterTitle: (() => void) | null = null

onMounted(() => {
  const element = primitiveRef.value?.$el as HTMLElement | undefined

  // A legend already names the fieldset. Anything else, for example a
  // DialogTitle rendered through `as-child`, has to name it explicitly.
  if (!element || element.tagName === "LEGEND") {
    return
  }

  if (!element.id) {
    element.id = fallbackId
  }

  unregisterTitle = item.registerTitle(element.id)
})

onBeforeUnmount(() => unregisterTitle?.())
</script>

<template>
  <Primitive
    v-bind="props.id ? { id: props.id } : {}"
    ref="primitiveRef"
    data-slot="questionnaire-title"
    :as="props.as"
    :as-child="props.asChild"
    :class="['yayaw-questionnaire-title', props.class]"
  >
    <slot />
  </Primitive>
</template>
