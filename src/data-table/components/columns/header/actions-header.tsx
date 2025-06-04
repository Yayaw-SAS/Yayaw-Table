import { cn } from "@/lib/utils"

interface ActionsHeaderProps {
    className?: string
    title: string
}

export function ActionsHeader({ className, title }: ActionsHeaderProps) {
    return (
        <div className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm transition-all shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:hover:bg-accent/50 py-2 has-[>svg]:px-3 h-full w-full justify-start rounded-none px-2 font-normal hover:bg-accent hover:text-accent-foreground focus-visible:ring-0")}>
            <span className="font-medium text-sm">{title}</span>
        </div>
    )
}
