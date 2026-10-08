import type { TableDensity } from "./table-contracts";

/**
 * Keep cells, controls, thumbnails, groups, headers, and text on the same scale.
 * Literal classes mirror TABLE_DENSITY_METRICS so Tailwind can generate them.
 * Below S, cell badges shrink with the text so they fit the control height.
 */
export const TABLE_DENSITY_CLASSES = {
  "extra-extra-small": {
    rows: "[&_tr]:h-5",
    text: "text-[10px] leading-[14px]",
    header: "!h-5 !px-1",
    cell: "!px-1 !py-0.5",
    groupButton: "min-h-5 !px-1 !py-0.5",
    controls:
      "[--yayaw-inline-control-height:1rem] [&_[data-density-control]]:!min-h-4 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-4 [&_[data-density-action]]:!w-4 [&_td_img]:!max-h-4 [&_td_img]:!max-w-4 [&_td_[data-slot=badge]]:!h-4 [&_td_[data-slot=badge]]:!text-[10px]",
  },
  "extra-small": {
    rows: "[&_tr]:h-6",
    text: "text-[11px] leading-4",
    header: "!h-6 !px-1",
    cell: "!px-1 !py-0.5",
    groupButton: "min-h-6 !px-1 !py-0.5",
    controls:
      "[--yayaw-inline-control-height:1.25rem] [&_[data-density-control]]:!min-h-5 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-5 [&_[data-density-action]]:!w-5 [&_td_img]:!max-h-5 [&_td_img]:!max-w-5 [&_td_[data-slot=badge]]:!text-[11px]",
  },
  small: {
    rows: "[&_tr]:h-8",
    text: "text-xs leading-4",
    header: "!h-8 !px-1.5",
    cell: "!px-1.5 !py-1",
    groupButton: "min-h-8 !px-1.5 !py-1",
    controls:
      "[--yayaw-inline-control-height:1.5rem] [&_[data-density-control]]:!min-h-6 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-6 [&_[data-density-action]]:!w-6 [&_td_img]:!max-h-6 [&_td_img]:!max-w-6",
  },
  medium: {
    rows: "[&_tr]:h-10",
    text: "text-sm leading-5",
    header: "!h-10 !px-2",
    cell: "!px-2 !py-1.5",
    groupButton: "min-h-10 !px-2 !py-1.5",
    controls:
      "[--yayaw-inline-control-height:1.75rem] [&_[data-density-control]]:!min-h-7 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-7 [&_[data-density-action]]:!w-7 [&_td_img]:!max-h-7 [&_td_img]:!max-w-7",
  },
  large: {
    rows: "[&_tr]:h-12",
    text: "text-sm leading-5",
    header: "!h-12 !px-3",
    cell: "!px-3 !py-2",
    groupButton: "min-h-12 !px-3 !py-2",
    controls:
      "[--yayaw-inline-control-height:2rem] [&_[data-density-control]]:!min-h-8 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-8 [&_[data-density-action]]:!w-8 [&_td_img]:!max-h-8 [&_td_img]:!max-w-8",
  },
  "extra-large": {
    rows: "[&_tr]:h-15",
    text: "text-base leading-6",
    header: "!h-15 !px-3.5",
    cell: "!px-3.5 !py-3",
    groupButton: "min-h-15 !px-3.5 !py-3",
    controls:
      "[--yayaw-inline-control-height:2.25rem] [&_[data-density-control]]:!min-h-9 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-9 [&_[data-density-action]]:!w-9 [&_td_img]:!max-h-9 [&_td_img]:!max-w-9",
  },
  "extra-extra-large": {
    rows: "[&_tr]:h-18",
    text: "text-lg leading-7",
    header: "!h-18 !px-4",
    cell: "!px-4 !py-3.5",
    groupButton: "min-h-18 !px-4 !py-3.5",
    controls:
      "[--yayaw-inline-control-height:2.75rem] [&_[data-density-control]]:!min-h-11 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-11 [&_[data-density-action]]:!w-11 [&_td_img]:!max-h-11 [&_td_img]:!max-w-11",
  },
} as const satisfies Record<
  TableDensity,
  {
    rows: string;
    text: string;
    header: string;
    cell: string;
    groupButton: string;
    controls: string;
  }
>;
