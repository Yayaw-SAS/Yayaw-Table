import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { z } from "zod";
import { CatalogueBulkEditor } from "../src/components/ui/yayaw-table/components/forms/catalogue-bulk-editor";
import { RuntimeField } from "../src/components/ui/yayaw-table/components/forms/field-runtime";
import { FormBuilder } from "../src/components/ui/yayaw-table/components/forms/form-builder";
import { useFormBuilder } from "../src/components/ui/yayaw-table/components/forms/hooks/use-form-builder";
import { useFormCatalogue } from "../src/components/ui/yayaw-table/components/forms/hooks/use-form-catalogue";
import type {
  AnyFieldDefinition,
  FieldValues,
  FormConfig,
  FormConfigContext,
} from "../src/components/ui/yayaw-table/components/forms/types";
import {
  defaultTranslations,
  type TableActions,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
const clients: QueryClient[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  for (const client of clients.splice(0)) {
    client.clear();
  }
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return {
    container,
    render: async (node: ReactNode) => {
      await act(() => root.render(node));
    },
  };
}
function provider(
  children: ReactNode,
  config: FormConfig,
  actions: TableActions = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return (
    <TableProvider
      getFormConfig={() => config as never}
      getTableActions={() => actions}
      queryClient={client}
      tableId="items"
      translations={defaultTranslations}
    >
      {children}
    </TableProvider>
  );
}
const context: FormConfigContext = {
  formType: "items",
  tableId: "items",
  tableType: "items",
  mode: "edit",
  values: {},
};

it("validates and transforms once per submission, preserves false and zero, and reacts to conditional fields", async () => {
  const view = mount();
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  let validations = 0;
  const saved: FieldValues[] = [];
  const config: FormConfig = {
    id: "items",
    defaultValues: { enabled: false, amount: 0, detail: "" },
    fields: [
      { name: "enabled", label: "Enabled", type: "switch" },
      {
        name: "amount",
        label: "Amount",
        type: "number",
        required: true,
        schema: z.number().transform((value) => {
          validations++;
          return value + 1;
        }),
      },
      {
        name: "detail",
        label: "Detail",
        type: "text",
        required: true,
        hidden: (ctx) => !ctx.values?.enabled,
      },
    ],
  };
  function Probe() {
    builder = useFormBuilder({
      config,
      formOptions: {
        onSubmit: (values) => {
          saved.push(values);
        },
      },
    });
    return (
      <FormBuilder
        context={builder.context}
        fields={builder.fields}
        form={builder.form}
      />
    );
  }
  await view.render(provider(<Probe />, config));
  expect(view.container.textContent).not.toContain("Detail");
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([{ enabled: false, amount: 1, detail: "" }]);
  expect(validations).toBe(1);
  await act(() => builder.form.setFieldValue("enabled", true));
  expect(view.container.textContent).toContain("Detail");
  await act(() => builder.form.handleSubmit());
  expect(saved).toHaveLength(1);
  expect(view.container.textContent).toContain("Detail is required");
});

it("keeps root and nested validation errors visible and blocks submission", async () => {
  const view = mount();
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  let saved = false;
  const config: FormConfig = {
    id: "items",
    fields: [
      {
        name: "lines",
        label: "Lines",
        type: "collection",
        itemFields: [
          { name: "name", label: "Name", type: "text", required: true },
        ],
      },
    ],
    defaultValues: { lines: [{ name: "" }] },
  };
  function Probe() {
    builder = useFormBuilder({
      config,
      formOptions: {
        onSubmit: () => {
          saved = true;
        },
      },
    });
    return <FormBuilder fields={builder.fields} form={builder.form} />;
  }
  await view.render(provider(<Probe />, config));
  await act(() => builder.form.handleSubmit());
  expect(saved).toBe(false);
  expect(view.container.textContent).toContain("Name is required");
});

it("ignores late initial values after switching rows and submits only changed editable fields", async () => {
  const view = mount();
  const first = deferred<FieldValues>();
  const second = deferred<FieldValues>();
  const signals: AbortSignal[] = [];
  const calls: unknown[] = [];
  let builder!: ReturnType<typeof useFormCatalogue<FieldValues>>;
  const config: FormConfig = {
    id: "items",
    submitMode: "patch",
    fields: [
      { name: "name", label: "Name", type: "text" },
      { name: "locked", label: "Locked", type: "text", disabled: true },
    ],
    loadInitialValues: (row, _ctx, signal) => {
      signals.push(signal);
      return row?.id === "one" ? first.promise : second.promise;
    },
    transform: (values) => ({ ...values, normalized: true }),
  };
  function Probe({ row }: { row: FieldValues }) {
    builder = useFormCatalogue({
      formType: "items",
      initialData: row,
      mode: "update",
    });
    return <FormBuilder fields={builder.fields} form={builder.form} />;
  }
  const actions: TableActions = {
    update: (id, values) => {
      calls.push({ id, values });
      return Promise.resolve({ success: true });
    },
  };
  await view.render(provider(<Probe row={{ id: "one" }} />, config, actions));
  await view.render(provider(<Probe row={{ id: "two" }} />, config, actions));
  await act(async () => {
    second.resolve({ name: "Second", locked: "private" });
    await settle();
  });
  await act(async () => {
    first.resolve({ name: "Stale" });
    await settle();
  });
  expect(signals[0]?.aborted).toBe(true);
  expect(builder.form.state.values.name).toBe("Second");
  await act(() => builder.form.setFieldValue("name", "Changed"));
  await act(() => builder.form.handleSubmit());
  expect(calls).toEqual([
    { id: "two", values: { name: "Changed", normalized: true } },
  ]);
});

it("reloads option dependencies, ignores stale responses, and does not reload for unrelated edits", async () => {
  const view = mount();
  const first = deferred<{ label: string; value: string }[]>();
  const second = deferred<{ label: string; value: string }[]>();
  const calls: unknown[] = [];
  const field: AnyFieldDefinition = {
    name: "choice",
    label: "Choice",
    type: "select",
    optionDependencies: ["country"],
    options: (ctx) => {
      calls.push(ctx.values?.country);
      return ctx.values?.country === "FR" ? first.promise : second.promise;
    },
  };
  const render = async (country: string, unrelated = "") => {
    await view.render(
      <RuntimeField
        context={{ ...context, values: { country, unrelated } }}
        field={field}
        value="chosen"
      >
        {(resolved) => <output>{JSON.stringify(resolved.options)}</output>}
      </RuntimeField>
    );
    await act(settle);
  };
  await render("FR");
  await render("DE");
  await act(async () => {
    second.resolve([{ value: "chosen", label: "German" }]);
    await settle();
  });
  await act(async () => {
    first.resolve([{ value: "chosen", label: "Stale French" }]);
    await settle();
  });
  await render("DE", "changed");
  expect(calls).toEqual(["FR", "DE"]);
  expect(view.container.textContent).toContain("German");
  expect(view.container.textContent).not.toContain("Stale French");
});

it("retries only failed bulk targets and sends added fields including false", async () => {
  const view = mount();
  const calls: unknown[] = [];
  const completed: string[][] = [];
  let closed = false;
  const config: FormConfig = {
    id: "items",
    fields: [
      { name: "active", label: "Active", type: "switch" },
      { name: "name", label: "Name", type: "text", required: true },
    ],
  };
  const actions: TableActions = {
    bulkUpdate: (ids, values) => {
      calls.push({ ids, values });
      return Promise.resolve(
        calls.length === 1
          ? { success: false, failedIds: ["two"], error: "Retry me" }
          : { success: true }
      );
    },
  };
  await view.render(
    provider(
      <CatalogueBulkEditor
        onClose={() => {
          closed = true;
        }}
        onCompleted={(ids) => {
          completed.push(ids);
          return Promise.resolve();
        }}
        tableId="items"
        tableType="items"
        targets={[
          { id: "one", row: { active: false, name: "One" } },
          { id: "two", row: { active: false, name: "Two" } },
        ]}
      />,
      config,
      actions
    )
  );
  await act(() =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "Add a field")
      ?.click()
  );
  await act(async () => {
    document.querySelector<HTMLElement>('[data-bulk-option="active"]')?.click();
    await settle();
  });
  const save = () =>
    [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.startsWith("Apply to ")
    );
  await act(async () => {
    save()?.click();
    await settle();
  });
  expect(calls).toEqual([{ ids: ["one", "two"], values: { active: false } }]);
  expect(completed).toEqual([["one"]]);
  expect(closed).toBe(false);
  await act(async () => {
    save()?.click();
    await settle();
  });
  expect(calls[1]).toEqual({ ids: ["two"], values: { active: false } });
  expect(completed).toEqual([["one"], ["two"]]);
  expect(closed).toBe(true);
});

