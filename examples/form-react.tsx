"use client";

// Only the standalone form: no table, no URL state library, no provider.
import { useEffect, useState } from "react";
import { YayawTableForm } from "../src/components/ui/yayaw-table/form/yayaw-table-form";
import {
  type DemoAcceptedResponse,
  demoLastResponse,
  demoPublishedForm,
  requestFormSettings,
  saveDemoResponse,
  submitDemoPublicForm,
} from "./form-links";
import { viewsColumns } from "./views";

const EXAMPLE_LINK = "?example=views";

/** What the host's server accepted: the record and its metadata (consents, context, server). */
function HostResult({ response }: { response: DemoAcceptedResponse }) {
  return (
    <section
      aria-labelledby="demo-result-title"
      className="grid gap-2 rounded-lg border bg-muted/40 p-4"
      data-demo-result
    >
      <h2 className="font-medium text-sm" id="demo-result-title">
        Response received by the host
      </h2>
      <p className="text-muted-foreground text-xs">
        The record and its metadata, as the host's server accepted them.
      </p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background p-3 text-xs">
        {JSON.stringify(response, null, 2)}
      </pre>
    </section>
  );
}

/**
 * A public form page: the snapshot a view published, as a host would serve
 * it, in the page's language (`&lang=fr`).
 */
function PublicForm({ locale, viewId }: { locale: string; viewId: string }) {
  const published = demoPublishedForm(viewId);
  const [result, setResult] = useState<DemoAcceptedResponse>();
  if (!published) {
    return (
      <output className="text-muted-foreground text-sm">
        This form is not published.
      </output>
    );
  }
  return (
    <>
      <YayawTableForm
        closed={!published.acceptsResponses}
        columns={published.snapshot.columns}
        form={published.snapshot.form}
        locale={locale}
        onSubmit={(values, meta) => submitDemoPublicForm(viewId, values, meta)}
        onSuccess={() => setResult(demoLastResponse())}
      />
      {result ? <HostResult response={result} /> : null}
    </>
  );
}

/**
 * `?example=form&form=<viewId>` renders a published form (`&lang=fr` in
 * French); `?example=form` shows the standalone component with the Request
 * view's settings.
 */
export function FormExample() {
  const params = new URLSearchParams(window.location.search);
  const viewId = params.get("form");
  const locale = params.get("lang") ?? "en";
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:px-6">
      {viewId ? (
        <PublicForm locale={locale} viewId={viewId} />
      ) : (
        <>
          <header className="grid gap-1">
            <h1 className="font-semibold text-2xl">Standalone form</h1>
            <p className="text-muted-foreground text-sm">
              <code>YayawTableForm</code> outside a table. Responses join the{" "}
              <a className="underline" href={EXAMPLE_LINK}>
                views example
              </a>
              .
            </p>
          </header>
          <section aria-label="Standalone form">
            <YayawTableForm
              columns={viewsColumns}
              form={requestFormSettings}
              locale={locale}
              onSubmit={(values) => {
                saveDemoResponse(values);
                return { ok: true };
              }}
            />
          </section>
        </>
      )}
    </main>
  );
}
