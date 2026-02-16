/**
 * Modern Add Filter Dropdown
 * Inspired by Linear's filter addition interface
 */
"use client";

import {
  Calendar,
  CheckSquare,
  Clock,
  Filter,
  Hash,
  List,
  Plus,
  Search,
  Star,
  Tag,
  Type,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useTranslations } from "../../providers/table-provider";
import type {
  ColumnDataType,
  ColumnsFilterConfig,
} from "../../types/filter-types";
import { translateWithFallback } from "./i18n-utils";

// Icons for different data types
const typeIcons = {
  text: Type,
  number: Hash,
  date: Calendar,
  option: CheckSquare,
  multiOption: List,
} as const;

// Colors for different data types
const typeColors = {
  text: "text-blue-600 bg-blue-50 border-blue-200",
  number: "text-emerald-600 bg-emerald-50 border-emerald-200",
  date: "text-purple-600 bg-purple-50 border-purple-200",
  option: "text-orange-600 bg-orange-50 border-orange-200",
  multiOption: "text-pink-600 bg-pink-50 border-pink-200",
} as const;

// Categories for organizing columns
const categories = {
  recent: {
    label: "Recently used",
    labelKey: "filters.add_menu.categories.recent",
    icon: Clock,
    color: "text-muted-foreground",
  },
  popular: {
    label: "Popular",
    labelKey: "filters.add_menu.categories.popular",
    icon: Zap,
    color: "text-amber-600",
  },
  text: {
    label: "Text fields",
    labelKey: "filters.add_menu.categories.text",
    icon: Type,
    color: "text-blue-600",
  },
  number: {
    label: "Number fields",
    labelKey: "filters.add_menu.categories.number",
    icon: Hash,
    color: "text-emerald-600",
  },
  date: {
    label: "Date fields",
    labelKey: "filters.add_menu.categories.date",
    icon: Calendar,
    color: "text-purple-600",
  },
  option: {
    label: "Selection fields",
    labelKey: "filters.add_menu.categories.option",
    icon: Tag,
    color: "text-orange-600",
  },
} as const;

interface ColumnOption {
  id: string;
  label: string;
  type: ColumnDataType;
  description?: string;
  category?: keyof typeof categories;
  isRecent?: boolean;
  isPopular?: boolean;
  isFilterable?: boolean;
}

