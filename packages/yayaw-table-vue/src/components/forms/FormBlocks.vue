<script setup lang="ts">
import type { Slots } from "vue";
import { formBlockId, formBlockSpan } from "../../form-layout";
import type { FormBlock, FormBlockContext } from "../../types";
import FormActionButton from "./FormActionButton.vue";

defineSlots<{ field(props: { fieldName: string }): unknown }>();
withDefaults(
  defineProps<{
    blocks: FormBlock[];
    columns?: 1 | 2 | 3;
    context: FormBlockContext;
    customSlots?: Slots;
  }>(),
  { columns: 1 }
);
const CustomContent = (props: {
  block: Extract<FormBlock, { type: "custom" }>;
  context: FormBlockContext;
  slots?: Slots;
}) =>
  props.slots?.[`form-${props.block.id}`]?.(props.context) ??
  props.block.render?.(props.context);
const text = (
  value: string | undefined,
  key: string | undefined,
  context: FormBlockContext
) => (key ? context.translations?.[key] ?? value : value);
</script>

<template>
  <div
    class="yayaw-form-block-grid"
    :data-form-columns="columns"
    :style="{ '--form-columns': columns }"
  >
    <div
      v-for="block in blocks"
      :key="formBlockId(block)"
      class="yayaw-form-block"
      :data-form-block="formBlockId(block)"
      :data-form-block-type="block.type"
      :data-full-span="block.span === 'full'"
      :style="{ '--form-span': formBlockSpan(block.span, columns) }"
    >
      <slot
        v-if="block.type === 'field'"
        name="field"
        :field-name="block.name"
      />
      <section v-else-if="block.type === 'section'" class="yayaw-form-section">
        <h3 v-if="block.title || block.titleKey">
          {{ text(block.title, block.titleKey, context) }}
        </h3>
        <p v-if="block.description || block.descriptionKey">
          {{ text(block.description, block.descriptionKey, context) }}
        </p>
        <FormBlocks
          :blocks="block.blocks"
          :columns="block.columns"
          :context="context"
          :custom-slots="customSlots"
        >
          <template #field="scope"
            ><slot name="field" v-bind="scope"
          /></template>
        </FormBlocks>
      </section>
      <div
        v-else-if="block.type === 'content'"
        class="yayaw-form-content"
        :data-tone="block.tone ?? 'default'"
      >
        <h3 v-if="block.title || block.titleKey">
          {{ text(block.title, block.titleKey, context) }}
        </h3>
        <p>{{ text(block.text, block.textKey, context) }}</p>
      </div>
      <div v-else-if="block.type === 'actions'" class="yayaw-form-actions">
        <FormActionButton
          v-for="action in block.actions"
          :key="action.id"
          :action="action"
          :context="context"
        />
      </div>
      <CustomContent
        v-else-if="block.type === 'custom'"
        :block="block"
        :context="context"
        :slots="customSlots"
      />
    </div>
  </div>
</template>
