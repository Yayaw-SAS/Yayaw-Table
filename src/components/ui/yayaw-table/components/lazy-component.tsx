"use client";

import {
  type ComponentType,
  type JSX,
  lazy,
  type ReactNode,
  Suspense,
} from "react";

/**
 * A component whose code loads the first time it renders, not with the table:
 * views, panels and dialogs that most visitors never open stay out of the
 * first download.
 */
export function lazyComponent<P extends object>(
  load: () => Promise<ComponentType<P>>,
  fallback: ReactNode = null
): ComponentType<P> {
  const Lazy = lazy(async () => ({ default: await load() }));
  const Loader = (props: P) => (
    <Suspense fallback={fallback}>
      <Lazy {...(props as P & JSX.IntrinsicAttributes)} />
    </Suspense>
  );
  return Loader;
}
