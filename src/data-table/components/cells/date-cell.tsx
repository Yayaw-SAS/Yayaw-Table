/**
 * Date cell component for data tables
 * Shows formatted date values with appropriate styling
 */
'use client';

import { format } from 'date-fns';
import { useLocale } from '../../providers/table-provider';

export interface DateCellProps {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Date format string (date-fns compatible)
   * @default "PPP" (localized date with month name)
   */
  dateFormat?: string;

  /**
   * Whether to show the time
   * @default false
   */
  showTime?: boolean;

  /**
   * The date value to display
   */
  value: Date | null | number | string | undefined;
}

/**
 * Cell component for displaying formatted date values
 */
export function DateCell({
  className = '',
  dateFormat = 'PPP',
  showTime = false,
  value,
}: DateCellProps) {
  // Get the current locale from our translations provider
  const _locale = useLocale();

  // Handle Prisma JSON objects with 'set' property
  if (value && typeof value === 'object' && 'set' in value) {
    value = (value as { set: unknown }).set as Date | number | string;
  }

  // If the value is not a valid date, return a placeholder
  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Format the date based on the locale and format string
  try {
    const date = new Date(value);

    // Check if the date is valid
    if (Number.isNaN(date.getTime())) {
      return <span className="text-muted-foreground">Invalid date</span>;
    }

    const formatString = showTime ? `${dateFormat} HH:mm` : dateFormat;
    return <span className={className}>{format(date, formatString)}</span>;
  } catch (_error) {
    return <span className="text-muted-foreground">Invalid date</span>;
  }
}
