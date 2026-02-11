"use client";

import Link from "next/link";
import { ThemeToggle } from "@/ui/custom/theme-toggle";

const productPillars = [
  {
    title: "Install with Shadcn CLI",
    description:
      "One command copies the full table code inside your app so you keep full ownership.",
    icon: "🧩",
  },
  {
    title: "Config-Driven Setup",
    description:
      "Plug in getTableConfig/getTableActions and you are production-ready in minutes.",
    icon: "⚙️",
  },
  {
    title: "Native i18n",
    description:
      "Translation keys are built-in across pagination, filters, presets, views, and forms.",
    icon: "🌍",
  },
] as const;

const coreFeatures = [
  {
    title: "Advanced Filtering System",
    description:
      "Typed operators by data type, faceted filters, presets, and modern advanced panels.",
  },
  {
    title: "URL State by Default",
    description:
      "Search, sort, pagination, grouping, and filters are shareable through URL params.",
  },
  {
    title: "Server + Client Friendly",
    description:
      "Works with server actions/API handlers while preserving smooth client UX.",
  },
  {
    title: "Production UX Toolkit",
    description:
      "Bulk actions, safe pagination, drag/drop columns, toolbar menus, and resilient defaults.",
  },
  {
    title: "Shadcn + TanStack Foundation",
    description:
      "Built on TanStack Table/Query with Shadcn components and strong TypeScript safety.",
  },
  {
    title: "Copy-Paste Ownership",
    description:
      "Registry install means no black box package lock-in for the UI layer.",
  },
] as const;

const comparisonRows = [
  {
    feature: "Advanced search + global search wiring",
    yayaw: "Built-in",
    basic: "Manual glue code",
  },
  {
    feature: "Grouping + grouped UX",
    yayaw: "Built-in",
    basic: "Partial / custom work",
  },
  {
    feature: "URL state (sort, filters, pagination, grouping)",
    yayaw: "Built-in",
    basic: "Usually custom",
  },
  {
    feature: "Native i18n surface (filters, presets, views, forms)",
    yayaw: "Comprehensive",
    basic: "Often limited",
  },
  {
    feature: "Advanced filters + presets",
    yayaw: "Included",
    basic: "Rare by default",
  },
  {
    feature: "Shadcn CLI install + code ownership",
    yayaw: "Yes",
    basic: "Depends",
  },
] as const;

const setupSteps = [
  {
    title: "1. Install",
    code: "npx shadcn@latest add https://table.yayaw.eu/r/yayaw-table.json",
    note: "Installs under components/ui/yayaw-table",
  },
  {
    title: "2. Configure",
    code: "getTableConfig(tableType) + getTableActions(tableType)",
    note: "Use your own schema, endpoints, and business rules",
  },
  {
    title: "3. Render",
    code: `<DataTable tableType="products"\n  getTableConfig={getTableConfig}\n  getTableActions={getTableActions}\n/>`,
    note: "Enable advanced filters, i18n, and URL state as needed",
  },
] as const;

export function HomePageClient() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_38%),radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.22),transparent_42%)] py-10 transition-colors">
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle variant="switch" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <section className="rounded-2xl border border-border/70 bg-card/85 p-8 shadow-xl backdrop-blur sm:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary text-xs">
            <span>Shadcn Registry + TypeScript</span>
            <span>•</span>
            <span>Production Ready</span>
          </div>

          <h1 className="max-w-4xl font-semibold text-4xl text-foreground leading-tight sm:text-6xl">
            Build advanced tables fast,
            <span className="bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
              {" "}
              without fighting your stack.
            </span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg text-muted-foreground sm:text-xl">
            YaYaw Table gives you an enterprise-grade data table with advanced
            filters, URL state, bulk actions, and native i18n while keeping your
            project architecture simple and configurable.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              href="/example"
            >
              Explore Live Example
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              href="/docs"
            >
              Read Setup Docs
            </Link>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {productPillars.map((pillar) => (
              <div
                className="rounded-xl border border-border/70 bg-background/70 p-4 text-left"
                key={pillar.title}
              >
                <div className="mb-2 text-2xl">{pillar.icon}</div>
                <h3 className="font-medium text-foreground">{pillar.title}</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-md lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-2xl text-foreground">
                Setup in 3 steps
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-600 text-xs">
                5-minute onboarding
              </span>
            </div>

            <div className="space-y-4">
              {setupSteps.map((step) => (
                <div
                  className="rounded-xl border border-border/70 bg-muted/30 p-4"
                  key={step.title}
                >
                  <h3 className="mb-2 font-medium text-foreground">
                    {step.title}
                  </h3>
                  <pre className="overflow-x-auto rounded bg-background p-3 text-muted-foreground text-sm">
                    {step.code}
                  </pre>
                  <p className="mt-2 text-muted-foreground text-xs">
                    {step.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-md lg:col-span-2">
            <h2 className="font-semibold text-2xl text-foreground">
              Why teams pick it
            </h2>
            <ul className="mt-4 space-y-3 text-muted-foreground text-sm">
              <li className="rounded-lg border border-border/60 bg-background/70 p-3">
                Keeps full control of your UI code through registry copy.
              </li>
              <li className="rounded-lg border border-border/60 bg-background/70 p-3">
                Works cleanly with custom backends and server actions.
              </li>
              <li className="rounded-lg border border-border/60 bg-background/70 p-3">
                Covers real-world table UX: filters, views, presets, bulk flows.
              </li>
              <li className="rounded-lg border border-border/60 bg-background/70 p-3">
                Strong translation model from day one, not bolted-on later.
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-8 shadow-md">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-2xl text-foreground">
              Feature coverage
            </h2>
            <Link
              className="rounded-lg border border-border bg-background px-4 py-2 font-medium text-sm transition-colors hover:bg-accent"
              href="/docs"
            >
              Full Documentation
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coreFeatures.map((feature) => (
              <article
                className="rounded-xl border border-border/70 bg-background/70 p-4"
                key={feature.title}
              >
                <h3 className="font-medium text-foreground">{feature.title}</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-8 shadow-md">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-2xl text-foreground">
              Compared to generic table libs
            </h2>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
              Practical feature depth
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-border/70 border-b">
                  <th className="px-3 py-2 font-medium text-foreground">
                    Capability
                  </th>
                  <th className="px-3 py-2 font-medium text-foreground">
                    YaYaw Table
                  </th>
                  <th className="px-3 py-2 font-medium text-foreground">
                    Generic table libs
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr className="border-border/50 border-b" key={row.feature}>
                    <td className="px-3 py-3 text-foreground">{row.feature}</td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-emerald-500/15 px-2 py-1 font-medium text-emerald-600 text-xs">
                        {row.yayaw}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.basic}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-primary/10 p-6 text-center">
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">Tip:</strong> toggle theme in
            the top-right corner to preview integration with your design system.
          </p>
        </section>
      </div>
    </div>
  );
}
