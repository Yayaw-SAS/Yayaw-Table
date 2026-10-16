import { it as test } from "vitest";
import {
  isRelativeDateToken,
  relativeDateLabel,
  resolveRelativeDate,
} from "./date-filter-days";
import {
  changeFilterOperator,
  dateRuleMode,
  defaultFilterOperator,
  filterChipsLayout,
  filterMenuOperators,
  filterMenuText,
  filterOperatorLabel,
  filterPeriodSentence,
  filterRuleComplete,
  filterRuleSummary,
  filterRulesCountText,
  rollingDateOf,
  rollingDateToken,
} from "./filter-menu";
import { filterMenuSuite } from "../../../tests/filter-menu-suite";

filterMenuSuite(test, {
  changeFilterOperator,
  dateRuleMode,
  defaultFilterOperator,
  filterChipsLayout,
  filterMenuOperators,
  filterMenuText,
  filterOperatorLabel,
  filterPeriodSentence,
  filterRuleComplete,
  filterRuleSummary,
  filterRulesCountText,
  isRelativeDateToken,
  relativeDateLabel,
  resolveRelativeDate,
  rollingDateOf,
  rollingDateToken,
});
