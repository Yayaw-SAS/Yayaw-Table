/** Read an optional monochrome icon from a configured or synthesized option. */
export function getOptionIconUrl(option: unknown): string | undefined {
  if (!(option && typeof option === "object" && "iconUrl" in option)) {
    return undefined;
  }
  const url = option.iconUrl;
  return typeof url === "string" && url.trim() ? url : undefined;
}

export function optionIconStyle(iconUrl: string) {
  const escapedUrl = iconUrl.replace(/[\\"\n\r\f]/g, (character) =>
    encodeURIComponent(character)
  );
  return { maskImage: `url("${escapedUrl}")` };
}
