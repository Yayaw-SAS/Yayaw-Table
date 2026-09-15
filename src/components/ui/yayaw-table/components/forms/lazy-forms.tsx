/**
 * Lazy loaded form components
 * Only the essential form container is lazy loaded for performance
 */
"use client";

import { lazy, Suspense } from "react";

// Lazy load the main form container
const CatalogueFormContainer = lazy(() =>
  import("./catalogue-form-container").then((mod) => ({
    default: mod.CatalogueFormContainer,
  }))
);

// Export only the used lazy component
export function LazyCatalogueFormContainer(props: Record<string, unknown>) {
  return (
    <Suspense fallback={null}>
      <CatalogueFormContainer {...props} />
    </Suspense>
  );
}
