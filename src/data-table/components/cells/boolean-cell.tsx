/**
 * Boolean cell component for data tables
 * Shows formatted boolean values with appropriate styling
 */
'use client'

import { Badge } from '@/components/ui/badge'

import { useTableTranslations } from '../../hooks'

interface BooleanCellProps {
    value: boolean
}

/**
 * Cell component for displaying boolean values
 * Shows green badge for true and red badge for false
 */
export function BooleanCell({ value }: BooleanCellProps) {
    const translations = useTableTranslations()
    return (
        <Badge
            className={value ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}
            variant={value ? 'default' : 'destructive'}
        >
            {value ? translations.true : translations.false}
        </Badge>
    )
}
