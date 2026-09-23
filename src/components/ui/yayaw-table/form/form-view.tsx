"use client";

import { useCallback, useMemo } from "react";
import type { DisplayModeRenderContext } from "../types/display-mode-renderer";
import {
  type FormLabelKey,
  mergeFormSettings,
  publicFormSnapshot,
} from "../utils/form-view";
import { FormShare } from "./form-share";
import { YayawTableForm } from "./yayaw-table-form";

/** The Form display mode: the view's form, creating records in this table. */
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
  return (
    <div className="grid min-w-0 gap-3 py-2" data-form-view>
      {formLinks ? (
        <div
          className="flex min-h-8 items-center justify-end gap-2"
          data-form-toolbar
        >
          <FormShare
            formLinks={formLinks}
            locale={locale}
            snapshot={snapshot}
            translate={translate}
            viewId={context.viewId}
          />
        </div>
      ) : null}
      <div className="rounded-lg bg-muted/40 px-3 py-6 sm:px-6 sm:py-10 dark:bg-muted/20">
        <YayawTableForm
          columns={formColumns}
          key={context.viewId ?? "form"}
          form={form}
          locale={locale}
          onSubmit={(values) => createRecord(values)}
          translate={translate}
        />
      </div>
    </div>
  );
}
