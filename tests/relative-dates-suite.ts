import assert from "node:assert/strict";
import type * as Days from "../src/components/ui/yayaw-table/utils/date-filter-days";
import type * as Exports from "../src/components/ui/yayaw-table/utils/export-model";
import type * as Contracts from "../src/components/ui/yayaw-table/utils/table-contracts";
import type * as Format from "../src/components/ui/yayaw-table/utils/value-format";

type Rule = Record<string, unknown>;

/** The shared helpers, from each edition's own copy. */
export interface RelativeDatesApi
  extends Pick<
      typeof Days,
      | "isDateFilterValue"
      | "isRelativeDateToken"
      | "localeWeekStart"
      | "relativeDateFieldLabel"
      | "relativeDateLabel"
      | "resolveRelativeDate"
      | "resolveRelativeDateRule"
    >,
    Pick<
      typeof Contracts,
      | "compatibleListParams"
      | "generateDataTypeFields"
      | "matchesContractFilter"
      | "resolveDataTypeEditor"
      | "resolveFilterTokens"
      | "tableFilterContext"
    >,
    Pick<typeof Exports, "exportMatrix">,
    Pick<
      typeof Format,
      | "columnDateFormat"
      | "dateTimeFromInput"
      | "dateTimeInputValue"
      | "formatColumnValue"
    > {}

/** What each edition decides on its own. */
export interface RelativeDatesEdition {
  /** Whether the edition's filter menu accepts a date rule as complete. */
  acceptsDateRule: (operator: string, values: unknown) => boolean;
  /** The date preset `defineTableConfig` gives a date column. */
  configuredPreset: (column: Rule, table?: Rule) => unknown;
}

const PARIS = "Europe/Paris";
const MEDIUM_DAY = /14 Oct 2026/;
const PARIS_TIME = /09:30/;
const NEW_YORK = "America/New_York";
/** A Wednesday, 12:00 in Paris. */
const NOW = "2026-10-14T10:00:00.000Z";

const due = (operator: string, values: unknown): Rule => ({
  id: `due-${operator}`,
  columnId: "due",
  type: "date",
  operator,
  values,
  isActive: true,
});

