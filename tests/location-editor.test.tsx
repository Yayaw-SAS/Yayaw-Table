import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act, type ComponentProps, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InlineEditableCell } from "../src/components/ui/yayaw-table/components/cells/inline-editable-cell";
import { FormBuilder } from "../src/components/ui/yayaw-table/components/forms/form-builder";
import { useFormBuilder } from "../src/components/ui/yayaw-table/components/forms/hooks/use-form-builder";
import type {
  FieldValues,
  FormConfig,
} from "../src/components/ui/yayaw-table/components/forms/types";
import { LocationEditor } from "../src/components/ui/yayaw-table/components/location/location-editor";
import { YayawTableForm } from "../src/components/ui/yayaw-table/form/yayaw-table-form";
import { resolveInlineEditColumnConfig } from "../src/components/ui/yayaw-table/hooks/use-inline-edit-runtime";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import type { FormDraft } from "../src/components/ui/yayaw-table/utils/form-view";

Object.defineProperty(globalThis, "CSS", {
  configurable: true,
  value: window.CSS,
});

const PARIS = { lat: 48.8566, lng: 2.3522 };
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
function required<T>(value: T | undefined | null): T {
  if (value == null) {
    throw new Error("Expected a location editor control");
  }
  return value;
}
async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() => root.render(node));
  return {
    container,
    render: async (next: ReactNode) => await act(() => root.render(next)),
  };
}
function provider(children: ReactNode) {
  const client = new QueryClient();
  clients.push(client);
  return (
    <TableProvider
      queryClient={client}
      tableId="locations"
      translations={defaultTranslations}
    >
      {children}
    </TableProvider>
  );
}
function input(suffix: string) {
  return required(
    document.querySelector<HTMLInputElement>(
      `[data-location-editor] input[id$="-${suffix}"]`
    )
  );
}
async function fill(suffix: string, value: string) {
  await act(() => {
    required(
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    ).call(input(suffix), value);
    input(suffix).dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function button(label: string) {
  await act(async () => {
    required(
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent === label
      )
    ).click();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function key(suffix: string, value: string) {
  await act(() =>
    input(suffix).dispatchEvent(
      new KeyboardEvent("keydown", { key: value, bubbles: true })
    )
  );
}

it.each([
  null,
  PARIS,
])("blocks invalid and partial record drafts without saving the previous value (initial %j)", async (initial) => {
  const saved: FieldValues[] = [];
  const config: FormConfig = {
    id: "places",
    defaultValues: { place: initial },
    fields: [{ name: "place", label: "Place", type: "location" }],
  };
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  function RecordForm() {
    builder = useFormBuilder({
      config,
      formOptions: {
        onSubmit: (values) => {
          saved.push(values);
        },
      },
    });
    return <FormBuilder fields={builder.fields} form={builder.form} />;
  }
  await mount(provider(<RecordForm />));
  await fill("lat", "91");
  await act(() => builder.form.handleSubmit());
  expect(saved).toHaveLength(0);
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(input("lat").value).toBe("91");
  await fill("lat", "45");
  await fill("lng", "");
  await act(() => builder.form.handleSubmit());
  expect(saved).toHaveLength(0);
  await fill("lng", "4");
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([{ place: { lat: 45, lng: 4 } }]);
});

it.each([
  false,
  true,
])("clears a record location while respecting required=%s", async (isRequired) => {
  const saved: FieldValues[] = [];
  const config: FormConfig = {
    id: "places",
    defaultValues: { place: PARIS },
    fields: [
      { name: "place", label: "Place", type: "location", required: isRequired },
    ],
  };
  let builder!: ReturnType<typeof useFormBuilder<FieldValues>>;
  function RecordForm() {
    builder = useFormBuilder({
      config,
      formOptions: {
        onSubmit: (values) => {
          saved.push(values);
        },
      },
    });
    return <FormBuilder fields={builder.fields} form={builder.form} />;
  }
  await mount(provider(<RecordForm />));
  await button("Clear");
  expect(input("lat").value).toBe("");
  expect(input("lng").value).toBe("");
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual(isRequired ? [] : [{ place: null }]);
  if (isRequired) {
    expect(document.body.textContent).toContain("Place is required");
  }
});

it("blocks public form submission of invalid JSON drafts and accepts correction", async () => {
  const saved: FieldValues[] = [];
  await mount(
    <YayawTableForm
      columns={[{ id: "place", header: "Place", type: "location" }]}
      form={{ questions: [{ id: "place", columnId: "place" }] }}
      onSubmit={(values) => {
        saved.push(values);
        return { ok: true };
      }}
    />
  );
  await fill("lat", "48");
  const submit = async () =>
    await act(async () => {
      required(document.querySelector("form")).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  await submit();
  expect(saved).toHaveLength(0);
  await fill("lng", "2");
  await fill("lat", "91");
  await submit();
  expect(saved).toHaveLength(0);
  await fill("lat", "45");
  await submit();
  expect(saved).toEqual([{ place: { lat: 45, lng: 2 } }]);
});

it("blocks invalid inline Done, Enter and blur until the visible draft is corrected", async () => {
  const saved: unknown[] = [];
  const row = { id: "1", place: PARIS };
  const cell = {
    getValue: () => row.place,
    row: { original: row },
    column: { id: "place", columnDef: { header: "Place" } },
  } as unknown as ComponentProps<typeof InlineEditableCell>["cell"];
  const view = await mount(
    provider(
      <>
        <InlineEditableCell
          cell={cell}
          displayValue="Paris"
          inlineConfig={resolveInlineEditColumnConfig(
            { id: "place", type: "location", inlineEdit: { enabled: true } },
            { enabled: true, debounceMs: 0 }
          )}
          onCommit={(value) => {
            saved.push(value);
            return Promise.resolve({ success: true });
          }}
          rowData={row}
        />
        <button data-outside="" type="button">
          Outside
        </button>
      </>
    )
  );
  await act(() =>
    required(view.container.querySelector("button")).dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true })
    )
  );
  await fill("lat", "91");
  await button("Done");
  await key("lat", "Enter");
  await act(() => {
    input("lat").focus();
    required(
      document.querySelector<HTMLButtonElement>("[data-outside]")
    ).focus();
  });
  expect(saved).toHaveLength(0);
  expect(input("lat").value).toBe("91");
  await fill("lat", "45");
  await key("lat", "Enter");
  expect(saved).toEqual([{ lat: 45, lng: PARIS.lng }]);
  expect(document.querySelector("[data-location-editor]")).toBeNull();
});

it("normalizes pasted coordinates and preserves typing echoes while applying external resets", async () => {
  let reset!: (value: unknown) => void;
  function Controlled() {
    const [value, setValue] = useState<unknown>(PARIS);
    reset = setValue;
    return (
      <LocationEditor
        onChange={setValue}
        onInvalidDraft={setValue}
        value={value}
      />
    );
  }
  await mount(<Controlled />);
  await fill("address", "40, 3");
  expect(input("address").value).toBe("40, 3");
  expect(input("lat").value).toBe("40");
  expect(input("lng").value).toBe("3");
  await fill("lat", "91");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  await fill("lat", "2.");
  expect(input("lat").value).toBe("2.");
  await act(() => reset(PARIS));
  expect(input("lat").value).toBe(String(PARIS.lat));
  await act(() => reset({ lat: 1, lng: 2 }));
  await act(() => reset(PARIS));
  expect(input("lat").value).toBe(String(PARIS.lat));
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

it("does not let a stored coordinate address mask invalid or cleared inputs", async () => {
  const changes: unknown[] = [];
  await mount(
    <LocationEditor
      onChange={(value) => changes.push(value)}
      onInvalidDraft={(value) => changes.push(value)}
      value={{ ...PARIS, address: "48.8566, 2.3522" }}
    />
  );
  expect(input("address").value).toBe("");
  await fill("lat", "91");
  expect(changes.at(-1)).toEqual({
    label: "",
    address: "",
    lat: "91",
    lng: "2.3522",
  });
  await fill("lat", "");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(changes.at(-1)).toEqual({
    label: "",
    address: "",
    lat: "",
    lng: "2.3522",
  });
});

it("restores an invalid public draft and blocks Next until it is corrected", async () => {
  function ControlledForm() {
    const [value, setValue] = useState<FormDraft>({
      place: JSON.stringify({ label: "", address: "", lat: "91", lng: "2" }),
    });
    return (
      <YayawTableForm
        columns={[
          { id: "place", header: "Place", type: "location" },
          { id: "name", header: "Name", type: "text" },
        ]}
        form={{
          layout: "steps",
          questions: [
            { id: "place", columnId: "place" },
            { id: "name", columnId: "name" },
          ],
        }}
        onSubmit={() => ({ ok: true })}
        onValueChange={setValue}
        value={value}
      />
    );
  }
  await mount(<ControlledForm />);
  expect(input("lat").value).toBe("91");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  await button("Next");
  expect(input("lat").value).toBe("91");
  await fill("lat", "45");
  await button("Next");
  await button("Back");
  expect(input("lat").value).toBe("45");
});

it("updates validation when the controlled value is reset to an invalid draft", async () => {
  const render = (value: unknown) => (
    <LocationEditor onChange={() => undefined} value={value} />
  );
  const view = await mount(render(PARIS));
  await view.render(render({ label: "", address: "", lat: "91", lng: "2" }));
  expect(input("lat").value).toBe("91");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  await view.render(render(PARIS));
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

it("keeps an unhandled invalid draft when its parent repeats the unchanged value", async () => {
  const render = () => (
    <LocationEditor onChange={() => undefined} value={{ ...PARIS }} />
  );
  const view = await mount(render());
  await fill("lat", "91");
  await view.render(render());
  expect(input("lat").value).toBe("91");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});

it("keeps each typed coordinate character until blur and submits the complete pair", async () => {
  const changes: unknown[] = [];
  function Controlled() {
    const [value, setValue] = useState<unknown>(null);
    return (
      <LocationEditor
        onChange={(next) => {
          changes.push(next);
          setValue(next);
        }}
        onInvalidDraft={setValue}
        value={value}
      />
    );
  }
  await mount(<Controlled />);
  for (const character of "48.8566, 2.3522") {
    await fill("address", input("address").value + character);
  }
  expect(input("address").value).toBe("48.8566, 2.3522");
  expect(input("lat").value).toBe("48.8566");
  expect(input("lng").value).toBe("2.3522");
  expect(changes.at(-1)).toEqual(PARIS);
  await act(() => {
    input("address").focus();
    input("lat").focus();
  });
  expect(input("address").value).toBe("");
  expect(changes.at(-1)).toEqual(PARIS);
  await fill("lat", "91");
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(changes.at(-1)).toEqual(PARIS);
});

it("preserves postal addresses when coordinates are edited", async () => {
  const changes: unknown[] = [];
  await mount(
    <LocationEditor
      onChange={(value) => changes.push(value)}
      value={{ ...PARIS, address: "10 Main Street" }}
    />
  );
  await fill("lat", "49");
  expect(input("address").value).toBe("10 Main Street");
  expect(changes.at(-1)).toEqual({
    lat: 49,
    lng: PARIS.lng,
    address: "10 Main Street",
  });
});
