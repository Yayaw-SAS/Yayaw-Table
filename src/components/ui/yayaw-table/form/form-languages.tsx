"use client";

import { useId } from "react";
import { formLanguageName } from "../utils/form-text";
import { RuleSelect } from "./form-rules";

/**
 * A form's languages as a segmented control (radios: arrow keys switch),
 * each named in itself ("English", "Français"), with "Add language" when
 * `onAdd` is given. Used by the Form settings ("Editing") and the Form view's
 * preview ("Language").
 */
export function FormLanguageSwitch({
  addLabel,
  addable = [],
  label,
  languages,
  onAdd,
  onChange,
  value,
}: {
  /** The legend: "Editing", "Language". */
  label: string;
  languages: readonly string[];
  value: string;
  onChange: (locale: string) => void;
  /** Languages "Add language" offers. */
  addable?: readonly string[];
  addLabel?: string;
  onAdd?: (locale: string) => void;
}) {
  const name = useId();
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      data-form-languages
    >
      <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
        <legend className="float-left mr-1 text-muted-foreground text-sm">
          {label}
        </legend>
        <div className="inline-flex flex-wrap rounded-md border bg-muted/60 p-0.5">
          {languages.map((locale) => (
            <label
              className="relative inline-flex h-7 cursor-pointer items-center rounded-[calc(var(--radius-md)-2px)] px-2.5 text-muted-foreground text-sm transition-colors has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50 dark:has-checked:bg-input/60"
              data-form-language={locale}
              key={locale}
              lang={locale}
            >
              <input
                checked={value === locale}
                className="sr-only"
                name={name}
                onChange={() => onChange(locale)}
                type="radio"
                value={locale}
              />
              {formLanguageName(locale)}
            </label>
          ))}
        </div>
      </fieldset>
      {onAdd && addLabel && addable.length ? (
        <div className="w-44 max-w-full">
          <RuleSelect
            label={addLabel}
            onChange={onAdd}
            options={addable.map((locale) => ({
              value: locale,
              label: formLanguageName(locale),
            }))}
            placeholder={addLabel}
            value=""
          />
        </div>
      ) : null}
    </div>
  );
}
