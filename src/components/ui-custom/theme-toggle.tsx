"use client"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

import { Icon } from "./icon"

interface ThemeToggleProps {
    className?: string
    variant?: "dropdown" | "switch"
}

function ThemeToggle({ className, variant = "dropdown" }: ThemeToggleProps) {
    const { setTheme } = useTheme()

    const toggleTheme = (theme: string) => {
        setTheme(theme)
    }

    const { resolvedTheme } = useTheme()
    if (variant === "switch") {
        return (
            <div className={cn("flex items-center", className)}>
                <Button
                    className="group/toggle h-8 w-8 px-0 [&_svg]:size-4"
                    onClick={() => toggleTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    variant="ghost"
                >
                    <Icon className="hidden dark:block" name="Sun" />
                    <Icon className="block dark:hidden" name="Moon" />
                    <span className="sr-only">Theme</span>
                </Button>
            </div>
        )
    }

    return (
        <div className={cn("relative", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                        <Icon
                            className="dark:-rotate-90 h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:scale-0"
                            name="Sun"
                        />
                        <Icon
                            className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                            name="Moon"
                        />
                        <span className="sr-only">Theme</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => toggleTheme("light")}
                    >
                        Light
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => toggleTheme("dark")}
                    >
                        Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => toggleTheme("system")}
                    >
                        System
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

export { ThemeToggle }
