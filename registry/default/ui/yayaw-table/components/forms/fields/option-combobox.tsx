"use client";

import { ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "../../../providers/table-provider";
import { formLabel } from "../../../utils/form-view";
import { optionControlKey } from "../../../utils/table-contracts";
import type { FormSelectOption } from "../types";

type OptionValue = FormSelectOption["value"];

const folded = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
/** The label contains the search, ignoring case and accents, as in Vue (not cmdk's fuzzy match). */
const containsLabel = (_value: string, search: string, keywords?: string[]) =>
  keywords?.some((keyword) => folded(keyword).includes(folded(search.trim())))
    ? 1
    : 0;

/**
 * A `searchable` select or multiSelect field: a button opening a list that
 * filters as you type. Several picks show as removable chips under it.
 */
export function OptionCombobox({
  id,
  label,
  options,
  value,
  multiple,
  disabled,
  invalid,
  placeholder,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  options: readonly FormSelectOption[];
  /** One value, or a list when `multiple`. */
  value: unknown;
  multiple: boolean;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  onChange: (value: OptionValue | OptionValue[] | null) => void;
  onBlur?: () => void;
}) {
  const { locale = "en" } = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = (multiple && Array.isArray(value) ? value : [value]).filter(
    (item) => item != null && item !== ""
  ) as OptionValue[];
  const isSelected = (option: OptionValue) =>
    selected.some((item) => Object.is(item, option));
  const labelOf = (option: OptionValue) =>
    options.find((item) => Object.is(item.value, option))?.label ??
    String(option);
  const pick = (option: OptionValue) => {
    // The next search starts empty, so several picks can be typed in a row.
    setSearch("");
    if (!multiple) {
      onChange(option);
      setOpen(false);
      return;
    }
    onChange(
      isSelected(option)
        ? selected.filter((item) => !Object.is(item, option))
        : [...selected, option]
    );
  };
  const choose = placeholder ?? formLabel("choose", locale);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Popover
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setSearch("");
              onBlur?.();
            }
          }}
          open={open && !disabled}
        >
          <PopoverTrigger
            render={
              <Button
                aria-expanded={open}
                aria-invalid={invalid || undefined}
                aria-label={label}
                className="w-full justify-between font-normal"
                data-searchable-field=""
                disabled={disabled}
                id={id}
                role="combobox"
                type="button"
                variant="outline"
              >
                <span className="truncate">
                  {multiple || !selected.length ? choose : labelOf(selected[0])}
                </span>
                {multiple && selected.length > 0 && (
                  <Badge className="ml-auto" variant="secondary">
                    {selected.length}
                  </Badge>
                )}
                <ChevronsUpDown aria-hidden="true" className="opacity-50" />
              </Button>
            }
          />
          <PopoverContent
            align="start"
            className="w-(--anchor-width) min-w-[min(18rem,calc(100vw-2rem))] gap-0 p-0"
          >
            <Command filter={containsLabel}>
              <CommandInput
                aria-label={`${label} ${formLabel("searchOptions", locale)}`}
                onValueChange={setSearch}
                placeholder={formLabel("searchOptions", locale)}
                value={search}
              />
              <CommandList className="max-h-[min(16rem,40dvh)]">
                <CommandEmpty>
                  {formLabel("noMatchingOption", locale)}
                </CommandEmpty>
                {options.map((option) => (
                  <CommandItem
                    className="min-h-11 md:min-h-8"
                    data-checked={isSelected(option.value)}
                    disabled={option.disabled}
                    key={optionControlKey(option.value)}
                    keywords={[option.label]}
                    onSelect={() => pick(option.value)}
                    value={optionControlKey(option.value)}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {!multiple && selected.length > 0 && (
          <Button
            aria-label={formLabel("removeOption", locale, undefined, {
              label: labelOf(selected[0]),
            })}
            disabled={disabled}
            onClick={() => onChange(null)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      {multiple && selected.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {selected.map((option) => (
            <li key={optionControlKey(option)}>
              <Badge className="gap-1" variant="secondary">
                {labelOf(option)}
                <button
                  aria-label={formLabel("removeOption", locale, undefined, {
                    label: labelOf(option),
                  })}
                  className="rounded-sm"
                  disabled={disabled}
                  onClick={() =>
                    onChange(
                      selected.filter((item) => !Object.is(item, option))
                    )
                  }
                  type="button"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
