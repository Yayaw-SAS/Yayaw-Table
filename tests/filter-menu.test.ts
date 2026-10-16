import { test } from "bun:test";
import {
  isRelativeDateToken,
  relativeDateLabel,
  resolveRelativeDate,
} from "../src/components/ui/yayaw-table/utils/date-filter-days";
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
} from "../src/components/ui/yayaw-table/utils/filter-menu";
import { filterMenuSuite } from "./filter-menu-suite";

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
