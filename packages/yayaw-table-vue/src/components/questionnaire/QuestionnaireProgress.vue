<!-- shadcn-vue Questionnaire (https://www.shadcn-vue.com/docs/components/questionnaire), vendored: behaviour unchanged, styled with the registry's CSS classes. -->
<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { computed } from "vue"
import { injectQuestionnaireRootContext } from "./useQuestionnaire"

const props = withDefaults(defineProps<PrimitiveProps & {
  class?: HTMLAttributes["class"]
}>(), {
  as: "div",
})

const root = injectQuestionnaireRootContext()

const label = computed(() =>
  root.total.value ? `Question ${root.current.value} of ${root.total.value}` : undefined)
</script>

<template>
  <Primitive
    aria-label="Questionnaire progress"
    aria-live="polite"
    data-slot="questionnaire-progress"
    role="progressbar"
    :aria-valuemax="root.total.value || undefined"
    :aria-valuemin="root.total.value ? 1 : undefined"
    :aria-valuenow="root.total.value ? root.current.value : undefined"
    :aria-valuetext="label"
    :as="props.as"
    :as-child="props.asChild"
    :data-current="root.current.value"
    :data-first="root.first.value ? '' : undefined"
    :data-last="root.last.value ? '' : undefined"
    :data-total="root.total.value"
    :class="['yayaw-questionnaire-progress', props.class]"
  >
    <slot
      :current="root.current.value"
      :first="root.first.value"
      :last="root.last.value"
      :total="root.total.value"
    >
      {{ label }}
    </slot>
  </Primitive>
</template>
