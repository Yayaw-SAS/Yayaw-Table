import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FormBuilder } from "../src/components/ui/yayaw-table/components/forms/form-builder";
import { useFormBuilder } from "../src/components/ui/yayaw-table/components/forms/hooks/use-form-builder";
import type {
  AnyFieldDefinition,
  FieldValues,
  FormConfig,
  FormSelectOption,
} from "../src/components/ui/yayaw-table/components/forms/types";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";
import {
  type TagCatalogApi,
  TagCatalogProvider,
} from "../src/components/ui/yayaw-table/providers/tag-catalog-provider";

let root: Root;
let client: QueryClient;
let builder: ReturnType<typeof useFormBuilder<FieldValues>>;
const saved: FieldValues[] = [];
const settle = () => new Promise((resolve) => setTimeout(resolve, 25));
afterEach(async () => {
  await act(() => root?.unmount());
  client?.clear();
  document.body.replaceChildren();
  saved.length = 0;
});
function required<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error("Expected form control");
  }
  return value;
}
function Probe({ config }: { config: FormConfig }) {
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
async function setup(
  field: AnyFieldDefinition,
  value: unknown,
  tagCatalog?: TagCatalogApi
) {
  const container = document.createElement("div");
  document.body.append(container);
  client = new QueryClient();
  root = createRoot(container);
  await act(async () => {
    root.render(
      <TableProvider
        queryClient={client}
        tableId="records"
        translations={defaultTranslations}
      >
        <TagCatalogProvider value={tagCatalog}>
          <Probe
            config={{
              id: "records",
              defaultValues: { choice: value },
              fields: [field],
            }}
          />
        </TagCatalogProvider>
      </TableProvider>
    );
    await settle();
  });
}
async function open() {
  await act(async () => {
    required(
      document.querySelector<HTMLButtonElement>('button[role="combobox"]')
    ).click();
    await settle();
  });
}
async function fill(value: string) {
  await act(async () => {
    const input = required(
      document.querySelector<HTMLInputElement>('input[role="combobox"]')
    );
    required(
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    ).call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
}
async function pick(label: string) {
  await act(async () => {
    required(
      [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (node) => node.textContent === label
      )
    ).click();
    await settle();
  });
}
const fieldFor = (
  type: "select" | "multiSelect",
  overrides: Partial<AnyFieldDefinition> = {}
): AnyFieldDefinition =>
  ({
    name: "choice",
    label: "Media",
    type,
    searchMinLength: 2,
    searchDebounceMs: 0,
    searchOptions: () => [],
    ...overrides,
  }) as AnyFieldDefinition;

for (const type of ["select", "multiSelect"] as const) {
  it(`searches and saves a remote ${type} without a separate search control`, async () => {
    const calls: string[] = [];
    await setup(
      fieldFor(type, {
        resolveOptions: () => [{ value: 1, label: "Saved media" }],
        searchOptions: (query) => {
          calls.push(query);
          return [{ value: 42, label: "Server choice" }];
        },
      }),
      type === "select" ? 1 : [1],
      // A remote field takes precedence over the table's dedicated tag picker.
      {
        columnForField: () => ({
          columnId: "choice",
          field: "choice",
          multiple: type === "multiSelect",
        }),
      } as unknown as TagCatalogApi
    );
    expect(document.querySelector('input[type="search"]')).toBeNull();
    expect(document.querySelector('[role="checkbox"]')).toBeNull();
    expect(document.body.textContent).toContain("Saved media");
    await open();
    await fill("n");
    expect(calls).toEqual([]);
    await fill("news");
    expect(calls).toEqual(["news"]);
    await pick("Server choice");
    expect(document.body.textContent).toContain("Server choice");
    await act(() => builder.form.handleSubmit());
    expect(saved).toEqual([{ choice: type === "select" ? 42 : [1, 42] }]);
  });
}

it("keeps loading, empty and failed searches in the list and ignores stale answers", async () => {
  let finish: (options: FormSelectOption[]) => void = () => undefined;
  let firstSignal: AbortSignal | undefined;
  let failed = false;
  await setup(
    fieldFor("multiSelect", {
      searchOptions: (query, _context, signal) => {
        if (query === "first") {
          firstSignal = signal;
          return new Promise((resolve) => {
            finish = resolve;
          });
        }
        if (query === "error" && !failed) {
          failed = true;
          throw new Error("Search unavailable");
        }
        return [];
      },
    }),
    []
  );
  await open();
  await fill("first");
  expect(
    required(document.querySelector('[role="listbox"]')).textContent
  ).toContain("Loading");
  await fill("empty");
  expect(firstSignal?.aborted).toBe(true);
  await act(async () => {
    finish([{ value: 7, label: "Stale option" }]);
    await settle();
  });
  expect(document.body.textContent).not.toContain("Stale option");
  expect(
    required(document.querySelector('[role="listbox"]')).textContent
  ).toContain("No match");
  await fill("error");
  expect(
    required(document.querySelector('[role="listbox"] [role="alert"]'))
      .textContent
  ).toContain("Search unavailable");
  await act(async () => {
    required(
      document.querySelector<HTMLButtonElement>('[role="alert"] button')
    ).click();
    await settle();
  });
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

it("creates an option from the list, retains its label and saves its persisted value", async () => {
  const created: string[] = [];
  await setup(
    fieldFor("multiSelect", {
      resolveOptions: () => [{ value: 77, label: "Created media" }],
      createOption: (label) => {
        created.push(label);
        return { value: 77, label: "Created media" };
      },
    }),
    []
  );
  await open();
  await fill("New media");
  await pick('Create "New media"');
  expect(created).toEqual(["New media"]);
  expect(document.body.textContent).toContain("Created media");
  expect(
    [...document.querySelectorAll('[role="option"]')].filter(
      (node) => node.textContent === "Created media"
    )
  ).toHaveLength(1);
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([{ choice: [77] }]);
});

it("reloads scoped base options and cancels stale searches when a dependency changes", async () => {
  const loads: unknown[] = [];
  let signal: AbortSignal | undefined;
  let finish: (options: FormSelectOption[]) => void = () => undefined;
  await setup(
    fieldFor("select", {
      optionDependencies: ["country"],
      options: (context) => {
        loads.push(context.values?.country);
        return [
          {
            value: 1,
            label: context.values?.country === "FR" ? "French" : "Initial",
          },
        ];
      },
      searchOptions: (_query, _context, requestSignal) => {
        signal = requestSignal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    }),
    1
  );
  await open();
  await fill("pending");
  await act(async () => {
    builder.form.setFieldValue("country", "FR");
    await settle();
  });
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    finish([{ value: 2, label: "Stale media" }]);
    await settle();
  });
  expect(document.body.textContent).toContain("French");
  expect(document.body.textContent).not.toContain("Stale media");
  await act(async () => {
    builder.form.setFieldValue("unrelated", "changed");
    await settle();
  });
  expect(loads).toEqual([undefined, "FR"]);
});

it("keeps selection changes made while an option is being created", async () => {
  let finish: (option: FormSelectOption) => void = () => undefined;
  await setup(
    fieldFor("multiSelect", {
      options: [{ value: 1, label: "Existing media" }],
      createOption: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
    [1]
  );
  await open();
  await fill("New media");
  await pick('Create "New media"');
  await act(async () => {
    required(
      document.querySelector<HTMLButtonElement>(
        'button[aria-label="Remove Existing media"]'
      )
    ).click();
    await settle();
  });
  await act(async () => {
    finish({ value: 77, label: "Created media" });
    await settle();
  });
  await act(() => builder.form.handleSubmit());
  expect(saved).toEqual([{ choice: [77] }]);
});

it("refreshes remembered labels and disabled state from newer server responses", async () => {
  await setup(
    fieldFor("select", {
      searchOptions: (query) => [
        {
          value: 7,
          label: query === "first" ? "Earlier label" : "Current label",
          disabled: query !== "first",
        },
      ],
    }),
    null
  );
  await open();
  await fill("first");
  expect(document.querySelector('[role="option"]')?.textContent).toBe(
    "Earlier label"
  );
  await fill("second");
  const option = required(document.querySelector('[role="option"]'));
  expect(option.textContent).toBe("Current label");
  expect(option.getAttribute("aria-disabled")).toBe("true");
});
