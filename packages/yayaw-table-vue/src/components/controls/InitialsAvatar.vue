<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { type AvatarShape, initialsAvatar } from "../../initials-avatar";
import "../../initials-avatar.css";

const props = withDefaults(
  defineProps<{
    name: string;
    /** An image shown instead of the initials while it loads (cards). */
    source?: string;
    shape?: AvatarShape;
    size?: "cell" | "large" | "small";
    /**
     * The name is shown next to the avatar: the initials are hidden from
     * assistive technologies. Otherwise the avatar reads as the name.
     */
    decorative?: boolean;
  }>(),
  { shape: "circle", size: "small", decorative: false, source: undefined }
);
const failedSource = ref<string>();
watch(
  () => props.source,
  () => {
    failedSource.value = undefined;
  }
);
const avatar = computed(() => initialsAvatar(props.name, props.shape));
const image = computed(() =>
  props.source && failedSource.value !== props.source ? props.source : undefined
);
</script>

<template>
  <span
    v-if="image"
    class="yayaw-avatar"
    data-avatar=""
    :data-shape="shape"
    :data-size="size === 'small' ? undefined : size"
  ><img :src="image" alt="" loading="lazy" @error="failedSource = image" /></span>
  <span
    v-else-if="avatar"
    class="yayaw-avatar"
    data-avatar=""
    :data-shape="avatar.shape"
    :data-size="size === 'small' ? undefined : size"
    :style="avatar.style"
    :aria-hidden="decorative ? 'true' : undefined"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : avatar.name"
  >{{ avatar.initials }}</span>
</template>
