/**
 * Utility for getting column type icons
 * Provides consistent icons across the data table components
 */
import {
  Asterisk,
  CalendarDays,
  CircleDot,
  CheckSquare,
  Hash,
  List,
  type LucideIcon,
  SquareCode,
  Tag,
  Text,
  ToggleRight,
} from "lucide-react";

export const COLUMN_TYPE_ICONS: Record<string, LucideIcon> = {
  text: Text,
  string: Asterisk,
  number: Hash,
  boolean: ToggleRight,
  tag: Tag,
  date: CalendarDays,
  code: SquareCode,
  select: CheckSquare,
  option: CheckSquare,
  multioption: List,
};

const STATUS_COLUMN_PATTERN = /(status|state)/;
const CATEGORY_COLUMN_PATTERN = /(categor|type|tag)/;
const BOOLEAN_OPTION_COLUMN_PATTERN =
  /(^is[a-z0-9])|(active|enabled|disabled|visible|verified|published|archived)/;

/**
 * Resolve a semantic icon for option-like columns based on the column id.
 */
const getSemanticOptionIcon = (
  normalizedType: string,
  normalizedColumnId: string
): LucideIcon | undefined => {
  const isOptionLikeType =
    normalizedType === "option" ||
    normalizedType === "select" ||
    normalizedType === "multioption";
  if (!isOptionLikeType || !normalizedColumnId) {
    return;
  }

  if (STATUS_COLUMN_PATTERN.test(normalizedColumnId)) {
    return CircleDot;
  }
  if (CATEGORY_COLUMN_PATTERN.test(normalizedColumnId)) {
    return Tag;
  }
  if (BOOLEAN_OPTION_COLUMN_PATTERN.test(normalizedColumnId)) {
    return ToggleRight;
  }

  return normalizedType === "multioption" ? List : CheckSquare;
};

/**
 * Get the icon component for a column type
 */
export const getColumnTypeIcon = (
  columnType: string,
  columnId?: string
): LucideIcon => {
  const normalizedType = columnType.toLowerCase();
  const normalizedColumnId = columnId?.toLowerCase() ?? "";

  const semanticOptionIcon = getSemanticOptionIcon(
    normalizedType,
    normalizedColumnId
  );
  if (semanticOptionIcon) {
    return semanticOptionIcon;
  }

  return COLUMN_TYPE_ICONS[normalizedType] || Text;
};

/**
 * Render a column icon with consistent styling
 */
export const ColumnIcon = ({
  columnType,
  columnId,
  className = "h-4 w-4",
}: {
  columnType: string;
  columnId?: string;
  className?: string;
}) => {
  const IconComponent = getColumnTypeIcon(columnType, columnId);
  return <IconComponent className={className} />;
};
