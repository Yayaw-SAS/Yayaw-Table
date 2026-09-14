"use client";

import { Images } from "lucide-react";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { useIsMobile } from "../../hooks/use-mobile";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type {
  TableDisplayMode,
  TableGalleryConfig,
  TableGalleryViewConfig,
} from "../../types/display-types";
import { TableTooltip } from "../../utils/table-tooltip";
import { ViewSettingsPanel } from "./view-settings-panel";

export interface GalleryMenuColumn {
  id: string;
  label: string;
  type?: string;
}

interface TableGalleryMenuProps {
  embedded?: boolean;
  className?: string;
  columns: GalleryMenuColumn[];
  defaultConfig?: TableGalleryConfig;
  defaultDisplayMode?: TableDisplayMode;
  enabled?: boolean;
  tableId: string;
}

const ASPECT_RATIO_OPTIONS: Array<{
  labelKey: string;
  value: NonNullable<TableGalleryConfig["aspectRatio"]>;
}> = [
  { labelKey: "views.gallery.wide", value: "wide" },
  { labelKey: "views.gallery.square", value: "square" },
  { labelKey: "views.gallery.video", value: "video" },
  { labelKey: "views.gallery.portrait", value: "portrait" },
];

const IMAGE_FIT_OPTIONS: Array<{
  labelKey: string;
  value: NonNullable<TableGalleryConfig["imageFit"]>;
}> = [
  { labelKey: "views.gallery.cover", value: "cover" },
  { labelKey: "views.gallery.contain", value: "contain" },
];

const CARD_SIZE_OPTIONS: Array<{
  labelKey: string;
  value: NonNullable<TableGalleryConfig["cardSize"]>;
}> = [
  { labelKey: "views.gallery.small", value: "small" },
  { labelKey: "views.gallery.medium", value: "medium" },
  { labelKey: "views.gallery.large", value: "large" },
];

function mergeGalleryConfig({
  defaults,
  override,
}: {
  defaults?: TableGalleryConfig;
  override?: TableGalleryViewConfig;
}): TableGalleryConfig {
  return {
    ...defaults,
    ...override,
  };
}

function getDefaultPropertyColumnIds({
  columns,
  imageColumn,
  titleColumn,
}: {
  columns: GalleryMenuColumn[];
  imageColumn?: string;
  titleColumn?: string;
}): string[] {
  return columns
    .filter((column) => column.id !== imageColumn && column.id !== titleColumn)
    .map((column) => column.id);
}

export function TableGalleryMenu({
  embedded = false,
  className,
  columns,
  defaultConfig,
  defaultDisplayMode,
  enabled = true,
  tableId,
}: TableGalleryMenuProps) {
  const { t } = useTranslations();
  const compact = useIsMobile();
  const { displayModeParam, galleryParam, setGalleryFromUI } = useTableUrlState(
    {
      defaultDisplayMode,
      tableId,
    }
  );
  const imageColumns = columns.filter((column) => column.type === "image");
  const activeConfig = mergeGalleryConfig({
    defaults: defaultConfig,
    override: galleryParam,
  });
  const activeImageColumn =
    activeConfig.imageColumn ?? imageColumns[0]?.id ?? "";
  const activeTitleColumn =
    activeConfig.titleColumn ||
    columns.find((column) => column.id !== activeImageColumn)?.id;
  const activePropertyColumnIds =
    activeConfig.cardColumnIds ??
    getDefaultPropertyColumnIds({
      columns,
      imageColumn: activeImageColumn,
      titleColumn: activeTitleColumn,
    });
  const activeAspectRatio = activeConfig.aspectRatio ?? "wide";
  const activeImageFit = activeConfig.imageFit ?? "cover";
  const activeCardSize = activeConfig.cardSize ?? "medium";
  const showCardLabels = activeConfig.showCardLabels === true;
  const triggerLabel = t("views.display.gallery");

  const updateGallery = (patch: TableGalleryViewConfig) => {
    const nextConfig: TableGalleryViewConfig = {
      ...galleryParam,
      ...patch,
    };

    for (const key of Object.keys(nextConfig) as Array<
      keyof TableGalleryViewConfig
    >) {
      if (nextConfig[key] === undefined) {
        delete nextConfig[key];
      }
    }

    setGalleryFromUI(nextConfig);
  };

  if (!enabled || displayModeParam !== "gallery" || columns.length === 0) {
    return null;
  }

  const options = (items: GalleryMenuColumn[]) =>
    items.map((column) => ({ value: column.id, label: column.label }));
  const content = (
    <StackMenuContent className="p-3">
      <div className="grid gap-3">
        <ViewSettingsPanel
          fields={[
            {
              id: "image",
              label: t("views.gallery.image"),
              value: activeImageColumn,
              options: [
                { value: "", label: t("common.none") },
                ...options(imageColumns.length ? imageColumns : columns),
              ],
              onChange: (imageColumn) => updateGallery({ imageColumn }),
            },
            {
              id: "title",
              label: t("views.gallery.titleColumn"),
              value: activeTitleColumn ?? "",
              options: options(
                columns.filter((column) => column.id !== activeImageColumn)
              ),
              onChange: (titleColumn) => updateGallery({ titleColumn }),
            },
            {
              id: "ratio",
              label: t("views.gallery.aspectRatio"),
              value: activeAspectRatio,
              options: ASPECT_RATIO_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              })),
              onChange: (value) =>
                updateGallery({
                  aspectRatio: value as TableGalleryViewConfig["aspectRatio"],
                }),
            },
            {
              id: "fit",
              label: t("views.gallery.imageFit"),
              value: activeImageFit,
              options: IMAGE_FIT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              })),
              onChange: (value) =>
                updateGallery({
                  imageFit: value as TableGalleryViewConfig["imageFit"],
                }),
            },
            {
              id: "size",
              label: t("views.gallery.cardSize"),
              value: activeCardSize,
              options: CARD_SIZE_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              })),
              onChange: (value) =>
                updateGallery({
                  cardSize: value as TableGalleryViewConfig["cardSize"],
                }),
            },
          ]}
          properties={{
            label: t("views.gallery.properties"),
            options: options(
              columns.filter(
                (column) =>
                  column.id !== activeImageColumn &&
                  column.id !== activeTitleColumn
              )
            ),
            value: activePropertyColumnIds,
            onChange: (cardColumnIds) => updateGallery({ cardColumnIds }),
            showLabels: showCardLabels,
            showLabelsLabel: t("views.gallery.showLabels"),
            onShowLabelsChange: (showCardLabels) =>
              updateGallery({ showCardLabels }),
          }}
        >
          <Button
            className="font-normal"
            disabled={Object.keys(galleryParam || {}).length === 0}
            onClick={() => setGalleryFromUI(undefined)}
            size="sm"
            variant="outline"
          >
            {t("common.reset")}
          </Button>
        </ViewSettingsPanel>
      </div>
    </StackMenuContent>
  );
  if (embedded) {
    return content;
  }

  return (
    <StackMenu
      align="start"
      asDropdown
      compact={compact}
      defaultView="gallery"
      trigger={
        <TableTooltip label={triggerLabel}>
          <Button
            aria-label={triggerLabel}
            className={cn(
              "h-8 gap-1.5 px-2 font-normal text-xs leading-4",
              className
            )}
            size="sm"
            type="button"
            variant="outline"
          >
            <Images className="size-4 shrink-0" />
            <span className="truncate">{triggerLabel}</span>
          </Button>
        </TableTooltip>
      }
    >
      <StackMenuView name="gallery" title={triggerLabel}>
        {content}
      </StackMenuView>
    </StackMenu>
  );
}
