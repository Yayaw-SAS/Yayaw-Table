"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { ThemeToggle } from "@/src/components/ui/custom/theme-toggle";
import { Link, usePathname } from "@/src/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";

const ANCHOR_SUFFIX_REGEX = /#.*$/;

export function SiteHeader() {
  const t = useTranslations("Nav");
  const common = useTranslations("Common");
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const items = useMemo(() => {
    return [
      { label: t("docs"), href: "/docs" },
      { label: t("example"), href: "/example" },
    ];
  }, [t]);

  const copyInstallCommand = async () => {
    const installCommand = common("installCommand");

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(installCommand);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = installCommand;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-border/60 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          className="inline-flex items-center gap-2 font-display font-semibold text-foreground text-lg tracking-tight"
          href="/"
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
          {t("brand")}
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const normalizedHref = item.href.replace(ANCHOR_SUFFIX_REGEX, "");
            const hasAnchor = item.href.includes("#");
            const isRootPath = normalizedHref === "/";
            let isActive = false;

            if (hasAnchor || isRootPath) {
              isActive = pathname === "/";
            } else {
              isActive =
                pathname === normalizedHref ||
                pathname.startsWith(`${normalizedHref}/`);
            }

            return (
              <Link
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          <ThemeToggle
            className="rounded-md border border-border/60"
            variant="switch"
          />
          <Button
            className="font-medium"
            onClick={copyInstallCommand}
            size="sm"
            type="button"
            variant="outline"
          >
            {isCopied ? common("copied") : common("copy")}
          </Button>
          <span aria-live="polite" className="sr-only">
            {isCopied ? common("copiedInstallCommand") : ""}
          </span>
          <Link href="/docs/installation">
            <Button size="sm" type="button">
              {t("install")}
            </Button>
          </Link>
        </div>

        <Button
          aria-expanded={isOpen}
          aria-label={isOpen ? t("closeMenu") : t("openMenu")}
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
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2">
              <LanguageSwitcher />
              <ThemeToggle variant="switch" />
            </div>
            <Button
              className="mt-2 w-full"
              onClick={copyInstallCommand}
              type="button"
              variant="outline"
            >
              {isCopied ? common("copied") : common("copy")}
            </Button>
            <Link href="/docs/installation" onClick={() => setIsOpen(false)}>
              <Button className="mt-2 w-full" type="button">
                {t("install")}
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
