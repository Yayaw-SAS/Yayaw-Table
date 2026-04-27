"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_PACKAGE_MANAGER,
  isPackageManager,
  PACKAGE_MANAGER_STORAGE_KEY,
  type PackageManager,
} from "@/src/lib/package-manager";

interface PackageManagerContextValue {
  packageManager: PackageManager;
  setPackageManager: (value: PackageManager) => void;
}

const PackageManagerContext = createContext<
  PackageManagerContextValue | undefined
>(undefined);

export function PackageManagerProvider({ children }: { children: ReactNode }) {
  const [packageManager, setPackageManagerState] = useState<PackageManager>(
    DEFAULT_PACKAGE_MANAGER
  );

  useEffect(() => {
    const storedValue = window.localStorage.getItem(
      PACKAGE_MANAGER_STORAGE_KEY
    );

    if (isPackageManager(storedValue)) {
      setPackageManagerState(storedValue);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PACKAGE_MANAGER_STORAGE_KEY, packageManager);
  }, [packageManager]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PACKAGE_MANAGER_STORAGE_KEY) {
        return;
      }

      if (isPackageManager(event.newValue)) {
        setPackageManagerState(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo<PackageManagerContextValue>(() => {
    return {
      packageManager,
      setPackageManager: setPackageManagerState,
    };
  }, [packageManager]);

  return (
    <PackageManagerContext.Provider value={value}>
      {children}
    </PackageManagerContext.Provider>
  );
}

export const usePackageManager = (): PackageManagerContextValue => {
  const context = useContext(PackageManagerContext);

  if (!context) {
    throw new Error(
      "usePackageManager must be used within a PackageManagerProvider"
    );
  }

  return context;
};
