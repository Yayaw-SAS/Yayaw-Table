import type { Metadata } from 'next'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { ReactNode } from 'react'
import { Suspense } from 'react'

export const metadata: Metadata = {
    title: 'YaYaw Table - Live Examples',
    description: 'See YaYaw Table in action with real examples and user-defined configurations'
}

export default function ExampleLayout({ children }: { children: ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                        <p className="text-muted-foreground">Loading example...</p>
                    </div>
                </div>
            }
        >
            <NuqsAdapter>{children}</NuqsAdapter>
        </Suspense>
    )
}
