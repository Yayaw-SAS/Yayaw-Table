import assert from "node:assert/strict";
import { formatColumns, formatRows } from "../examples/value-formats";
import type * as Planning from "../src/components/ui/yayaw-table/planning/format";
import type * as Calendar from "../src/components/ui/yayaw-table/utils/calendar-model";
import type * as Connector from "../src/components/ui/yayaw-table/utils/connector-flow";
import type * as Export from "../src/components/ui/yayaw-table/utils/export-model";
import type * as Feed from "../src/components/ui/yayaw-table/utils/feed-view";
import type * as FileTree from "../src/components/ui/yayaw-table/utils/filetree-model";
import type * as Form from "../src/components/ui/yayaw-table/utils/form-view";
import type * as MapModel from "../src/components/ui/yayaw-table/utils/map-model";
import type * as Details from "../src/components/ui/yayaw-table/utils/record-details";
import type * as Contracts from "../src/components/ui/yayaw-table/utils/table-contracts";
import type * as Format from "../src/components/ui/yayaw-table/utils/value-format";
import type * as Dashboard from "../src/components/ui/yayaw-table-dashboard/dashboard-model";

/**
 * The format matrix (`examples/value-formats.ts`) through every shared model:
 * a column's format reads the same wherever the field shows, in both editions.
 */
export interface FormatMatrixApi {
  calendarEvents: typeof Calendar.calendarEvents;
  connectorLabels: typeof Connector.connectorLabels;
  formatSyncValue: typeof Connector.formatSyncValue;
  dashboardDateRangeText: typeof Dashboard.dashboardDateRangeText;
  detailDisplay: typeof Details.detailDisplay;
  detailLabels: typeof Details.detailLabels;
  detailSections: typeof Details.detailSections;
  exportMatrix: typeof Export.exportMatrix;
  feedPropertyValue: typeof Feed.feedPropertyValue;
  feedTitleText: typeof Feed.feedTitleText;
  formatFeedAbsoluteDate: typeof Feed.formatFeedAbsoluteDate;
  groupFeedRows: typeof Feed.groupFeedRows;
  formatFileTreeValue: typeof FileTree.formatFileTreeValue;
  formatRelativeDate: typeof FileTree.formatRelativeDate;
  formDateDisplay: typeof Form.formDateDisplay;
  mapMarkers: typeof MapModel.mapMarkers;
  mapPopupProperties: typeof MapModel.mapPopupProperties;
  fieldText: typeof Contracts.fieldText;
  groupedValueLabel: typeof Contracts.groupedValueLabel;
  formatColumnCalculation: typeof Format.formatColumnCalculation;
  planningFormatters: typeof Planning.planningFormatters;
}

type Test = (name: string, run: () => void) => void;

// Intl may use narrow and no-break spaces; compare with plain spaces.
const plain = (text: string | undefined) => (text ?? "").replace(/[  ]/g, " ");

const EXPECTED = {
  "en-US": {
    amount: "€2,499.00",
    total: "€4,049.50",
    progress: "45%",
    weight: "12.5 kg",
    reach: "1.3M",
    share: "33%",
    range: "9d",
    score: "≈ 1 234.5 pts",
    scoreTotal: "≈ 1 329.8 pts",
  },
  "fr-FR": {
    amount: "2 499,00 €",
    total: "4 049,50 €",
    progress: "45 %",
    weight: "12,5 kg",
    reach: "1,3 M",
    share: "33 %",
    range: "9j",
    score: "≈ 1 234,5 pts",
    scoreTotal: "≈ 1 329,8 pts",
  },
} as const;
const DUE = "06/09/2026 00:30";
const DUE_DAY = "06/09/2026";
const LAST_DUE = "15/09/2026 14:00";
const PARIS_HALF_PAST_FOUR = /16:30/;

