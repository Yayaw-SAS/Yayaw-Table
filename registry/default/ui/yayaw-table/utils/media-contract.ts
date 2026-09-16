/** Framework-neutral gallery media contract. Runtime callbacks never enter saved views. */
export interface TableMediaSource {
  url: string;
  type?: "image" | "video" | "audio" | "document" | "file";
  mimeType?: string;
  poster?: string;
  alt?: string;
  tracks?: {
    src: string;
    label?: string;
    srcLang?: string;
    kind?: "captions" | "subtitles";
  }[];
}

export interface TableGalleryMediaConfig {
  /** Opt in to the native viewer and separate preview from record activation. */
  enabled?: boolean;
  urlColumn?: string;
  typeColumn?: string;
  mimeTypeColumn?: string;
  posterColumn?: string;
  hoverPreview?: boolean;
  getMedia?: (row: Record<string, unknown>) => TableMediaSource | undefined;
}

export interface GalleryMediaItem {
  id: string;
  title: string;
  source?: TableMediaSource;
}

export type TableGalleryPreviewSize = "small" | "medium" | "large";

/** Relative asset paths and HTTP(S) are supported; executable and opaque schemes are not. */
export function mediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }
  const source = value.trim();
  try {
    const url = new URL(source, "https://yayaw.invalid/");
    if (url.protocol === "https:" || url.protocol === "http:") {
      return source;
    }
  } catch {
    return;
  }
}

export function resolveGalleryMedia(
  row: Record<string, unknown>,
  config?: TableGalleryMediaConfig,
  imageColumn?: string
): TableMediaSource | undefined {
  if (config?.enabled !== true) {
    return;
  }
  const custom = config.getMedia?.(row);
  const url = mediaUrl(
    custom?.url ?? row[config.urlColumn ?? imageColumn ?? ""]
  );
  if (!url) {
    return;
  }
  const mimeType = String(
    custom?.mimeType ?? row[config.mimeTypeColumn ?? ""] ?? ""
  );
  const candidate = custom?.type ?? row[config.typeColumn ?? ""];
  let type: NonNullable<TableMediaSource["type"]> = "file";
  if (
    ["image", "video", "audio", "document", "file"].includes(String(candidate))
  ) {
    type = candidate as NonNullable<TableMediaSource["type"]>;
  } else if (mimeType.startsWith("image/")) {
    type = "image";
  } else if (mimeType.startsWith("video/")) {
    type = "video";
  } else if (mimeType.startsWith("audio/")) {
    type = "audio";
  } else if (mimeType === "application/pdf") {
    type = "document";
  } else if (!config.urlColumn && imageColumn) {
    type = "image";
  }
  return {
    ...custom,
    url,
    type,
    mimeType,
    poster: mediaUrl(custom?.poster ?? row[config.posterColumn ?? ""]),
    tracks: custom?.tracks?.flatMap((track) => {
      const src = mediaUrl(track.src);
      return src ? [{ ...track, src }] : [];
    }),
  };
}

/** M preserves the configured ratio; S/L scale only its height, not the card width. */
export function galleryAspectRatio(
  ratio = "wide",
  size?: TableGalleryPreviewSize
): string {
  const ratios: Record<string, number> = {
    portrait: 3 / 4,
    square: 1,
    video: 16 / 9,
    wide: 16 / 10,
  };
  const factor = ({ small: 0.7, medium: 1, large: 1.35 } as const)[
    size ?? "medium"
  ];
  return String((ratios[ratio] ?? 16 / 10) / factor);
}
