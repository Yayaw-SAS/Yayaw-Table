/**
 * Browser helpers of the Feed view shared by both editions (synced to Vue by
 * `contracts:sync`): the scroll root, loading the next page before the end of
 * the feed scrolls into view, and windowing long feeds (only the posts near
 * the viewport render; the others keep their measured height). Both editions
 * attach them to the same markup: posts and placeholders are
 * `[data-feed-item]` with `data-row-id`, posts are `[data-feed-card]`.
 */

/** The next page loads one screen (the scroll root's height) before the end. */
export const FEED_PREFETCH_MARGIN = "0px 0px 100% 0px";
/** Height of a post never measured while no post has been measured. */
export const FEED_ESTIMATED_POST_HEIGHT = 240;

const ITEM = "[data-feed-item]";
const CARD = "[data-feed-card]";
const SCROLLING = new Set(["auto", "scroll", "overlay"]);

/**
 * The nearest ancestor that scrolls vertically (it overflows), or undefined
 * when the page itself scrolls. Ancestors that only clip or scroll sideways
 * are skipped.
 */
export function feedScrollRoot(element: Element): HTMLElement | undefined {
  let node = element.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    if (
      SCROLLING.has(getComputedStyle(node).overflowY) &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return;
}

/** Whether the browser can load pages on scroll; without it the button shows. */
export const canObserveFeedEnd = (): boolean =>
  typeof IntersectionObserver !== "undefined";

export interface FeedEndObserver {
  disconnect: () => void;
}

/**
 * Calls `onReach` when `sentinel` comes within one screen of the bottom of
 * the scroll root (the nearest scrolling ancestor, else the viewport), and
 * right away when it already is. Undefined without IntersectionObserver.
 */
export function observeFeedEnd(
  sentinel: Element,
  onReach: () => void
): FeedEndObserver | undefined {
  if (!canObserveFeedEnd()) {
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onReach();
      }
    },
    { root: feedScrollRoot(sentinel) ?? null, rootMargin: FEED_PREFETCH_MARGIN }
  );
  observer.observe(sentinel);
  return { disconnect: () => observer.disconnect() };
}

/** Whether the person asked for reduced motion: scrolling never animates then. */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Focus a post's title (`[data-feed-title]`) without animating the scroll. */
export function focusFeedPost(
  container: ParentNode,
  id: string | undefined
): boolean {
  const card = [...container.querySelectorAll<HTMLElement>(CARD)].find(
    (item) => item.dataset.rowId === id
  );
  const title = card?.querySelector<HTMLElement>("[data-feed-title]");
  if (!(id && title)) {
    return false;
  }
  title.focus({ preventScroll: true });
  title.scrollIntoView({
    block: "nearest",
    behavior: prefersReducedMotion() ? "instant" : "auto",
  });
  return true;
}

// Windowing -------------------------------------------------------------------

/** Measured post heights by row id, kept while posts are not rendered. */
export interface FeedHeights {
  has: (id: string) => boolean;
  set: (id: string, height: number) => void;
  /** The post's last measured height, else the average of measured posts. */
  heightOf: (id: string) => number;
}

export function createFeedHeights(
  fallback = FEED_ESTIMATED_POST_HEIGHT
): FeedHeights {
  const heights = new Map<string, number>();
  let total = 0;
  return {
    has: (id) => heights.has(id),
    set: (id, height) => {
      // Posts not laid out (hidden, detached) measure 0: keep what was known.
      if (!(Number.isFinite(height) && height > 0)) {
        return;
      }
      total += height - (heights.get(id) ?? 0);
      heights.set(id, height);
    },
    heightOf: (id) =>
      heights.get(id) ??
      (heights.size > 0 ? Math.round(total / heights.size) : fallback),
  };
}

export interface FeedBox {
  top: number;
  bottom: number;
}

/** Smallest index from which `test` holds (it holds from there on), or `count`. */
function firstIndex(count: number, test: (index: number) => boolean): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (test(middle)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}

/**
 * Items meeting the view extended by `overscan` above and below, as
 * `[start, end)` over items in document order (one column, so their boxes only
 * move down). Bisection reads a few boxes, not all of them.
 */
export function feedWindowRange(
  count: number,
  boxAt: (index: number) => FeedBox,
  view: FeedBox,
  overscan: number
): { start: number; end: number } {
  const top = view.top - overscan;
  const bottom = view.bottom + overscan;
  const start = firstIndex(count, (index) => boxAt(index).bottom > top);
  const end = firstIndex(count, (index) => boxAt(index).top > bottom);
  return { start, end: Math.max(start, end) };
}

