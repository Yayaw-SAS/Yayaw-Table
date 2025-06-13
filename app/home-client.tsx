"use client"

import Link from 'next/link'
import { ThemeToggle } from '../index'

export function HomePageClient() {
  return (
    <div className="py-12 min-h-screen bg-gradient-to-b from-background to-muted/20 transition-colors">
      {/* Header with Theme Toggle */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle variant="dropdown" />
      </div>

      <div className="flex items-center justify-center min-h-screen">
        <div className="max-w-4xl mx-auto text-center px-6">
          {/* Hero Section */}
          <div className="space-y-6">
            <h1 className="text-5xl font-bold text-foreground sm:text-6xl">
              📦 <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                YaYaw Table
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A flexible, powerful data table component library for React that lets you 
              <strong className="text-foreground"> define your own table configurations</strong> instead of imposing predefined structures.
            </p>
            
            <p className="text-muted-foreground/80">
              No assumptions, full control. Built on @tanstack/react-table with TypeScript.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link 
              href="/example"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
            >
              🚀 See Live Examples
            </Link>
            
            <Link 
              href="/docs"
              className="inline-flex items-center justify-center px-6 py-3 border border-border bg-background text-foreground font-medium rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              📚 Read Documentation
            </Link>
          </div>

          {/* Quick Preview */}
          <div className="mt-12 bg-card rounded-lg shadow-lg border border-border p-6 text-left max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-center text-card-foreground">Quick Start</h3>
            <div className="bg-muted p-4 rounded overflow-x-auto">
              <pre className="text-sm text-muted-foreground">
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
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 bg-card rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="text-2xl mb-3">🎛️</div>
              <h3 className="font-semibold mb-2 text-card-foreground">User-Defined</h3>
              <p className="text-muted-foreground text-sm">You define the table structure, not the library</p>
            </div>
            
            <div className="p-6 bg-card rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="text-2xl mb-3">🏗️</div>
              <h3 className="font-semibold mb-2 text-card-foreground">Flexible Types</h3>
              <p className="text-muted-foreground text-sm">7 column types: text, number, tag, date, boolean, code, dynamic</p>
            </div>
            
            <div className="p-6 bg-card rounded-lg border border-border hover:shadow-md transition-shadow">
              <div className="text-2xl mb-3">🚀</div>
              <h3 className="font-semibold mb-2 text-card-foreground">Built on TanStack</h3>
              <p className="text-muted-foreground text-sm">Powered by @tanstack/react-table with performance</p>
            </div>
          </div>

          {/* Theme Notice */}
          <div className="mt-8 p-4 bg-accent/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              🎨 <strong className="text-foreground">Try the theme toggle</strong> in the top-right corner to see how YaYaw Table adapts to your design system!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 