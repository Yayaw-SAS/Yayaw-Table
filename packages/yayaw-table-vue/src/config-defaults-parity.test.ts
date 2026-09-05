import { expect, it } from "vitest";
import expectedDefaults from "../../../tests/fixtures/behavior-defaults.json";
import { defineTableConfig } from "./config";

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
