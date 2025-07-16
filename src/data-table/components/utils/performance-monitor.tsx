/**
 * Simple performance monitoring for development
 * Lightweight development utility to track component loading
 */
'use client';

import { useEffect, useRef } from 'react';

/**
 * Simple hook to measure component render performance
 */
export function useRenderPerformance(_componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const currentTime = performance.now();
    const renderDuration = currentTime - lastRenderTime.current;

    if (process.env.NODE_ENV === 'development' && renderDuration > 16) {
      // Performance warning: render took longer than 16ms
    }

    lastRenderTime.current = currentTime;
  });

  return renderCount.current;
}

/**
 * Simple hook to measure lazy component loading time
 */
export function useLazyLoadPerformance(_componentName: string) {
  const startTime = useRef(performance.now());

  const markLoadComplete = () => {
    const loadTime = performance.now() - startTime.current;

    if (process.env.NODE_ENV === 'development') {
      // Log component load time for debugging
    }

    return loadTime;
  };

  return { markLoadComplete };
}
