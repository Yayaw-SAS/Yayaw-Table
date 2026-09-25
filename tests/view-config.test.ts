import { test } from "bun:test";
import {
  canonicalViewConfig,
  copyJson,
  jsonPath,
  sanitizeViewConfig,
  VIEW_CONFIG_KEYS,
  VIEW_CONFIG_LIMITS,
  VIEW_FILTER_OPERATORS,
} from "../src/components/ui/yayaw-table/utils/view-config";
import { viewConfigSuite } from "./view-config-suite";

viewConfigSuite(test, {
  canonicalViewConfig,
  copyJson,
  jsonPath,
  sanitizeViewConfig,
  VIEW_CONFIG_KEYS,
  VIEW_CONFIG_LIMITS,
  VIEW_FILTER_OPERATORS,
});
