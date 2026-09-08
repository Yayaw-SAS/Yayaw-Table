/** Deterministic layout for the identical React/Vue observer lifecycle scenarios. */
export function mockAutoPageLayout(win: Window & typeof globalThis) {
  const originalBounds = win.HTMLElement.prototype.getBoundingClientRect;
  const originalRects = win.HTMLElement.prototype.getClientRects;
  const originalFrame = win.requestAnimationFrame;
  const originalCancel = win.cancelAnimationFrame;
  const originalHeight = win.innerHeight;
  let rowHeight = 40;
  let nextId = 0;
  const frames = new Map<number, FrameRequestCallback>();
  win.requestAnimationFrame = (callback) => {
    frames.set(++nextId, callback);
    return nextId;
  };
  win.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  Object.defineProperty(win, "innerHeight", {
    configurable: true,
    value: 600,
    writable: true,
  });
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = this.tagName === "TBODY" ? 132 : 100;
    let height = this.hasAttribute("data-yayaw-pagination") ? 48 : 400;
    if (this.tagName === "TR") {
      height = rowHeight;
    }
    return {
      x: 0,
      y: top,
      left: 0,
      top,
      right: 800,
      bottom: top + height,
      width: 800,
      height,
      toJSON: () => ({}),
    };
  };
  win.HTMLElement.prototype.getClientRects = function () {
    return [this.getBoundingClientRect()] as unknown as DOMRectList;
  };
  return {
    flush() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) {
        callback(0);
      }
    },
    resize(height: number) {
      Object.defineProperty(win, "innerHeight", {
        configurable: true,
        value: height,
        writable: true,
      });
      win.dispatchEvent(new win.Event("resize"));
    },
    rowHeight(height: number) {
      rowHeight = height;
    },
    pending: () => frames.size,
    restore() {
      win.HTMLElement.prototype.getBoundingClientRect = originalBounds;
      win.HTMLElement.prototype.getClientRects = originalRects;
      win.requestAnimationFrame = originalFrame;
      win.cancelAnimationFrame = originalCancel;
      Object.defineProperty(win, "innerHeight", {
        configurable: true,
        value: originalHeight,
        writable: true,
      });
    },
  };
}
