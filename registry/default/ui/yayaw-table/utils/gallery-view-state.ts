/** Serializable gallery preferences shared by both framework registries. */
type TableGalleryAspectRatio = "portrait" | "square" | "video" | "wide";
type TableGalleryCardSize = "large" | "medium" | "small";
type TableGalleryImageFit = "contain" | "cover";

export interface GalleryViewState {
  imageColumn?: string;
  titleColumn?: string;
  cardColumnIds?: string[];
  aspectRatio?: TableGalleryAspectRatio;
  imageFit?: TableGalleryImageFit;
  cardSize?: TableGalleryCardSize;
  previewSize?: TableGalleryCardSize;
  showCardLabels?: boolean;
}

function normalizeColumnIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGalleryAspectRatio(
  value: unknown
): TableGalleryAspectRatio | undefined {
  if (
    value === "portrait" ||
    value === "square" ||
    value === "video" ||
    value === "wide"
  ) {
    return value;
  }

  return;
}

function normalizeGalleryImageFit(
  value: unknown
): TableGalleryImageFit | undefined {
  if (value === "contain" || value === "cover") {
    return value;
  }

  return;
}

function normalizeGalleryCardSize(
  value: unknown
): TableGalleryCardSize | undefined {
  if (value === "large" || value === "medium" || value === "small") {
    return value;
  }

  return;
}

export function normalizeGalleryViewConfig(
  config: GalleryViewState | undefined
): GalleryViewState | undefined {
  if (!config) {
    return;
  }

  const normalized: GalleryViewState = {};
  const imageColumn = config.imageColumn?.trim();
  const titleColumn = config.titleColumn?.trim();
  const cardColumnIds = normalizeColumnIds(config.cardColumnIds);
  const aspectRatio = normalizeGalleryAspectRatio(config.aspectRatio);
  const imageFit = normalizeGalleryImageFit(config.imageFit);
  const cardSize = normalizeGalleryCardSize(config.cardSize);
  const previewSize = normalizeGalleryCardSize(config.previewSize);

  if (typeof config.imageColumn === "string") {
    normalized.imageColumn = imageColumn ?? "";
  }
  if (titleColumn) {
    normalized.titleColumn = titleColumn;
  }
  if (cardColumnIds !== undefined) {
    normalized.cardColumnIds = cardColumnIds;
  }
  if (aspectRatio) {
    normalized.aspectRatio = aspectRatio;
  }
  if (imageFit) {
    normalized.imageFit = imageFit;
  }
  if (previewSize) {
    normalized.previewSize = previewSize;
  }
  if (cardSize) {
    normalized.cardSize = cardSize;
  }
  if (typeof config.showCardLabels === "boolean") {
    normalized.showCardLabels = config.showCardLabels;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
