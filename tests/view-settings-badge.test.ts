import { test } from "bun:test";
import { viewSettingsBadgeCount } from "../src/components/ui/yayaw-table/utils/table-contracts";
import { viewSettingsBadgeSuite } from "./view-settings-badge-suite";

viewSettingsBadgeSuite(test, viewSettingsBadgeCount);
