/** Framework-neutral layout contracts; each registry ships its own copy. */
export interface FormLayoutRuntime {
  disabled: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  setFieldValue: (name: string, value: unknown) => void;
  submit: () => Promise<void>;
  validate: () => Promise<boolean>;
}

export interface FormLayoutAction<TContext> {
  id: string;
  label: string;
  labelKey?: string;
  disabled?: boolean | ((context: TContext) => boolean);
  hidden?: boolean | ((context: TContext) => boolean);
  /** Validate the form before running this action, without submitting it. */
  validate?: boolean;
  variant?: "default" | "outline" | "secondary" | "destructive";
  onClick: (context: TContext, signal: AbortSignal) => void | Promise<void>;
}

export type FormBlockSpan = 1 | 2 | 3 | "full";

interface BlockBase {
  id: string;
  span?: FormBlockSpan;
}

export type FormLayoutBlock<TContext, TContent> =
  | {
      type: "field";
      name: string;
      id?: string;
      span?: FormBlockSpan;
    }
  | (BlockBase & {
      type: "section";
      title?: string;
      titleKey?: string;
      description?: string;
      descriptionKey?: string;
      columns?: 1 | 2 | 3;
      blocks: FormLayoutBlock<TContext, TContent>[];
    })
  | (BlockBase & {
      type: "content";
      title?: string;
      titleKey?: string;
      text: string;
      textKey?: string;
      tone?: "default" | "info" | "warning";
    })
  | (BlockBase & {
      type: "actions";
      actions: FormLayoutAction<TContext>[];
    })
  | (BlockBase & {
      type: "custom";
      /** React/Vue render callback. Vue also supports the form-{id} slot. */
      render?: (context: TContext) => TContent;
    });

/** Render each declared field once and retain fields omitted from the layout. */
export function resolveFormBlocks<TContext, TContent>(
  blocks: FormLayoutBlock<TContext, TContent>[],
  fieldNames: readonly string[]
): FormLayoutBlock<TContext, TContent>[] {
  const remaining = new Set(fieldNames);
  const visit = (
    items: FormLayoutBlock<TContext, TContent>[]
  ): FormLayoutBlock<TContext, TContent>[] => {
    const result: FormLayoutBlock<TContext, TContent>[] = [];
    for (const block of items) {
      if (block.type === "field") {
        if (remaining.delete(block.name)) {
          result.push(block);
        }
      } else if (block.type === "section") {
        result.push({ ...block, blocks: visit(block.blocks) });
      } else {
        result.push(block);
      }
    }
    return result;
  };
  return [
    ...visit(blocks),
    ...Array.from(remaining, (name) => ({ type: "field" as const, name })),
  ];
}

export function formBlockId<TContext, TContent>(
  block: FormLayoutBlock<TContext, TContent>
): string {
  return block.type === "field"
    ? (block.id ?? `field-${block.name}`)
    : block.id;
}

export function formBlockSpan(
  span: FormBlockSpan | undefined,
  columns: number
): number | "full" {
  return span === "full" ? "full" : Math.min(span ?? 1, columns);
}

export function formActionFlag<TContext>(
  flag: boolean | ((context: TContext) => boolean) | undefined,
  context: TContext
): boolean {
  return typeof flag === "function" ? flag(context) : flag === true;
}

/** Resolve form-local translations while retaining unresolved provider keys. */
export function translateFormBlocks<TContext, TContent>(
  blocks: FormLayoutBlock<TContext, TContent>[],
  keys: Record<string, string>
): FormLayoutBlock<TContext, TContent>[] {
  const translated = (value: string | undefined, key: string | undefined) => ({
    value: key ? (keys[key] ?? value) : value,
    key: key && keys[key] !== undefined ? undefined : key,
  });
  return blocks.map((block) => {
    if (block.type === "section" || block.type === "content") {
      const title = translated(block.title, block.titleKey);
      if (block.type === "section") {
        const description = translated(block.description, block.descriptionKey);
        return {
          ...block,
          title: title.value,
          titleKey: title.key,
          description: description.value,
          descriptionKey: description.key,
          blocks: translateFormBlocks(block.blocks, keys),
        };
      }
      const text = translated(block.text, block.textKey);
      return {
        ...block,
        title: title.value,
        titleKey: title.key,
        text: text.value ?? block.text,
        textKey: text.key,
      };
    }
    if (block.type === "actions") {
      return {
        ...block,
        actions: block.actions.map((action) => {
          const label = translated(action.label, action.labelKey);
          return {
            ...action,
            label: label.value ?? action.label,
            labelKey: label.key,
          };
        }),
      };
    }
    return block;
  });
}
