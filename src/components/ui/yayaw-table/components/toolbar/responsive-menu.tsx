"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/src/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";

/**
 * A settings surface uses dialog semantics because it contains form controls.
 * Clip the outer shell so input focus cannot scroll its header out of view;
 * the inner scroll area remains the sole scrolling surface.
 */
export function ResponsiveMenu({
  compact,
  open,
  onOpenChange,
  trigger,
  title,
  children,
  align = "start",
  sideOffset = 5,
}: {
  compact: boolean;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  title: string;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <Drawer onOpenChange={onOpenChange} open={open}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          aria-describedby={undefined}
          className="max-h-[90dvh] overflow-clip pb-[env(safe-area-inset-bottom)] data-[vaul-drawer-direction=bottom]:max-h-[90dvh] [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11"
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Popover modal={false} onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align={align}
        aria-label={title}
        className="w-[min(20rem,calc(100vw-1rem))] gap-0 overflow-clip p-0"
        sideOffset={sideOffset}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
