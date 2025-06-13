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
    <Suspense fallback={<div>Loading...</div>}>
      <NuqsAdapter>
        {children}
      </NuqsAdapter>
    </Suspense>
  )
} 