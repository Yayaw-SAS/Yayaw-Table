import { beforeEach, test } from "bun:test";
import assert from "node:assert/strict";
import {
  createDemoFormLinks,
  demoLastResponse,
  demoPublishedForm,
  requestFormView,
  submitDemoPublicForm,
} from "../examples/form-links";
import { viewsColumns } from "../examples/views";
import {
  buildPublicFormSnapshot,
  type PublicFormSnapshot,
} from "../src/components/ui/yayaw-table/utils/form-view";

beforeEach(() => window.localStorage.clear());

test("the demo host builds the snapshot itself and ignores the browser's", async () => {
  const links = createDemoFormLinks(viewsColumns);
  const tampered: PublicFormSnapshot = {
    version: 1,
    viewId: "request",
    form: { questions: [{ id: "salary", columnId: "salary" }] },
    columns: [{ id: "salary", header: "Salary", type: "number" }],
    hiddenValues: { status: "Active", owner: "attacker" },
  };
  await links.publish("request", tampered);
  const stored = demoPublishedForm("request")?.snapshot;
  assert.deepEqual(
    stored,
    buildPublicFormSnapshot({ view: requestFormView, columns: viewsColumns })
  );
  assert.deepEqual(stored?.hiddenValues, { status: "Draft" });
  assert.equal(
    stored?.columns.some((column) => column.id === "salary"),
    false
  );
  assert.equal(stored?.form.rules?.length, 3);
  await assert.rejects(links.publish("unknown"));
});

test("public responses follow the published rules", async () => {
  await createDemoFormLinks(viewsColumns).publish("request");
  const consents = { privacy: true as const };
  assert.deepEqual(
    submitDemoPublicForm(
      "request",
      { name: "A", category: "Hardware" },
      { consents, fields: {}, locale: "en" }
    ),
    { ok: false, errors: { price: "errorRequired" } }
  );
  assert.deepEqual(
    submitDemoPublicForm(
      "request",
      { name: "B", category: "Service", serialNumber: "ignored" },
      { consents, fields: {}, locale: "en" }
    ),
    { ok: true }
  );
  const saved = JSON.parse(
    window.localStorage.getItem("yayaw-demo-form-responses") ?? "[]"
  );
  assert.equal(saved.at(-1).serialNumber, undefined);
  assert.equal(saved.at(-1).status, "Draft");
});

test("the demo host requires the consent and keeps the metadata apart", async () => {
  await createDemoFormLinks(viewsColumns).publish("request");
  const values = { name: "C", category: "Service" };
  assert.deepEqual(submitDemoPublicForm("request", values), {
    ok: false,
    errors: { privacy: "errorConsent" },
  });
  assert.deepEqual(
    submitDemoPublicForm("request", values, {
      consents: { privacy: true },
      fields: { utm_source: "newsletter", page: "javascript:void(0)" },
      locale: "fr",
    }),
    { ok: true }
  );
  const last = demoLastResponse();
  assert.deepEqual(last?.values, { ...values, status: "Draft" });
  assert.deepEqual(last?.metadata.context, { utm_source: "newsletter" });
  assert.equal(last?.metadata.consents[0]?.version, "2026-09");
  assert.equal(last?.metadata.consents[0]?.locale, "fr");
  assert.equal(
    last?.metadata.consents[0]?.text,
    "J’accepte que ma demande soit traitée conformément à la politique de confidentialité."
  );
  assert.ok(last?.metadata.consents[0]?.acceptedAt);
  assert.deepEqual(last?.metadata.server, {
    pageId: "form/request",
    revision: 1,
  });
});
