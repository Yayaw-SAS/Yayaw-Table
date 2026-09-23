<script setup lang="ts">
import { Check, Copy, ExternalLink, Globe, Link2 } from "lucide-vue-next";
import { SwitchRoot, SwitchThumb } from "reka-ui";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from "vue";
import TableTooltip from "../components/toolbar/TableTooltip.vue";
import ToolbarMenu from "../components/toolbar/ToolbarMenu.vue";
import {
  type FormLabelKey,
  type FormLinkActions,
  type FormLinkStatus,
  type FormTranslate,
  formLabel,
  type PublicFormSnapshot,
} from "../form-view";

/**
 * "Share form": a button of the form's header bar opening the publishing
 * controls (a drawer on phones, like the Data menu). Republishing is explicit:
 * edits reach the link with "Update public form", so unsaved experiments
 * never go live by accident.
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
const COPIED_MS = 2000;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

// Phones get the drawer, as the table's menus do.
const compact = ref(false);
let media: MediaQueryList | undefined;
const updateCompact = (): void => {
  compact.value = media?.matches ?? false;
};
onMounted(() => {
  media = window.matchMedia?.("(max-width: 767px)");
  updateCompact();
  media?.addEventListener?.("change", updateCompact);
});
onBeforeUnmount(() => {
  media?.removeEventListener?.("change", updateCompact);
  clearTimeout(copiedTimer);
});
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
const togglePublished = (viewId: string, checked: boolean) =>
  checked ? publish(viewId) : unpublish(viewId);
const copyLabel = computed(() => (copied.value ? label("copied") : label("copy")));
const copy = async () => {
  if (!status.value?.url) return;
  try {
    await navigator.clipboard.writeText(status.value.url);
    copied.value = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copied.value = false;
    }, COPIED_MS);
  } catch {
    copied.value = false;
  }
};
</script>

<template>
  <ToolbarMenu
    :open="open"
    :compact="compact"
    :title="label('share')"
    :close-label="label('close')"
    align="end"
    @update:open="open = $event"
  >
    <template #trigger>
      <button
        type="button"
        class="yayaw-button yayaw-button-outline yayaw-form-share-trigger"
        data-form-share
      >
        <Link2 :size="16" aria-hidden="true" />{{ label("share") }}
      </button>
    </template>
    <div class="yayaw-form-share-panel" data-form-share-panel>
      <template v-if="viewId">
        <div class="yayaw-form-switch-setting">
          <span class="yayaw-form-share-icon"><Globe :size="16" aria-hidden="true" /></span>
          <div class="yayaw-form-switch-text">
            <label :id="`${id}-publish-label`" class="yayaw-form-switch-label" :for="`${id}-publish`">{{ label("publish") }}</label>
            <p :id="`${id}-publish-hint`" class="yayaw-form-settings-note">{{ label("publishHint") }}</p>
          </div>
          <SwitchRoot
            :id="`${id}-publish`"
            class="yayaw-switch-root"
            :model-value="published"
            :disabled="busy || loading"
            :aria-labelledby="`${id}-publish-label`"
            :aria-describedby="`${id}-publish-hint`"
            @update:model-value="togglePublished(viewId, $event === true)"
          >
            <SwitchThumb class="yayaw-switch-thumb" />
          </SwitchRoot>
        </div>
        <template v-if="published && status?.url">
          <div class="yayaw-form-share-field">
            <label class="yayaw-form-settings-note" :for="`${id}-url`">{{ label("publicLink") }}</label>
            <div class="yayaw-form-share-link">
              <input :id="`${id}-url`" class="yayaw-input" readonly :value="status.url" @focus="($event.target as HTMLInputElement).select()" />
              <TableTooltip :label="copyLabel">
                <button type="button" class="yayaw-button yayaw-button-outline yayaw-icon-only" :aria-label="copyLabel" @click="copy">
                  <Check v-if="copied" :size="16" aria-hidden="true" />
                  <Copy v-else :size="16" aria-hidden="true" />
                </button>
              </TableTooltip>
              <TableTooltip :label="label('open')">
                <a class="yayaw-button yayaw-button-outline yayaw-icon-only" :aria-label="label('open')" :href="status.url" target="_blank" rel="noopener">
                  <ExternalLink :size="16" aria-hidden="true" />
                </a>
              </TableTooltip>
            </div>
          </div>
          <div v-if="formLinks.setAcceptingResponses" class="yayaw-form-switch-setting">
            <label :id="`${id}-accept-label`" class="yayaw-form-switch-label" :for="`${id}-accept`">{{ label("acceptResponses") }}</label>
            <SwitchRoot
              :id="`${id}-accept`"
              class="yayaw-switch-root"
              :model-value="accepting"
              :disabled="busy"
              :aria-labelledby="`${id}-accept-label`"
              @update:model-value="setAccepting(viewId, $event === true)"
            >
              <SwitchThumb class="yayaw-switch-thumb" />
            </SwitchRoot>
          </div>
          <div class="yayaw-form-share-update">
            <button
              type="button"
              class="yayaw-button yayaw-button-outline"
              :disabled="busy"
              :aria-describedby="`${id}-republish-hint`"
              @click="publish(viewId)"
            >
              {{ label("republish") }}
            </button>
            <p :id="`${id}-republish-hint`" class="yayaw-form-settings-note">{{ label("republishHint") }}</p>
          </div>
        </template>
      </template>
      <p v-else class="yayaw-form-help">{{ label("saveFirst") }}</p>
      <p v-if="failed" class="yayaw-form-error" role="alert">{{ label("shareError") }}</p>
      <output v-if="copied" class="yayaw-sr-only">{{ label("copied") }}</output>
    </div>
  </ToolbarMenu>
</template>