it("preserves an invalid JSON draft and only submits the corrected parsed value", async () => {
  const view = mount();
  const saved: FieldValues[] = [];
  const config: FormConfig = {
    id: "items",
    fields: [{ name: "payload", label: "Payload", type: "json" }],
  };
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  function Probe() {
    builder = useFormBuilder({
      config,
      initialData: { payload: { enabled: false } },
      formOptions: {
        onSubmit: (values) => {
          saved.push(values);
        },
      },
    });
    return (
      <FormBuilder
        context={builder.context}
        fields={builder.fields}
        form={builder.form}
      />
    );
  }
  await view.render(provider(<Probe />, config));
  const textarea = view.container.querySelector("textarea");
  expect(textarea?.value).toContain('"enabled": false');
  const fill = async (value: string) => {
    await act(() => {
      Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set?.call(textarea, value);
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  await fill("{ incomplete");
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([]);
  expect(textarea?.value).toBe("{ incomplete");
  expect(view.container.textContent).toContain("expected valid JSON");
  await fill('{"enabled":true}');
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([{ payload: { enabled: true } }]);
});

it("composes fields, translated content and asynchronous actions without changing the submitted shape", async () => {
  const view = mount();
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  const saved: FieldValues[] = [];
  let calls = 0;
  const gate = deferred<void>();
  const config: FormConfig = {
    id: "layout",
    defaultValues: { name: "", amount: 7 },
    translations: {
      namespace: "layout",
      keys: { note: "Reviewed information" },
    },
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "amount", label: "Amount", type: "number" },
    ],
    blocks: [
      {
        type: "section",
        id: "details",
        columns: 2,
        blocks: [
          { type: "field", name: "name" },
          { type: "field", name: "name" },
          { type: "field", name: "unknown" },
          {
            type: "content",
            id: "note",
            text: "Fallback",
            textKey: "note",
            span: "full",
          },
          {
            type: "custom",
            id: "preview",
            render: ({ values }) => (
              <output>{String(values?.name || "Empty")}</output>
            ),
          },
        ],
      },
      {
        type: "actions",
        id: "tools",
        actions: [
          {
            id: "enrich",
            label: "Enrich",
            validate: true,
            onClick: async (ctx) => {
              calls++;
              if (calls === 1) {
                throw new Error("Try again");
              }
              await gate.promise;
              ctx.setFieldValue("name", "Enriched");
            },
          },
        ],
      },
    ],
  };
  function Probe() {
    builder = useFormBuilder({
      config,
      formOptions: {
        onSubmit: (values) => {
          saved.push(values);
        },
      },
    });
    return (
      <FormBuilder
        blocks={builder.blocks}
        context={builder.context}
        fields={builder.fields}
        form={builder.form}
      />
    );
  }
  await view.render(provider(<Probe />, config));
  expect(view.container.querySelectorAll('input[name="name"]')).toHaveLength(1);
  expect(view.container.textContent).toContain("Reviewed information");
  expect(
    view.container.querySelector('[data-form-columns="2"]')
  ).not.toBeNull();
  expect(
    view.container.querySelector('[data-form-block="field-amount"]')
  ).not.toBeNull();
  const button = view.container.querySelector<HTMLButtonElement>(
    '[data-form-block="tools"] button'
  );
  if (!button) {
    throw new Error("Missing custom action button");
  }
  await act(async () => {
    button.click();
    await settle();
  });
  expect(calls).toBe(0);
  expect(view.container.textContent).toContain("Name is required");
  await act(() => builder.form.setFieldValue("name", "Draft"));
  expect(view.container.querySelector("output")?.textContent).toBe("Draft");
  await act(async () => {
    button.click();
    await settle();
  });
  expect(view.container.textContent).toContain("Try again");
  await act(async () => {
    button.click();
    button.click();
    await settle();
  });
  expect(calls).toBe(2);
  expect(button.disabled).toBe(true);
  expect(saved).toHaveLength(0);
  await act(async () => {
    gate.resolve();
    await settle();
  });
  expect(button.disabled).toBe(false);
  expect(view.container.querySelector("output")?.textContent).toBe("Enriched");
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([{ name: "Enriched", amount: 7 }]);
});

it("aborts custom actions when the form unmounts and ignores late field writes", async () => {
  const view = mount();
  const gate = deferred<void>();
  let signal: AbortSignal | undefined;
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  const config: FormConfig = {
    id: "abort",
    defaultValues: { name: "Draft" },
    fields: [{ name: "name", label: "Name", type: "text" }],
    blocks: [
      {
        type: "actions",
        id: "tools",
        actions: [
          {
            id: "load",
            label: "Load",
            onClick: async (ctx, currentSignal) => {
              signal = currentSignal;
              await gate.promise;
              ctx.setFieldValue("name", "Late");
            },
          },
        ],
      },
    ],
  };
  function Probe() {
    builder = useFormBuilder({
      config,
      formOptions: { onSubmit: () => undefined },
    });
    return (
      <FormBuilder
        blocks={builder.blocks}
        context={builder.context}
        fields={builder.fields}
        form={builder.form}
      />
    );
  }
  await view.render(provider(<Probe />, config));
  await act(() =>
    view.container
      .querySelector<HTMLButtonElement>('[data-form-block="tools"] button')
      ?.click()
  );
  await view.render(null);
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    gate.resolve();
    await settle();
  });
  expect(builder.form.getFieldValue("name")).toBe("Draft");
});

