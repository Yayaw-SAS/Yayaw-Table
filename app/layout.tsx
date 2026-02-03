import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
});

const rootThemeOptions = {
  attribute: "class",
  defaultTheme: "system" as const,
  disableTransitionOnChange: true,
  enableSystem: true,
} as const;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html className={inter.className} lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans text-foreground">
        <NuqsAdapter>
          <RootProvider theme={rootThemeOptions}>{children}</RootProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}

export const metadata = {
  title: "YaYaw Table Documentation",
  description:
    "A flexible data table component library for React with user-defined configurations",
};
