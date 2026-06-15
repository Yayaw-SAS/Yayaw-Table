"use client";

import { Check, Images, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Separator } from "@/src/components/ui/separator";
import {
  StackMenu,
  StackMenuContent,
  StackMenuView,
} from "@/components/ui/custom/stack-menu";
import { useTableUrlState } from "../../hooks/use-table-url-state";
import { useTranslations } from "../../providers/table-provider";
import type {
  TableDisplayMode,
  TableGalleryConfig,
  TableGalleryViewConfig,
} from "../../types/display-types";
import { ColumnIcon } from "../../utils/column-icons";

export interface GalleryMenuColumn {
  id: string;
  label: string;
  type?: string;
}

interface TableGalleryMenuProps {
  className?: string;
  columns: GalleryMenuColumn[];
  defaultConfig?: TableGalleryConfig;
  defaultDisplayMode?: TableDisplayMode;
  enabled?: boolean;
  tableId: string;
}

interface ChoiceButtonProps {
  active: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
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

function ChoiceButton({ active, icon, label, onClick }: ChoiceButtonProps) {
  return (
    <Button
      className="flex h-8 w-full items-center justify-between px-3 text-left"
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate text-sm">{label}</span>
      </span>
      {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
    </Button>
  );
}

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
  className,
  columns,
  defaultConfig,
  defaultDisplayMode,
  enabled = true,
  tableId,
}: TableGalleryMenuProps) {
  const { t } = useTranslations();
  const { displayModeParam, galleryParam, setGalleryFromUI } = useTableUrlState({
    defaultDisplayMode,
    tableId,
  });
  const imageColumns = columns.filter((column) => column.type === "image");
  const activeConfig = mergeGalleryConfig({
    defaults: defaultConfig,
    override: galleryParam,
  });
  const activeImageColumn =
    activeConfig.imageColumn || imageColumns[0]?.id || columns[0]?.id;
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

  return (
    <StackMenu
      align="start"
      asDropdown
      defaultView="gallery"
      trigger={
        <Button
          aria-label={triggerLabel}
          className={cn("h-8 gap-1.5 px-2 text-xs", className)}
          size="sm"
          title={triggerLabel}
          type="button"
          variant="outline"
        >
          <Images className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">{triggerLabel}</span>
        </Button>
      }
    >
      <StackMenuView name="gallery" title={triggerLabel}>
        <StackMenuContent>
          <div className="flex min-h-0 w-[320px] flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="px-1 font-medium text-sm">
                {t("views.gallery.title")}
              </div>
              <Button
                disabled={Object.keys(galleryParam || {}).length === 0}
                onClick={() => setGalleryFromUI(undefined)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("common.reset")}
              </Button>
            </div>

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.gallery.image")}
              </div>
              {(imageColumns.length ? imageColumns : columns).map((column) => (
                <ChoiceButton
                  active={activeImageColumn === column.id}
                  icon={
                    <ColumnIcon
                      className="h-3.5 w-3.5"
                      columnId={column.id}
                      columnType={column.type || "text"}
                    />
                  }
                  key={column.id}
                  label={column.label}
                  onClick={() => updateGallery({ imageColumn: column.id })}
                />
              ))}
            </div>

            <Separator />

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.gallery.titleColumn")}
              </div>
              {columns
                .filter((column) => column.id !== activeImageColumn)
                .map((column) => (
                  <ChoiceButton
                    active={activeTitleColumn === column.id}
                    icon={
                      <ColumnIcon
                        className="h-3.5 w-3.5"
                        columnId={column.id}
                        columnType={column.type || "text"}
                      />
                    }
                    key={column.id}
                    label={column.label}
                    onClick={() => updateGallery({ titleColumn: column.id })}
                  />
                ))}
            </div>

            <Separator />

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.gallery.properties")}
              </div>
              {columns
                .filter(
                  (column) =>
                    column.id !== activeImageColumn &&
                    column.id !== activeTitleColumn
                )
                .map((column) => {
                  const isActive = activePropertyColumnIds.includes(column.id);
                  return (
                    <ChoiceButton
                      active={isActive}
                      icon={
                        <ColumnIcon
                          className="h-3.5 w-3.5"
                          columnId={column.id}
                          columnType={column.type || "text"}
                        />
                      }
                      key={column.id}
                      label={column.label}
                      onClick={() => {
                        updateGallery({
                          cardColumnIds: isActive
                            ? activePropertyColumnIds.filter(
                                (id) => id !== column.id
                              )
                            : [...activePropertyColumnIds, column.id],
                        });
                      }}
                    />
                  );
                })}
            </div>

            <Separator />

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.gallery.aspectRatio")}
              </div>
              {ASPECT_RATIO_OPTIONS.map((option) => (
                <ChoiceButton
                  active={activeAspectRatio === option.value}
                  key={option.value}
                  label={t(option.labelKey)}
                  onClick={() => updateGallery({ aspectRatio: option.value })}
                />
              ))}
            </div>

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.gallery.imageFit")}
              </div>
              {IMAGE_FIT_OPTIONS.map((option) => (
                <ChoiceButton
                  active={activeImageFit === option.value}
                  key={option.value}
                  label={t(option.labelKey)}
                  onClick={() => updateGallery({ imageFit: option.value })}
                />
              ))}
            </div>

            <div>
              <div className="px-1 pb-1 text-muted-foreground text-xs">
                {t("views.gallery.cardSize")}
              </div>
              {CARD_SIZE_OPTIONS.map((option) => (
                <ChoiceButton
                  active={activeCardSize === option.value}
                  key={option.value}
                  label={t(option.labelKey)}
                  onClick={() => updateGallery({ cardSize: option.value })}
                />
              ))}
            </div>

            <Separator />

            <ChoiceButton
              active={showCardLabels}
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label={t("views.gallery.showLabels")}
              onClick={() =>
                updateGallery({ showCardLabels: !showCardLabels })
              }
            />
          </div>
        </StackMenuContent>
      </StackMenuView>
    </StackMenu>
  );
}
