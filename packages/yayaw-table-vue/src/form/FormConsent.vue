<script setup lang="ts">
/**
 * A consent: a required checkbox labelled by its statement, whose link (the
 * privacy policy…) opens in a new tab so the answers are kept.
 */
import { Check } from "lucide-vue-next";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { computed } from "vue";
import {
  type FormDraft,
  formConsentParts,
  type ResolvedFormConsent,
} from "../form-view";

const props = defineProps<{
  consent: ResolvedFormConsent;
  /** Id of the checkbox; its statement labels it. */
  inputId: string;
  value?: FormDraft[string];
  error?: string;
  disabled?: boolean;
  /** Read after the link, which opens in a new tab ("(opens in a new tab)"). */
  newTabLabel: string;
}>();
const emit = defineEmits<{ change: [checked: boolean] }>();
const labelId = computed(() => `${props.inputId}-label`);
const errorId = computed(() => `${props.inputId}-error`);
const parts = computed(() => formConsentParts(props.consent));
</script>

<template>
  <div
    class="yayaw-form-question"
    :data-form-consent="consent.id"
    :data-invalid="error ? true : undefined"
  >
    <div class="yayaw-form-consent">
      <CheckboxRoot
        :id="inputId"
        class="yayaw-checkbox yayaw-form-consent-box"
        data-form-focus
        :model-value="value === true"
        :disabled="disabled"
        :aria-labelledby="labelId"
        :aria-describedby="error ? errorId : undefined"
        :aria-invalid="error ? true : undefined"
        required
        @update:model-value="emit('change', $event === true)"
      >
        <CheckboxIndicator class="yayaw-checkbox-indicator">
          <Check :size="14" aria-hidden="true" />
        </CheckboxIndicator>
      </CheckboxRoot>
      <label :id="labelId" class="yayaw-form-consent-label" :for="inputId">{{ parts.before }}<a v-if="parts.link?.href" class="yayaw-form-consent-link" :href="parts.link.href" target="_blank" rel="noopener noreferrer">{{ parts.link.label }}<span class="yayaw-sr-only"> {{ newTabLabel }}</span></a><template v-else-if="parts.link">{{ parts.link.label }}</template>{{ parts.after }}<span class="yayaw-form-required" aria-hidden="true">*</span></label>
    </div>
    <p v-if="error" :id="errorId" class="yayaw-form-error">{{ error }}</p>
  </div>
</template>
