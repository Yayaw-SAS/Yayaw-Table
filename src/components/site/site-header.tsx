"use client";

import { Github, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CopyTextButton } from "@/src/components/site/copy-text-button";
import { Button } from "@/src/components/ui/button";
import { buttonVariants } from "@/src/components/ui/button-styles";
import { ThemeToggle } from "@/src/components/ui/custom/theme-toggle";
import { getLocalizedHref, stripLocalePrefix } from "@/src/i18n/pathnames";
import type { AppLocale } from "@/src/i18n/routing";
import { LATEST_INSTALL_COMMANDS } from "@/src/lib/package-manager";
import { siteConfig } from "@/src/lib/site-config";
import { LanguageSwitcher } from "./language-switcher";
import { usePackageManager } from "./package-manager-provider";

interface SiteHeaderLabels {
  brand: string;
  closeMenu: string;
  copied: string;
  copiedInstallCommand: string;
  copy: string;
  docs: string;
  example: string;
  install: string;
  language: string;
  openMenu: string;
  theme: string;
  themeDark: string;
  themeLight: string;
  themeSystem: string;
}

interface SiteHeaderProps {
  labels: SiteHeaderLabels;
  locale: AppLocale;
}

export function SiteHeader({ labels, locale }: SiteHeaderProps) {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname ?? "/");
  const [isOpen, setIsOpen] = useState(false);
  const { packageManager } = usePackageManager();
  const homeHref = getLocalizedHref(locale, "/");
  const docsHref = getLocalizedHref(locale, "/docs");
  const exampleHref = getLocalizedHref(locale, "/example");
  const installHref = getLocalizedHref(locale, "/docs/installation");
  const installCommand = LATEST_INSTALL_COMMANDS[packageManager];
  const themeLabels = {
    dark: labels.themeDark,
    light: labels.themeLight,
    system: labels.themeSystem,
    theme: labels.theme,
  };
  const items = [
    { href: docsHref, label: labels.docs, matchPathname: "/docs" },
    { href: exampleHref, label: labels.example, matchPathname: "/example" },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-border/60 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          className="inline-flex items-center gap-2 font-display font-semibold text-foreground text-lg tracking-tight"
          href={homeHref}
        >
          <Image
            alt="YaYaw Table"
            className="block dark:hidden"
            height={28}
            src="/yayaw-icon-light.svg"
            width={28}
          />
          <Image
            alt="YaYaw Table"
            className="hidden dark:block"
            height={28}
            src="/yayaw-icon-dark.svg"
            width={28}
          />
          {labels.brand}
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const isActive =
              normalizedPathname === item.matchPathname ||
              normalizedPathname.startsWith(`${item.matchPathname}/`);

            return (
              <Link
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                href={item.href}
                key={item.href}
                prefetch={item.matchPathname === "/example" ? false : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <LanguageSwitcher ariaLabel={labels.language} locale={locale} />
          <ThemeToggle
            className="rounded-md border border-border/60"
            labels={themeLabels}
          />
          <a
            aria-label="GitHub"
            className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
            href={siteConfig.githubUrl}
            rel="noopener"
            target="_blank"
          >
            <Github className="size-4" />
          </a>
          <CopyTextButton
            className="font-medium"
            copiedLabel={labels.copied}
            copyLabel={labels.copy}
            liveRegionLabel={labels.copiedInstallCommand}
            size="sm"
            text={installCommand}
            variant="outline"
          />
          <Link className={buttonVariants({ size: "sm" })} href={installHref}>
            {labels.install}
          </Link>
        </div>

        <Button
          aria-expanded={isOpen}
          aria-label={isOpen ? labels.closeMenu : labels.openMenu}
          className="md:hidden"
          onClick={() => setIsOpen((prevState) => !prevState)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {isOpen && (
        <div className="border-border/60 border-t bg-card px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {items.map((item) => (
              <Link
                className="rounded-md px-3 py-2 text-foreground text-sm transition-colors hover:bg-accent"
                href={item.href}
                key={item.href}
                onClick={() => setIsOpen(false)}
                prefetch={item.matchPathname === "/example" ? false : undefined}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2">
              <LanguageSwitcher ariaLabel={labels.language} locale={locale} />
              <ThemeToggle labels={themeLabels} />
              <a
                aria-label="GitHub"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: "ghost",
                })}
                href={siteConfig.githubUrl}
                rel="noopener"
                target="_blank"
              >
                <Github className="size-4" />
              </a>
            </div>
            <CopyTextButton
              className="mt-2 w-full"
              copiedLabel={labels.copied}
              copyLabel={labels.copy}
              liveRegionLabel={labels.copiedInstallCommand}
              text={installCommand}
              variant="outline"
            />
            <Link
              className={buttonVariants({ className: "mt-2 w-full" })}
              href={installHref}
              onClick={() => setIsOpen(false)}
            >
              {labels.install}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
