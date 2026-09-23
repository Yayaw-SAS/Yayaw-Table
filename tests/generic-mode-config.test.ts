import { test } from "bun:test";
import {
  GENERIC_MODE_CONFIG_KEYS,
  normalizeGenericModeConfigs,
  normalizeModeConfig,
  pickGenericModeConfigs,
} from "../src/components/ui/yayaw-table/utils/display-modes";
import { genericModeConfigSuite } from "./generic-mode-config-suite";

genericModeConfigSuite(test, {
  GENERIC_MODE_CONFIG_KEYS,
  normalizeGenericModeConfigs,
  normalizeModeConfig,
  pickGenericModeConfigs,
});
