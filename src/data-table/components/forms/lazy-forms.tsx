/**
 * Lazy loaded form components
 * Only the essential form container is lazy loaded for performance
 */
'use client';

import { lazy, Suspense } from 'react';

// Lazy load the main form container
const CatalogueFormContainer = lazy(() =>
  import('./catalogue-form-container').then((mod) => ({
    default: mod.CatalogueFormContainer,
  }))
);

// Skeleton loader for the form container
const ContainerSkeleton = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="w-full max-w-md rounded-lg bg-background shadow-lg">
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <div className="h-10 w-20 animate-pulse rounded bg-muted" />
          <div className="h-10 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  </div>
);

// Export only the used lazy component
export function LazyCatalogueFormContainer(props: Record<string, unknown>) {
  return (
    <Suspense fallback={<ContainerSkeleton />}>
      <CatalogueFormContainer {...props} />
    </Suspense>
  );
}
