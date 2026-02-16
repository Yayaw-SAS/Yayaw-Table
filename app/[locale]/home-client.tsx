"use client";

import {
  CheckCircle2,
  Layers3,
  Link2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SiteHeader } from "@/src/components/site/site-header";
import { Button } from "@/src/components/ui/button";
import { Link } from "@/src/i18n/navigation";

const CASE_ICONS = {
  catalog: Layers3,
  orders: Workflow,
  users: ShieldCheck,
} as const;

const PRODUCT_ICONS = {
  architecture: Workflow,
  i18n: Sparkles,
  install: ScanSearch,
  stack: ShieldCheck,
  state: Link2,
  ux: Layers3,
} as const;

const MIGRATION_KEYS = ["before", "after", "outcome"] as const;
const PROOF_KEYS = ["ownership", "url", "i18n", "dx"] as const;

export function HomePageClient() {
  const t = useTranslations("Home");
  const common = useTranslations("Common");
  const [isCopied, setIsCopied] = useState(false);

  const copyCommand = async () => {
    const command = common("installCommand");

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(command);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = command;
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
    <div className="relative min-h-screen bg-site-gradient">
      <SiteHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pt-10 pb-16 sm:px-6">
        <section className="site-surface animate-rise rounded-3xl border border-border/70 p-6 shadow-2xl sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-primary text-xs">
            <span>{t("badgeA")}</span>
            <span>•</span>
            <span>{t("badgeB")}</span>
          </div>

          <h1 className="mt-5 max-w-5xl font-display text-4xl text-foreground leading-tight sm:text-6xl">
            {t("heroTitleLead")}
            <span className="bg-gradient-to-r from-primary via-cyan-500 to-sky-500 bg-clip-text text-transparent">
              {` ${t("heroTitleAccent")}`}
            </span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-muted-foreground sm:text-xl">
            {t("heroDescription")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/docs/installation">
              <Button className="w-full sm:w-auto" size="lg" type="button">
                {t("ctaInstall")}
              </Button>
            </Link>
            <Link href="/example">
              <Button
                className="w-full sm:w-auto"
                size="lg"
                type="button"
                variant="secondary"
              >
                {t("ctaExample")}
              </Button>
            </Link>
            <Link href="/docs">
              <Button
                className="w-full sm:w-auto"
                size="lg"
                type="button"
                variant="ghost"
              >
                {t("ctaDocs")}
              </Button>
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5">
            <p className="mb-3 text-muted-foreground text-xs">
              {t("installHint")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 overflow-x-auto rounded-lg bg-muted/70 px-3 py-2 font-mono text-foreground text-sm">
                {common("installCommand")}
              </code>
              <div className="flex flex-col items-start gap-1">
                <Button onClick={copyCommand} type="button" variant="outline">
                  {isCopied ? common("copied") : common("copy")}
                </Button>
                <span aria-live="polite" className="sr-only">
                  {isCopied ? common("copiedInstallCommand") : ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid animate-rise animate-rise-delay-1 gap-6 lg:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card/85 p-6 shadow-lg lg:col-span-1">
            <h2 className="font-display text-2xl text-foreground">
              {t("proofTitle")}
            </h2>
            <ul className="mt-4 space-y-3 text-muted-foreground text-sm">
              {PROOF_KEYS.map((key) => (
                <li className="flex items-start gap-2" key={key}>
                  <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                  <span>{t(`proofItems.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="rounded-2xl border border-border/70 bg-card/85 p-6 shadow-lg lg:col-span-3"
            id="use-cases"
          >
            <h2 className="font-display text-2xl text-foreground">
              {t("useCases.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("useCases.description")}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {(Object.keys(CASE_ICONS) as Array<keyof typeof CASE_ICONS>).map(
                (key) => {
                  const Icon = CASE_ICONS[key];

                  return (
                    <article
                      className="rounded-xl border border-border/60 bg-background/75 p-4"
                      key={key}
                    >
                      <Icon className="size-5 text-primary" />
                      <h3 className="mt-3 font-medium text-foreground">
                        {t(`useCases.${key}.title`)}
                      </h3>
                      <p className="mt-1 text-muted-foreground text-sm">
                        {t(`useCases.${key}.description`)}
                      </p>
                    </article>
                  );
                }
              )}
            </div>
          </div>
        </section>

        <section
          className="animate-rise animate-rise-delay-1 rounded-2xl border border-border/70 bg-card/85 p-6 shadow-lg"
          id="product"
        >
          <h2 className="font-display text-2xl text-foreground">
            {t("product.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("product.description")}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(
              Object.keys(PRODUCT_ICONS) as Array<keyof typeof PRODUCT_ICONS>
            ).map((key) => {
              const Icon = PRODUCT_ICONS[key];

              return (
                <article
                  className="rounded-xl border border-border/60 bg-background/75 p-4"
                  key={key}
                >
                  <Icon className="size-5 text-primary" />
                  <h3 className="mt-3 font-medium text-foreground">
                    {t(`product.pillars.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {t(`product.pillars.${key}.description`)}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid animate-rise animate-rise-delay-2 gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-border/70 bg-card/85 p-6 shadow-lg lg:col-span-2">
            <h2 className="font-display text-2xl text-foreground">
              {t("migration.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t("migration.description")}
            </p>

            <ul className="mt-5 space-y-3 text-muted-foreground text-sm">
              {MIGRATION_KEYS.map((key) => (
                <li
                  className="rounded-lg border border-border/60 bg-background/75 p-3"
                  key={key}
                >
                  {t(`migration.items.${key}`)}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-primary/20 bg-primary/10 p-6 shadow-lg">
            <h2 className="font-display text-2xl text-foreground">
              {t("finalCta.title")}
            </h2>
            <p className="mt-2 text-muted-foreground text-sm">
              {t("finalCta.description")}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/docs/installation">
                <Button className="w-full" type="button">
                  {t("finalCta.primary")}
                </Button>
              </Link>
              <Link href="/docs">
                <Button className="w-full" type="button" variant="secondary">
                  {t("finalCta.secondary")}
                </Button>
              </Link>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
