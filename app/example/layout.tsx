import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export const metadata: Metadata = {
  title: 'YaYaw Table - Live Examples',
  description: 'See YaYaw Table in action with real examples and user-defined configurations'
}

export default function ExampleLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading example...</p>
        </div>
      </div>
    }>
      <NuqsAdapter>
        {children}
      </NuqsAdapter>
    </Suspense>
  )
} 