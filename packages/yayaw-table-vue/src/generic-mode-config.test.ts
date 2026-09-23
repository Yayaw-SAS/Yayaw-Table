import { it } from "vitest";
import { genericModeConfigSuite } from "../../../tests/generic-mode-config-suite";
import {
  GENERIC_MODE_CONFIG_KEYS,
  normalizeGenericModeConfigs,
  normalizeModeConfig,
  pickGenericModeConfigs,
} from "./display-modes";

genericModeConfigSuite(it, {
  GENERIC_MODE_CONFIG_KEYS,
  normalizeGenericModeConfigs,
  normalizeModeConfig,
  pickGenericModeConfigs,
});
