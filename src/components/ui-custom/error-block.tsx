"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"

const FileQuestion = dynamic(() => import("lucide-react").then((mod) => mod.FileQuestion), {
    ssr: false
})

interface ErrorBlockProps {
    action?: {
        href: string
        label: string
    }
    code?: string
    description?: string
    icon?: React.ElementType
    message?: string
    reset?: () => void
    showBackButton?: boolean
    showHomeButton?: boolean
    title?: string
}

export function ErrorBlock({
    action,
    code,
    description,
    icon: Icon = FileQuestion,
    message,
    reset,
    showBackButton = false,
    showHomeButton,
    title
}: ErrorBlockProps) {
    const router = useRouter()
    return (
        <div className="container mx-auto flex h-full flex-col items-center justify-center px-8">
            <div className="absolute inset-x-0 flex w-full translate-y-[-85%] justify-center text-center font-black text-[8rem] text-muted-foreground opacity-[0.1] sm:translate-y-[-60%] sm:text-[10rem] md:translate-y-[-50%] md:text-[12rem] lg:translate-y-[-40%] lg:text-[16rem] xl:translate-y-[-30%] xl:text-[20rem] dark:opacity-[0.1]">
                {code}
            </div>
            <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center gap-2 text-center">
                <h1>{title}</h1>
                {description && <p>{description}</p>}
                <p>{message}</p>
                <div className="mx-auto mt-10 flex w-fit flex-col gap-x-6 gap-y-3 sm:flex-row sm:items-center sm:justify-center">
                    {showBackButton && (
                        <Button
                            className="group"
                            onClick={() => window.history.back()}
                            variant="secondary"
                        >
                            <ArrowLeft
                                className="group-hover:-translate-x-0.5 ms-0 me-1 opacity-60 transition-transform"
                                size={16}
                                strokeWidth={2}
                            />
                            Back
                        </Button>
                    )}
                    {action && (
                        <Button asChild className="cursor-pointer" variant="default">
                            <Link href={action.href}>{action.label}</Link>
                        </Button>
                    )}
                    {reset && (
                        <Button onClick={reset} variant="outline">
                            Try again
                        </Button>
                    )}
                    {showHomeButton && (
                        <Button className="cursor-pointer" onClick={() => router.push("/")}>
                            Home
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
