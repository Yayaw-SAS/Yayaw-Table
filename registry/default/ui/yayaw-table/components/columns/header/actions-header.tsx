import { cn } from "@/lib/utils";

interface ActionsHeaderProps {
  className?: string;
  title?: string;
}

export function ActionsHeader({ className }: ActionsHeaderProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full shrink-0 items-center justify-center",
        className
      )}
    />
  );
}
