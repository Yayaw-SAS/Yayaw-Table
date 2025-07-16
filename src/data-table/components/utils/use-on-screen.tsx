/**
 * Hook utilitaire pour détecter quand un élément est visible dans le viewport
 * en utilisant l'Intersection Observer API
 */
'use client';

import { useEffect, useRef, useState } from 'react';

interface UseOnScreenOptions {
  rootMargin?: string;
  threshold?: number | number[];
}

/**
 * Hook pour détecter si un élément est visible dans le viewport
 * @param options Options de configuration pour l'Intersection Observer
 * @returns Un objet avec isVisible (booléen) et ref (à attacher à l'élément à observer)
 */
export function useOnScreen(options: UseOnScreenOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [options]);

  return { isVisible, ref } as const;
}