const bulkButton = (text: string) => {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((candidate) => candidate.textContent === text);
  if (!button) {
    throw new Error(`Missing button: ${text}`);
  }
  return button;
};
const addBulkProperty = async (name: string) => {
  await act(() => bulkButton("Add a field").click());
  await act(async () => {
    document
      .querySelector<HTMLElement>(`[data-bulk-option="${name}"]`)
      ?.click();
    await settle();
  });
};
const fillBulkInput = async (name: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(
    `[data-bulk-field="${name}"] input`
  );
  if (!input) {
    throw new Error(`Missing field: ${name}`);
  }
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
};
async function mountBulkProperties(
  config: FormConfig,
  bulkUpdate: NonNullable<TableActions["bulkUpdate"]>
) {
  const view = mount();
  await view.render(
    provider(
      <CatalogueBulkEditor
        onClose={() => undefined}
        onCompleted={() => Promise.resolve()}
        tableId="items"
        tableType="items"
        targets={[
          { id: "one", row: { name: "First", note: "Same", amount: 1 } },
          { id: "two", row: { name: "Second", note: "Same", amount: 2 } },
        ]}
      />,
      config,
      { bulkUpdate }
    )
  );
  return view;
}

it("starts empty, searches properties, retains insertion order and excludes removed drafts", async () => {
  const calls: FieldValues[] = [];
  await mountBulkProperties(
    {
      id: "items",
      fields: [
        { name: "name", type: "text", label: "Name", required: true },
        { name: "amount", type: "number", label: "Amount" },
      ],
    },
    (_ids, values) => {
      calls.push(values);
      return Promise.resolve({ success: true });
    }
  );
  expect(document.querySelectorAll("[data-bulk-field]")).toHaveLength(0);
  expect(bulkButton("Apply to 2 rows").disabled).toBe(true);
  await addBulkProperty("amount");
  await fillBulkInput("amount", "24");
  await addBulkProperty("name");
  expect(
    [...document.querySelectorAll("[data-bulk-field]")].map((field) =>
      field.getAttribute("data-bulk-field")
    )
  ).toEqual(["amount", "name"]);
  await fillBulkInput("name", "Do not persist");
  expect(bulkButton("Add a field").disabled).toBe(true);
  await act(async () => {
    document
      .querySelector<HTMLButtonElement>('[aria-label="Remove Name"]')
      ?.click();
    await settle();
  });
  expect(document.activeElement).toBe(bulkButton("Add a field"));
  await act(async () => {
    bulkButton("Apply to 2 rows").click();
    await settle();
  });
  expect(calls).toEqual([{ amount: 24 }]);
});

