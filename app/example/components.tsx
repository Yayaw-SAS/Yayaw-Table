import type React from 'react'

// Composants personnalisés pour le titre et la description
export function CustomTitle({
    children,
    className
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <h2 className={`font-bold text-2xl text-foreground ${className || ''}`}>🚀 {children}</h2>
    )
}

export function CustomDescription({
    children,
    className
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <p className={`font-medium text-base text-muted-foreground ${className || ''}`}>
            💡 {children}
        </p>
    )
}
