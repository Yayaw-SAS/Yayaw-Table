/**
 * DOM behaviour of the file tree shared by the React and Vue editions:
 * pointer drags with a floating label, auto-scroll near edges and a
 * not-allowed cursor on invalid targets; desktop file drops for hosts with
 * `onDropFiles`; and the resizable details pane.
 */
import type { FileTreeController } from "./filetree-controller";
import {
  FILETREE_ROW_ATTRIBUTE,
  fileTreeAutoScroll,
  fileTreeRowAt,
} from "./filetree-model";

/** Pointer travel before a press becomes a drag. */
const DRAG_THRESHOLD = 5;
const LABEL_OFFSET = 14;
const DRAGGING_CLASS = "yayaw-ft-dragging";
const INVALID_ATTRIBUTE = "data-ft-invalid";
const INTERACTIVE =
  "input,textarea,select,button,a,[role='checkbox'],[data-ft-no-drag]";

interface PendingDrag {
  id: string;
  x: number;
  y: number;
  started: boolean;
}

function scrollParent(element: HTMLElement | null): HTMLElement | undefined {
  let current = element?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
}

function autoScroll(root: HTMLElement, y: number): void {
  const scroller = scrollParent(
    root.querySelector(`[${FILETREE_ROW_ATTRIBUTE}]`) as HTMLElement | null
  );
  if (scroller) {
    const rect = scroller.getBoundingClientRect();
    scroller.scrollTop += fileTreeAutoScroll(y, rect.top, rect.bottom);
    return;
  }
  const delta = fileTreeAutoScroll(y, 0, window.innerHeight);
  if (delta) {
    window.scrollBy(0, delta);
  }
}

function renderLabel(
  label: HTMLElement,
  controller: FileTreeController,
  x: number,
  y: number
): void {
  const drag = controller.getState().drag;
  const count = drag?.ids.length ?? 0;
  label.textContent = drag?.message ?? controller.label("items", { count });
  label.dataset.valid = drag?.valid ? "true" : "false";
  label.style.transform = `translate(${x + LABEL_OFFSET}px, ${y + LABEL_OFFSET}px)`;
  document.documentElement.toggleAttribute(
    INVALID_ATTRIBUTE,
    Boolean(drag?.overId) && !drag?.valid
  );
}

/**
 * Drag rows onto folders with the mouse or a pen (touch uses "Move to…").
 * Answers a cleanup function.
 */
export function attachFileTreeDrag(
  root: HTMLElement,
  controller: FileTreeController,
  enabled: () => boolean
): () => void {
  let pending: PendingDrag | undefined;
  let label: HTMLElement | undefined;
  let suppressClick = false;

  const finish = (drop: boolean) => {
    const started = pending?.started;
    pending = undefined;
    label?.remove();
    label = undefined;
    document.documentElement.classList.remove(DRAGGING_CLASS);
    document.documentElement.removeAttribute(INVALID_ATTRIBUTE);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", onEscape, true);
    if (!started) {
      return;
    }
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    if (drop) {
      controller.dragEnd();
    } else {
      controller.dragCancel();
    }
  };
  const begin = () => {
    if (!pending) {
      return;
    }
    controller.dragStart(pending.id);
    if (!controller.getState().drag) {
      finish(false);
      return;
    }
    pending.started = true;
    label = document.createElement("div");
    label.className = "yayaw-ft-drag-label";
    label.setAttribute("aria-hidden", "true");
    // Portals inherit the tree's theme tokens.
    label.dataset.theme = root.closest(".dark") ? "dark" : "light";
    document.body.append(label);
    document.documentElement.classList.add(DRAGGING_CLASS);
  };
  function move(event: PointerEvent) {
    if (!pending) {
      return;
    }
    const distance = Math.hypot(
      event.clientX - pending.x,
      event.clientY - pending.y
    );
    if (!pending.started && distance < DRAG_THRESHOLD) {
      return;
    }
    if (!pending.started) {
      begin();
    }
    if (!(pending?.started && label)) {
      return;
    }
    event.preventDefault();
    controller.dragOver(fileTreeRowAt(event.clientX, event.clientY));
    renderLabel(label, controller, event.clientX, event.clientY);
    autoScroll(root, event.clientY);
  }
  function up() {
    finish(true);
  }
  function cancel() {
    finish(false);
  }
  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && pending?.started) {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  }
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType === "touch" || !enabled()) {
      return;
    }
    const target = event.target as Element | null;
    const row = target?.closest(`[${FILETREE_ROW_ATTRIBUTE}]`);
    const id = row?.getAttribute(FILETREE_ROW_ATTRIBUTE);
    if (
      !(id && row?.getAttribute("role") === "row") ||
      target?.closest(INTERACTIVE)
    ) {
      return;
    }
    pending = { id, x: event.clientX, y: event.clientY, started: false };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", onEscape, true);
  };
  const click = (event: MouseEvent) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("click", click, true);
  return () => {
    finish(false);
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("click", click, true);
  };
}

