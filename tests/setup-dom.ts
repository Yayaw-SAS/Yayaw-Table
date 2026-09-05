import { Window } from "happy-dom";

// Initialize the browser before UI modules choose their client/server hooks.
const browser = new Window({ url: "http://localhost" });
// Bun 1.2 does not populate the VM intrinsics expected by Happy DOM.
Object.assign(browser, {
  Array,
  Error,
  Object,
  Promise,
  RegExp,
  SyntaxError,
  TypeError,
});
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "DocumentFragment",
  "MutationObserver",
  "ResizeObserver",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "localStorage",
  "sessionStorage",
] as const) {
  const value = name === "window" ? browser : browser[name];
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}
Object.assign(globalThis, {
  getComputedStyle: browser.getComputedStyle.bind(browser),
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
  IS_REACT_ACT_ENVIRONMENT: true,
});

if (!("IntersectionObserver" in globalThis)) {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: class {
      disconnect = () => undefined;
      observe = () => undefined;
      unobserve = () => undefined;
    },
    writable: true,
  });
}
