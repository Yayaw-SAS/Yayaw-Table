import { expect, type Page, test } from "@playwright/test";

// The same rows, list handler and config in both demos (examples/default-sort.ts).
// Stored order: Desk, Lamp, Chair. The handler orders by `orderBy`, then by id.
const EXAMPLE = "/?example=default-sort";
const NAMES = ["Desk", "Lamp", "Chair"];
const BY_START = ["Desk", "Lamp", "Chair"];
const BY_ID = ["Chair", "Desk", "Lamp"];

/** Record names in reading order, each once (the Gantt shows a label and a bar). */
const recordOrder = (page: Page) =>
  page.evaluate((names) => {
    const seen: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim() ?? "";
      if (names.includes(text) && !seen.includes(text)) {
        seen.push(text);
      }
    }
    return seen;
  }, NAMES);

const modes = [
  // Kanban lanes follow the status options: Active (Desk, Chair), then Draft.
  { mode: "kanban", sorted: ["Desk", "Chair", "Lamp"], unsorted: BY_ID },
  { mode: "table", sorted: BY_START, unsorted: BY_ID },
  { mode: "gallery", sorted: BY_START, unsorted: BY_ID },
  { mode: "gantt", sorted: BY_START, unsorted: BY_ID },
] as const;

for (const { mode, sorted, unsorted } of modes) {
  test(`${mode} starts from the configured columns.sort`, async ({ page }) => {
    await page.goto(`${EXAMPLE}&restock-display=${mode}`);
    await expect.poll(() => recordOrder(page)).toEqual(sorted);
  });

  test(`${mode} keeps the list order without a configured sort`, async ({
    page,
  }) => {
    await page.goto(`${EXAMPLE}&sort=none&restock-display=${mode}`);
    await expect.poll(() => recordOrder(page)).toEqual(unsorted);
  });
}

test("a sort in the URL wins over the configured one", async ({ page }) => {
  const byName = encodeURIComponent(
    JSON.stringify([{ id: "name", desc: true }])
  );
  await page.goto(`${EXAMPLE}&restock-sort=${byName}`);
  await expect.poll(() => recordOrder(page)).toEqual(["Lamp", "Desk", "Chair"]);
});