const DROP_ATTRIBUTE = "data-ft-file-drop";

const hasFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer?.types ?? []).includes("Files");

/** Files dragged from the desktop onto a folder go to the host's `onDropFiles`. */
export function attachFileTreeFileDrop(
  root: HTMLElement,
  controller: FileTreeController,
  enabled: () => boolean
): () => void {
  let marked: Element | undefined;
  const mark = (element: Element | undefined) => {
    marked?.removeAttribute(DROP_ATTRIBUTE);
    marked = element;
    marked?.setAttribute(DROP_ATTRIBUTE, "true");
  };
  const over = (event: DragEvent) => {
    if (!(enabled() && hasFiles(event))) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    mark(
      (event.target as Element | null)?.closest(
        `[${FILETREE_ROW_ATTRIBUTE}]`
      ) ?? undefined
    );
  };
  const leave = (event: DragEvent) => {
    if (!root.contains(event.relatedTarget as Node | null)) {
      mark(undefined);
    }
  };
  const drop = (event: DragEvent) => {
    if (!(enabled() && hasFiles(event))) {
      return;
    }
    event.preventDefault();
    const id = marked?.getAttribute(FILETREE_ROW_ATTRIBUTE) ?? null;
    mark(undefined);
    controller
      .dropFiles(id, Array.from(event.dataTransfer?.files ?? []))
      .catch(() => undefined);
  };
  root.addEventListener("dragover", over);
  root.addEventListener("dragleave", leave);
  root.addEventListener("drop", drop);
  return () => {
    mark(undefined);
    root.removeEventListener("dragover", over);
    root.removeEventListener("dragleave", leave);
    root.removeEventListener("drop", drop);
  };
}

export const FILETREE_DETAILS_MIN = 256;
export const FILETREE_DETAILS_MAX = 576;
export const FILETREE_DETAILS_DEFAULT = 320;
const RESIZE_STEP = 16;

export const clampDetailsWidth = (width: number): number =>
  Math.round(
    Math.min(FILETREE_DETAILS_MAX, Math.max(FILETREE_DETAILS_MIN, width))
  );

/** Width after a key on the pane's resize handle; undefined for other keys. */
export function detailsWidthAfterKey(
  width: number,
  key: string
): number | undefined {
  const steps: Record<string, number> = {
    ArrowLeft: RESIZE_STEP,
    ArrowRight: -RESIZE_STEP,
    Home: FILETREE_DETAILS_MAX - width,
    End: FILETREE_DETAILS_MIN - width,
  };
  const step = steps[key];
  return step === undefined ? undefined : clampDetailsWidth(width + step);
}

/** Drag the pane's left edge; `onWidth` receives each new width. */
export function startDetailsResize(
  event: PointerEvent,
  width: number,
  onWidth: (width: number) => void
): void {
  event.preventDefault();
  const startX = event.clientX;
  const move = (next: PointerEvent) =>
    onWidth(clampDetailsWidth(width + startX - next.clientX));
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}
