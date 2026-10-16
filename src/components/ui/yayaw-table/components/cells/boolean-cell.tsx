/**
 * Boolean cell component for data tables
 * Shows a checked or unchecked checkbox-style mark, as in the Vue edition
 */
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

import { useTableTranslations } from "../../hooks";

interface BooleanCellProps {
  value: boolean;
  /** `switch` (`displayVariant: "switch"`): drawn as a switch, as the Vue edition. */
  variant?: "checkbox" | "switch";
}

/**
 * Cell component for displaying boolean values: a filled mark with a check
 * for true, an empty box for false (never an error-colored badge).
 */
export function BooleanCell({ value, variant = "checkbox" }: BooleanCellProps) {
  const translations = useTableTranslations();
  if (variant === "switch") {
    // A picture of the switch: the cell around it is the control, so it is never a button itself.
    return (
      <span
        aria-label={value ? translations.true : translations.false}
        className={cn(
          "yayaw-cell-switch relative inline-flex h-[18.4px] w-[32px] shrink-0 items-center self-center rounded-full border border-transparent align-middle shadow-xs transition-all",
          value ? "bg-primary" : "bg-input dark:bg-input/80"
        )}
        data-state={value ? "checked" : "unchecked"}
        role="img"
      >
        <span
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-background transition-transform",
            value
              ? "translate-x-[calc(100%-2px)] dark:bg-primary-foreground"
              : "translate-x-0 dark:bg-foreground"
          )}
        />
      </span>
    );
  }
  return (
    <span
      aria-label={value ? translations.true : translations.false}
      className={cn(
        "yayaw-boolean inline-flex size-4 shrink-0 items-center self-center align-middle justify-center rounded-[4px] border shadow-xs",
        value
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-transparent"
      )}
      data-value={String(value)}
      role="img"
    >
      {value ? <Check aria-hidden="true" className="size-3.5" /> : null}
    </span>
  );
}
