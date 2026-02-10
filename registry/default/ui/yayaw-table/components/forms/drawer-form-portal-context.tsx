"use client";

import { createContext, type RefObject, useContext } from "react";

/**
 * Context that provides a ref to the drawer form content container.
 * When set, Select (and other portalled components) can render their dropdown
 * inside this container so focus stays within the drawer and the dropdown
 * doesn't get closed by the drawer's focus trap.
 */
const DrawerFormPortalContainerContext =
  createContext<RefObject<HTMLElement | null> | null>(null);

export function useDrawerFormPortalContainer(): RefObject<HTMLElement | null> | null {
  return useContext(DrawerFormPortalContainerContext);
}

export { DrawerFormPortalContainerContext };
