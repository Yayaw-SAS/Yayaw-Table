import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

/** Measure an inert clone so flex-grow does not turn the container width into a minimum. */
function measureToolbarContent(element: HTMLElement): number {
  const probe = element.cloneNode(true) as HTMLElement;
  probe.setAttribute("aria-hidden", "true");
  probe.inert = true;
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;width:max-content;max-width:none;inset:0 auto auto 0";
  element.parentElement?.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

export function useToolbarLayout() {
  const root = useTemplateRef<HTMLElement>("toolbarRoot");
  const mobile = ref(false);
  const constrained = ref(false);
  const compact = computed(() => mobile.value || constrained.value);
  let requiredWidth = 768;
  let observer: ResizeObserver | undefined;
  let query: MediaQueryList | undefined;
  const measure = () => {
    const element = root.value;
    const width = element?.getBoundingClientRect().width;
    if (!(element && width)) {
      return;
    }
    if (!compact.value) {
      requiredWidth = Math.max(768, measureToolbarContent(element));
    }
    constrained.value = width + 1 < requiredWidth;
  };
  const viewportChanged = () => {
    mobile.value = query?.matches ?? false;
    measure();
  };
  onMounted(() => {
    query = window.matchMedia?.("(max-width: 767px)");
    viewportChanged();
    query?.addEventListener?.("change", viewportChanged);
    if (root.value && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(root.value);
    }
  });
  watch(compact, measure, { flush: "post" });
  onBeforeUnmount(() => {
    observer?.disconnect();
    query?.removeEventListener?.("change", viewportChanged);
  });
  return { root, compact, mobile };
}
