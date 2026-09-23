import assert from "node:assert/strict";
import type * as Destinations from "../src/components/ui/yayaw-table/utils/data-destinations";

const run = () => undefined;

export function dataDestinationsSuite(
  test: (name: string, body: () => void | Promise<void>) => void,
  destinations: Pick<
    typeof Destinations,
    "dataDestinationQuery" | "groupDataDestinations" | "runDataDestination"
  >
) {
  test("groups destinations by kind, keeps order and skips hidden or duplicate ones", () => {
    const groups = destinations.groupDataDestinations(
      [
        { id: "n8n", label: "n8n", kind: "export", run },
        { id: "slack", label: "Slack", kind: "share", run },
        { id: "n8n", label: "Duplicate", kind: "share", run },
        { id: "off", label: "Off", kind: "export", hidden: true, run },
        { id: "sheet", label: "Sheet", kind: "export", run },
        {
          id: "selected",
          label: "Selected",
          kind: "export",
          requiresSelection: true,
          run,
        },
      ],
      0
    );
    assert.deepEqual(
      groups.export.map((item) => item.id),
      ["n8n", "sheet"]
    );
    assert.deepEqual(
      groups.share.map((item) => item.id),
      ["slack"]
    );
    assert.deepEqual(
      destinations
        .groupDataDestinations(
          [
            {
              id: "selected",
              label: "S",
              kind: "export",
              requiresSelection: true,
              run,
            },
          ],
          2
        )
        .export.map((item) => item.id),
      ["selected"]
    );
  });

  test("gives destinations the view's query in the list shape", () => {
    assert.deepEqual(
      destinations.dataDestinationQuery({
        search: "  bravo ",
        filters: { status: "Active" },
        advancedFilters: {
          filters: [
            { id: "a", columnId: "price", operator: "gt", values: 10 },
            {
              id: "b",
              columnId: "name",
              operator: "contains",
              values: "x",
              isActive: false,
            },
          ],
          joinOperator: "or",
        },
        sorting: [
          { id: "__manual", desc: false },
          { id: "price", desc: true },
        ],
      }),
      {
        search: "bravo",
        filters: { status: "Active" },
        // Same envelope as `list`: active rules only, with their combination.
        advancedFilters: [
          {
            id: "a",
            columnId: "price",
            operator: "gt",
            values: 10,
            isActive: true,
            joinOperator: "or",
          },
        ],
        advancedFilterJoin: "or",
        sorting: [{ id: "price", desc: true }],
      }
    );
  });

  test("reports a destination's message or error without throwing", async () => {
    const context = {
      tableId: "t",
      viewId: null,
      query: destinations.dataDestinationQuery({}),
      columns: [],
      selectedRowIds: [],
      url: "https://example.test/",
      loadRows: () => Promise.resolve([]),
    };
    assert.deepEqual(
      await destinations.runDataDestination(
        { run: () => Promise.resolve({ message: "Sent" }) },
        context
      ),
      { ok: true, message: "Sent" }
    );
    assert.deepEqual(
      await destinations.runDataDestination(
        {
          run: () => {
            throw new Error("Webhook unreachable");
          },
        },
        context
      ),
      { ok: false, error: "Webhook unreachable" }
    );
  });
}
