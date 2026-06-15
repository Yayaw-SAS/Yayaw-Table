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
  ImageIcon,
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
  date: CalendarDays,
  image: ImageIcon,
  code: SquareCode,
  select: CheckSquare,
  multiselect: List,
};

const STATUS_COLUMN_PATTERN = /(status|state)/;
const CATEGORY_COLUMN_PATTERN = /(categor|type|tag)/;
const BOOLEAN_SELECT_COLUMN_PATTERN =
  /(^is[a-z0-9])|(active|enabled|disabled|visible|verified|published|archived)/;

/**
 * Resolve a semantic icon for select-like columns based on the column id.
 */
const getSemanticSelectIcon = (
  normalizedType: string,
  normalizedColumnId: string
): LucideIcon | undefined => {
  const isSelectLikeType =
    normalizedType === "select" || normalizedType === "multiselect";
  if (!isSelectLikeType || !normalizedColumnId) {
    return;
  }

  if (STATUS_COLUMN_PATTERN.test(normalizedColumnId)) {
    return CircleDot;
  }
  if (CATEGORY_COLUMN_PATTERN.test(normalizedColumnId)) {
    return Tag;
  }
  if (BOOLEAN_SELECT_COLUMN_PATTERN.test(normalizedColumnId)) {
    return ToggleRight;
  }

  return normalizedType === "multiselect" ? List : CheckSquare;
};

/**
 * Get the icon component for a column type
 */
export const getColumnTypeIcon = (
  columnType: string,
  columnId?: string,
  displayVariant?: "default" | "tag"
): LucideIcon => {
  if (displayVariant === "tag") {
    return Tag;
  }

  const normalizedType = columnType.toLowerCase();
  const normalizedColumnId = columnId?.toLowerCase() ?? "";

  const semanticSelectIcon = getSemanticSelectIcon(
    normalizedType,
    normalizedColumnId
  );
  if (semanticSelectIcon) {
    return semanticSelectIcon;
  }

  return COLUMN_TYPE_ICONS[normalizedType] || Text;
};

/**
 * Render a column icon with consistent styling
 */
export const ColumnIcon = ({
  columnType,
  columnId,
  displayVariant,
  className = "h-4 w-4",
}: {
  columnType: string;
  columnId?: string;
  displayVariant?: "default" | "tag";
  className?: string;
}) => {
  const IconComponent = getColumnTypeIcon(
    columnType,
    columnId,
    displayVariant
  );
  return <IconComponent className={className} />;
};
