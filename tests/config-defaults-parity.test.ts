import { expect, it } from "bun:test";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { resolveTableCatalogueConfig } from "../src/components/ui/yayaw-table/hooks/use-table-config";
import expectedDefaults from "./fixtures/behavior-defaults.json";

it("uses the shared React and Vue behavior defaults", () => {
  const config = defineTableConfig({
    id: "defaults-parity",
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      mandatory: [],
      order: ["name"],
      visible: ["name"],
    },
    translations: { keys: {}, namespace: "defaults-parity" },
  });

  expect(config.table).toMatchObject(expectedDefaults);
});

it("retains catalogue-owned React toolbar actions", () => {
  const action = { id: "sync", label: "Sync", onClick: () => undefined };
  const config = defineTableConfig({
    id: "toolbar-parity",
    columns: {
      definitions: [{ id: "name", header: "Name", type: "text" }],
      mandatory: [],
      order: ["name"],
      visible: ["name"],
    },
    toolbarActions: [action],
    toolbarActionsPlacement: "after-export",
    translations: { keys: {}, namespace: "toolbar-parity" },
  });

  expect(config.toolbarActions).toEqual([action]);
  expect(resolveTableCatalogueConfig(config)).toMatchObject({
    toolbarActions: [action],
    toolbarActionsPlacement: "after-export",
  });
});
