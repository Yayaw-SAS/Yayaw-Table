import { cn } from "@/lib/utils";

interface ActionsHeaderProps {
  className?: string;
  title?: string;
}

export function ActionsHeader({ className, title }: ActionsHeaderProps) {
  return (
    <div
      aria-label={title ?? "Actions"}
      className={cn(
        "flex h-full w-full shrink-0 items-center justify-center",
        className
      )}
    />
  );
}
