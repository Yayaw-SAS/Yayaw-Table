import { it } from "vitest";
import { dataDestinationsSuite } from "../../../tests/data-destinations-suite";
import {
  dataDestinationQuery,
  groupDataDestinations,
  runDataDestination,
} from "./data-destinations";

dataDestinationsSuite(it, {
  dataDestinationQuery,
  groupDataDestinations,
  runDataDestination,
});
