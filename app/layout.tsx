import { ThemeProvider } from '@/src/components/theme-provider';
import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

const inter = Inter({
  subsets: ['latin'],
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html className={inter.className} lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <NuqsAdapter>
            <RootProvider>{children}</RootProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}

export const metadata = {
  title: 'YaYaw Table Documentation',
  description:
    'A flexible data table component library for React with user-defined configurations',
};