it("disables invalid drafts, preserves zero and only offers schema-approved clears", async () => {
  const calls: FieldValues[] = [];
  await mountBulkProperties(
    {
      id: "items",
      fields: [
        {
          name: "amount",
          type: "number",
          label: "Amount",
          schema: z.number().min(0),
        },
        { name: "note", type: "text", label: "Note", schema: z.string() },
      ],
    },
    (_ids, values) => {
      calls.push(values);
      return Promise.resolve({ success: true });
    }
  );
  await addBulkProperty("amount");
  await fillBulkInput("amount", "-1");
  expect(bulkButton("Apply to 2 rows").disabled).toBe(true);
  expect(
    document.querySelector('[data-bulk-field="amount"]')?.textContent
  ).not.toContain("Clear value");
  await fillBulkInput("amount", "0");
  await addBulkProperty("note");
  await act(async () => {
    bulkButton("Clear value").click();
    await settle();
  });
  expect(
    document.querySelector<HTMLInputElement>('[data-bulk-field="note"] input')
      ?.value
  ).toBe("");
  await act(async () => {
    bulkButton("Apply to 2 rows").click();
    await settle();
  });
  expect(calls).toEqual([{ amount: 0, note: "" }]);
});

it("keeps a rejected bulk draft and allows removal of an invalid required property", async () => {
  const calls: FieldValues[] = [];
  await mountBulkProperties(
    {
      id: "items",
      fields: [
        { name: "name", type: "text", label: "Name", required: true },
        { name: "note", type: "text", label: "Note" },
      ],
    },
    (_ids, values) => {
      calls.push(values);
      return Promise.reject(new Error("Offline"));
    }
  );
  await addBulkProperty("name");
  expect(bulkButton("Apply to 2 rows").disabled).toBe(true);
  await addBulkProperty("note");
  await fillBulkInput("note", "Retain this draft");
  await act(async () => {
    document
      .querySelector<HTMLButtonElement>('[aria-label="Remove Name"]')
      ?.click();
    await settle();
  });
  await act(async () => {
    bulkButton("Apply to 2 rows").click();
    await settle();
  });
  expect(calls).toEqual([{ note: "Retain this draft" }]);
  expect(document.querySelector('[role="alert"]')?.textContent).toBe("Offline");
  expect(
    document.querySelector<HTMLInputElement>('[data-bulk-field="note"] input')
      ?.value
  ).toBe("Retain this draft");
  expect(bulkButton("Apply to 2 rows").disabled).toBe(false);
});
