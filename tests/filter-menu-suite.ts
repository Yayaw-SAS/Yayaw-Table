import assert from "node:assert/strict";
import type * as Days from "../src/components/ui/yayaw-table/utils/date-filter-days";
import type * as Menu from "../src/components/ui/yayaw-table/utils/filter-menu";

/** The shared helpers, from each edition's own copy. */
export interface FilterMenuApi
  extends Pick<
      typeof Days,
      "isRelativeDateToken" | "relativeDateLabel" | "resolveRelativeDate"
    >,
    Pick<
      typeof Menu,
      | "changeFilterOperator"
      | "dateRuleMode"
      | "defaultFilterOperator"
      | "filterChipsLayout"
      | "filterMenuOperators"
      | "filterMenuText"
      | "filterOperatorLabel"
      | "filterPeriodSentence"
      | "filterRuleComplete"
      | "filterRuleSummary"
      | "filterRulesCountText"
      | "rollingDateOf"
      | "rollingDateToken"
    > {}

const PARIS = "Europe/Paris";
/** A Wednesday, 12:00 in Paris. */
const NOW = "2026-10-14T10:00:00.000Z";

const rule = (
  columnId: string,
  operator: string,
  values?: unknown,
  type?: string
) => ({
  id: `${columnId}-${operator}`,
  columnId,
  operator,
  values,
  type,
  isActive: true,
});

