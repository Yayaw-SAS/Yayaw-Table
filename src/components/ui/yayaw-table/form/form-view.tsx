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
  const snapshot = useCallback(
    () => publicFormSnapshot(form, columns),
    [columns, form]
  );
  return (
    <div className="grid gap-4 py-2" data-form-view>
      {formLinks ? (
        <FormShare
          formLinks={formLinks}
          locale={locale}
          snapshot={snapshot}
          translate={translate}
          viewId={context.viewId}
        />
      ) : null}
      <div className="rounded-lg border bg-background px-4 py-6 sm:px-8">
        <YayawTableForm
          columns={columns}
          form={form}
          locale={locale}
          onSubmit={(values) => createRecord(values)}
          translate={translate}
        />
      </div>
    </div>
  );
}
