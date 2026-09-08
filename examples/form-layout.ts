import type {
  FormLayoutBlock,
  FormLayoutRuntime,
} from "../src/components/ui/yayaw-table/utils/form-layout";

/** Shared configuration: React callbacks and Vue slots supply the preview. */
export function productFormBlocks<
  TContext extends FormLayoutRuntime & { values?: Record<string, unknown> },
  TContent,
>(): FormLayoutBlock<TContext, TContent>[] {
  return [
    {
      type: "content",
      id: "help",
      title: "Product details",
      text: "Review the information before saving. Fields omitted from this layout remain available below.",
      tone: "info",
    },
    {
      type: "section",
      id: "identity",
      title: "Identity and price",
      columns: 2,
      blocks: [
        { type: "field", name: "name" },
        { type: "field", name: "price" },
        { type: "custom", id: "preview", span: "full" },
      ],
    },
    {
      type: "actions",
      id: "tools",
      actions: [
        {
          id: "normalize",
          label: "Normalize name",
          onClick: (context) => {
            context.setFieldValue(
              "name",
              String(context.values?.name ?? "").trim()
            );
          },
        },
      ],
    },
  ];
}
