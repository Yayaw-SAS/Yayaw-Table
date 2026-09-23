import { beforeEach, test } from "bun:test";
import assert from "node:assert/strict";
import {
  createDemoFormLinks,
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
  assert.deepEqual(
    submitDemoPublicForm("request", { name: "A", category: "Hardware" }),
    { ok: false, errors: { price: "errorRequired" } }
  );
  assert.deepEqual(
    submitDemoPublicForm("request", {
      name: "B",
      category: "Service",
      serialNumber: "ignored",
    }),
    { ok: true }
  );
  const saved = JSON.parse(
    window.localStorage.getItem("yayaw-demo-form-responses") ?? "[]"
  );
  assert.equal(saved.at(-1).serialNumber, undefined);
  assert.equal(saved.at(-1).status, "Draft");
});
