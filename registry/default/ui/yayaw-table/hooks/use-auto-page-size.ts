"use client";

import { atom, useAtom, useSetAtom } from "jotai";
import { atomFamily } from "jotai-family";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  type AutoPageMeasurement,
  observeAutoPageSize,
} from "../utils/auto-page-size";

// The table's keyed store survives loading skeletons between server pages.
const autoPageState = atomFamily((_tableId: string) =>
  atom({
    automatic: false,
    resetKey: "",
    expectedSize: undefined as number | undefined,
  })
);

/** Clear transient sizing when the owning table leaves the page, not while its query reloads. */
export function useAutoPageSizeLifetime(tableId: string) {
  const setMode = useSetAtom(autoPageState(tableId));
  useEffect(
    () => () => {
      setMode({ automatic: false, resetKey: "", expectedSize: undefined });
    },
    [setMode]
  );
}

export function useAutoPageSize({
  root,
  tableId,
  enabled,
  resetKey,
  measurementKey,
  pageSize,
  setPageSize,
}: {
  root: RefObject<HTMLDivElement | null>;
  tableId: string;
  enabled: boolean;
  resetKey: string;
  measurementKey: string;
  pageSize: number;
  setPageSize: (size: number) => void;
}) {
  const [mode, setMode] = useAtom(autoPageState(tableId));
  const automatic = enabled && mode.resetKey === resetKey && mode.automatic;
  const [measurement, setMeasurement] = useState<AutoPageMeasurement>();
  const previousSize = useRef(pageSize);
  const current = useRef({ automatic, pageSize, setPageSize });
  current.current = { automatic, pageSize, setPageSize };
  useEffect(() => {
    setMode((previous) =>
      !enabled || previous.resetKey !== resetKey
        ? { automatic: false, resetKey, expectedSize: undefined }
        : previous
    );
  }, [resetKey, enabled, setMode]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Density and view changes invalidate measured row heights.
  useEffect(() => {
    if (!(enabled && root.current)) {
      return;
    }
    return observeAutoPageSize(root.current, (value) => {
      setMeasurement((previous) =>
        previous?.pageSize === value.pageSize &&
        previous.tableHeight === value.tableHeight
          ? previous
          : value
      );
      if (
        current.current.automatic &&
        current.current.pageSize !== value.pageSize
      ) {
        setMode((previous) => ({ ...previous, expectedSize: value.pageSize }));
        current.current.setPageSize(value.pageSize);
      }
    });
  }, [root, enabled, resetKey, measurementKey, setMode]);
  useEffect(() => {
    if (
      automatic &&
      previousSize.current !== pageSize &&
      mode.expectedSize !== undefined &&
      pageSize !== mode.expectedSize
    ) {
      setMode((previous) => ({ ...previous, automatic: false }));
    }
    previousSize.current = pageSize;
  }, [automatic, pageSize, mode.expectedSize, setMode]);
  const selectSize = (value: string) => {
    const auto = value === "auto";
    const size = auto ? measurement?.pageSize : Number(value);
    if (size && Number.isInteger(size) && size > 0) {
      setMode({ automatic: auto, resetKey, expectedSize: size });
      setPageSize(size);
    } else {
      setMode((previous) => ({ ...previous, automatic: auto, resetKey }));
    }
  };
  return {
    automatic,
    selectSize,
    tableHeight: automatic ? measurement?.tableHeight : undefined,
  };
}
