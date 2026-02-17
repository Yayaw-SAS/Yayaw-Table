import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { Toaster } from "@/src/components/ui/sonner";
import { routing } from "@/src/i18n/routing";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body-family",
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-family",
});

const rootThemeOptions = {
  attribute: "class",
  defaultTheme: "system" as const,
  disableTransitionOnChange: true,
  enableSystem: true,
} as const;

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestLocale = await getLocale().catch(() => routing.defaultLocale);
  const locale = hasLocale(routing.locales, requestLocale)
    ? requestLocale
    : routing.defaultLocale;

  return (
    <html
      className={`${bodyFont.variable} ${displayFont.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans text-foreground antialiased">
        <NuqsAdapter>
          <RootProvider theme={rootThemeOptions}>
            {children}
            <Toaster />
          </RootProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
