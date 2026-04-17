import type { AppLocale } from "./routing";
import { routing } from "./routing";

const NON_DEFAULT_LOCALES = routing.locales.filter(
  (locale) => locale !== routing.defaultLocale
);

export function getLocalizedHref(locale: AppLocale, pathname: string): string {
  if (pathname === "/") {
    return locale === routing.defaultLocale ? "/" : `/${locale}`;
  }

  return locale === routing.defaultLocale ? pathname : `/${locale}${pathname}`;
}

export function stripLocalePrefix(pathname: string): string {
  for (const locale of NON_DEFAULT_LOCALES) {
    const localePrefix = `/${locale}`;

    if (pathname === localePrefix) {
      return "/";
    }

    if (pathname.startsWith(`${localePrefix}/`)) {
      return pathname.slice(localePrefix.length);
    }
  }

  return pathname;
}
