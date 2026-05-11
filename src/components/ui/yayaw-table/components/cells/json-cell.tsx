/**
 * JSON cell component for data tables
 * Shows formatted JSON values with appropriate styling
 */
"use client";

import { useTableTranslations } from "../../hooks";

export interface JsonCellProps {
  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Maximum number of items to display before truncating
   * @default 3
   */
  maxItems?: number;

  /**
   * The value to display (can be an array, object, or primitive)
   */
  value: unknown;
}

// Helper function to format display value
const formatDisplayValue = (item: unknown): string => {
  if (item === null || item === undefined) {
    return "null";
  }
  if (typeof item === "object") {
    return JSON.stringify(item);
  }
  if (typeof item === "string") {
    return `&quot;${item}&quot;`;
  }
  return String(item);
};

// Helper function to process initial value
const processValue = (initialValue: unknown): unknown => {
  let processedValue = safelyParseJson(initialValue);

  // Handle Prisma JSON objects with 'set' property
  if (
    processedValue &&
    typeof processedValue === "object" &&
    "set" in processedValue
  ) {
    processedValue = (processedValue as { set: unknown }).set;
    processedValue = safelyParseJson(processedValue);
  }

  return processedValue;
};

/**
 * Cell component for displaying JSON values
 * Shows arrays and objects in a compact, readable format
 */
export function JsonCell({
  className = "",
  maxItems = 3,
  value,
}: JsonCellProps) {
  const _translations = useTableTranslations();

  const processedValue = processValue(value);

  // Handle null or undefined
  if (processedValue === null || processedValue === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Handle arrays
  if (Array.isArray(processedValue)) {
    return (
      <div
        className={`flex max-w-[200px] flex-wrap gap-1 overflow-hidden text-ellipsis ${className}`}
      >
        {processedValue.slice(0, maxItems).map((item) => {
          const parsedItem = safelyParseJson(item);
          const displayValue = formatDisplayValue(parsedItem);
          const itemKey =
            typeof item === "object" ? JSON.stringify(item) : String(item);

          return (
            <span
              className="inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs"
              key={itemKey}
              title={
                typeof item === "object" ? JSON.stringify(item) : String(item)
              }
            >
              {displayValue}
            </span>
          );
        })}
        {processedValue.length > maxItems && (
          <span className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs">
            +{processedValue.length - maxItems}
          </span>
        )}
      </div>
    );
  }

  // Handle objects
  if (typeof processedValue === "object" && processedValue !== null) {
    const entries = Object.entries(processedValue as Record<string, unknown>);
    return (
      <div
        className={`flex max-w-[200px] flex-wrap gap-1 overflow-hidden text-ellipsis ${className}`}
      >
        {entries.slice(0, maxItems).map(([key, val], index) => {
          const parsedVal = safelyParseJson(val);
          const displayValue = formatDisplayValue(parsedVal);

          // Full JSON representation for the tooltip
          const fullValue = JSON.stringify({ [key]: val });

          return (
            <span
              className="inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs"
              key={key || index}
              title={fullValue}
            >
              <span className="font-medium">&quot;{key}&quot;:</span>{" "}
              {displayValue}
            </span>
          );
        })}
        {entries.length > maxItems && (
          <span className="inline-flex items-center rounded-md border bg-muted px-2 py-1 text-xs">
            +{entries.length - maxItems}
          </span>
        )}
      </div>
    );
  }

  // For strings that look like JSON but couldn't be parsed earlier
  if (
    typeof processedValue === "string" &&
    (processedValue.includes('\\"') ||
      processedValue.includes("\\'") ||
      (processedValue.includes("{") && processedValue.includes("}"))) &&
    processedValue.length > 2
  ) {
    try {
      // One more attempt to clean and parse the string
      const cleanValue = processedValue
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
      const parsedValue = JSON.parse(cleanValue);
      return (
        <span
          className={`block max-w-[200px] truncate ${className}`}
          title={JSON.stringify(parsedValue)}
        >
          {JSON.stringify(parsedValue)}
        </span>
      );
    } catch {
      // Fall through to default handling
    }
  }

  // Default fallback for primitive values
  const stringValue =
    typeof processedValue === "string"
      ? processedValue
      : JSON.stringify(processedValue);
  return (
    <span
      className={`block max-w-[200px] truncate ${className}`}
      title={stringValue}
    >
      {stringValue}
    </span>
  );
}

/**
 * Safely parses a JSON string if it's a string that looks like JSON
 * Otherwise returns the original value
 */
function safelyParseJson(value: unknown): unknown {
  if (
    typeof value === "string" &&
    (value.startsWith("{") || value.startsWith("[")) &&
    (value.endsWith("}") || value.endsWith("]"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // If it can't be parsed as JSON, return the original
      return value;
    }
  }
  return value;
}
