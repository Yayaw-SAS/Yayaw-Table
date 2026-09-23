<!-- shadcn-vue Questionnaire (https://www.shadcn-vue.com/docs/components/questionnaire), vendored: behaviour unchanged, styled with the registry's CSS classes. -->
<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import { computed } from "vue"
import { injectQuestionnaireRootContext } from "./useQuestionnaire"

const props = withDefaults(defineProps<PrimitiveProps & {
  class?: HTMLAttributes["class"]
  disabled?: boolean
  type?: "button" | "submit"
  size?: "default" | "sm"
  variant?: "default" | "outline"
}>(), {
  as: "button",
  disabled: false,
  size: "default",
  variant: "default",
  type: "submit",
})

const root = injectQuestionnaireRootContext()

const visible = computed(() => root.total.value > 0 && root.last.value)
const shortcut = computed(() => (visible.value && !props.disabled ? "Enter" : null))
</script>

<template>
  <Primitive
    data-slot="questionnaire-submit"
    :type="props.type"
    :aria-hidden="!visible || undefined"
    :aria-disabled="props.disabled || undefined"
    :aria-keyshortcuts="shortcut ?? undefined"
    :as="props.as"
    :as-child="props.asChild"
    :data-disabled="props.disabled ? '' : undefined"
    :data-hidden="visible ? undefined : ''"
    :data-shortcut="shortcut ?? undefined"
    :data-size="props.size"
    :data-status="root.activeItemStatus.value ?? undefined"
    :data-variant="props.variant"
    :data-visible="visible ? '' : undefined"
    :disabled="props.disabled"
    :hidden="!visible"
    :inert="!visible"
    :tabindex="visible ? undefined : -1"
    :class="['yayaw-button', props.variant === 'outline' && 'yayaw-button-outline', 'yayaw-questionnaire-submit', props.class]"
  >
    <slot>Submit</slot>
  </Primitive>
</template>