interface ModernAddFilterDropdownProps {
  columnsConfig: ColumnsFilterConfig;
  onAddFilter: (columnId: string, type: ColumnDataType) => void;
  existingFilterColumnIds?: string[];
  recentColumns?: string[];
  popularColumns?: string[];
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Column option item component
 */
function ColumnOptionItem({
  option: columnOption,
  onSelect,
}: {
  option: ColumnOption;
  onSelect: (option: ColumnOption) => void;
}) {
  const { t } = useTranslations();
  const TypeIcon = typeIcons[columnOption.type];

  return (
    <Button
      className={cn(
        "flex w-full items-center justify-start gap-3 rounded-md px-3 py-2 text-left transition-all duration-150",
        "group hover:bg-accent/50"
      )}
      onClick={() => onSelect(columnOption)}
      type="button"
      variant="ghost"
    >
      {/* Type Icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
          "bg-gradient-to-br group-hover:shadow-sm",
          typeColors[columnOption.type]
        )}
      >
        <TypeIcon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm">
            {columnOption.label}
          </span>
          {columnOption.isRecent && (
            <Badge className="text-xs" variant="secondary">
              {translateWithFallback(t, "filters.add_menu.recent", "Recent")}
            </Badge>
          )}
          {columnOption.isPopular && (
            <Badge
              className="bg-amber-100 text-amber-700 text-xs"
              variant="secondary"
            >
              {translateWithFallback(t, "filters.add_menu.popular", "Popular")}
            </Badge>
          )}
        </div>
        {columnOption.description && (
          <p className="truncate text-muted-foreground text-xs">
            {columnOption.description}
          </p>
        )}
      </div>

      {/* Add Icon */}
      <Plus className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Button>
  );
}

/**
 * Modern Add Filter Dropdown Component
 */
export function ModernAddFilterDropdown({
  columnsConfig,
  onAddFilter,
  existingFilterColumnIds = [],
  recentColumns = [],
  popularColumns = [],
  className,
  size = "md",
  variant = "default",
  disabled = false,
  placeholder,
}: ModernAddFilterDropdownProps) {
  const { t } = useTranslations();
  const triggerLabel = placeholder ?? t("filters.add");
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [_selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("popular");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Convert config to column options
  const columnOptions = useMemo<ColumnOption[]>(() => {
    return Object.entries(columnsConfig)
      .filter(([_, config]) => config.filterable !== false)
      .map(([columnId, config]) => ({
        id: columnId,
        label: columnId,
        type: config.type,
        description: config.placeholder,
        isRecent: recentColumns.includes(columnId),
        isPopular: popularColumns.includes(columnId),
        isFilterable: config.filterable !== false,
        category: config.type === "multiOption" ? "option" : config.type,
      }));
  }, [columnsConfig, recentColumns, popularColumns]);

  // Filter and categorize options
  const filteredOptions = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const available = columnOptions.filter(
      (option) =>
        !existingFilterColumnIds.includes(option.id) &&
        (searchTerm === "" ||
          option.label.toLowerCase().includes(searchLower) ||
          option.description?.toLowerCase().includes(searchLower))
    );

    // Organize by tabs
    const popularOptions = available.filter((opt) => opt.isPopular).slice(0, 6);
    const recentOptions = available
      .filter((opt) => opt.isRecent && !opt.isPopular)
      .slice(0, 6);

    // Group by data type for "All" tab
    const byType = available.reduce(
      (acc, option) => {
        const category = option.category || option.type;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(option);
        return acc;
      },
      {} as Record<string, ColumnOption[]>
    );

    return {
      popular: popularOptions,
      recent: recentOptions,
      all: byType,
      search: searchTerm ? available : [],
    };
  }, [columnOptions, existingFilterColumnIds, searchTerm]);

  // Handle column selection
  const handleSelectColumn = (option: ColumnOption) => {
    onAddFilter(option.id, option.type);
    setIsOpen(false);
    setSearchTerm("");
    setSelectedIndex(0);
  };

