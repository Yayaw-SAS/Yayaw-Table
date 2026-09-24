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

interface PageState {
  names: string[];
  skeleton: boolean;
  table: boolean;
}

/**
 * Records each state the page shows from its first paint: the record names in
 * order, and whether a table body or a loading skeleton is up.
 */
function recordPageStates(names: string[]) {
  const states: PageState[] = [];
  Object.assign(window, { __defaultSortStates: states });
  const record = () => {
    if (!document.body) {
      return;
    }
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
    states.push({
      names: seen,
      skeleton: Boolean(document.querySelector('[data-slot="skeleton"]')),
      table: Boolean(document.querySelector("tbody")),
    });
  };
  new MutationObserver(record).observe(document, {
    characterData: true,
    childList: true,
    subtree: true,
  });
}

const pageStates = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __defaultSortStates: PageState[] })
        .__defaultSortStates
  );

// `&initial=…`: the host renders its first page before the list answers
// (a server-rendered page, as far as the table can tell).
test("the host's first rows show at once, then load in columns.sort", async ({
  page,
}) => {
  await page.addInitScript(recordPageStates, NAMES);
  await page.goto(`${EXAMPLE}&initial=list`);
  await expect.poll(() => recordOrder(page)).toEqual(BY_START);
  const states = await pageStates(page);
  // The first table the page shows already holds the host's rows, in the
  // list's own order, and no skeleton ever replaces them.
  expect(states.find((state) => state.table)?.names).toEqual(BY_ID);
  expect(states.some((state) => state.skeleton)).toBe(false);
});

test("rows the host ordered by columns.sort show at once", async ({ page }) => {
  await page.addInitScript(recordPageStates, NAMES);
  await page.goto(`${EXAMPLE}&initial=sorted`);
  await expect.poll(() => recordOrder(page)).toEqual(BY_START);
  const states = await pageStates(page);
  expect(states.find((state) => state.table)?.names).toEqual(BY_START);
  expect(states.some((state) => state.skeleton)).toBe(false);
});
