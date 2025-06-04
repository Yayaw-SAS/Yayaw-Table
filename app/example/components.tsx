import React from 'react'

// Composants personnalisés pour le titre et la description
export function CustomTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-2xl font-bold text-foreground ${className || ''}`}>
      🚀 {children}
    </h2>
  )
}

export function CustomDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-base text-muted-foreground font-medium ${className || ''}`}>
      💡 {children}
    </p>
  )
} 