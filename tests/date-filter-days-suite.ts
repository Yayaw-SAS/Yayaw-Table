import assert from "node:assert/strict";
import type * as Calendar from "../src/components/ui/yayaw-table/utils/calendar-model";
import type * as Chart from "../src/components/ui/yayaw-table/utils/chart-model";
import type * as Days from "../src/components/ui/yayaw-table/utils/date-filter-days";
import type * as Contracts from "../src/components/ui/yayaw-table/utils/table-contracts";
import type * as ViewMenu from "../src/components/ui/yayaw-table/utils/view-menu";
import type * as Dashboard from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

type Rule = Record<string, unknown>;

/** The shared helpers, from each edition's own copy. */
export interface DateFilterDaysApi
  extends Pick<
    typeof Days,
    | "addCalendarDays"
    | "calendarDay"
    | "dateFilterDays"
    | "isCalendarDay"
    | "normalizeDateFilterRule"
    | "normalizeDateFilterRules"
    | "todayCalendarDay"
  > {
  matchesContractFilter: typeof Contracts.matchesContractFilter;
  chartBucketRange: typeof Chart.chartBucketRange;
  calendarScope: typeof Calendar.calendarScope;
  areViewSettingsEqual: typeof ViewMenu.areViewSettingsEqual;
  dashboardViewParams: typeof Dashboard.dashboardViewParams;
}

/** How an edition reads rules: from its URL value and from a saved view. */
export interface DateFilterEdition {
  /** The rules the edition holds after reading its `<tableId>-advancedFilters` value. */
  readUrlRules: (value: string) => Rule[];
  /** The rules the edition holds after applying a saved view's settings. */
  applyViewRules: (config: Record<string, unknown>) => Rule[];
}

const PARIS = "Europe/Paris";
const NEW_YORK = "America/New_York";

/** A rule on the `due` date column, as the filter menus write it. */
const dueRule = (operator: string, values: unknown): Rule => ({
  id: `due-${operator}`,
  columnId: "due",
  type: "date",
  operator,
  values,
  isActive: true,
});

/** What older versions wrote for a day: the instant of the viewer's local midnight. */
const localMidnight = (day: string): string => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1).toISOString();
};

const valuesOf = (rules: Rule[]) => rules.map((rule) => rule.values);