export function relativeDatesSuite(
  test: (name: string, run: () => void) => void,
  api: RelativeDatesApi,
  edition: RelativeDatesEdition
) {
  const range = (token: string, context: Record<string, unknown> = {}) =>
    api.resolveRelativeDate(token, { now: NOW, timeZone: PARIS, ...context });

  test("recognizes relative tokens and keeps other values out", () => {
    for (const token of [
      "$today",
      "$thisWeek",
      "$nextYear",
      "$last7Days",
      "$next3660Days",
    ]) {
      assert.equal(api.isRelativeDateToken(token), true, token);
    }
    for (const value of [
      "today",
      "$last0Days",
      "$last3661Days",
      "$lastDays",
      "$viewer",
      "2026-10-14",
      7,
    ]) {
      assert.equal(api.isRelativeDateToken(value), false, String(value));
    }
    assert.equal(api.isDateFilterValue("2026-10-14"), true);
    assert.equal(api.isDateFilterValue("$thisMonth"), true);
    assert.equal(api.isDateFilterValue("2026-02-30"), false);
  });

  test("resolves days, weeks, months, years and day counts in the viewer's zone", () => {
    assert.deepEqual(range("$today"), {
      start: "2026-10-14",
      end: "2026-10-14",
    });
    assert.deepEqual(range("$yesterday"), {
      start: "2026-10-13",
      end: "2026-10-13",
    });
    assert.deepEqual(range("$tomorrow"), {
      start: "2026-10-15",
      end: "2026-10-15",
    });
    assert.deepEqual(range("$thisWeek", { locale: "fr" }), {
      start: "2026-10-12",
      end: "2026-10-18",
    });
    assert.deepEqual(range("$lastWeek", { locale: "fr" }), {
      start: "2026-10-05",
      end: "2026-10-11",
    });
    assert.deepEqual(range("$nextWeek", { locale: "fr" }), {
      start: "2026-10-19",
      end: "2026-10-25",
    });
    assert.deepEqual(range("$thisMonth"), {
      start: "2026-10-01",
      end: "2026-10-31",
    });
    assert.deepEqual(range("$lastMonth"), {
      start: "2026-09-01",
      end: "2026-09-30",
    });
    assert.deepEqual(range("$nextMonth"), {
      start: "2026-11-01",
      end: "2026-11-30",
    });
    assert.deepEqual(range("$thisYear"), {
      start: "2026-01-01",
      end: "2026-12-31",
    });
    assert.deepEqual(range("$lastYear"), {
      start: "2025-01-01",
      end: "2025-12-31",
    });
    assert.deepEqual(range("$last7Days"), {
      start: "2026-10-08",
      end: "2026-10-14",
    });
    assert.deepEqual(range("$next30Days"), {
      start: "2026-10-14",
      end: "2026-11-12",
    });
    // Month ends and leap years.
    assert.deepEqual(
      api.resolveRelativeDate("$lastMonth", {
        now: "2028-03-31T12:00:00Z",
        timeZone: PARIS,
      }),
      { start: "2028-02-01", end: "2028-02-29" }
    );
    assert.deepEqual(
      api.resolveRelativeDate("$nextMonth", {
        now: "2026-12-15T12:00:00Z",
        timeZone: PARIS,
      }),
      { start: "2027-01-01", end: "2027-01-31" }
    );
    assert.equal(api.resolveRelativeDate("2026-10-14"), undefined);
  });

  test("starts weeks on the locale's first day unless the table says otherwise", () => {
    assert.equal(api.localeWeekStart("fr-FR"), 1);
    assert.equal(api.localeWeekStart("en-US"), 0);
    assert.deepEqual(range("$thisWeek", { locale: "en-US" }), {
      start: "2026-10-11",
      end: "2026-10-17",
    });
    assert.deepEqual(range("$thisWeek", { locale: "en-US", weekStartsOn: 6 }), {
      start: "2026-10-10",
      end: "2026-10-16",
    });
  });

  test("reads today in the given time zone", () => {
    const lateEvening = "2026-10-14T23:30:00.000Z";
    assert.equal(
      api.resolveRelativeDate("$today", { now: lateEvening, timeZone: PARIS })
        ?.start,
      "2026-10-15"
    );
    assert.equal(
      api.resolveRelativeDate("$today", {
        now: lateEvening,
        timeZone: NEW_YORK,
      })?.start,
      "2026-10-14"
    );
  });

  test("resolves a rule's tokens to the day shapes every date rule uses", () => {
    const context = { now: NOW, timeZone: PARIS, locale: "fr" };
    const resolve = (operator: string, values: unknown) =>
      api.resolveRelativeDateRule(due(operator, values), context);
    assert.deepEqual(resolve("equals", "$thisWeek").values, [
      "2026-10-12",
      "2026-10-18",
    ]);
    assert.equal(resolve("equals", "$thisWeek").operator, "between");
    assert.deepEqual(resolve("between", ["$lastWeek", "$today"]).values, [
      "2026-10-05",
      "2026-10-14",
    ]);
    assert.deepEqual(resolve("notEquals", ["$thisMonth"]).values, [
      "2026-10-01",
      "2026-10-31",
    ]);
    assert.equal(resolve("before", "$today").values, "2026-10-14");
    assert.deepEqual(resolve("after", ["$thisWeek"]).values, ["2026-10-18"]);
    const fixed = due("equals", "2026-10-01");
    assert.equal(api.resolveRelativeDateRule(fixed, context), fixed);
  });

  test("filters rows on relative dates, including date and time values", () => {
    const context = { now: NOW, timeZone: PARIS, locale: "fr" };
    const matches = (actual: unknown, operator: string, values: unknown) =>
      api.matchesContractFilter(actual, due(operator, values), context);
    assert.equal(matches("2026-10-18", "between", "$thisWeek"), true);
    assert.equal(matches("2026-10-19", "between", "$thisWeek"), false);
    assert.equal(
      api.matchesContractFilter("2026-10-18", due("equals", "$thisWeek"), {
        ...context,
        locale: "en-US",
      }),
      false
    );
    assert.equal(matches("2026-10-13", "before", "$today"), true);
    assert.equal(matches("2026-10-14", "before", "$today"), false);
    assert.equal(matches("2026-10-15", "after", "$today"), true);
    assert.equal(matches("2026-10-20", "notEquals", "$thisWeek"), true);
    assert.equal(matches("2026-10-13", "notEquals", "$thisWeek"), false);
    assert.equal(matches(null, "equals", "$today"), false);
    // A date and time is the day it falls on in the viewer's zone.
    assert.equal(matches("2026-10-14T22:30:00Z", "equals", "$tomorrow"), true);
    assert.equal(
      api.matchesContractFilter(
        "2026-10-14T22:30:00Z",
        due("equals", "$today"),
        { ...context, timeZone: NEW_YORK }
      ),
      true
    );
  });

  test("replaces $viewer with the host's viewer id, and keeps it without one", () => {
    const owner: Rule = {
      id: "owner",
      columnId: "owner",
      type: "select",
      operator: "is",
      values: "$viewer",
    };
    const assignees: Rule = {
      id: "assignees",
      columnId: "assignees",
      type: "multiSelect",
      operator: "contains",
      values: ["$viewer", "u9"],
    };
    const state = { filters: [owner, assignees], joinOperator: "and" };
    const resolved = api.resolveFilterTokens(state, { viewerId: "u1" });
    assert.deepEqual(
      resolved.filters.map((rule) => rule.values),
      ["u1", ["u1", "u9"]]
    );
    assert.equal(api.resolveFilterTokens(state, {}), state);
    assert.equal(
      api.matchesContractFilter("u1", owner, { viewerId: "u1" }),
      true
    );
    assert.equal(
      api.matchesContractFilter("u2", owner, { viewerId: "u1" }),
      false
    );
    assert.deepEqual(
      api.tableFilterContext(
        { timeZone: PARIS, weekStartsOn: 0, viewerId: 7 },
        "fr"
      ),
      { timeZone: PARIS, locale: "fr", weekStartsOn: 0, viewerId: 7 }
    );
  });

  test("hands list requests resolved rules", () => {
    const request = api.compatibleListParams(
      {
        advancedFilters: {
          filters: [
            due("equals", "$thisMonth"),
            { ...due("before", "$today"), id: "off", isActive: false },
            {
              id: "owner",
              columnId: "owner",
              type: "select",
              operator: "is",
              values: "$viewer",
            },
          ],
          joinOperator: "and",
        },
      },
      { now: NOW, timeZone: PARIS, viewerId: "u1" }
    );
    assert.deepEqual(
      (request.advancedFilters as Rule[]).map((rule) => [
        rule.operator,
        rule.values,
      ]),
      [
        ["between", ["2026-10-01", "2026-10-31"]],
        ["is", "u1"],
      ]
    );
  });

  test("labels tokens in English and French", () => {
    assert.equal(api.relativeDateLabel("$thisWeek"), "This week");
    assert.equal(api.relativeDateLabel("$last14Days", "en"), "Last 14 days");
    assert.equal(
      api.relativeDateLabel("$next7Days", "fr-FR"),
      "7 prochains jours"
    );
    assert.equal(api.relativeDateLabel("$lastMonth", "fr"), "Le mois dernier");
    assert.equal(
      api.relativeDateLabel("$today", "en", (key) =>
        key === "filters.relative.today" ? "Now" : undefined
      ),
      "Now"
    );
    assert.equal(api.relativeDateFieldLabel("fixed", "fr"), "Date précise");
  });

  test("accepts complete relative date rules in the filter menu", () => {
    assert.equal(edition.acceptsDateRule("equals", "$today"), true);
    assert.equal(edition.acceptsDateRule("between", "$thisWeek"), true);
    assert.equal(edition.acceptsDateRule("before", ["$last7Days"]), true);
    assert.equal(
      edition.acceptsDateRule("between", ["2026-10-01", "$today"]),
      true
    );
    assert.equal(edition.acceptsDateRule("equals", "$someday"), false);
  });

  test("converts date and time inputs in the column's zone", () => {
    assert.equal(
      api.dateTimeInputValue("2026-10-14T07:30:00.000Z", PARIS),
      "2026-10-14T09:30"
    );
    assert.equal(
      api.dateTimeFromInput("2026-10-14T09:30", PARIS),
      "2026-10-14T07:30:00.000Z"
    );
    assert.equal(
      api.dateTimeFromInput("2026-01-10T09:00", NEW_YORK),
      "2026-01-10T14:00:00.000Z"
    );
    // Summer time starts at 02:00 in Paris on 29 March 2026.
    assert.equal(
      api.dateTimeFromInput("2026-03-29T03:30", PARIS),
      "2026-03-29T01:30:00.000Z"
    );
    assert.equal(
      api.dateTimeInputValue("2026-10-14T09:30", PARIS),
      "2026-10-14T09:30"
    );
    assert.equal(
      api.dateTimeInputValue("2026-10-14", PARIS),
      "2026-10-14T00:00"
    );
    assert.equal(api.dateTimeInputValue(null), "");
    assert.equal(api.dateTimeFromInput(""), "");
    assert.equal(api.dateTimeFromInput("soon"), undefined);
  });

  test("shows, edits and generates date and time columns", () => {
    const column = {
      id: "starts",
      header: "Starts",
      type: "date",
      withTime: true,
      timeZone: PARIS,
    };
    assert.equal(api.columnDateFormat(column).preset, "dateTime");
    assert.equal(
      api.columnDateFormat({ ...column, dateDisplayPreset: "iso" }).preset,
      "iso"
    );
    const text = api.formatColumnValue(
      "2026-10-14T07:30:00.000Z",
      column,
      "en-GB"
    );
    assert.match(text ?? "", MEDIUM_DAY);
    assert.match(text ?? "", PARIS_TIME);
    assert.equal(
      api.resolveDataTypeEditor({ columnType: "date", withTime: true }),
      "datetime"
    );
    assert.equal(api.resolveDataTypeEditor({ columnType: "date" }), "date");
    assert.equal(
      api.resolveDataTypeEditor({ columnType: "date", formFieldType: "text" }),
      "text"
    );
    assert.deepEqual(api.generateDataTypeFields([column]), [
      {
        name: "starts",
        label: "Starts",
        type: "date",
        withTime: true,
        timeZone: PARIS,
      },
    ]);
    assert.equal(edition.configuredPreset(column), "dateTime");
    assert.equal(
      edition.configuredPreset(column, { dateDisplayPreset: "dmy-numeric" }),
      "dateTime"
    );
    assert.equal(
      edition.configuredPreset(
        { ...column, withTime: undefined },
        { dateDisplayPreset: "dmy-numeric" }
      ),
      "dmy-numeric"
    );
    // Exports keep the time as displayed, and the instant as stored.
    const configured = {
      ...column,
      dateDisplayPreset: edition.configuredPreset(column),
    } as Parameters<typeof api.exportMatrix>[1][number];
    const exportRows = [{ starts: "2026-10-14T07:30:00.000Z" }];
    const [formattedCell] =
      api.exportMatrix(exportRows, [configured], {
        formatted: true,
        locale: "en-GB",
      }).rows[0] ?? [];
    assert.match(String(formattedCell), MEDIUM_DAY);
    assert.match(String(formattedCell), PARIS_TIME);
    assert.deepEqual(
      api.exportMatrix(exportRows, [configured], { formatted: false }).rows,
      [["2026-10-14T07:30:00.000Z"]]
    );
  });
}
