<script setup lang="ts">
import { ExternalLink, Link2 } from "lucide-vue-next";
import { computed, ref, useId, watch } from "vue";
import {
  type FormLabelKey,
  type FormLinkActions,
  type FormLinkStatus,
  type FormTranslate,
  formLabel,
  type PublicFormSnapshot,
} from "../form-view";

/**
 * "Share form": publish the view's form on a public link served by the host.
 * Republishing is explicit: edits reach the link with "Update public form",
 * so unsaved experiments never go live by accident.
 */
const props = defineProps<{
  formLinks: FormLinkActions;
  viewId: string | null;
  /** The form as it would be published now. */
  snapshot: () => PublicFormSnapshot;
  locale: string;
  translate?: FormTranslate;
}>();

const id = `yayaw-form-share-${useId()}`;
const label = (key: FormLabelKey): string =>
  formLabel(key, props.locale, props.translate);
const open = ref(false);
const busy = ref(false);
const loading = ref(false);
const failed = ref(false);
const copied = ref(false);
const status = ref<FormLinkStatus | null>(null);
const published = computed(() =>
  Boolean(status.value?.published && status.value.url)
);
const accepting = computed(() => status.value?.acceptsResponses !== false);

let request = 0;
watch(
  () => [props.formLinks, props.viewId] as const,
  async ([formLinks, viewId]) => {
    const current = ++request;
    status.value = null;
    if (!viewId) return;
    loading.value = true;
    try {
      const next = await formLinks.status(viewId);
      if (current === request) {
        status.value = next;
        failed.value = false;
      }
    } catch {
      if (current === request) failed.value = true;
    } finally {
      if (current === request) loading.value = false;
    }
  },
  { immediate: true }
);

const run = async (task: () => Promise<FormLinkStatus | null>) => {
  busy.value = true;
  try {
    status.value = await task();
    failed.value = false;
  } catch {
    failed.value = true;
  } finally {
    busy.value = false;
  }
};
const publish = (viewId: string) =>
  run(async () => {
    const { url } = await props.formLinks.publish(viewId, {
      ...props.snapshot(),
      viewId,
    });
    return {
      acceptsResponses: accepting.value,
      ...status.value,
      published: true,
      url,
    };
  });
const unpublish = (viewId: string) =>
  run(async () => {
    await props.formLinks.unpublish(viewId);
    return { published: false };
  });
const setAccepting = (viewId: string, next: boolean) =>
  run(async () => {
    await props.formLinks.setAcceptingResponses?.(viewId, next);
    return { published: true, ...status.value, acceptsResponses: next };
  });
const togglePublished = (viewId: string, event: Event) =>
  (event.target as HTMLInputElement).checked ? publish(viewId) : unpublish(viewId);
const copy = async () => {
  if (!status.value?.url) return;
  try {
    await navigator.clipboard.writeText(status.value.url);
    copied.value = true;
  } catch {
    copied.value = false;
  }
};
</script>

<template>
  <section class="yayaw-form-share" :aria-label="label('share')" data-form-share>
    <div class="yayaw-form-share-bar">
      <button
        type="button"
        class="yayaw-button yayaw-button-outline"
        :aria-expanded="open"
        :aria-controls="`${id}-panel`"
        @click="open = !open"
      >
        <Link2 :size="16" aria-hidden="true" />{{ label("share") }}
      </button>
    </div>
    <div v-if="open" :id="`${id}-panel`" class="yayaw-form-share-panel">
      <template v-if="viewId">
        <label class="yayaw-form-check" :for="`${id}-publish`">
          <input
            :id="`${id}-publish`"
            type="checkbox"
            role="switch"
            :aria-checked="published"
            :checked="published"
            :disabled="busy || loading"
            @change="togglePublished(viewId, $event)"
          />
          <span>{{ label("publish") }}</span>
        </label>
        <div v-if="published && status?.url" class="yayaw-form-share-panel">
          <div class="yayaw-form-question">
            <label class="yayaw-form-label" :for="`${id}-url`">{{ label("publicLink") }}</label>
            <div class="yayaw-form-share-link">
              <input :id="`${id}-url`" class="yayaw-input" readonly :value="status.url" />
              <button type="button" class="yayaw-button yayaw-button-outline" @click="copy">
                {{ copied ? label("copied") : label("copy") }}
              </button>
              <a class="yayaw-button yayaw-button-outline" :href="status.url" target="_blank" rel="noopener">
                <ExternalLink :size="16" aria-hidden="true" />{{ label("open") }}
              </a>
            </div>
          </div>
          <label v-if="formLinks.setAcceptingResponses" class="yayaw-form-check" :for="`${id}-accept`">
            <input
              :id="`${id}-accept`"
              type="checkbox"
              role="switch"
              :aria-checked="accepting"
              :checked="accepting"
              :disabled="busy"
              @change="setAccepting(viewId, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ label("acceptResponses") }}</span>
          </label>
          <div class="yayaw-form-share-bar">
            <button type="button" class="yayaw-button yayaw-button-outline" :disabled="busy" @click="publish(viewId)">
              {{ label("republish") }}
            </button>
            <p class="yayaw-form-help">{{ label("republishHint") }}</p>
          </div>
        </div>
      </template>
      <p v-else class="yayaw-form-help">{{ label("saveFirst") }}</p>
      <p v-if="failed" class="yayaw-form-error" role="alert">{{ label("shareError") }}</p>
      <output v-if="copied" class="yayaw-sr-only">{{ label("copied") }}</output>
    </div>
  </section>
</template>
