import type {
  CollectionFieldDefinition,
  CollectionFieldItem,
  FieldValues,
} from "../types";

export type CollectionItem = CollectionFieldItem;

export interface CollectionValidationResult {
  globalErrors: string[];
  itemErrors: string[][];
  messages: string[];
}

function isRecord(value: unknown): value is CollectionItem {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCollectionItem(value: unknown): CollectionItem {
  if (isRecord(value)) {
    return value;
  }
  return { value };
}

export function cloneCollectionItem(item: CollectionItem): CollectionItem {
  return { ...item };
}

export function normalizeCollectionItems(value: unknown): CollectionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => cloneCollectionItem(toCollectionItem(item)));
}

export function insertCollectionItem(
  items: readonly CollectionItem[],
  item: CollectionItem,
  index = items.length
): CollectionItem[] {
  const safeIndex = Math.min(Math.max(index, 0), items.length);
  return [
    ...items.slice(0, safeIndex).map(cloneCollectionItem),
    cloneCollectionItem(item),
    ...items.slice(safeIndex).map(cloneCollectionItem),
  ];
}

export function replaceCollectionItem(
  items: readonly CollectionItem[],
  index: number,
  item: CollectionItem
): CollectionItem[] {
  if (index < 0 || index >= items.length) {
    return items.map(cloneCollectionItem);
  }
  return items.map((currentItem, currentIndex) =>
    currentIndex === index
      ? cloneCollectionItem(item)
      : cloneCollectionItem(currentItem)
  );
}

export function removeCollectionItem(
  items: readonly CollectionItem[],
  index: number
): CollectionItem[] {
  return items
    .filter((_, currentIndex) => currentIndex !== index)
    .map(cloneCollectionItem);
}

export function moveCollectionItem(
  items: readonly CollectionItem[],
  fromIndex: number,
  toIndex: number
): CollectionItem[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items.map(cloneCollectionItem);
  }

  const nextItems = items.map(cloneCollectionItem);
  const [item] = nextItems.splice(fromIndex, 1);
  if (!item) {
    return nextItems;
  }
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

export function getCollectionItemErrors<
  TFieldValues extends FieldValues = FieldValues,
>(
  field: Pick<CollectionFieldDefinition<TFieldValues>, "validateItem">,
  item: CollectionItem,
  index: number | null
): string[] {
  return field.validateItem?.(item, index) ?? [];
}

export function getCollectionValidationResult<
  TFieldValues extends FieldValues = FieldValues,
>(
  field: Pick<
    CollectionFieldDefinition<TFieldValues>,
    "itemLabel" | "validateItem" | "validateItems"
  >,
  value: unknown
): CollectionValidationResult {
  const items = normalizeCollectionItems(value);
  const itemErrors = items.map((item, index) =>
    getCollectionItemErrors(field, item, index)
  );
  const globalErrors = field.validateItems?.(items) ?? [];
  const itemMessages = itemErrors.flatMap((errors, index) =>
    errors.map((message) => `${field.itemLabel} ${index + 1}: ${message}`)
  );

  return {
    globalErrors,
    itemErrors,
    messages: [...globalErrors, ...itemMessages],
  };
}

export function getCollectionValidationMessages<
  TFieldValues extends FieldValues = FieldValues,
>(
  field: Pick<
    CollectionFieldDefinition<TFieldValues>,
    "itemLabel" | "validateItem" | "validateItems"
  >,
  value: unknown
): string[] {
  return getCollectionValidationResult(field, value).messages;
}

export function createCollectionFieldValidators<
  TFieldValues extends FieldValues = FieldValues,
>(
  field: Pick<
    CollectionFieldDefinition<TFieldValues>,
    "itemLabel" | "validateItem" | "validateItems"
  >
) {
  const validate = ({ value }: { value: unknown }) => {
    const errors = getCollectionValidationMessages(field, value);
    return errors.length > 0 ? errors : undefined;
  };

  return {
    onChange: validate,
    onSubmit: validate,
  };
}
