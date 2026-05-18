"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
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

type ThemeMode = "dark" | "light" | "system";

interface ThemeToggleLabels {
  dark: string;
  light: string;
  system: string;
  theme: string;
}

interface ThemeToggleProps {
  className?: string;
  labels?: Partial<ThemeToggleLabels>;
  variant?: "dropdown" | "switch";
}

const DEFAULT_LABELS: ThemeToggleLabels = {
  dark: "Dark",
  light: "Light",
  system: "System",
  theme: "Theme",
};

const THEME_OPTIONS: Array<{ labelKey: keyof ThemeToggleLabels; value: ThemeMode }> =
  [
    { labelKey: "light", value: "light" },
    { labelKey: "dark", value: "dark" },
    { labelKey: "system", value: "system" },
  ];

const THEME_ICONS = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

function normalizeTheme(theme: string | undefined): ThemeMode {
  if (theme === "dark" || theme === "light") {
    return theme;
  }

  return "system";
}

function ThemeToggle({
  className,
  labels,
  variant = "dropdown",
}: ThemeToggleProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const resolvedLabels = { ...DEFAULT_LABELS, ...labels };

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
  const activeTheme = normalizeTheme(theme);
  const TriggerIcon = THEME_ICONS[activeTheme];

  if (!mounted) {
    return (
      <div
        className={cn("flex items-center", className)}
        suppressHydrationWarning
      >
        <Button
          aria-label={resolvedLabels.theme}
          className="group/toggle h-8 w-8 px-0 [&_svg]:size-4"
          disabled
          type="button"
          variant="ghost"
        >
          <span className="sr-only">{resolvedLabels.theme}</span>
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
          aria-label={resolvedLabels.theme}
          className="group/toggle h-8 w-8 px-0 [&_svg]:size-4"
          onClick={handleSwitchClick}
          type="button"
          variant="ghost"
        >
          <Sun className="hidden size-4 dark:block" />
          <Moon className="block size-4 dark:hidden" />
          <span className="sr-only">{resolvedLabels.theme}</span>
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
            <Button
              aria-label={resolvedLabels.theme}
              size="icon"
              type="button"
              variant="ghost"
            >
              <TriggerIcon className="size-4" />
              <span className="sr-only">{resolvedLabels.theme}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {THEME_OPTIONS.map((option) => {
            const OptionIcon = THEME_ICONS[option.value];
            const isActive = activeTheme === option.value;

            return (
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                key={option.value}
                onClick={() => toggleTheme(option.value)}
              >
                <OptionIcon className="size-4" />
                <span>{resolvedLabels[option.labelKey]}</span>
                {isActive && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { ThemeToggle };
