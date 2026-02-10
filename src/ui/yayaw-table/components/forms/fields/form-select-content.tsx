/**
 * Form-layer select dropdown content with built-in drawer support.
 * Uses Base UI primitives and applies container + absolute positioning when
 * the form is inside a drawer, so it works without modifying the shared Select.
 */
"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDrawerFormPortalContainer } from "../drawer-form-portal-context";

const POPUP_CLASSES =
  "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 min-w-36 rounded-md shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto data-[align-trigger=true]:animate-none";

const SCROLL_BUTTON_CLASSES =
  "bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4 top-0 w-full";

interface FormSelectContentProps
  extends SelectPrimitive.Popup.Props,
    Pick<
      SelectPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
    > {
  className?: string;
}

export function FormSelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: FormSelectContentProps) {
  const portalContainer = useDrawerFormPortalContainer();
  const insideDrawer = Boolean(portalContainer);

  return (
    <SelectPrimitive.Portal container={portalContainer ?? undefined}>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={insideDrawer ? false : alignItemWithTrigger}
        alignOffset={alignOffset}
        className="isolate z-50"
        positionMethod={insideDrawer ? "absolute" : undefined}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className={cn(POPUP_CLASSES, className)}
          data-align-trigger={insideDrawer ? false : alignItemWithTrigger}
          data-slot="select-content"
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow
            className={cn(SCROLL_BUTTON_CLASSES, "top-0")}
            data-slot="select-scroll-up-button"
          >
            <ChevronUpIcon />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow
            className={cn(SCROLL_BUTTON_CLASSES, "bottom-0")}
            data-slot="select-scroll-down-button"
          >
            <ChevronDownIcon />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}
