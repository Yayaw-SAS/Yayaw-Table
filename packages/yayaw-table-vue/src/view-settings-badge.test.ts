import { it } from "vitest";
import { viewSettingsBadgeSuite } from "../../../tests/view-settings-badge-suite";
import { viewSettingsBadgeCount } from "./table-contracts";

viewSettingsBadgeSuite(it, viewSettingsBadgeCount);
