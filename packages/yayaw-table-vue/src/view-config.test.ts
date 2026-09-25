import { it } from "vitest";
import { viewConfigSuite } from "../../../tests/view-config-suite";
import {
  copyJson,
  jsonPath,
  sanitizeViewConfig,
  VIEW_CONFIG_KEYS,
  VIEW_CONFIG_LIMITS,
  VIEW_FILTER_OPERATORS,
} from "./view-config";

viewConfigSuite(it, {
  copyJson,
  jsonPath,
  sanitizeViewConfig,
  VIEW_CONFIG_KEYS,
  VIEW_CONFIG_LIMITS,
  VIEW_FILTER_OPERATORS,
});
