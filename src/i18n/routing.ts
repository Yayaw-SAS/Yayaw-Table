import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  // Keep stable localized URLs, but detect the browser locale on first visit
  // and persist a manual language choice afterward.
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];
