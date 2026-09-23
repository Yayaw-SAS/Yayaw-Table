import { it } from "vitest";
import { viewTabsSuite } from "../../../tests/view-tabs-suite";
import { resolveViewTabs, splitViewTabs } from "./view-tabs";

viewTabsSuite(it, { resolveViewTabs, splitViewTabs });
