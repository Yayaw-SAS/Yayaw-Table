import assert from "node:assert/strict";
import type * as Modes from "../src/components/ui/yayaw-table/utils/display-modes";

export function genericModeConfigSuite(
  test: (name: string, run: () => void) => void,
  modes: Pick<
    typeof Modes,
    | "GENERIC_MODE_CONFIG_KEYS"
    | "normalizeGenericModeConfigs"
    | "normalizeModeConfig"
    | "pickGenericModeConfigs"
  >
) {
  test("lists the modes whose settings the registry handles generically", () => {
    assert.ok(modes.GENERIC_MODE_CONFIG_KEYS.includes("list"));
    assert.ok(!(modes.GENERIC_MODE_CONFIG_KEYS as string[]).includes("kanban"));
  });

  test("normalizes each generic mode with its own normalizer", () => {
    assert.deepEqual(
      modes.normalizeGenericModeConfigs({
        list: { maxProperties: "2", unknown: true },
        kanban: { titleColumn: "name" },
      }),
      { list: { maxProperties: 2 } }
    );
    assert.equal(modes.normalizeModeConfig("list", { wrap: "yes" }), undefined);
  });

  test("picks generic settings from a table config for passing them along", () => {
    assert.deepEqual(
      modes.pickGenericModeConfigs({ list: { wrap: true }, gallery: {} }),
      { list: { wrap: true } }
    );
    assert.deepEqual(modes.pickGenericModeConfigs({}), {});
  });
}
