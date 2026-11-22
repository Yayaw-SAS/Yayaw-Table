export interface CatalogueOption {
  value: string | number;
  label: string;
}

const tags: CatalogueOption[] = [
  { value: "launch", label: "Launch" },
  { value: "featured", label: "Featured" },
];
const media: CatalogueOption[] = [
  { value: 101, label: "Launch image" },
  { value: 102, label: "Product video" },
];

/** Simulates the host's asynchronous catalogue; real hosts call their API here. */
async function search(
  options: CatalogueOption[],
  query: string,
  signal: AbortSignal
) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  signal.throwIfAborted();
  if (query === "error") {
    throw new Error("The catalogue is unavailable. Try another search.");
  }
  return options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase())
  );
}

export const recordTagSearch = {
  searchOptions: (query: string, _context: unknown, signal: AbortSignal) =>
    search(tags, query, signal),
  resolveOptions: (values: unknown[]) =>
    Promise.resolve(tags.filter((option) => values.includes(option.value))),
  createOption: (label: string) => {
    const option = { value: crypto.randomUUID(), label };
    tags.push(option);
    return Promise.resolve(option);
  },
};

export const recordMediaSearch = {
  searchOptions: (query: string, _context: unknown, signal: AbortSignal) =>
    // Server-side aliases need not occur in the returned option's label.
    search(media, query === "hero" ? "launch" : query, signal),
  resolveOptions: (values: unknown[]) =>
    Promise.resolve(media.filter((option) => values.includes(option.value))),
};
