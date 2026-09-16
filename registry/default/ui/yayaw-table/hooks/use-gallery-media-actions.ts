import { Eye, Link } from "lucide-react";
import { createElement, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { ActionItem } from "../components/columns/actions-column";
import type { TableGalleryConfig } from "../types/display-types";
import { resolveGalleryMedia } from "../utils/media-contract";
import { mediaViewerLabels, openMediaViewer } from "../utils/media-viewer";
import "../utils/media-viewer.css";

const EMPTY_MEDIA_ACTIONS: never[] = [];

/** Menus and visual cards expose the same media capabilities in every display mode. */
export function useGalleryMediaActions<TData extends Record<string, unknown>>(
  rows: TData[],
  config: TableGalleryConfig | undefined,
  locale: string,
  onInfo?: (row: TData) => void
): ActionItem<TData>[] {
  const latest = useRef({ rows, config, onInfo });
  latest.current = { rows, config, onInfo };
  const enabled = config?.media?.enabled === true;
  const viewer = useRef<ReturnType<typeof openMediaViewer> | undefined>(
    undefined
  );
  useEffect(() => () => viewer.current?.destroy(), []);
  return useMemo(() => {
    if (!enabled) {
      return EMPTY_MEDIA_ACTIONS;
    }
    const labels = mediaViewerLabels(locale);
    return [
      {
        type: "view",
        label: labels.preview,
        icon: createElement(Eye, { className: "size-4" }),
        onClick: (row) => {
          const { rows, config, onInfo } = latest.current;
          if (!config) {
            return undefined;
          }
          const active = document.activeElement;
          const menu = active?.closest('[role="menu"]');
          const triggerId = menu
            ?.getAttribute("aria-labelledby")
            ?.split(" ")[0];
          const element = triggerId
            ? document.getElementById(triggerId)
            : active;
          const ordered = rows.includes(row) ? rows : [row, ...rows];
          // Let the menu release its focus scope before the native modal opens.
          queueMicrotask(() => {
            viewer.current?.destroy();
            viewer.current = openMediaViewer({
              items: ordered.map((item, index) => ({
                id: String(index),
                title: String(
                  item[config.titleColumn ?? "name"] ?? item.id ?? ""
                ),
                source: resolveGalleryMedia(
                  item,
                  config.media,
                  config.imageColumn
                ),
              })),
              index: ordered.indexOf(row),
              labels,
              returnFocus: element instanceof HTMLElement ? element : undefined,
              onInfo: onInfo
                ? (id) => {
                    const item = ordered[Number(id)];
                    if (item) {
                      onInfo(item);
                    }
                  }
                : undefined,
            });
          });
          return undefined;
        },
      },
      {
        type: "view",
        label: labels.copyLink,
        icon: createElement(Link, { className: "size-4" }),
        disabled: (row) =>
          !resolveGalleryMedia(
            row,
            latest.current.config?.media,
            latest.current.config?.imageColumn
          ),
        onClick: async (row) => {
          const { config } = latest.current;
          if (!config) {
            return false;
          }
          const source = resolveGalleryMedia(
            row,
            config.media,
            config.imageColumn
          );
          if (!source) {
            return false;
          }
          await navigator.clipboard.writeText(source.url);
          toast.success(labels.linkCopied);
          return true;
        },
      },
    ];
  }, [enabled, locale]);
}
