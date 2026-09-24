"use client";

import { useCallback, useMemo, useState } from "react";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import { formLanguage, formLocaleMatch } from "../utils/form-text";
import {
  type FormLabelKey,
  formLabel,
  formViewLocales,
  mergeFormSettings,
  publicFormSnapshot,
} from "../utils/form-view";
import { FormLanguageSwitch } from "./form-languages";
import { FormShare } from "./form-share";
import { YayawTableForm } from "./yayaw-table-form";

/**
 * The Form display mode: the view's form, creating records in this table. A
 * form written in several languages can be previewed in each of them.
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
  const previewed =
    preview && languages.includes(preview) ? preview : undefined;
  // Tags look like the table's: its colored-tags setting applies to the form.
  const formColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        coloredTags: column.coloredTags ?? context.coloredTags,
      })),
    [columns, context.coloredTags]
  );
  const snapshot = useCallback(
    () => publicFormSnapshot(form, formColumns),
    [formColumns, form]
  );
  const multilingual = languages.length > 1;
  return (
    <div className="grid min-w-0 gap-3 py-2" data-form-view>
      {formLinks || multilingual ? (
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
          {formLinks ? (
            <div className="ml-auto">
              <FormShare
                formLinks={formLinks}
                locale={locale}
                snapshot={snapshot}
                translate={translate}
                viewId={context.viewId}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-lg bg-muted/40 px-3 py-6 sm:px-6 sm:py-10 dark:bg-muted/20">
        <YayawTableForm
          columns={formColumns}
          form={form}
          key={context.viewId ?? "form"}
          locale={previewed ?? locale}
          onSubmit={(values) => createRecord(values)}
          translate={translate}
        />
      </div>
    </div>
  );
}
