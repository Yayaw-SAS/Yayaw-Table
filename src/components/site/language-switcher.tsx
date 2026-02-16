"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import type { AppLocale } from "@/src/i18n/routing";
import { routing } from "@/src/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("Nav");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="inline-flex items-center gap-2 text-muted-foreground text-xs">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        className="rounded-md border border-border/70 bg-background px-2 py-1 text-foreground text-xs"
        disabled={isPending}
        onChange={(event) => {
          const nextLocale = event.target.value as AppLocale;

          startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
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
