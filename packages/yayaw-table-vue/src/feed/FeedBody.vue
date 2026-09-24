<script setup lang="ts">
import {
  type CSSProperties,
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  type VNodeChild,
  watch,
} from "vue";
import { feedBodyNeedsToggle } from "../feed-view";

/** Line height of the body, in em, so clamped heights match both editions. */
const BODY_LINE_HEIGHT = 1.5;

const props = defineProps<{
  text: string;
  lines: number;
  /** What the host's `renderBody` returned; plain text without it. */
  content?: unknown;
  hasContent: boolean;
  showMore: string;
  showLess: string;
  /** Kept by the view per row id, so it survives windowing. */
  expanded: boolean;
}>();
const emit = defineEmits<{ toggle: [] }>();

/** Shows whatever the host renderer returned (VNode or string). */
const RenderedBody = defineComponent({
  props: { node: { type: null, default: undefined } },
  setup: (bodyProps) => () => bodyProps.node as VNodeChild,
});

const id = useId();
const element = ref<HTMLElement>();
const expanded = computed(() => props.expanded);
const overflows = ref(false);
const clamped = computed(() => props.lines > 0 && !expanded.value);
const style = computed<CSSProperties>(() => {
  const base: CSSProperties = { lineHeight: String(BODY_LINE_HEIGHT) };
  if (!clamped.value) {
    return base;
  }
  if (props.hasContent) {
    return {
      ...base,
      maxHeight: `${props.lines * BODY_LINE_HEIGHT}em`,
      overflow: "hidden",
    };
  }
  return {
    ...base,
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: String(props.lines),
  };
});

const measure = () => {
  const node = element.value;
  if (!node || expanded.value) {
    return;
  }
  overflows.value = feedBodyNeedsToggle(props.text, props.lines, {
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  });
};
let observer: ResizeObserver | undefined;
onMounted(() => {
  measure();
  if (typeof ResizeObserver !== "undefined" && element.value) {
    observer = new ResizeObserver(measure);
    observer.observe(element.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
watch(
  () => [props.text, props.lines, expanded.value],
  async () => {
    await nextTick();
    measure();
  }
);
</script>

<template>
  <div class="yayaw-feed-body-wrap">
    <div
      :id="id"
      ref="element"
      class="yayaw-feed-body"
      :class="{ 'yayaw-feed-rich': props.hasContent }"
      data-feed-body
      :data-expanded="expanded ? 'true' : 'false'"
      :style="style"
    >
      <RenderedBody v-if="props.hasContent" :node="props.content" />
      <template v-else>{{ props.text }}</template>
    </div>
    <button
      v-if="overflows || expanded"
      type="button"
      class="yayaw-feed-toggle"
      :aria-controls="id"
      :aria-expanded="expanded"
      @click="emit('toggle')"
    >
      {{ expanded ? props.showLess : props.showMore }}
    </button>
  </div>
</template>
