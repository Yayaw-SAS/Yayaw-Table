import { useMemo, useState } from "react";
import { DataTable } from "../src/components/ui/yayaw-table/components/data-table";
import { defineTableConfig } from "../src/components/ui/yayaw-table/config/helpers";
import { exampleServerKanban } from "./server-kanban";

export function ServerKanbanExample() {
  const [opened, setOpened] = useState("");
  const board = useMemo(
    () => exampleServerKanban((row) => setOpened(String(row.name))),
    []
  );
  const config = useMemo(
    () =>
      defineTableConfig({
        id: "server-board-demo",
        columns: {
          definitions: [
            { id: "url", header: "Website", type: "url", inlineEdit: false },
            { id: "name", header: "Name", type: "text", inlineEdit: false },
            {
              id: "owner",
              header: "Owner",
              inlineEdit: false,
              type: "text",
              filterRenderer: ({ value, onChange }) => (
                <select
                  aria-label="Owner filter"
                  onChange={(event) => onChange(event.target.value)}
                  value={String(value ?? "")}
                >
                  <option value="">Everyone</option>
                  <option value="Morgan">Morgan</option>
                </select>
              ),
            },
            {
              id: "stage",
              header: "Stage",
              type: "text",
              inlineEdit: true,
              enableGrouping: true,
            },
          ],
          order: ["name", "owner", "stage"],
          visible: ["name", "owner"],
          mandatory: [],
        },
        table: {
          syncUrl: false,
          defaultDisplayMode: "kanban",
          displayModes: ["kanban"],
          allowCreate: false,
          allowEdit: false,
          canEditRow: (row) => String(row.id) !== "2",
          allowInlineEdit: true,
          inlineEdit: { enabled: true },
          allowDelete: false,
          enableRowSelection: false,
          showClearFilters: true,
          showResetFilters: true,
          kanban: {
            groupBy: "stage",
            titleColumn: "name",
            cardColumnIds: ["owner", "url"],
            allowDragUpdate: true,
            dragFromCard: true,
            server: board,
          },
        },
        translations: { namespace: "demo", keys: { title: "Server Kanban" } },
      }),
    [board]
  );
  return (
    <main>
      <h1>Server Kanban · React</h1>
      <p>
        Five records, independent pages, an empty lane and a recoverable error.
      </p>
      <output>{opened}</output>
      <DataTable
        getTableActions={() => ({ update: board.update })}
        getTableConfig={() => config}
        initialData={[]}
        initialPageCount={1}
        initialRowCount={0}
        tableType={config.id}
      />
    </main>
  );
}
