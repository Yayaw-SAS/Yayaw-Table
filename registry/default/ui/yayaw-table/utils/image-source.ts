const IMAGE_SOURCE_PATTERN =
  /^(?:https?:\/\/|\/(?!\/)|data:image\/[a-z0-9.+-]+;base64,|blob:)/i;

export function resolveImageSource(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return;
  }

  const source = value.trim();
  if (!(source && IMAGE_SOURCE_PATTERN.test(source))) {
    return;
  }

  return source;
}

export function getImageFallbackInitial(value: unknown): string {
  if (typeof value !== "string") {
    return "?";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
