import { onBeforeUnmount, onMounted, type Ref, ref, watch } from "vue";
import {
  type AutoPageMeasurement,
  observeAutoPageSize,
} from "../auto-page-size";
import { useTableContext } from "../context";

export function useAutoPageSize(root: Ref<HTMLElement | undefined>) {
  const context = useTableContext();
  const defaultAutomatic = Boolean(
    context.config.table.enablePagination !== false &&
      context.config.table.enableAutoPageSize &&
      context.config.table.defaultAutoPageSize
  );
  const automatic = ref(defaultAutomatic);
  const measurement = ref<AutoPageMeasurement>();
  let expectedSize: number | undefined;
  let fitKey = "";
  let stop: (() => void) | undefined;
  let mounted = false;
  const setPageSize = (pageSize: number) => {
    const previous = context.state.pagination.value;
    expectedSize = pageSize;
    if (previous.pageSize !== pageSize) {
      context.state.pagination.value = {
        pageIndex: Math.floor(
          (previous.pageIndex * previous.pageSize) / pageSize
        ),
        pageSize,
      };
    }
  };
  const observe = () => {
    stop?.();
    if (!(mounted && root.value && context.config.table.enableAutoPageSize)) {
      return;
    }
    stop = observeAutoPageSize(root.value, (value) => {
      if (
        measurement.value?.layoutKey !== value.layoutKey ||
        measurement.value?.pageSize !== value.pageSize ||
        measurement.value?.tableHeight !== value.tableHeight
      ) {
        measurement.value = value;
      }
      if (automatic.value) {
        const nextFitKey = `${context.state.density.value}:${value.layoutKey}`;
        // Keep the capacity stable across pages with different row heights.
        const size =
          fitKey === nextFitKey
            ? Math.min(value.pageSize, expectedSize ?? value.pageSize)
            : value.pageSize;
        fitKey = nextFitKey;
        setPageSize(size);
      }
    });
  };
  onMounted(() => {
    mounted = true;
    observe();
  });
  onBeforeUnmount(() => {
    mounted = false;
    stop?.();
  });
  watch(() => context.state.density.value, observe);
  watch(
    () => context.state.activeViewId.value,
    () => {
      expectedSize = undefined;
      fitKey = "";
      automatic.value = defaultAutomatic;
      observe();
    }
  );
  watch(
    () => context.state.pagination.value.pageSize,
    (value) => {
      if (
        automatic.value &&
        expectedSize !== undefined &&
        value !== expectedSize
      ) {
        automatic.value = false;
      }
    }
  );
  const selectSize = (value: string) => {
    automatic.value = value === "auto";
    fitKey = `${context.state.density.value}:${measurement.value?.layoutKey}`;
    const size = automatic.value ? measurement.value?.pageSize : Number(value);
    if (size && Number.isInteger(size) && size > 0) {
      setPageSize(size);
    }
  };
  return { automatic, measurement, selectSize };
}
