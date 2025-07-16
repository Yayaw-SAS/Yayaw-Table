'use client';

import Link from 'next/link';
import { ThemeToggle } from '../index';

export function HomePageClient() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-12 transition-colors">
      {/* Header with Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle variant="switch" />
      </div>

      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-4xl px-6 text-center">
          {/* Hero Section */}
          <div className="space-y-6">
            <h1 className="font-bold text-5xl text-foreground sm:text-6xl">
              📦{' '}
              <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                YaYaw Table
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-muted-foreground text-xl">
              A flexible, powerful data table component library for React that
              lets you
              <strong className="text-foreground">
                {' '}
                define your own table configurations
              </strong>{' '}
              instead of imposing predefined structures.
            </p>

            <p className="text-muted-foreground/80">
              No assumptions, full control. Built on @tanstack/react-table with
              TypeScript.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 hover:shadow-xl"
              href="/example"
            >
              🚀 See Live Examples
            </Link>

            <Link
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              href="/docs"
            >
              📚 Read Documentation
            </Link>
          </div>

          {/* Quick Preview */}
          <div className="mx-auto mt-12 max-w-2xl rounded-lg border border-border bg-card p-6 text-left shadow-lg">
            <h3 className="mb-4 text-center font-semibold text-card-foreground text-lg">
              Quick Start
            </h3>
            <div className="overflow-x-auto rounded bg-muted p-4">
              <pre className="text-muted-foreground text-sm">
                {`import { DataTable, defineTableConfig } from 'yayaw-table'

const config = defineTableConfig({
  id: "products",
  columns: {
    definitions: [
      { id: "name", type: "text", header: "Product Name" },
      { id: "price", type: "number", header: "Price" },
      { id: "status", type: "tag", header: "Status" }
    ],
    order: ["select", "name", "price", "status", "actions"],
    visible: ["select", "name", "price", "status", "actions"]
  },
  table: { defaultPageSize: 10 }
})

<DataTable 
  tableType="products"
  config={config}
  data={products}
/>`}
              </pre>
            </div>
          </div>

          {/* Features */}
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 text-2xl">🎛️</div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                User-Defined
              </h3>
              <p className="text-muted-foreground text-sm">
                You define the table structure, not the library
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 text-2xl">🏗️</div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                Flexible Types
              </h3>
              <p className="text-muted-foreground text-sm">
                7 column types: text, number, tag, date, boolean, code, dynamic
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 text-2xl">🚀</div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                Built on TanStack
              </h3>
              <p className="text-muted-foreground text-sm">
                Powered by @tanstack/react-table with performance
              </p>
            </div>
          </div>

          {/* Theme Notice */}
          <div className="mt-8 rounded-lg border border-border bg-accent/50 p-4">
            <p className="text-muted-foreground text-sm">
              🎨{' '}
              <strong className="text-foreground">Try the theme toggle</strong>{' '}
              in the top-right corner to see how YaYaw Table adapts to your
              design system!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