export function dateFilterDaysSuite(
  test: (name: string, run: () => void) => void,
  days: DateFilterDaysApi,
  edition: DateFilterEdition
) {
  test("reads days, wall-clock times and instants as calendar days", () => {
    assert.equal(days.calendarDay("2026-09-25"), "2026-09-25");
    assert.equal(days.calendarDay("2026-09-25", NEW_YORK), "2026-09-25");
    assert.equal(days.calendarDay("2026-09-25T23:30"), "2026-09-25");
    assert.equal(days.calendarDay("2026-09-25 08:00:00"), "2026-09-25");
    assert.equal(days.calendarDay(new Date(2026, 8, 25, 23, 59)), "2026-09-25");
    assert.equal(days.calendarDay(new Date(2026, 8, 25)), "2026-09-25");
    for (const invalid of ["2026-02-30", "2026-13-01", "", "soon", null, {}]) {
      assert.equal(days.calendarDay(invalid), undefined, String(invalid));
    }
    assert.equal(days.isCalendarDay("2024-02-29"), true);
    assert.equal(days.isCalendarDay("2023-02-29"), false);
    assert.equal(days.isCalendarDay("2026-09-25T00:00:00.000Z"), false);
    assert.equal(days.addCalendarDays("2026-03-01", -1), "2026-02-28");
    assert.equal(days.addCalendarDays("2026-12-31", 1), "2027-01-01");
    assert.equal(
      days.todayCalendarDay(PARIS, new Date("2026-09-24T22:30:00.000Z")),
      "2026-09-25"
    );
    assert.equal(
      days.todayCalendarDay(NEW_YORK, new Date("2026-09-24T22:30:00.000Z")),
      "2026-09-24"
    );
  });

  test("reads an instant as its day in the viewer's time zone", () => {
    // 25 September at midnight in Paris (UTC+2) and in New York (UTC-4).
    assert.equal(
      days.calendarDay("2026-09-24T22:00:00.000Z", PARIS),
      "2026-09-25"
    );
    assert.equal(
      days.calendarDay("2026-09-24T22:00:00.000Z", NEW_YORK),
      "2026-09-24"
    );
    assert.equal(
      days.calendarDay("2026-09-25T04:00:00.000Z", NEW_YORK),
      "2026-09-25"
    );
    assert.equal(
      days.calendarDay("2026-09-25T00:00:00+02:00", PARIS),
      "2026-09-25"
    );
    assert.equal(
      days.calendarDay(Date.UTC(2026, 8, 24, 22), PARIS),
      "2026-09-25"
    );
    // Across the daylight saving changes of both zones.
    assert.equal(
      days.calendarDay("2026-03-28T23:00:00.000Z", PARIS),
      "2026-03-29"
    );
    assert.equal(
      days.calendarDay("2026-10-24T22:00:00.000Z", PARIS),
      "2026-10-25"
    );
    assert.equal(
      days.calendarDay("2026-03-08T05:00:00.000Z", NEW_YORK),
      "2026-03-08"
    );
    assert.equal(
      days.calendarDay("2026-11-01T04:00:00.000Z", NEW_YORK),
      "2026-11-01"
    );
  });

  test("normalizes older instants to the days a Paris or New York viewer picked", () => {
    const paris = [
      dueRule("between", [
        "2026-09-04T22:00:00.000Z",
        "2026-09-11T22:00:00.000Z",
      ]),
      dueRule("equals", "2026-09-24T22:00:00.000Z"),
      dueRule("before", ["2026-09-30T22:00:00.000Z"]),
      // The older "Today" shortcut kept the time of the click.
      dueRule("after", "2026-09-25T12:34:56.789Z"),
    ];
    assert.deepEqual(
      valuesOf(days.normalizeDateFilterRules(paris, { timeZone: PARIS })),
      [["2026-09-05", "2026-09-12"], "2026-09-25", ["2026-10-01"], "2026-09-25"]
    );
    const newYork = [
      dueRule("between", [
        "2026-09-05T04:00:00.000Z",
        "2026-09-12T04:00:00.000Z",
      ]),
      dueRule("equals", "2026-09-25T04:00:00.000Z"),
      dueRule("before", ["2026-10-01T04:00:00.000Z"]),
      dueRule("after", "2026-09-25T12:34:56.789Z"),
    ];
    assert.deepEqual(
      valuesOf(days.normalizeDateFilterRules(newYork, { timeZone: NEW_YORK })),
      [["2026-09-05", "2026-09-12"], "2026-09-25", ["2026-10-01"], "2026-09-25"]
    );
  });

  test("keeps rules that already name days, other rules and other operators", () => {
    const rules = [
      dueRule("between", ["2026-09-05", "2026-09-12"]),
      dueRule("equals", "2026-09-25"),
      dueRule("isEmpty", []),
      { ...dueRule("isNotEmpty", undefined) },
      {
        id: "price",
        columnId: "price",
        type: "number",
        operator: "between",
        values: [1_725_000_000_000, 1_726_000_000_000],
      },
      {
        id: "name",
        columnId: "name",
        type: "text",
        operator: "equals",
        values: "2026-09-24T22:00:00.000Z",
      },
    ];
    // The same list: nothing changed, so memoized queries stay put.
    assert.equal(
      days.normalizeDateFilterRules(rules, { timeZone: PARIS }),
      rules
    );
    const envelope = { filters: rules, joinOperator: "or" as const };
    assert.equal(days.normalizeDateFilterRules(envelope), envelope);
    assert.equal(days.normalizeDateFilterRules(undefined), undefined);
    // A value that is not a date stays for validation to report.
    assert.deepEqual(days.dateFilterDays("equals", "soon"), "soon");
    assert.deepEqual(
      days.dateFilterDays("isEmpty", ["2026-09-24T22:00:00.000Z"]),
      ["2026-09-24T22:00:00.000Z"]
    );
  });

  test("keeps each rule's shape and orders between days", () => {
    const single = ["2026-09-24T22:00:00.000Z"];
    assert.deepEqual(days.dateFilterDays("equals", single, PARIS), [
      "2026-09-25",
    ]);
    // Dashboards send open ranges as one-day lists; days pass as they are.
    const from = ["2026-09-05"];
    assert.equal(days.dateFilterDays("greaterThanOrEqual", from), from);
    assert.deepEqual(
      days.dateFilterDays("between", ["2026-09-12", "2026-09-05"]),
      ["2026-09-05", "2026-09-12"]
    );
    assert.equal(days.dateFilterDays("between", "2026-09-05"), "2026-09-05");
    const envelope = days.normalizeDateFilterRules(
      {
        filters: [
          {
            id: "untyped",
            columnId: "due",
            operator: "between",
            values: [localMidnight("2026-09-12"), localMidnight("2026-09-05")],
          },
        ],
        joinOperator: "or",
      },
      { isDateColumn: (columnId) => columnId === "due" }
    );
    assert.deepEqual(envelope, {
      filters: [
        {
          id: "untyped",
          columnId: "due",
          operator: "between",
          values: ["2026-09-05", "2026-09-12"],
        },
      ],
      joinOperator: "or",
    });
  });

  test("between includes its first and last days, in either order", () => {
    const records = [
      "2026-09-04",
      "2026-09-05",
      "2026-09-12",
      "2026-09-13",
      new Date(2026, 8, 5, 0, 0),
      new Date(2026, 8, 12, 23, 59, 59),
      new Date(2026, 8, 13, 0, 0),
      localMidnight("2026-09-12"),
      null,
    ];
    const matching = (rule: Rule) =>
      records.map((value) => days.matchesContractFilter(value, rule));
    const expected = [false, true, true, false, true, true, false, true, false];
    assert.deepEqual(
      matching(dueRule("between", ["2026-09-05", "2026-09-12"])),
      expected
    );
    assert.deepEqual(
      matching(dueRule("between", ["2026-09-12", "2026-09-05"])),
      expected
    );
    // Older rules: instants at the viewer's midnights filter the same days.
    assert.deepEqual(
      matching(
        dueRule("between", [
          localMidnight("2026-09-05"),
          localMidnight("2026-09-12"),
        ])
      ),
      expected
    );
    assert.deepEqual(matching(dueRule("between", ["2026-09-05"])), [
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  test("compares whole days with each day operator", () => {
    const records = [
      "2026-09-04",
      "2026-09-05",
      new Date(2026, 8, 5, 18),
      "2026-09-06",
    ];
    const matching = (operator: string, values: unknown) =>
      records.map((value) =>
        days.matchesContractFilter(value, dueRule(operator, values))
      );
    assert.deepEqual(matching("equals", "2026-09-05"), [
      false,
      true,
      true,
      false,
    ]);
    assert.deepEqual(matching("notEquals", ["2026-09-05"]), [
      true,
      false,
      false,
      true,
    ]);
    assert.deepEqual(matching("before", "2026-09-05"), [
      true,
      false,
      false,
      false,
    ]);
    assert.deepEqual(matching("after", "2026-09-05"), [
      false,
      false,
      false,
      true,
    ]);
    assert.deepEqual(matching("lessThan", "2026-09-05"), [
      true,
      false,
      false,
      false,
    ]);
    assert.deepEqual(matching("greaterThan", "2026-09-05"), [
      false,
      false,
      false,
      true,
    ]);
    assert.deepEqual(matching("greaterThanOrEqual", "2026-09-05"), [
      false,
      true,
      true,
      true,
    ]);
    assert.deepEqual(matching("lessThanOrEqual", "2026-09-05"), [
      true,
      true,
      true,
      false,
    ]);
    assert.deepEqual(matching("isEmpty", undefined), [
      false,
      false,
      false,
      false,
    ]);
    assert.equal(
      days.matchesContractFilter("", dueRule("isEmpty", undefined)),
      true
    );
  });

  test("reads the edition's link: days stay days, older instants become the viewer's days", () => {
    const current = [
      dueRule("between", ["2026-09-05", "2026-09-12"]),
      dueRule("after", "2026-09-01"),
    ];
    const read = edition.readUrlRules(JSON.stringify(current));
    assert.deepEqual(valuesOf(read), [
      ["2026-09-05", "2026-09-12"],
      "2026-09-01",
    ]);
    // Reading what the edition writes gives the same days back.
    assert.deepEqual(valuesOf(edition.readUrlRules(JSON.stringify(read))), [
      ["2026-09-05", "2026-09-12"],
      "2026-09-01",
    ]);
    const older = [
      dueRule("between", [
        localMidnight("2026-09-05"),
        localMidnight("2026-09-12"),
      ]),
      dueRule("after", localMidnight("2026-09-01")),
    ];
    assert.deepEqual(valuesOf(edition.readUrlRules(JSON.stringify(older))), [
      ["2026-09-05", "2026-09-12"],
      "2026-09-01",
    ]);
    // The Vue envelope, with its join.
    const envelope = edition.readUrlRules(
      JSON.stringify({ filters: older, joinOperator: "or" })
    );
    assert.deepEqual(valuesOf(envelope), [
      ["2026-09-05", "2026-09-12"],
      "2026-09-01",
    ]);
    assert.ok(envelope.every((rule) => rule.joinOperator === "or"));
    assert.deepEqual(edition.readUrlRules("not json"), []);
  });

  test("applies a saved view's older instants as days, without marking it modified", () => {
    const saved = {
      advancedFilters: [
        dueRule("between", [
          localMidnight("2026-09-05"),
          localMidnight("2026-09-12"),
        ]),
      ],
    };
    const applied = edition.applyViewRules(saved);
    assert.deepEqual(valuesOf(applied), [["2026-09-05", "2026-09-12"]]);
    assert.equal(
      days.areViewSettingsEqual(saved, { advancedFilters: applied }),
      true
    );
    assert.equal(
      days.areViewSettingsEqual(saved, {
        advancedFilters: [dueRule("between", ["2026-09-05", "2026-09-13"])],
      }),
      false
    );
    // Dashboard KPIs send the view's query to `aggregate` themselves.
    assert.deepEqual(
      valuesOf(days.dashboardViewParams(saved).advancedFilters as Rule[]),
      [["2026-09-05", "2026-09-12"]]
    );
  });

  test("chart bucket clicks select whole days", () => {
    const cases: [
      string,
      Parameters<typeof days.chartBucketRange>[1],
      [string, string],
    ][] = [
      ["2026-09-12", "day", ["2026-09-12", "2026-09-12"]],
      ["2026-09-07", "week", ["2026-09-07", "2026-09-13"]],
      ["2026-09", "month", ["2026-09-01", "2026-09-30"]],
      ["2024-02", "month", ["2024-02-01", "2024-02-29"]],
      ["2026-Q3", "quarter", ["2026-07-01", "2026-09-30"]],
      ["2026", "year", ["2026-01-01", "2026-12-31"]],
    ];
    for (const [key, bucket, range] of cases) {
      const rule = dueRule("between", days.chartBucketRange(key, bucket));
      assert.deepEqual(rule.values, range, `${bucket} ${key}`);
      // Already days: normalizing keeps the rule as it is.
      assert.equal(
        days.normalizeDateFilterRule(rule, { timeZone: NEW_YORK }),
        rule
      );
      const [first, last] = range;
      assert.equal(days.matchesContractFilter(first, rule), true);
      assert.equal(days.matchesContractFilter(`${last}T23:59`, rule), true);
      assert.equal(
        days.matchesContractFilter(days.addCalendarDays(first, -1), rule),
        false
      );
      assert.equal(
        days.matchesContractFilter(days.addCalendarDays(last, 1), rule),
        false
      );
    }
  });

  test("calendar ranges name the visible days", () => {
    const scope = days.calendarScope(
      { dateColumn: "due", layout: "month" },
      new Date(2026, 7, 31),
      new Date(2026, 9, 12)
    );
    assert.deepEqual(scope && { from: scope.from, to: scope.to }, {
      from: "2026-08-31",
      to: "2026-10-11",
    });
    assert.ok(days.isCalendarDay(scope?.from) && days.isCalendarDay(scope?.to));
  });
}