  // Handle popover state changes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchTerm("");
      setSelectedIndex(0);
    }
  };

  // Size variants
  const sizeClasses = {
    sm: "h-7 px-2 text-xs",
    md: "h-8 px-3 text-sm",
    lg: "h-10 px-4 text-base",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Popover onOpenChange={handleOpenChange} open={isOpen}>
      <PopoverTrigger>
        <Button
          className={cn(
            "transition-all duration-200",
            sizeClasses[size],
            "hover:shadow-sm",
            className
          )}
          disabled={disabled}
          size="sm"
          type="button"
          variant={variant}
        >
          <Plus className={cn("mr-1", iconSizes[size])} />
          {triggerLabel}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-auto min-w-80 max-w-96 p-0"
        side="bottom"
        sideOffset={4}
      >
        <div className="border-border border-b p-3">
          {/* Search Header */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="h-auto border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={translateWithFallback(
                t,
                "filters.advanced.search_columns",
                "Search columns..."
              )}
              ref={searchInputRef}
              value={searchTerm}
            />
          </div>
        </div>

        {searchTerm ? (
          // Search Results
          <div className="max-h-80 overflow-y-auto">
            <div className="p-2">
              {filteredOptions.search.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Filter className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">
                    {translateWithFallback(
                      t,
                      "filters.advanced.no_columns_found",
                      "No columns found"
                    )}
                  </p>
                  <p className="text-xs">
                    {translateWithFallback(
                      t,
                      "filters.advanced.try_different_search",
                      "Try a different search term"
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredOptions.search.map((option) => (
                    <ColumnOptionItem
                      key={option.id}
                      onSelect={handleSelectColumn}
                      option={option}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Tabbed Interface
          <Tabs
            className="w-full"
            onValueChange={setActiveTab}
            value={activeTab}
          >
            <div className="border-border border-b px-3">
              <TabsList className="grid h-8 w-full grid-cols-3">
                <TabsTrigger className="text-xs" value="popular">
                  <Star className="mr-1 h-3 w-3" />
                  {translateWithFallback(
                    t,
                    "filters.add_menu.popular",
                    "Popular"
                  )}
                </TabsTrigger>
                <TabsTrigger className="text-xs" value="recent">
                  <Clock className="mr-1 h-3 w-3" />
                  {translateWithFallback(
                    t,
                    "filters.add_menu.recent",
                    "Recent"
                  )}
                </TabsTrigger>
                <TabsTrigger className="text-xs" value="all">
                  <Filter className="mr-1 h-3 w-3" />
                  {translateWithFallback(t, "filters.add_menu.all", "All")}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <TabsContent className="m-0 p-2" value="popular">
                {filteredOptions.popular.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <Star className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    <p className="text-sm">
                      {translateWithFallback(
                        t,
                        "filters.advanced.no_popular_filters",
                        "No popular filters"
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredOptions.popular.map((option) => (
                      <ColumnOptionItem
                        key={option.id}
                        onSelect={handleSelectColumn}
                        option={option}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent className="m-0 p-2" value="recent">
                {filteredOptions.recent.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <Clock className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    <p className="text-sm">
                      {translateWithFallback(
                        t,
                        "filters.advanced.no_recent_filters",
                        "No recent filters"
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredOptions.recent.map((option) => (
                      <ColumnOptionItem
                        key={option.id}
                        onSelect={handleSelectColumn}
                        option={option}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent className="m-0 p-2" value="all">
                {Object.keys(filteredOptions.all).length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <Filter className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    <p className="text-sm">
                      {translateWithFallback(
                        t,
                        "filters.advanced.no_columns_available",
                        "No columns available"
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(filteredOptions.all).map(
                      ([categoryKey, options], index) => {
                        const category =
                          categories[categoryKey as keyof typeof categories];
                        const CategoryIcon = category?.icon || Filter;

                        return (
                          <div key={categoryKey}>
                            {index > 0 && <Separator className="my-2" />}

                            {/* Category Header */}
                            <div className="mb-2 flex items-center gap-2 px-2 py-1">
                              <CategoryIcon
                                className={cn(
                                  "h-3 w-3",
                                  category?.color || "text-muted-foreground"
                                )}
                              />
                              <span className="font-medium text-muted-foreground text-xs">
                                {category
                                  ? translateWithFallback(
                                      t,
                                      category.labelKey,
                                      category.label
                                    )
                                  : categoryKey}
                              </span>
                              <Badge
                                className="h-4 text-xs"
                                variant="secondary"
                              >
                                {options.length}
                              </Badge>
                            </div>

                            {/* Category Options */}
                            <div className="space-y-1">
                              {options.map((option) => (
                                <ColumnOptionItem
                                  key={option.id}
                                  onSelect={handleSelectColumn}
                                  option={option}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Footer */}
        <div className="border-border border-t p-2">
          <p className="text-center text-muted-foreground text-xs">
            {searchTerm
              ? translateWithFallback(
                  t,
                  "filters.add_menu.clear_search_hint",
                  "Press Esc to clear search"
                )
              : translateWithFallback(
                  t,
                  "filters.add_menu.navigate_hint",
                  "Use tabs to navigate categories"
                )}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Quick Add Filter Button - simplified version
 */
export function QuickAddFilterButton({
  onAddFilter,
  availableColumns,
  className,
}: {
  onAddFilter: (columnId: string, type: ColumnDataType) => void;
  availableColumns: Array<{ id: string; type: ColumnDataType; label: string }>;
  className?: string;
}) {
  const { t } = useTranslations();
  // Show first available column as quick add
  const firstAvailable = availableColumns[0];

  if (!firstAvailable) {
    return null;
  }

  return (
    <Button
      className={cn(
        "h-8 px-2 text-muted-foreground text-xs hover:text-foreground",
        "border border-border border-dashed hover:border-solid hover:bg-accent",
        "transition-all duration-200",
        className
      )}
      onClick={() => onAddFilter(firstAvailable.id, firstAvailable.type)}
      size="sm"
      variant="ghost"
    >
      <Plus className="mr-1 h-3 w-3" />
      {translateWithFallback(t, "filters.advanced.add_column", "Add {column}", {
        column: firstAvailable.label,
      })}
    </Button>
  );
}