export function filterMenuSuite(
  test: (name: string, run: () => void) => void,
  api: FilterMenuApi
) {
  const range = (token: string, weekStartsOn = 1) =>
    api.resolveRelativeDate(token, { now: NOW, timeZone: PARIS, weekStartsOn });

  test("resolves rolling periods in days, weeks, months and years", () => {
    assert.deepEqual(range("$last7Days"), {
      start: "2026-10-08",
      end: "2026-10-14",
    });
    assert.deepEqual(range("$next2Weeks"), {
      start: "2026-10-14",
      end: "2026-10-27",
    });
    assert.deepEqual(range("$last3Months"), {
      start: "2026-07-15",
      end: "2026-10-14",
    });
    assert.deepEqual(range("$last1Years"), {
      start: "2025-10-15",
      end: "2026-10-14",
    });
    assert.deepEqual(range("$next1Years"), {
      start: "2026-10-14",
      end: "2027-10-13",
    });
    for (const token of [
      "$last0Days",
      "$last11Years",
      "$next523Weeks",
      "$last2Fortnights",
    ]) {
      assert.equal(api.isRelativeDateToken(token), false, token);
    }
  });

  test("names rolling periods in English and French", () => {
    assert.equal(api.relativeDateLabel("$last3Months", "en"), "Last 3 months");
    assert.equal(
      api.relativeDateLabel("$next2Weeks", "fr"),
      "2 prochaines semaines"
    );
    assert.equal(
      api.relativeDateLabel("$last30Days", "fr"),
      "30 derniers jours"
    );
  });

  test("splits a rolling token into its parts and back", () => {
    assert.deepEqual(api.rollingDateOf("$next6Months"), {
      direction: "next",
      count: 6,
      unit: "Months",
    });
    assert.equal(api.rollingDateOf("$thisWeek"), undefined);
    assert.equal(
      api.rollingDateToken({ direction: "last", count: 12.7, unit: "Weeks" }),
      "$last12Weeks"
    );
    assert.equal(
      api.rollingDateToken({ direction: "last", count: 99, unit: "Years" }),
      undefined
    );
  });

  test("offers operators by type, with the first as the default", () => {
    assert.equal(api.defaultFilterOperator("text"), "contains");
    assert.equal(api.defaultFilterOperator("select"), "isAnyOf");
    assert.equal(api.defaultFilterOperator("date"), "equals");
    assert.ok(!api.filterMenuOperators("number").includes("contains"));
    assert.ok(api.filterMenuOperators("date").includes("before"));
    assert.equal(api.filterOperatorLabel("number", "greaterThanOrEqual"), "≥");
    assert.equal(api.filterOperatorLabel("date", "before", "fr"), "Est avant");
    assert.equal(
      api.filterOperatorLabel("date", "before", "en", (key) =>
        key === "filters.menu.operators.date.before"
          ? "Earlier than"
          : undefined
      ),
      "Earlier than"
    );
  });

  test("filters only with a usable value", () => {
    assert.equal(
      api.filterRuleComplete(rule("name", "contains", "", "text")),
      false
    );
    assert.equal(
      api.filterRuleComplete(rule("name", "isEmpty", undefined, "text")),
      true
    );
    assert.equal(
      api.filterRuleComplete(rule("amount", "equals", 0, "number")),
      true
    );
    assert.equal(
      api.filterRuleComplete(rule("amount", "equals", Number.NaN, "number")),
      false
    );
    assert.equal(
      api.filterRuleComplete(rule("amount", "between", [1], "number")),
      false
    );
    assert.equal(
      api.filterRuleComplete(rule("due", "equals", "$thisWeek", "date")),
      true
    );
    assert.equal(
      api.filterRuleComplete(rule("tags", "isAnyOf", [], "select")),
      false
    );
  });

  test("keeps what still fits when the operator changes", () => {
    const token = rule("due", "equals", "$lastMonth", "date");
    assert.equal(
      api.changeFilterOperator(token, "before", "date").values,
      "$lastMonth"
    );
    assert.deepEqual(
      api.changeFilterOperator(
        rule("amount", "equals", 5, "number"),
        "between",
        "number"
      ).values,
      [5, 5]
    );
    assert.equal(
      api.changeFilterOperator(
        rule("name", "contains", "acme", "text"),
        "isEmpty",
        "text"
      ).values,
      undefined
    );
    assert.equal(api.dateRuleMode(token), "relative");
    assert.equal(
      api.dateRuleMode(rule("due", "between", ["2026-10-01", "2026-10-02"])),
      "range"
    );
    assert.equal(
      api.dateRuleMode(rule("due", "before", "2026-10-01")),
      "exact"
    );
  });

  test("summarizes a rule as its chip reads", () => {
    const status = {
      id: "status",
      header: "Status",
      type: "select" as const,
      options: [
        { value: "won", label: "Won" },
        { value: "open", label: "Open" },
        { value: "lost", label: "Lost" },
      ],
    };
    assert.deepEqual(
      api.filterRuleSummary(
        rule("status", "isAnyOf", ["won", "open", "lost"]),
        status
      ),
      { property: "Status:", value: "Won, Open +1", complete: true }
    );
    assert.deepEqual(
      api.filterRuleSummary(rule("status", "isAnyOf", []), status),
      { property: "Status", value: "", complete: false }
    );
    const amount = { id: "amount", header: "Amount", type: "number" as const };
    assert.equal(
      api.filterRuleSummary(
        rule("amount", "greaterThanOrEqual", 5000),
        amount,
        "en"
      ).value,
      "≥ 5,000"
    );
    const due = { id: "due", header: "Due", type: "date" as const };
    assert.deepEqual(
      api.filterRuleSummary(rule("due", "equals", "$thisWeek"), due, "fr"),
      { property: "Due:", value: "Cette semaine", complete: true }
    );
    assert.equal(
      api.filterRuleSummary(rule("due", "before", "2026-10-01"), due, "en")
        .value,
      "is before Oct 1, 2026"
    );
  });

  test("lays out chips, the advanced filter and pinned periods", () => {
    const rules = [
      rule("status", "isAnyOf", ["won"]),
      { ...rule("due", "equals", "$thisMonth"), id: "filter-bar-due" },
    ];
    assert.deepEqual(
      api
        .filterChipsLayout(rules, "and", { pinnedColumns: ["due"] })
        .chips.map((item) => item.columnId),
      ["status"]
    );
    assert.equal(
      api.filterChipsLayout(rules, "and", {
        advanced: true,
        pinnedColumns: ["due"],
      }).advanced.length,
      1
    );
    assert.equal(api.filterChipsLayout(rules, "or").advanced.length, 2);
    assert.equal(api.filterRulesCountText(1, "en"), "1 rule");
    assert.equal(api.filterRulesCountText(3, "fr"), "3 règles");
  });

  test("says which days a period covers", () => {
    assert.equal(
      api.filterPeriodSentence("$thisMonth", "en", undefined, {
        now: NOW,
        timeZone: PARIS,
      }),
      "From Oct 1, 2026 to Oct 31, 2026"
    );
    assert.equal(
      api.filterPeriodSentence(undefined, "en"),
      api.filterMenuText("noPeriod", "en")
    );
  });
}
