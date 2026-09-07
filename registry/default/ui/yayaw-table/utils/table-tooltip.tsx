"use client";

import type { ComponentProps, ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Forward trigger props so menus and tooltips share one accessible button. */
export function TableTooltip({
  children,
  label,
  ...props
}: Omit<ComponentProps<typeof TooltipTrigger>, "children" | "render"> & {
  children: ReactElement;
  label: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={children} {...props} />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