const column = (id: string) => {
  const found = formatColumns.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No column ${id}`);
  }
  return found;
};
const alpha = formatRows[0] as Record<string, unknown>;

export function formatMatrixSuite(test: Test, api: FormatMatrixApi) {
  for (const [locale, expected] of Object.entries(EXPECTED)) {
    test(`${locale}: titles, groups and labels read each column's format`, () => {
      const text = (id: string) =>
        plain(api.fieldText(alpha[id], column(id), locale, alpha));
      assert.equal(text("amount"), expected.amount);
      assert.equal(text("progress"), expected.progress);
      assert.equal(text("weight"), expected.weight);
      assert.equal(text("reach"), expected.reach);
      assert.equal(text("due"), DUE);
      assert.equal(text("status"), "Active");
      // Affixes and separators keep their spaces.
      assert.equal(text("score"), expected.score);
      assert.equal(
        plain(
          api.groupedValueLabel(2499, undefined, {
            column: column("amount"),
            locale,
          })
        ),
        expected.amount
      );
    });

    test(`${locale}: calculations keep the format; counts and shares stay plain`, () => {
      const calculation = (value: unknown, kind: string, id: string) =>
        plain(api.formatColumnCalculation(value, kind, column(id), locale));
      assert.equal(calculation(4049.5, "sum", "amount"), expected.total);
      assert.equal(calculation(1329.75, "sum", "score"), expected.scoreTotal);
      assert.equal(calculation(0.45, "average", "progress"), expected.progress);
      assert.equal(calculation(formatRows[2]?.due, "max", "due"), LAST_DUE);
      assert.equal(calculation(9, "range", "due"), expected.range);
      assert.equal(calculation(3, "count_all", "amount"), "3");
      assert.equal(
        calculation(1234, "count_values", "amount"),
        plain(new Intl.NumberFormat(locale).format(1234))
      );
      assert.equal(
        calculation(100 / 3, "percent_empty", "amount"),
        expected.share
      );
    });

    test(`${locale}: the record view, exports and connectors show formatted values`, () => {
      const labels = api.detailLabels(locale);
      const [section] = api.detailSections({}, formatColumns, alpha, "Record");
      const shown = (id: string) => {
        const field = section?.fields.find((item) => item.id === id);
        assert.ok(field);
        return plain(
          api.detailDisplay(field, alpha[id], alpha, locale, labels).text
        );
      };
      assert.equal(shown("amount"), expected.amount);
      assert.equal(shown("progress"), expected.progress);
      assert.equal(shown("weight"), expected.weight);
      assert.equal(shown("due"), DUE);
      assert.equal(shown("score"), expected.score);

      const matrix = api.exportMatrix([alpha], formatColumns, {
        formatted: true,
        locale,
      });
      assert.deepEqual(
        matrix.rows[0]?.slice(0, 7).map((cell) => plain(String(cell))),
        [
          "Alpha",
          "Active",
          expected.amount,
          expected.progress,
          expected.weight,
          expected.reach,
          DUE,
        ]
      );
      // Raw exports keep what is stored.
      assert.deepEqual(
        api
          .exportMatrix([alpha], formatColumns, { formatted: false })
          .rows[0]?.slice(2, 7),
        [2499, 0.45, 12.5, 1_250_000, "2026-09-05T22:30:00Z"]
      );

      const t = api.connectorLabels(locale);
      const sync = (id: string) =>
        plain(api.formatSyncValue(alpha[id], t, { ...column(id), locale }));
      assert.equal(sync("amount"), expected.amount);
      assert.equal(sync("due"), DUE);
      assert.equal(sync("status"), "Active");
    });

    test(`${locale}: feed, map, calendar and file tree read the columns' formats`, () => {
      const feedOptions = { locale, coloredTags: true, yes: "Yes", no: "No" };
      const feedText = (id: string, value: unknown) => {
        const property = api.feedPropertyValue(column(id), value, feedOptions);
        return plain(property && "text" in property ? property.text : "");
      };
      assert.equal(feedText("amount", 2499), expected.amount);
      assert.equal(feedText("due", alpha.due), DUE);
      assert.equal(
        plain(api.feedTitleText(alpha, column("reach"), locale)),
        expected.reach
      );
      assert.equal(
        plain(api.formatFeedAbsoluteDate(alpha.due, locale, column("due"))),
        DUE
      );
      assert.deepEqual(
        api
          .groupFeedRows(formatRows, column("amount"), "No value", locale)
          .map((section) => plain(section.label))
          .slice(0, 1),
        [expected.amount]
      );

      assert.deepEqual(
        api
          .mapPopupProperties(
            alpha,
            { popupColumns: ["amount", "due"] },
            formatColumns,
            locale
          )
          .map((property) => plain(property.text)),
        [expected.amount, DUE]
      );
      const located = { ...alpha, site: { lat: 48.85, lng: 2.35 } };
      const { markers } = api.mapMarkers(
        [located],
        { locationColumn: "site", titleColumn: "amount" },
        [...formatColumns, { id: "site", type: "location" }],
        (row) => String(row.id),
        locale
      );
      assert.equal(plain(markers[0]?.title), expected.amount);

      const [event] = api.calendarEvents(
        [alpha],
        { dateColumn: "due", titleColumn: "amount" },
        (row) => String(row.id),
        { columns: formatColumns, locale }
      );
      assert.equal(plain(event?.title), expected.amount);

      const settings = { sizeColumn: "weight", updatedColumn: "updatedAt" };
      // A number format set on the size column wins over file units.
      assert.equal(
        plain(
          api.formatFileTreeValue(12.5, column("weight"), { locale, settings })
        ),
        expected.weight
      );
      assert.equal(
        plain(
          api.formatFileTreeValue(alpha.due, column("due"), {
            locale,
            settings,
          })
        ),
        DUE
      );
      // Past a week, the Updated column reads in its own format.
      assert.match(
        plain(
          api.formatRelativeDate(
            alpha.updatedAt,
            locale,
            new Date("2026-10-30T12:00:00Z"),
            column("updatedAt")
          )
        ),
        PARIS_HALF_PAST_FOUR
      );
    });

    test(`${locale}: days (filters, dashboards, plans, form answers) read the date part`, () => {
      assert.equal(
        plain(
          api.dashboardDateRangeText(
            { start: "2026-09-06", end: "2026-09-12" },
            locale,
            undefined,
            column("due")
          )
        ),
        `${DUE_DAY} – 12/09/2026`
      );
      const plan = api.planningFormatters(
        formatColumns,
        { startColumn: "due", endColumn: "due", titleColumn: "amount" },
        locale
      );
      assert.equal(plan.day("2026-09-06"), DUE_DAY);
      assert.equal(
        plain(
          plan.task({
            ref: { source: "formats", id: "f1" },
            label: "2499",
            start: "2026-09-06",
            end: "2026-09-06",
            parent: null,
            record: alpha,
          })
        ),
        expected.amount
      );
      assert.equal(
        plain(plan.field("amount", 2499)),
        `Amount: ${expected.amount}`
      );
      assert.equal(
        api.formDateDisplay("2026-09-06", locale, {
          dateFormat: "dd/MM/yyyy HH:mm",
        }),
        DUE_DAY
      );
    });
  }
}
