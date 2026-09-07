import type { TableDensity } from "./table-contracts";

/** Keep cells, controls, thumbnails, groups, and headers on the same spacing scale. */
export const TABLE_DENSITY_CLASSES = {
  "extra-small": {
    rows: "[&_tr]:h-7",
    header: "!h-7 !px-1.5",
    cell: "!px-1.5 !py-0.5",
    groupButton: "min-h-7 !px-1.5 !py-0.5",
    controls:
      "[&_[data-density-control]]:!min-h-6 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-6 [&_[data-density-action]]:!w-6 [&_td_img]:!max-h-6 [&_td_img]:!max-w-6",
  },
  small: {
    rows: "[&_tr]:h-8",
    header: "!h-8 !px-2",
    cell: "!px-2 !py-1",
    groupButton: "min-h-8 !px-2 !py-1",
    controls:
      "[&_[data-density-control]]:!min-h-6 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-6 [&_[data-density-action]]:!w-6 [&_td_img]:!max-h-6 [&_td_img]:!max-w-6",
  },
  medium: {
    rows: "[&_tr]:h-10",
    header: "!h-10 !px-2",
    cell: "!px-2 !py-1.5",
    groupButton: "min-h-10 !px-2 !py-1.5",
    controls:
      "[&_[data-density-control]]:!min-h-7 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-7 [&_[data-density-action]]:!w-7 [&_td_img]:!max-h-7 [&_td_img]:!max-w-7",
  },
  large: {
    rows: "[&_tr]:h-12",
    header: "!h-12 !px-2.5",
    cell: "!px-2.5 !py-2",
    groupButton: "min-h-12 !px-2.5 !py-2",
    controls:
      "[&_[data-density-control]]:!min-h-8 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-8 [&_[data-density-action]]:!w-8 [&_td_img]:!max-h-8 [&_td_img]:!max-w-8",
  },
  "extra-large": {
    rows: "[&_tr]:h-14",
    header: "!h-14 !px-3",
    cell: "!px-3 !py-2.5",
    groupButton: "min-h-14 !px-3 !py-2.5",
    controls:
      "[&_[data-density-control]]:!min-h-9 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-9 [&_[data-density-action]]:!w-9 [&_td_img]:!max-h-9 [&_td_img]:!max-w-9",
  },
  "extra-extra-large": {
    rows: "[&_tr]:h-16",
    header: "!h-16 !px-4",
    cell: "!px-4 !py-3",
    groupButton: "min-h-16 !px-4 !py-3",
    controls:
      "[&_[data-density-control]]:!min-h-10 [&_[data-density-control]]:!py-0 [&_[data-density-action]]:!h-10 [&_[data-density-action]]:!w-10 [&_td_img]:!max-h-10 [&_td_img]:!max-w-10",
  },
} as const satisfies Record<
  TableDensity,
  {
    rows: string;
    header: string;
    cell: string;
    groupButton: string;
    controls: string;
  }
>;
