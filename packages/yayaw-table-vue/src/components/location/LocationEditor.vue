<script setup lang="ts">
import { LoaderCircle, MapPin, Search } from "lucide-vue-next";
import { computed, inject, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from "vue";
import { tableContextKey } from "../../context";
import { useOverlayTheme } from "../../composables/use-overlay-theme";
import {
  createGeocodeSearch,
  floatingPanelPosition,
  type GeocodeResult,
  type GeocodeSearchState,
  type LocationDraft,
  type LocationLabelKey,
  type LocationValue,
  locationDraftFrom,
  locationFromDraft,
  locationFromGeocode,
  locationLabel,
} from "../../location-model";

/**
 * Address search with the host's geocoder, plus a name and coordinates. Used
 * by inline editing, record forms and the Form view (same as React).
 */
const props = withDefaults(
  defineProps<{
    value: unknown;
    /** The field's name, for the group's accessible name. */
    label?: string;
    autofocus?: boolean;
    disabled?: boolean;
    /** A floating panel (inline editing) rather than a form field. */
    floating?: boolean;
    invalid?: boolean;
    /** Id of the address input, for an outer label. */
    inputId?: string;
    describedBy?: string;
    /** Show Cancel and Done (inline editing). */
    actions?: boolean;
    locale?: string;
    /** The cell a floating editor opens from; it floats above the table's overflow. */
    anchor?: HTMLElement | null;
  }>(),
  { autofocus: false, disabled: false, floating: false, invalid: false, actions: false }
);
const emit = defineEmits<{
  /** Each valid value (null once every field is empty). */
  change: [value: LocationValue | null];
  done: [];
  cancel: [];
  /** Focus left the editor (inline editing saves, as other editors do on blur). */
  leave: [];
}>();

const context = inject(tableContextKey, undefined);
const locale = computed(() => props.locale ?? context?.locale ?? "en");
const label = (key: LocationLabelKey): string =>
  locationLabel(key, locale.value, (name, fallback) => {
    const value = context?.translations.value[`location.${name}`];
    return typeof value === "string" ? value : fallback;
  });
const geocode = computed(() => context?.actions.value?.geocode);
const generatedId = useId();
const id = props.inputId ?? generatedId;
const addressId = props.inputId ?? `${id}-address`;
const draft = ref<LocationDraft>(locationDraftFrom(props.value));
const IDLE: GeocodeSearchState = { status: "idle", query: "", results: [] };
const search = ref<GeocodeSearchState>(IDLE);
const error = ref<string>();
const suggestions = useTemplateRef<HTMLUListElement>("suggestions");
let searcher = createGeocodeSearch({ geocode: geocode.value, locale: locale.value, onChange: (state) => { search.value = state; } });
watch([geocode, locale], () => {
  searcher.cancel();
  searcher = createGeocodeSearch({ geocode: geocode.value, locale: locale.value, onChange: (state) => { search.value = state; } });
});
onBeforeUnmount(() => searcher.cancel());
// Inline, the editor floats above the table (fixed, under its cell) with the table's theme.
const container = useTemplateRef<HTMLFieldSetElement>("container");
const anchorRef = computed(() => props.anchor ?? null);
const { overlayStyle, updateOpen } = useOverlayTheme(anchorRef);
const position = ref<{ top: number; left: number }>();
const teleported = computed(() => props.floating && Boolean(props.anchor));
const place = (): void => {
  if (!props.anchor) return;
  const rect = container.value?.getBoundingClientRect();
  position.value = floatingPanelPosition(
    props.anchor.getBoundingClientRect(),
    { width: rect?.width ?? 0, height: rect?.height ?? 0 },
    { width: window.innerWidth, height: window.innerHeight }
  );
};
const floatingStyle = computed<Record<string, string> | undefined>(() =>
  teleported.value && position.value
    ? { ...overlayStyle.value, position: "fixed", top: `${position.value.top}px`, left: `${position.value.left}px`, marginTop: "0" }
    : undefined
);
onMounted(() => {
  if (teleported.value) {
    updateOpen(true);
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
  }
  if (props.autofocus) document.getElementById(addressId)?.focus();
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", place, true);
  window.removeEventListener("resize", place);
});
const onFocusout = (event: FocusEvent): void => {
  if (!container.value?.contains(event.relatedTarget as Node | null)) emit("leave");
};

const apply = (next: LocationDraft): void => {
  draft.value = next;
  const result = locationFromDraft(next);
  if ("value" in result) {
    error.value = undefined;
    emit("change", result.value);
  }
};
const choose = (suggestion: GeocodeResult): void => {
  // Keep focus in the editor: the suggestion list is about to disappear.
  document.getElementById(addressId)?.focus();
  searcher.cancel();
  search.value = IDLE;
  const chosen = locationFromGeocode(suggestion);
  draft.value = locationDraftFrom(chosen);
  error.value = undefined;
  emit("change", chosen);
};
const done = (): void => {
  const result = locationFromDraft(draft.value);
  if ("error" in result) {
    error.value = label(result.error);
    return;
  }
  emit("done");
};
const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" && props.actions) {
    event.preventDefault();
    event.stopPropagation();
    emit("cancel");
  } else if (event.key === "Enter" && props.actions && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    event.stopPropagation();
    done();
  }
};
const onAddressKeydown = (event: KeyboardEvent): void => {
  if (event.key === "ArrowDown" && search.value.results.length) {
    event.preventDefault();
    event.stopPropagation();
    suggestions.value?.querySelector("button")?.focus();
  }
};
const onSuggestionKeydown = (event: KeyboardEvent): void => {
  const item = (event.currentTarget as HTMLElement).closest("li");
  let sibling: Element | null | undefined;
  if (event.key === "ArrowDown") sibling = item?.nextElementSibling;
  else if (event.key === "ArrowUp") sibling = item?.previousElementSibling;
  if (sibling) {
    event.preventDefault();
    sibling.querySelector("button")?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    search.value = IDLE;
    document.getElementById(addressId)?.focus();
  }
};
const onAddress = (event: Event): void => {
  const text = (event.target as HTMLInputElement).value;
  apply({ ...draft.value, address: text });
  searcher.search(text);
};
const statusText = computed(() => {
  if (search.value.status === "searching") return label("searching");
  if (search.value.status === "error") return label("searchFailed");
  return search.value.status === "done" && !search.value.results.length ? label("noResults") : "";
});
</script>

