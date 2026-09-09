import { type Ref, ref } from "vue";

/** Portaled controls retain the table's theme and typography outside its DOM subtree. */
export function useOverlayTheme(anchor: Readonly<Ref<HTMLElement | null>>) {
  const overlayStyle = ref<Record<string, string>>({});
  const updateOpen = (open: boolean): void => {
    if (!(open && anchor.value)) {
      return;
    }
    const style = getComputedStyle(anchor.value);
    const tokens: Record<string, string> = { font: style.font };
    for (const name of [
      "background",
      "foreground",
      "muted",
      "muted-foreground",
      "border",
      "primary",
      "primary-foreground",
      "danger",
      "radius",
      "shadow",
    ]) {
      const property = `--yayaw-${name}`;
      tokens[property] = style.getPropertyValue(property);
    }
    overlayStyle.value = tokens;
  };
  return { overlayStyle, updateOpen };
}
