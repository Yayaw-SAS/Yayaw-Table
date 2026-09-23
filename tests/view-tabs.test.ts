import { test } from "bun:test";
import {
  resolveViewTabs,
  splitViewTabs,
} from "../src/components/ui/yayaw-table/utils/view-tabs";
import { viewTabsSuite } from "./view-tabs-suite";

viewTabsSuite(test, { resolveViewTabs, splitViewTabs });
