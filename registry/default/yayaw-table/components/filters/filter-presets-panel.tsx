/**
 * Filter Presets Panel - Phase 5 Advanced Features
 * Modern UI for managing, organizing, and sharing filter presets
 */
"use client";

import {
  Bookmark,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  Filter,
  MoreHorizontal,
  Save,
  Search,
  Settings,
  Share2,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { UseFilterPresetsReturn } from "../../hooks/use-filter-presets";
import type {
  AdvancedFilterState,
  FilterPreset,
} from "../../types/advanced-filter-types";

interface FilterPresetsPanelProps {
  /** Current filter state */
  currentState?: AdvancedFilterState;
  /** Presets hook return */
  presets: UseFilterPresetsReturn;
  /** Callback when preset is loaded */
  onLoadPreset?: (state: AdvancedFilterState) => void;
  /** Whether the panel is in compact mode */
  compact?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Preset card component
 */
function PresetCard({
  preset,
  onLoad,
  onEdit,
  onDelete,
  onDuplicate,
  onShare,
  onToggleFavorite,
  isFavorite,
  isRecent,
  isPopular,
}: {
  preset: FilterPreset;
  onLoad: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  isRecent: boolean;
  isPopular: boolean;
}) {
  return (
    <div className="group relative rounded-lg border p-4 transition-colors hover:bg-accent/50">
      {/* Preset header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {preset.icon && (
            <span className="text-lg" title={preset.name}>
              {preset.icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-medium text-sm">{preset.name}</h4>
            {preset.description && (
              <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                {preset.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Indicators */}
          <div className="flex gap-1">
            {isFavorite && (
              <Star className="h-3 w-3 fill-current text-amber-500" />
            )}
            {isRecent && <Clock className="h-3 w-3 text-blue-500" />}
            {isPopular && <TrendingUp className="h-3 w-3 text-emerald-500" />}
            {preset.isSystem && (
              <Settings className="h-3 w-3 text-muted-foreground" />
            )}
            {preset.isPublic && (
              <Users className="h-3 w-3 text-muted-foreground" />
            )}
          </div>

          {/* Quick favorite toggle */}
          <Button
            className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {isFavorite ? (
              <StarOff className="h-3 w-3" />
            ) : (
              <Star className="h-3 w-3" />
            )}
          </Button>

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                size="sm"
                variant="ghost"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {!preset.isSystem && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tags */}
      {preset.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {preset.tags.slice(0, 3).map((tag) => (
            <Badge className="text-xs" key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
          {preset.tags.length > 3 && (
            <Badge className="text-xs" variant="secondary">
              +{preset.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <div className="flex items-center gap-2">
          <span>Used {preset.metadata.usageCount} times</span>
          {preset.metadata.lastUsed && (
            <span>• Last: {preset.metadata.lastUsed.toLocaleDateString()}</span>
          )}
        </div>

        {/* Load button */}
        <Button
          className="h-6 px-2 text-xs"
          onClick={onLoad}
          size="sm"
          type="button"
        >
          <Eye className="mr-1 h-3 w-3" />
          Load
        </Button>
      </div>
    </div>
  );
}

/**
 * Save preset dialog
 */
function SavePresetDialog({
  currentState,
  onSave,
  isOpen,
  onOpenChange,
}: {
  currentState?: AdvancedFilterState;
  onSave: (options: {
    name: string;
    description?: string;
    tags?: string[];
    icon?: string;
    color?: string;
    isPublic?: boolean;
  }) => Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!(name.trim() && currentState)) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name,
        description: description || undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        isPublic,
      });

      // Reset form
      setName("");
      setDescription("");
      setTags("");
      setIsPublic(false);
      onOpenChange(false);
    } catch (_error) {
      // Error handling can be added here if needed
    } finally {
      setIsSaving(false);
    }
  };

  const hasFilters = currentState?.groups.some(
    (group) => group.filters.length > 0 && group.isActive
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Filter Preset</DialogTitle>
          <DialogDescription>
            Save your current filter configuration for future use.
          </DialogDescription>
        </DialogHeader>

        {hasFilters ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder="My awesome filter preset"
                value={name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                value={description}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                onChange={(e) => setTags(e.target.value)}
                placeholder="work, urgent, weekly (comma separated)"
                value={tags}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                checked={isPublic}
                className="rounded"
                id="public"
                onChange={(e) => setIsPublic(e.target.checked)}
                type="checkbox"
              />
              <Label htmlFor="public">
                Make public (visible to other users)
              </Label>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground text-sm">
              No active filters to save. Add some filters first.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!(name.trim() && hasFilters) || isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save Preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Main filter presets panel
 */
export function FilterPresetsPanel({
  currentState,
  presets,
  onLoadPreset,
  compact = false,
  className,
}: FilterPresetsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [presetIdToDelete, setPresetIdToDelete] = useState<null | string>(null);
  const [selectedTab, setSelectedTab] = useState<
    "all" | "recent" | "popular" | "system"
  >("all");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Filter presets based on search and tab
  const filteredPresets = useMemo(() => {
    let filtered = presets.presets;

    // Filter by tab
    switch (selectedTab) {
      case "recent":
        filtered = presets.recentPresets;
        break;
      case "popular":
        filtered = presets.popularPresets;
        break;
      case "system":
        filtered = presets.systemPresets;
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = presets.searchPresets(searchQuery);
    }

    return filtered;
  }, [presets, searchQuery, selectedTab]);

  // Handle preset actions
  const handleLoadPreset = useCallback(
    async (presetId: string) => {
      try {
        const state = await presets.loadPreset(presetId);
        onLoadPreset?.(state);
      } catch (_error) {
        // Error handling can be added here if needed
      }
    },
    [presets, onLoadPreset]
  );

  const handleSavePreset = useCallback(
    async (options: {
      name: string;
      description?: string;
      isPublic?: boolean;
      tags?: string[];
      icon?: string;
      color?: string;
    }) => {
      if (!currentState) {
        return;
      }
      await presets.savePreset(currentState, options);
    },
    [presets, currentState]
  );

  const handleDeletePresetClick = useCallback((presetId: string) => {
    setPresetIdToDelete(presetId);
  }, []);

  const handleConfirmDeletePreset = useCallback(async () => {
    if (presetIdToDelete) {
      await presets.deletePreset(presetIdToDelete);
      setPresetIdToDelete(null);
    }
  }, [presets, presetIdToDelete]);

  const handleCancelDeletePreset = useCallback(() => {
    setPresetIdToDelete(null);
  }, []);

  const handleSharePreset = useCallback(
    async (presetId: string) => {
      try {
        const url = await presets.sharePreset(presetId);
        await navigator.clipboard.writeText(url);
        // You would show a toast notification here
      } catch (_error) {
        // Error handling can be added here if needed
      }
    },
    [presets]
  );

  const handleToggleFavorite = useCallback(
    async (presetId: string, isFavorite: boolean) => {
      await presets.setFavorite(presetId, !isFavorite);
    },
    [presets]
  );

  if (compact) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Presets</h3>
          <Button
            className="h-6 px-2 text-xs"
            onClick={() => setSaveDialogOpen(true)}
            size="sm"
          >
            <Save className="mr-1 h-3 w-3" />
            Save
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {filteredPresets.slice(0, 4).map((preset) => (
            <Button
              className="h-8 justify-start px-2 text-xs"
              key={preset.id}
              onClick={() => handleLoadPreset(preset.id)}
              size="sm"
              variant="outline"
            >
              {preset.icon && <span className="mr-1">{preset.icon}</span>}
              <span className="truncate">{preset.name}</span>
            </Button>
          ))}
        </div>

        <SavePresetDialog
          currentState={currentState}
          isOpen={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          onSave={handleSavePreset}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPresetIdToDelete(null);
          }
        }}
        open={presetIdToDelete !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this preset? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDeletePreset}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeletePreset}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-lg">Filter Presets</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="gap-1"
            onClick={() => setSaveDialogOpen(true)}
            size="sm"
          >
            <Save className="h-4 w-4" />
            Save Current
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Upload className="mr-2 h-4 w-4" />
                Import Presets
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Export All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search presets..."
          value={searchQuery}
        />
      </div>

      {/* Tabs */}
      <Tabs
        onValueChange={(value) =>
          setSelectedTab(value as "all" | "recent" | "popular" | "system")
        }
        value={selectedTab}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value={selectedTab}>
          <ScrollArea className="h-96">
            {filteredPresets.length === 0 ? (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-50" />
                <h3 className="mb-1 font-medium">No presets found</h3>
                <p className="mb-4 text-muted-foreground text-sm">
                  {searchQuery
                    ? "Try a different search term"
                    : "Create your first preset by saving your current filters"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setSaveDialogOpen(true)}>
                    <Save className="mr-2 h-4 w-4" />
                    Save First Preset
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPresets.map((preset) => (
                  <PresetCard
                    isFavorite={preset.tags.includes("favorite")}
                    isPopular={presets.popularPresets.some(
                      (p) => p.id === preset.id
                    )}
                    isRecent={presets.recentPresets.some(
                      (p) => p.id === preset.id
                    )}
                    key={preset.id}
                    onDelete={() => handleDeletePresetClick(preset.id)}
                    onDuplicate={() => presets.duplicatePreset(preset.id)}
                    onEdit={() => {
                      /* TODO: Edit dialog */
                    }}
                    onLoad={() => handleLoadPreset(preset.id)}
                    onShare={() => handleSharePreset(preset.id)}
                    onToggleFavorite={() =>
                      handleToggleFavorite(
                        preset.id,
                        preset.tags.includes("favorite")
                      )
                    }
                    preset={preset}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Save dialog */}
      <SavePresetDialog
        currentState={currentState}
        isOpen={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSavePreset}
      />
    </div>
  );
}
