import type { CatalogueFormLayoutConfig } from "../../config/form-config";

const DEFAULT_DRAWER_WIDTH = "28rem";
const DEFAULT_MODAL_WIDTH = "80vw";

export interface ResolvedCatalogueFormLayout {
  mode: "drawer" | "modal";
  width: string;
}

export function resolveCatalogueFormLayout(
  layout?: CatalogueFormLayoutConfig
): ResolvedCatalogueFormLayout {
  const mode = layout?.mode === "modal" ? "modal" : "drawer";

  return {
    mode,
    width:
      layout?.width ??
      (mode === "modal" ? DEFAULT_MODAL_WIDTH : DEFAULT_DRAWER_WIDTH),
  };
}
