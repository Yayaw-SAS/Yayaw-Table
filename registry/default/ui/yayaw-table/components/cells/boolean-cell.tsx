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
}

/**
 * Cell component for displaying boolean values: a filled mark with a check
 * for true, an empty box for false (never an error-colored badge).
 */
export function BooleanCell({ value }: BooleanCellProps) {
  const translations = useTableTranslations();
  return (
    <span
      aria-label={value ? translations.true : translations.false}
      className={cn(
        "yayaw-boolean inline-flex size-4 shrink-0 items-center justify-center self-center rounded-[4px] border align-middle shadow-xs",
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
