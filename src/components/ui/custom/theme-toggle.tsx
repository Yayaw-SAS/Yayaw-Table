"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";

import { Icon } from "./icon";

interface ThemeToggleProps {
  className?: string;
  variant?: "dropdown" | "switch";
}

function ThemeToggle({ className, variant = "dropdown" }: ThemeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(
    (theme: string) => {
      setTheme(theme);
    },
    [setTheme]
  );

  const handleSwitchClick = useCallback(() => {
    toggleTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, toggleTheme]);

  if (!mounted) {
    return (
      <div
        className={cn("flex items-center", className)}
        suppressHydrationWarning
      >
        <Button
          aria-label="Theme"
          className="group/toggle h-8 w-8 px-0 [&_svg]:size-4"
          disabled
          type="button"
          variant="ghost"
        >
          <span className="sr-only">Theme</span>
        </Button>
      </div>
    );
  }

  if (variant === "switch") {
    return (
      <div
        className={cn("flex items-center", className)}
        suppressHydrationWarning
      >
        <Button
          aria-label="Theme"
          className="group/toggle h-8 w-8 px-0 [&_svg]:size-4"
          onClick={handleSwitchClick}
          type="button"
          variant="ghost"
        >
          <Icon className="hidden dark:block" name="Sun" />
          <Icon className="block dark:hidden" name="Moon" />
          <span className="sr-only">Theme</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn("relative", className)}
      suppressHydrationWarning
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="icon" type="button" variant="ghost">
              <Icon
                className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
                name="Sun"
              />
              <Icon
                className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
                name="Moon"
              />
              <span className="sr-only">Theme</span>
            </Button>
          }
        />
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
  );
}

export { ThemeToggle };