const sameIds = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string> | null
): boolean =>
  right !== null &&
  left.size === right.size &&
  [...left].every((id) => right.has(id));

/** Posts that must stay rendered: the one holding focus and those playing a video. */
function stickyIds(list: HTMLElement): string[] {
  const ids: string[] = [];
  const focused = document.activeElement?.closest<HTMLElement>(CARD);
  if (focused?.dataset.rowId && list.contains(focused)) {
    ids.push(focused.dataset.rowId);
  }
  for (const video of list.querySelectorAll("video")) {
    const id = video.closest<HTMLElement>(CARD)?.dataset.rowId;
    if (id && !video.paused) {
      ids.push(id);
    }
  }
  return ids;
}

export interface FeedWindowTracker {
  /**
   * Call after each render of the list: re-reads the scroll root, measures
   * the posts rendered, then recomputes the window when `active`.
   */
  update: (active: boolean) => void;
  disconnect: () => void;
}

/**
 * Reports the ids of the posts to render (`null` while not windowing): those
 * within one screen of the scroll root's visible part, plus the post holding
 * focus and posts playing a video. Every rendered post is measured into
 * `heights`, so placeholders keep the exact height of the posts they replace.
 */
export function trackFeedWindow(
  list: HTMLElement,
  options: {
    heights: FeedHeights;
    onChange: (ids: ReadonlySet<string> | null) => void;
  }
): FeedWindowTracker {
  let active = false;
  let frame: number | undefined;
  // Sizes may have changed since the last measure (a render, a resize).
  let dirty = true;
  let last: ReadonlySet<string> | null = null;
  let root = feedScrollRoot(list);
  let scroller: EventTarget = root ?? window;

  const measure = () => {
    dirty = false;
    for (const card of list.querySelectorAll<HTMLElement>(CARD)) {
      const id = card.dataset.rowId;
      if (id) {
        options.heights.set(id, card.getBoundingClientRect().height);
      }
    }
  };
  const compute = () => {
    frame = undefined;
    if (dirty) {
      measure();
    }
    if (!active) {
      return;
    }
    const items = [...list.querySelectorAll<HTMLElement>(ITEM)];
    const view = root
      ? root.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const range = feedWindowRange(
      items.length,
      (index) =>
        items.at(index)?.getBoundingClientRect() ?? { top: 0, bottom: 0 },
      view,
      view.bottom - view.top
    );
    const ids = new Set(stickyIds(list));
    for (const item of items.slice(range.start, range.end)) {
      if (item.dataset.rowId) {
        ids.add(item.dataset.rowId);
      }
    }
    if (!sameIds(ids, last)) {
      last = ids;
      options.onChange(ids);
    }
  };
  const schedule = () => {
    if (frame === undefined) {
      frame = requestAnimationFrame(compute);
    }
  };
  const resized = () => {
    dirty = true;
    schedule();
  };

  const listen = () =>
    scroller.addEventListener("scroll", schedule, { passive: true });
  const unlisten = () => scroller.removeEventListener("scroll", schedule);
  const resizes =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(resized);
  resizes?.observe(list);
  if (root) {
    resizes?.observe(root);
  }
  listen();
  window.addEventListener("resize", resized);
  list.addEventListener("focusin", schedule);
  list.addEventListener("focusout", schedule);
  // Media events do not bubble: listen while they go down.
  list.addEventListener("play", schedule, true);
  list.addEventListener("pause", schedule, true);

  return {
    update: (next) => {
      dirty = true;
      const nextRoot = feedScrollRoot(list);
      if (nextRoot !== root) {
        unlisten();
        if (root) {
          resizes?.unobserve(root);
        }
        root = nextRoot;
        scroller = root ?? window;
        listen();
        if (root) {
          resizes?.observe(root);
        }
      }
      if (active && !next) {
        last = null;
        options.onChange(null);
      }
      active = next;
      schedule();
    },
    disconnect: () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
        frame = undefined;
      }
      unlisten();
      resizes?.disconnect();
      window.removeEventListener("resize", resized);
      list.removeEventListener("focusin", schedule);
      list.removeEventListener("focusout", schedule);
      list.removeEventListener("play", schedule, true);
      list.removeEventListener("pause", schedule, true);
    },
  };
}
