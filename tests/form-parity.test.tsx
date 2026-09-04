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

it("retries only failed bulk targets and sends checked fields including false", async () => {
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
  const checkbox = [...document.querySelectorAll("label")]
    .find((label) => label.textContent?.includes("Apply Active"))
    ?.querySelector("input");
  expect(checkbox).toBeTruthy();
  await act(() => checkbox?.click());
  const save = () =>
    [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Save"
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
