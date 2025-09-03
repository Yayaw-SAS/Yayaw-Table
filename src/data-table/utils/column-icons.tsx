/**
 * Utility for getting column type icons
 * Provides consistent icons across the data table components
 */
import {
  Asterisk,
  CalendarDays,
  CheckSquare,
  Hash,
  type LucideIcon,
  SquareCode,
  Tag,
  Text,
  ToggleRight,
} from 'lucide-react';

export const COLUMN_TYPE_ICONS: Record<string, LucideIcon> = {
  text: Text,
  string: Asterisk,
  number: Hash,
  boolean: ToggleRight,
  tag: Tag,
  date: CalendarDays,
  code: SquareCode,
  select: CheckSquare,
};

/**
 * Get the icon component for a column type
 */
export const getColumnTypeIcon = (columnType: string): LucideIcon => {
  return COLUMN_TYPE_ICONS[columnType] || Text;
};

/**
 * Render a column icon with consistent styling
 */
export const ColumnIcon = ({
  columnType,
  className = 'h-4 w-4',
}: {
  columnType: string;
  className?: string;
}) => {
  const IconComponent = getColumnTypeIcon(columnType);
  return <IconComponent className={className} />;
};
