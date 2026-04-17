import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // Disable locale cookies and automatic detection so localized pages stay
  // cache-friendly and map to stable URLs.
  localeCookie: false,
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
