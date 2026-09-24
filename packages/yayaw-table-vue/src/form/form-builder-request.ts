import { inject, type Ref, ref } from "vue";
import { tableContextKey } from "../context";

const requests = new WeakMap<object, Ref<number>>();

/**
 * "Edit form" in View settings asks the table's Form view to open its form
 * builder (the settings menu closes first): a counter of requests, per table
 * instance.
 */
export function useFormBuilderRequests(): Ref<number> {
  const table = inject(tableContextKey, undefined);
  if (!table) {
    return ref(0);
  }
  const known = requests.get(table);
  if (known) {
    return known;
  }
  const created = ref(0);
  requests.set(table, created);
  return created;
}