<template>
  <Teleport to="body" :disabled="!teleported">
  <fieldset
    ref="container"
    class="yayaw-location-editor"
    :class="{ 'is-floating': floating }"
    :style="floatingStyle"
    :aria-label="props.label ?? label('location')"
    :disabled="disabled"
    data-location-editor=""
    @keydown="onKeydown"
    @focusout="onFocusout"
  >
    <label class="yayaw-location-field" :for="addressId">
      <span>{{ geocode ? label("search") : label("address") }}</span>
      <span class="yayaw-location-search">
        <Search :size="14" aria-hidden="true" />
        <input
          :id="addressId"
          class="yayaw-input"
          autocomplete="off"
          data-form-focus
          :autofocus="autofocus"
          :aria-invalid="invalid || Boolean(error) ? 'true' : undefined"
          :aria-describedby="describedBy"
          :placeholder="label('coordinatesHint')"
          :value="draft.address"
          @input="onAddress"
          @keydown="onAddressKeydown"
        />
      </span>
    </label>
    <ul v-if="search.results.length" ref="suggestions" class="yayaw-location-suggestions" :aria-label="label('suggestions')" data-location-suggestions="">
      <li v-for="suggestion in search.results" :key="`${suggestion.lat},${suggestion.lng},${suggestion.label}`">
        <button type="button" class="yayaw-location-suggestion" @click="choose(suggestion)" @keydown="onSuggestionKeydown">
          <MapPin :size="14" aria-hidden="true" />
          <span>
            <span class="yayaw-location-suggestion-label">{{ suggestion.label }}</span>
            <span v-if="suggestion.address" class="yayaw-location-suggestion-address">{{ suggestion.address }}</span>
          </span>
        </button>
      </li>
    </ul>
    <output v-if="statusText" class="yayaw-location-status" aria-live="polite">
      <LoaderCircle v-if="search.status === 'searching'" :size="12" class="yayaw-spin" aria-hidden="true" />
      {{ statusText }}
    </output>
    <label class="yayaw-location-field" :for="`${id}-label`">
      <span>{{ label("label") }}</span>
      <input :id="`${id}-label`" class="yayaw-input" :value="draft.label" @input="apply({ ...draft, label: ($event.target as HTMLInputElement).value })" />
    </label>
    <div class="yayaw-location-coordinates">
      <label class="yayaw-location-field" :for="`${id}-lat`">
        <span>{{ label("latitude") }}</span>
        <input :id="`${id}-lat`" class="yayaw-input" inputmode="decimal" :aria-invalid="error ? 'true' : undefined" :value="draft.lat" @input="apply({ ...draft, lat: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="yayaw-location-field" :for="`${id}-lng`">
        <span>{{ label("longitude") }}</span>
        <input :id="`${id}-lng`" class="yayaw-input" inputmode="decimal" :aria-invalid="error ? 'true' : undefined" :value="draft.lng" @input="apply({ ...draft, lng: ($event.target as HTMLInputElement).value })" />
      </label>
    </div>
    <p v-if="error" class="yayaw-location-error" role="alert">{{ error }}</p>
    <div class="yayaw-location-actions">
      <button type="button" class="yayaw-button yayaw-button-ghost" @click="apply({ label: '', address: '', lat: '', lng: '' })">{{ label("clear") }}</button>
      <template v-if="actions">
        <button type="button" class="yayaw-button yayaw-button-outline" @click="emit('cancel')">{{ label("cancel") }}</button>
        <button type="button" class="yayaw-button" @click="done">{{ label("done") }}</button>
      </template>
    </div>
  </fieldset>
  </Teleport>
</template>
