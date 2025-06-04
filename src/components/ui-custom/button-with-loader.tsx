import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

import type { ComponentProps } from "react"

type ButtonWithLoaderProps = ComponentProps<typeof Button> & {
    isLoading?: boolean
    loadingText?: string
}

export function ButtonWithLoader({
    children,
    className,
    isLoading,
    loadingText,
    variant = "default",
    ...props
}: ButtonWithLoaderProps) {
    return (
        <Button
            className={cn(isLoading && "opacity-50", className)}
            disabled={isLoading}
            variant={variant}
            {...props}
        >
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {loadingText}
                </>
            ) : (
                children
            )}
        </Button>
    )
}
