"use client";

import { Check } from "lucide-react";
import { type ReactNode, useId } from "react";

export interface MenuChoice<TValue extends string> {
  value: TValue;
  label: string;
  icon?: ReactNode;
}

/** One choice per row, for settings screens in touch drawers. */
export function MenuChoiceList<TValue extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: TValue) => void;
  options: readonly MenuChoice<TValue>[];
  value: TValue;
}) {
  const name = useId();
  return (
    <fieldset className="grid gap-1 p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent has-focus-visible:bg-accent"
          key={option.value}
        >
          <input
            checked={option.value === value}
            className="sr-only"
            name={name}
            onChange={() => onChange(option.value)}
            type="radio"
            value={option.value}
          />
          {option.icon}
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.value === value ? (
            <Check aria-hidden="true" className="size-4 shrink-0" />
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}
