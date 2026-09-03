import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  cloneFormValue,
  fieldIsDisabled,
  fieldIsHidden,
} from "../form-runtime";
import type {
  FormFieldContext,
  FormFieldDefinition,
  SelectOption,
} from "../types";

/** Keep option requests scoped to the field's declared dependencies. */
export const useFieldOptions = (input: {
  field: () => FormFieldDefinition;
  context: () => FormFieldContext;
  value: () => unknown;
}) => {
  const query = ref("");
  const base = ref<SelectOption[]>([]);
  const searched = ref<SelectOption[]>([]);
  const resolved = ref<SelectOption[]>([]);
  const created = ref<SelectOption[]>([]);
  const loading = ref(false);
  const error = ref<string>();
  const mounted = ref(false);
  let baseLoaded = false;
  let generation = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const values = (): unknown[] => {
    const value = input.value();
    return Array.isArray(value)
      ? value
      : [value].filter(
          (item) => item !== undefined && item !== null && item !== ""
        );
  };
  const options = computed(() => {
    const configured = Array.isArray(input.field().options)
      ? (input.field().options as SelectOption[])
      : [];
    const all = [
      ...configured,
      ...base.value,
      ...searched.value,
      ...resolved.value,
      ...created.value,
    ];
    return all.filter(
      (option, index) =>
        all.findIndex((candidate) =>
          Object.is(candidate.value, option.value)
        ) === index
    );
  });
  const active = () =>
    mounted.value &&
    !fieldIsHidden(input.field(), input.context()) &&
    !fieldIsDisabled(input.field(), input.context());
  const rememberSelection = () => {
    const selected = options.value.filter((option) =>
      values().some((value) => Object.is(value, option.value))
    );
    for (const option of selected) {
      if (
        !resolved.value.some((known) => Object.is(known.value, option.value))
      ) {
        resolved.value.push(option);
      }
    }
  };
  const invalidate = () => {
    generation += 1;
    controller?.abort();
    if (timer) {
      clearTimeout(timer);
    }
    loading.value = false;
  };
  const loadBase = async (
    field: FormFieldDefinition,
    context: FormFieldContext
  ): Promise<SelectOption[]> => {
    if (baseLoaded) {
      return base.value;
    }
    const configured =
      typeof field.options === "function"
        ? await field.options(context)
        : (field.options ?? []);
    const legacy = field.optionsLoader
      ? (await field.optionsLoader()).map((value) => ({ value, label: value }))
      : [];
    return [...configured, ...legacy];
  };
  const populate = async (
    field: FormFieldDefinition,
    context: FormFieldContext,
    text: string,
    signal: AbortSignal,
    current: () => boolean
  ): Promise<void> => {
    const nextBase = await loadBase(field, context);
    if (!current()) {
      return;
    }
    base.value = nextBase;
    baseLoaded = true;
    const known = [...nextBase, ...created.value, ...resolved.value];
    const selected = values().filter(
      (value) => !known.some((option) => Object.is(value, option.value))
    );
    if (selected.length && field.resolveOptions) {
      const next = await field.resolveOptions(selected, context, signal);
      if (!current()) {
        return;
      }
      resolved.value = [...resolved.value, ...next];
    }
    if (
      field.searchOptions &&
      text.length >= Math.max(1, field.searchMinLength ?? 3)
    ) {
      const next = await field.searchOptions(text, context, signal);
      if (!current()) {
        return;
      }
      searched.value = next;
    }
  };
  const load = async (): Promise<void> => {
    invalidate();
    if (!active()) {
      return;
    }
    const version = generation;
    const request = new AbortController();
    controller = request;
    loading.value = true;
    error.value = undefined;
    const field = input.field();
    const context = {
      ...input.context(),
      values: cloneFormValue(input.context().values),
    };
    const text = query.value.trim();
    const current = () => generation === version && !request.signal.aborted;
    try {
      await populate(field, context, text, request.signal, current);
    } catch (cause) {
      if (current()) {
        error.value = cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      if (current()) {
        loading.value = false;
      }
    }
  };
  watch(
    () =>
      JSON.stringify([
        input.field().name,
        input.field().optionsScope,
        Array.isArray(input.field().options)
          ? input.field().options
          : undefined,
        (input.field().optionDependencies ?? []).map(
          (name) => input.context().values[name]
        ),
      ]),
    async () => {
      invalidate();
      baseLoaded = false;
      base.value = [];
      searched.value = [];
      resolved.value = [];
      created.value = [];
      error.value = undefined;
      query.value = "";
      await load();
    }
  );
  watch(active, async (enabled) => {
    if (enabled) {
      await load();
    } else {
      invalidate();
    }
  });
  watch(
    query,
    () => {
      invalidate();
      rememberSelection();
      searched.value = [];
      if (!(active() && query.value.trim())) {
        return;
      }
      timer = setTimeout(
        load,
        Math.max(0, input.field().searchDebounceMs ?? 300)
      );
    },
    { flush: "sync" }
  );
  watch(
    () => JSON.stringify(values()),
    async () => {
      rememberSelection();
      if (
        input.field().resolveOptions &&
        values().some(
          (value) =>
            !options.value.some((option) => Object.is(value, option.value))
        )
      ) {
        await load();
      }
    }
  );
  const reload = async () => {
    baseLoaded = false;
    await load();
  };
  onMounted(() => {
    mounted.value = true;
  });
  onBeforeUnmount(invalidate);
  return { query, options, created, loading, error, reload };
};
