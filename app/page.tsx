import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
      <div className="max-w-4xl mx-auto text-center px-6">
        {/* Hero Section */}
        <div className="space-y-6">
          <h1 className="text-5xl font-bold text-gray-900 sm:text-6xl">
            📦 <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              YaYaw Table
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A flexible, powerful data table component library for React that lets you 
            <strong> define your own table configurations</strong> instead of imposing predefined structures.
          </p>
          
          <p className="text-gray-500">
            No assumptions, full control. Built on @tanstack/react-table with TypeScript.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link 
            href="/example"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            🚀 See Live Examples
          </Link>
          
          <Link 
            href="/docs"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            📚 Read Documentation
          </Link>
        </div>

        {/* Quick Preview */}
        <div className="mt-12 bg-white rounded-lg shadow-lg border p-6 text-left max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold mb-4 text-center">Quick Start</h3>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
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

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 bg-white rounded-lg border">
            <div className="text-2xl mb-3">🎛️</div>
            <h3 className="font-semibold mb-2">User-Defined</h3>
            <p className="text-gray-600 text-sm">You define the table structure, not the library</p>
          </div>
          
          <div className="p-6 bg-white rounded-lg border">
            <div className="text-2xl mb-3">🏗️</div>
            <h3 className="font-semibold mb-2">Flexible Types</h3>
            <p className="text-gray-600 text-sm">7 column types: text, number, tag, date, boolean, code, dynamic</p>
          </div>
          
          <div className="p-6 bg-white rounded-lg border">
            <div className="text-2xl mb-3">🚀</div>
            <h3 className="font-semibold mb-2">Built on TanStack</h3>
            <p className="text-gray-600 text-sm">Powered by @tanstack/react-table for performance</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'YaYaw Table - User-Defined Data Tables for React',
  description: 'A flexible data table component library that lets you define your own configurations instead of imposing predefined structures.'
} 