"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { getLocalizedHref, stripLocalePrefix } from "@/src/i18n/pathnames";
import type { AppLocale } from "@/src/i18n/routing";
import { routing } from "@/src/i18n/routing";

interface LanguageSwitcherProps {
  ariaLabel: string;
  locale: AppLocale;
}

export function LanguageSwitcher({ ariaLabel, locale }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 text-muted-foreground text-xs">
      <span className="sr-only">{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        className="rounded-md border border-border/70 bg-background px-2 py-1 text-foreground text-xs"
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value as AppLocale;

          startTransition(() => {
            const basePathname = stripLocalePrefix(pathname ?? "/");
            const nextPathname = getLocalizedHref(nextLocale, basePathname);
            const queryString = searchParams.toString();

            router.replace(
              queryString ? `${nextPathname}?${queryString}` : nextPathname
            );
          });
        }}
        value={locale}
      >
        {routing.locales.map((itemLocale) => (
          <option key={itemLocale} value={itemLocale}>
            {itemLocale.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
