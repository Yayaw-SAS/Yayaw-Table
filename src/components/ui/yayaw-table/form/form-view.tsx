"use client";

import { useAtomValue } from "jotai";
import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import { formLanguage, formLocaleMatch } from "../utils/form-text";
import {
  type FormLabelKey,
  type FormViewSettings,
  formLabel,
  formViewLocales,
  mergeFormSettings,
  publicFormSnapshot,
  withFormFields,
} from "../utils/form-view";
import { FormBuilderDialog } from "./form-builder-dialog";
import { formBuilderRequestAtom } from "./form-builder-request";
import { FormLanguageSwitch } from "./form-languages";
import { FormShare } from "./form-share";
import { YayawTableForm } from "./yayaw-table-form";

/** Opens the form builder when View settings ask for it ("Edit form"). */
function useBuilderRequests(tableId: string, open: () => void) {
  const request = useAtomValue(formBuilderRequestAtom(tableId));
  const seen = useRef(request);
  useEffect(() => {
    if (request !== seen.current) {
      seen.current = request;
      open();
    }
  }, [open, request]);
}

/**
 * The Form display mode: the view's form, creating records in this table,
 * with "Edit form" (the form builder) and "Share form" above it. A form
 * written in several languages can be previewed in each of them.
 */
export function FormView({ context }: { context: DisplayModeRenderContext }) {
  const { columns, createRecord, defaults, formLinks, locale, settings } =
    context;
  const translate = useCallback(
    (key: FormLabelKey, fallback: string) =>
      context.translate(`form.${key}`, fallback),
    [context.translate]
  );
  const form = useMemo(
    () => mergeFormSettings(defaults, settings),
    [defaults, settings]
  );
  const languages = useMemo(
    () => formViewLocales(defaults, settings, formLanguage(locale) || "en"),
    [defaults, settings, locale]
  );
  const [preview, setPreview] = useState<string>();
  const previewed = preview && languages.includes(preview) ? preview : undefined;
  // Tags look like the table's: its colored-tags setting applies to the form.
  // Columns the create form lacks are not asked.
  const formColumns = useMemo(
    () =>
      withFormFields(
        columns.map((column) => ({
          ...column,
          coloredTags: column.coloredTags ?? context.coloredTags,
        })),
        context.formFields
      ),
    [columns, context.coloredTags, context.formFields]
  );
  const snapshot = useCallback(
    () => publicFormSnapshot(form, formColumns),
    [formColumns, form]
  );
  const [building, setBuilding] = useState(false);
  const openBuilder = useCallback(() => setBuilding(true), []);
  useBuilderRequests(context.tableId, openBuilder);
  const editButton = useRef<HTMLButtonElement>(null);
  const save = (next: FormViewSettings | undefined) =>
    context.updateSettings(next as Record<string, unknown> | undefined);
  const multilingual = languages.length > 1;
  const editable = form.editButton !== false;
  return (
    <div className="grid min-w-0 gap-3 py-2" data-form-view>
      {formLinks || multilingual || editable ? (
        <div
          className="flex min-h-8 flex-wrap items-center gap-2"
          data-form-toolbar
        >
          {multilingual ? (
            <FormLanguageSwitch
              label={formLabel("previewLanguage", locale, translate)}
              languages={languages}
              onChange={setPreview}
              value={
                previewed ??
                formLocaleMatch(languages, locale) ??
                languages[0] ??
                locale
              }
            />
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {editable ? (
              <Button
                data-form-edit
                onClick={openBuilder}
                ref={editButton}
                size="sm"
                type="button"
                variant="outline"
              >
                <Pencil aria-hidden="true" />
                {formLabel("editForm", locale, translate)}
              </Button>
            ) : null}
            {formLinks ? (
              <FormShare
                formLinks={formLinks}
                locale={locale}
                snapshot={snapshot}
                translate={translate}
                viewId={context.viewId}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="rounded-lg bg-muted/40 px-3 py-6 sm:px-6 sm:py-10 dark:bg-muted/20">
        <YayawTableForm
          columns={formColumns}
          key={context.viewId ?? "form"}
          form={form}
          locale={previewed ?? locale}
          onSubmit={(values) => createRecord(values)}
          translate={translate}
        />
      </div>
      <FormBuilderDialog
        columns={formColumns}
        defaults={defaults}
        finalFocus={editButton}
        locale={locale}
        onOpenChange={setBuilding}
        onSave={save}
        open={building}
        settings={settings}
        share={
          formLinks
            ? { formLinks, snapshot, viewId: context.viewId }
            : undefined
        }
        translate={translate}
      />
    </div>
  );
}
