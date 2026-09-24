"use client";

import { useSetAtom } from "jotai";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import { useStackMenu } from "@/components/ui/custom/stack-menu";
import { Button } from "@/src/components/ui/button";
import type { DisplayModeSettingsContext } from "../types/display-mode-renderer";
import {
  formBuilderSummary,
  formBuilderSummaryLines,
} from "../utils/form-builder";
import {
  type FormLabelKey,
  type FormTranslate,
  formLabel,
  normalizeFormViewConfig,
  withFormFields,
} from "../utils/form-view";
import { formBuilderRequestAtom } from "./form-builder-request";

/**
 * View → Form settings: what the form asks (questions, layout, languages)
 * and "Edit form", which closes the menu and opens the form builder over the
 * Form view, where the form is edited. Reset goes back to the table's form.
 */
export function FormSettings({
  context,
}: {
  context: DisplayModeSettingsContext;
}) {
  const translate: FormTranslate = (name, fallback) =>
    context.translate(`form.${name}`, fallback);
  const label = (key: FormLabelKey) =>
    formLabel(key, context.locale, translate);
  const columns = useMemo(
    () => withFormFields(context.columns, context.formFields),
    [context.columns, context.formFields]
  );
  const summary = formBuilderSummary(
    columns,
    context.defaults,
    context.settings,
    context.locale
  );
  const lines = formBuilderSummaryLines(summary, context.locale, translate);
  const menu = useStackMenu();
  const requestBuilder = useSetAtom(formBuilderRequestAtom(context.tableId));
  const customized = Boolean(normalizeFormViewConfig(context.settings));
  const edit = () => {
    menu.onOpenChange?.(false);
    requestBuilder((count) => count + 1);
  };
  return (
    <div className="grid min-w-0 gap-3" data-form-settings>
      <div className="grid min-w-0 gap-1" data-form-summary>
        {summary.title ? (
          <p className="truncate font-medium text-sm">{summary.title}</p>
        ) : null}
        {lines.map((line) => (
          <p className="text-muted-foreground text-sm" key={line}>
            {line}
          </p>
        ))}
      </div>
      <Button data-form-settings-edit onClick={edit} type="button">
        <Pencil aria-hidden="true" />
        {label("editForm")}
      </Button>
      <p className="text-muted-foreground text-xs">{label("summaryHint")}</p>
      <Button
        className="font-normal"
        disabled={!customized}
        onClick={() => context.updateSettings(undefined)}
        size="sm"
        type="button"
        variant="outline"
      >
        {label("reset")}
      </Button>
    </div>
  );
}
