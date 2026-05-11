import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "../../../hooks/use-mobile";
import { useTableUrlState } from "../../../hooks/use-table-url-state";
import { useTranslations } from "../../../providers/table-provider";

const SearchBar = ({
  placeholder,
  tableId = "default",
  debounceMs = 300,
}: {
  placeholder: string;
  tableId?: string;
  debounceMs?: number;
}) => {
  const { t } = useTranslations();
  const isMobile = useIsMobile();
  const { globalSearchParam, setGlobalSearchFromUI } = useTableUrlState({
    tableId,
  });
  const [value, setValue] = useState(globalSearchParam || "");
  const [isExpandedOnMobile, setIsExpandedOnMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef<string | null>(null);
  const wasFocusedRef = useRef<boolean>(false);
  const caretPosRef = useRef<number | null>(null);

  useEffect(() => {
    const restoreFocus = () => {
      if (wasFocusedRef.current && inputRef.current) {
        inputRef.current.focus({ preventScroll: true });
        if (caretPosRef.current !== null) {
          try {
            inputRef.current.setSelectionRange(
              caretPosRef.current,
              caretPosRef.current
            );
          } catch {
            // ignore selection errors
          }
        }
      }
      wasFocusedRef.current = false;
      caretPosRef.current = null;
    };

    const scheduleRestoreFocus = () => {
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        window.requestAnimationFrame(restoreFocus);
        return;
      }

      restoreFocus();
    };

    // If the update was initiated locally, skip value overwrite but restore focus
    if (lastPushedRef.current === globalSearchParam) {
      lastPushedRef.current = null;
      // next frame to ensure mount completed if re-created
      scheduleRestoreFocus();
      return;
    }

    setValue(globalSearchParam || "");
    // Also attempt to restore focus if we previously had it
    scheduleRestoreFocus();
  }, [globalSearchParam]);

  useEffect(() => {
    if (!isMobile) {
      setIsExpandedOnMobile(false);
      return;
    }
    if ((globalSearchParam || "").length > 0) {
      setIsExpandedOnMobile(true);
    }
  }, [isMobile, globalSearchParam]);

  useEffect(() => {
    if (!(isMobile && isExpandedOnMobile)) {
      return;
    }
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      clearTimeout(focusTimer);
    };
  }, [isMobile, isExpandedOnMobile]);

  // Debounce push to URL while typing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      // Avoid redundant writes
      if ((globalSearchParam || "") !== trimmed) {
        lastPushedRef.current = trimmed;
        setGlobalSearchFromUI(trimmed);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debounceMs, setGlobalSearchFromUI, globalSearchParam]);

  if (isMobile && !isExpandedOnMobile) {
    return (
      <Button
        aria-label={placeholder}
        className="h-8 w-8"
        onClick={() => {
          setIsExpandedOnMobile(true);
        }}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 w-40 pr-8 pl-9 sm:w-64"
        onChange={(e) => {
          // Capture focus and caret before any potential remount
          wasFocusedRef.current = document.activeElement === inputRef.current;
          caretPosRef.current = inputRef.current?.selectionStart ?? null;
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Flush immediately on Enter
            if (debounceRef.current) {
              clearTimeout(debounceRef.current);
            }
            const trimmed = value.trim();
            lastPushedRef.current = trimmed;
            e.preventDefault();
            setGlobalSearchFromUI(trimmed);
            return;
          }
          if (e.key === "Escape" && isMobile) {
            if (value.length > 0) {
              setValue("");
              setGlobalSearchFromUI("");
              return;
            }
            setIsExpandedOnMobile(false);
          }
        }}
        placeholder={placeholder}
        ref={inputRef}
        value={value}
        // No onBlur push to avoid losing caret/focus in some browsers
      />
      {(isMobile || value.length > 0) && (
        <Button
          aria-label={value ? t("common.reset") : "Close search"}
          className="absolute top-1/2 right-0 -translate-y-1/2 rounded bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:font-bold focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-transparent focus-visible:ring-offset-0 active:bg-transparent dark:hover:bg-transparent"
          onClick={() => {
            if (value.length > 0) {
              setValue("");
              setGlobalSearchFromUI("");
              inputRef.current?.focus();
              return;
            }
            if (isMobile) {
              setIsExpandedOnMobile(false);
            }
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
};

export { SearchBar };
