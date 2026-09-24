import "./setup-dom";
import { afterEach, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BooleanCell } from "../src/components/ui/yayaw-table/components/cells/boolean-cell";
import {
  defaultTranslations,
  TableProvider,
} from "../src/components/ui/yayaw-table/providers/table-provider";

const roots: Root[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(() => root.unmount());
  }
  document.body.replaceChildren();
});

it("renders booleans as a checkbox-style mark, never an error badge", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(() =>
    root.render(
      <TableProvider
        queryClient={new QueryClient()}
        tableId="booleans"
        translations={defaultTranslations}
      >
        <BooleanCell value />
        <BooleanCell value={false} />
      </TableProvider>
    )
  );
  const [checked, unchecked] = [
    ...container.querySelectorAll<HTMLElement>(".yayaw-boolean"),
  ];
  // Same markup as the Vue cell: role, label, data-value and a check only when true.
  expect(checked?.getAttribute("role")).toBe("img");
  expect(checked?.getAttribute("aria-label")).toBe("True");
  expect(checked?.dataset.value).toBe("true");
  expect(checked?.querySelector("svg")).not.toBeNull();
  expect(unchecked?.getAttribute("aria-label")).toBe("False");
  expect(unchecked?.dataset.value).toBe("false");
  expect(unchecked?.querySelector("svg")).toBeNull();
  expect(unchecked?.textContent).toBe("");
  expect(container.innerHTML).not.toContain("destructive");
});
