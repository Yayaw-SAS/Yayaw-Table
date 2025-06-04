import { cn } from "@/lib/utils"
import { type VariantProps, cva } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import * as React from "react"

const loaderVariants = cva("animate-spin text-muted-foreground", {
    defaultVariants: {
        size: "default"
    },
    variants: {
        size: {
            default: "h-4 w-4",
            lg: "h-6 w-6",
            sm: "h-2 w-2",
            xl: "h-10 w-10"
        }
    }
})

export interface LoaderProps
    extends React.HTMLAttributes<SVGSVGElement>,
        VariantProps<typeof loaderVariants> {
    asChild?: boolean
}

const Loader = React.forwardRef<SVGSVGElement, LoaderProps>(
    ({ className, size, ...props }, ref) => {
        return <Loader2 className={cn(loaderVariants({ className, size }))} ref={ref} {...props} />
    }
)
Loader.displayName = "Loader"

export { Loader, loaderVariants }
