import { cn } from "@/lib/utils";

interface ActionsHeaderProps {
  className?: string;
  title: string;
}

export function ActionsHeader({ className, title }: ActionsHeaderProps) {
  return (
    <div
      className={cn(
        "inline-flex h-full w-full shrink-0 items-center justify-center whitespace-nowrap px-2 font-normal text-foreground text-sm sm:justify-start",
        className
      )}
    >
      <span className="sr-only sm:not-sr-only">{title}</span>
    </div>
  );
}
