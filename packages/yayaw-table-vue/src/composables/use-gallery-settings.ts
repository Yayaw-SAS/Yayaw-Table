import { computed } from "vue";
import { useTableContext } from "../context";
import type {
  TableGalleryAspectRatio,
  TableGalleryCardSize,
  TableGalleryImageFit,
} from "../types";

export function useGallerySettings() {
  const context = useTableContext();
  const translate = (key: string, fallback: string) =>
    String(context.translations.value[key] ?? fallback);
  const columns = computed(() =>
    context.config.columns.definitions.filter(
      (column) => !["select", "actions"].includes(column.id)
    )
  );
  const columnOptions = computed(() =>
    columns.value.map((column) => ({ value: column.id, label: column.header }))
  );
  const imageOptions = computed(() => [
    { value: "", label: translate("none", "None") },
    ...columnOptions.value,
  ]);
  const ratioOptions = computed(() => [
    { value: "square" as const, label: translate("cardSquare", "Square") },
    {
      value: "portrait" as const,
      label: translate("cardPortrait", "Portrait"),
    },
    { value: "video" as const, label: translate("cardVideo", "Video") },
    { value: "wide" as const, label: translate("cardWide", "Wide") },
  ]);
  const fitOptions = computed(() => [
    { value: "cover" as const, label: translate("cardCover", "Cover") },
    { value: "contain" as const, label: translate("cardContain", "Contain") },
  ]);
  const sizeOptions = computed(() => [
    { value: "small" as const, label: translate("cardSmall", "Small") },
    { value: "medium" as const, label: translate("cardMedium", "Medium") },
    { value: "large" as const, label: translate("cardLarge", "Large") },
  ]);
  const imageColumn = computed({
    get: () =>
      context.state.gallery.value.imageColumn ??
      context.config.table.gallery?.imageColumn ??
      columns.value.find((column) => column.type === "image")?.id ??
      "",
    set: (value: string) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        imageColumn: value,
      };
    },
  });
  const titleColumn = computed({
    get: () =>
      context.state.gallery.value.titleColumn ??
      context.config.table.gallery?.titleColumn ??
      columns.value.find((column) => column.id !== imageColumn.value)?.id ??
      "id",
    set: (value: string) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        titleColumn: value,
      };
    },
  });
  const propertyIds = computed({
    get: () =>
      context.state.gallery.value.cardColumnIds ??
      context.config.table.gallery?.cardColumnIds ??
      columns.value
        .filter(
          (column) =>
            ![imageColumn.value, titleColumn.value].includes(column.id)
        )
        .slice(0, 4)
        .map((column) => column.id),
    set: (value: string[]) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        cardColumnIds: value,
      };
    },
  });
  const aspectRatio = computed({
    get: () =>
      context.state.gallery.value.aspectRatio ??
      context.config.table.gallery?.aspectRatio ??
      "square",
    set: (value: TableGalleryAspectRatio) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        aspectRatio: value,
      };
    },
  });
  const imageFit = computed({
    get: () =>
      context.state.gallery.value.imageFit ??
      context.config.table.gallery?.imageFit ??
      "cover",
    set: (value: TableGalleryImageFit) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        imageFit: value,
      };
    },
  });
  const cardSize = computed({
    get: () =>
      context.state.gallery.value.cardSize ??
      context.config.table.gallery?.cardSize ??
      "medium",
    set: (value: TableGalleryCardSize) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        cardSize: value,
      };
    },
  });
  const showLabels = computed({
    get: () =>
      context.state.gallery.value.showCardLabels ??
      context.config.table.gallery?.showCardLabels ??
      false,
    set: (value: boolean) => {
      context.state.gallery.value = {
        ...context.state.gallery.value,
        showCardLabels: value,
      };
    },
  });

  return {
    context,
    translate,
    columns,
    columnOptions,
    titleColumn,
    propertyIds,
    showLabels,
    imageOptions,
    ratioOptions,
    fitOptions,
    sizeOptions,
    imageColumn,
    aspectRatio,
    imageFit,
    cardSize,
  };
}
