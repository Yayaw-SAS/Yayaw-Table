import type { FormRule } from "../src/components/ui/yayaw-table/utils/form-conditions";

/** Shared records and column contracts keep the two interactive examples comparable. */
export const presentationRows = [
  {
    id: "one",
    mediaKind: "video",
    mediaUrl:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    mimeType: "video/mp4",
    name: "Workspace Pro",
    category: "Software",
    status: "Active",
    price: 49,
    active: true,
    createdAt: "2026-09-01",
    description: "A shared workspace for product teams.",
    video:
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: "two",
    mediaKind: "image",
    mediaUrl: "https://picsum.photos/seed/yayaw-gallery-two/900/600",
    mimeType: "image/jpeg",
    name: "Studio Display",
    category: "Hardware",
    status: "Draft",
    price: 399,
    active: false,
    createdAt: "2026-09-08",
    description: "A display for the design studio.",
  },
  {
    id: "three",
    mediaKind: "image",
    mediaUrl: "https://picsum.photos/seed/yayaw-gallery-three/600/900",
    mimeType: "image/jpeg",
    name: "Team Support",
    category: "Service",
    status: "Active",
    price: 99,
    active: true,
    createdAt: "2026-09-12",
    description: "Dedicated support for your team.",
  },
];
export const presentationColumns = [
  { id: "name", header: "Name", type: "text" as const },
  {
    id: "category",
    header: "Category",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: ["Software", "Hardware", "Service"].map((value) => ({
      value,
      label: value,
    })),
  },
  {
    id: "status",
    header: "Status",
    type: "select" as const,
    displayVariant: "tag" as const,
    options: ["Active", "Draft", "Archived"].map((value) => ({
      value,
      label: value,
    })),
  },
  { id: "price", header: "Price", type: "number" as const },
  { id: "active", header: "Available", type: "boolean" as const },
  { id: "createdAt", header: "Created", type: "date" as const },
  { id: "description", header: "Description", type: "text" as const },
];

const rule = (id: string, when: FormRule["when"], then: FormRule["then"]) => ({
  id,
  when,
  then,
});

/**
 * One declarative condition, shared with the Form view's engine: hardware
 * products need a description. In a bulk edit of mixed categories the
 * condition is treated as not met, with a note.
 */
export const presentationRules: FormRule[] = [
  rule(
    "hardware-description",
    {
      join: "and",
      items: [{ fieldId: "category", operator: "is", value: "Hardware" }],
    },
    { action: "require", fieldIds: ["description"] }
  ),
];

/** Explicit catalogue contract also enables Vue's field-based bulk editor. */
export const presentationForm = {
  id: "record-presentation",
  submitMode: "patch" as const,
  rules: presentationRules,
  fields: presentationColumns.map((column) => ({
    name: column.id,
    label: column.header,
    type: column.type === "boolean" ? ("switch" as const) : column.type,
    options: column.options,
  })),
};

/** The same read-only media field is rendered by both framework examples. */
export const presentationDetails = {
  title: (row: Record<string, unknown>) => String(row.name),
  description: () => "Product details",
  updatedAt: (row: Record<string, unknown>) => String(row.createdAt),
  sections: [
    {
      id: "product",
      title: "Product",
      fields: [
        ...presentationColumns.map((column) => ({
          id: column.id,
          label: column.header,
          type: column.type,
          options: column.options,
        })),
        {
          id: "video",
          label: "Product video",
          type: "video" as const,
          hidden: (row: Record<string, unknown>) => !row.video,
        },
      ],
    },
  ],
};

/** Gallery and record consultation share the same media source. */
export const presentationGallery = {
  titleColumn: "name",
  cardColumnIds: ["category", "status", "price"],
  imageColumn: "mediaUrl",
  imageFit: "cover" as const,
  previewSize: "medium" as const,
  media: {
    enabled: true,
    urlColumn: "mediaUrl",
    typeColumn: "mediaKind",
    mimeTypeColumn: "mimeType",
    hoverPreview: true,
  },
};
