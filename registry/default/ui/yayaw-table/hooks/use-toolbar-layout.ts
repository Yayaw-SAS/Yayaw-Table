"use client";

import { useSetAtom } from "jotai";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toolbarCompactAtom } from "../atoms/table-atoms";
import { useIsMobile } from "./use-mobile";

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

/** Remember the full layout's natural width so narrow embedded tables also compact. */
export function useToolbarLayout(tableId: string) {
  const root = useRef<HTMLDivElement>(null);
  const requiredWidth = useRef(768);
  const mobile = useIsMobile();
  const [constrained, setConstrained] = useState(false);
  const compact = mobile || constrained;
  const setCompact = useSetAtom(toolbarCompactAtom(tableId));
  useEffect(() => {
    setCompact(compact);
  }, [compact, setCompact]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      if (!width) {
        return;
      }
      if (!compact) {
        requiredWidth.current = Math.max(768, measureToolbarContent(element));
      }
      setConstrained(width + 1 < requiredWidth.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [compact]);
  return { compact, root, mobile };
}
