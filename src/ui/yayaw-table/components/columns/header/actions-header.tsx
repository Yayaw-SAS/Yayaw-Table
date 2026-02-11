import { cn } from "@/lib/utils";

interface ActionsHeaderProps {
  className?: string;
  title: string;
}

export function ActionsHeader({ className, title }: ActionsHeaderProps) {
  return (
    <div
      className={cn(
        "inline-flex h-full w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-none px-2 py-2 font-normal text-sm outline-none transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-0 focus-visible:ring-ring/50 has-[>svg]:px-3 aria-invalid:border-destructive aria-invalid:ring-destructive/20 sm:justify-start dark:aria-invalid:ring-destructive/40 dark:hover:bg-accent/50",
        className
      )}
    >
      <span className="sr-only font-medium text-sm sm:not-sr-only">
        {title}
      </span>
    </div>
  );
}
