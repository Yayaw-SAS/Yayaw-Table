"use client";

// Only the standalone form: no table, no URL state library, no provider.
import { YayawTableForm } from "../src/components/ui/yayaw-table/form/yayaw-table-form";
import {
  demoPublishedForm,
  requestFormSettings,
  saveDemoResponse,
  submitDemoPublicForm,
} from "./form-links";
import { viewsColumns } from "./views";

const EXAMPLE_LINK = "?example=views";

/** A public form page: the snapshot a view published, as a host would serve it. */
function PublicForm({ viewId }: { viewId: string }) {
  const published = demoPublishedForm(viewId);
  if (!published) {
    return (
      <output className="text-muted-foreground text-sm">
        This form is not published.
      </output>
    );
  }
  return (
    <YayawTableForm
      closed={!published.acceptsResponses}
      columns={published.snapshot.columns}
      form={published.snapshot.form}
      onSubmit={(values) => submitDemoPublicForm(viewId, values)}
    />
  );
}

/**
 * `?example=form&form=<viewId>` renders a published form; `?example=form`
 * shows the standalone component with the Request view's settings.
 */
export function FormExample() {
  const viewId = new URLSearchParams(window.location.search).get("form");
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:px-6">
      {viewId ? (
        <PublicForm viewId={viewId} />
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
          <section
            aria-label="Standalone form"
            className="rounded-lg border px-4 py-6 sm:px-8"
          >
            <YayawTableForm
              columns={viewsColumns}
              form={requestFormSettings}
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
