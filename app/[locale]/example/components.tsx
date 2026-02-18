import type React from "react";

import { cn } from "@/lib/utils";

export function CustomTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("font-display text-2xl text-foreground", className)}>
      {children}
    </h2>
  );
}

export function CustomDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>{children}</p>
  );
}
