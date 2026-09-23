import { test } from "bun:test";
import {
  dataDestinationQuery,
  groupDataDestinations,
  runDataDestination,
} from "../src/components/ui/yayaw-table/utils/data-destinations";
import { dataDestinationsSuite } from "./data-destinations-suite";

dataDestinationsSuite(test, {
  dataDestinationQuery,
  groupDataDestinations,
  runDataDestination,
});
