"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Switch } from "@/src/components/ui/switch";
import type { FormBuilderState } from "../utils/form-builder";
import { formLanguageName } from "../utils/form-text";
import type {
  FormColumn,
  FormLabelKey,
  FormTranslate,
} from "../utils/form-view";
import { YayawTableForm } from "./yayaw-table-form";

type Label = (key: FormLabelKey, params?: Record<string, string>) => string;

/** The preview answers without sending anything. */
const previewSubmit = () => ({ ok: true as const });

/** The rendered item of an outline entry, for highlighting the selection. */
function previewTarget(
  body: HTMLElement,
  state: FormBuilderState
): HTMLElement | null {
  const selection = state.selection;
  const escaped = (id: string) => CSS.escape(id);
  switch (selection.kind) {
    case "question":
      return body.querySelector(
        `[data-form-question="${escaped(selection.entry.id)}"]`
      );
    case "consent":
      return body.querySelector(
        `[data-form-consent="${escaped(selection.entry.id)}"]`
      );
    case "section":
      return body.querySelector(
        `[data-form-section="${escaped(selection.entry.id)}"]`
      );
    default:
      return null;
  }
}

/**
 * The builder's center: the form as people will see it, in the language
 * being edited and the chosen layout. Answers are never sent; "Show as
 * closed" previews the closed message.
 */
export function FormBuilderPreview({
  columns,
  headingId,
  label,
  languageBar,
  state,
  translate,
}: {
  columns: readonly FormColumn[];
  headingId: string;
  label: Label;
  /** The language switcher, above the preview on phones. */
  languageBar?: ReactNode;
  state: FormBuilderState;
  translate?: FormTranslate;
}) {
  const id = useId();
  const [closed, setClosed] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  // The selected question, section or consent is outlined and scrolled into view.
  useEffect(() => {
    const container = body.current;
    const target = container ? previewTarget(container, state) : null;
    if (!target) {
      return;
    }
    target.setAttribute("data-builder-selected", "");
    target.scrollIntoView?.({ block: "nearest" });
    return () => target.removeAttribute("data-builder-selected");
  }, [state]);
  const layout = label(state.layout === "steps" ? "layoutSteps" : "layoutPage");
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-h-0 min-w-0 flex-col bg-muted/40 dark:bg-muted/20"
      data-form-builder-preview
    >
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-background px-4 py-2">
        <h2 className="font-medium text-sm" id={headingId}>
          {label("builderPreview")}
        </h2>
        <span className="text-muted-foreground text-xs" data-form-builder-preview-state>
          {formLanguageName(state.locale)} · {layout}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-muted-foreground text-xs" htmlFor={`${id}-closed`}>
            {label("builderShowClosed")}
          </label>
          <Switch
            checked={closed}
            id={`${id}-closed`}
            onCheckedChange={(next) => setClosed(next)}
            size="sm"
          />
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 sm:py-8 [&_[data-builder-selected]]:rounded-md [&_[data-builder-selected]]:outline-2 [&_[data-builder-selected]]:outline-primary/60 [&_[data-builder-selected]]:outline-offset-4"
        ref={body}
      >
        <div className="mx-auto grid w-full max-w-[640px] gap-3">
          {languageBar}
          <p className="text-muted-foreground text-xs">{label("builderPreviewNote")}</p>
          <YayawTableForm
            closed={closed}
            columns={columns}
            form={state.form}
            locale={state.locale}
            onSubmit={previewSubmit}
            translate={translate}
          />
        </div>
      </div>
    </section>
  );
}
