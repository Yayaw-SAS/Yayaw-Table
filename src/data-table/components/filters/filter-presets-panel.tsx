/**
 * Filter Presets Panel - Phase 5 Advanced Features
 * Modern UI for managing, organizing, and sharing filter presets
 */
"use client"

import React, { useState, useMemo, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
    Save,
    Search,
    Star,
    StarOff,
    Share2,
    Download,
    Upload,
    MoreHorizontal,
    Copy,
    Edit,
    Trash2,
    Clock,
    TrendingUp,
    Bookmark,
    Filter,
    Tag,
    Users,
    Eye,
    Settings,
    Sparkles
} from "lucide-react"

import type { FilterPreset, AdvancedFilterState } from '../../types/advanced-filter-types'
import type { UseFilterPresetsReturn } from '../../hooks/use-filter-presets'

interface FilterPresetsPanelProps {
    /** Current filter state */
    currentState?: AdvancedFilterState
    /** Presets hook return */
    presets: UseFilterPresetsReturn
    /** Callback when preset is loaded */
    onLoadPreset?: (state: AdvancedFilterState) => void
    /** Whether the panel is in compact mode */
    compact?: boolean
    /** Custom className */
    className?: string
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
    isPopular
}: {
    preset: FilterPreset
    onLoad: () => void
    onEdit: () => void
    onDelete: () => void
    onDuplicate: () => void
    onShare: () => void
    onToggleFavorite: () => void
    isFavorite: boolean
    isRecent: boolean
    isPopular: boolean
}) {
    return (
        <div className="group relative border rounded-lg p-4 hover:bg-accent/50 transition-colors">
            {/* Preset header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {preset.icon && (
                        <span className="text-lg" title={preset.name}>
                            {preset.icon}
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm truncate">{preset.name}</h4>
                        {preset.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
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
                            <Star className="h-3 w-3 text-amber-500 fill-current" />
                        )}
                        {isRecent && (
                            <Clock className="h-3 w-3 text-blue-500" />
                        )}
                        {isPopular && (
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                        )}
                        {preset.isSystem && (
                            <Settings className="h-3 w-3 text-muted-foreground" />
                        )}
                        {preset.isPublic && (
                            <Users className="h-3 w-3 text-muted-foreground" />
                        )}
                    </div>

                    {/* Quick favorite toggle */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleFavorite()
                        }}
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
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <MoreHorizontal className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onShare}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDuplicate}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                            </DropdownMenuItem>
                            {!preset.isSystem && (
                                <>
                                    <DropdownMenuItem onClick={onEdit}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                        onClick={onDelete}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
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
                <div className="flex flex-wrap gap-1 mb-3">
                    {preset.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                        </Badge>
                    ))}
                    {preset.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                            +{preset.tags.length - 3}
                        </Badge>
                    )}
                </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span>Used {preset.metadata.usageCount} times</span>
                    {preset.metadata.lastUsed && (
                        <span>• Last: {preset.metadata.lastUsed.toLocaleDateString()}</span>
                    )}
                </div>
                
                {/* Load button */}
                <Button
                    size="sm"
                    onClick={onLoad}
                    className="h-6 px-2 text-xs"
                >
                    <Eye className="h-3 w-3 mr-1" />
                    Load
                </Button>
            </div>
        </div>
    )
}

/**
 * Save preset dialog
 */
function SavePresetDialog({
    currentState,
    onSave,
    isOpen,
    onOpenChange
}: {
    currentState?: AdvancedFilterState
    onSave: (options: {
        name: string
        description?: string
        tags?: string[]
        icon?: string
        color?: string
        isPublic?: boolean
    }) => Promise<void>
    isOpen: boolean
    onOpenChange: (open: boolean) => void
}) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [tags, setTags] = useState('')
    const [isPublic, setIsPublic] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const handleSave = async () => {
        if (!name.trim() || !currentState) return

        setIsSaving(true)
        try {
            await onSave({
                name,
                description: description || undefined,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                isPublic
            })
            
            // Reset form
            setName('')
            setDescription('')
            setTags('')
            setIsPublic(false)
            onOpenChange(false)
        } catch (error) {
            console.error('Failed to save preset:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const hasFilters = currentState && currentState.groups.some(group => 
        group.filters.length > 0 && group.isActive
    )

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save Filter Preset</DialogTitle>
                    <DialogDescription>
                        Save your current filter configuration for future use.
                    </DialogDescription>
                </DialogHeader>

                {!hasFilters ? (
                    <div className="text-center py-6">
                        <Filter className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">
                            No active filters to save. Add some filters first.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My awesome filter preset"
                                maxLength={100}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional description..."
                                maxLength={500}
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tags">Tags</Label>
                            <Input
                                id="tags"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="work, urgent, weekly (comma separated)"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="public"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                                className="rounded"
                            />
                            <Label htmlFor="public">Make public (visible to other users)</Label>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={!name.trim() || !hasFilters || isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Preset'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/**
 * Main filter presets panel
 */
export function FilterPresetsPanel({
    currentState,
    presets,
    onLoadPreset,
    compact = false,
    className
}: FilterPresetsPanelProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTab, setSelectedTab] = useState<'all' | 'recent' | 'popular' | 'system'>('all')
    const [saveDialogOpen, setSaveDialogOpen] = useState(false)

    // Filter presets based on search and tab
    const filteredPresets = useMemo(() => {
        let filtered = presets.presets

        // Filter by tab
        switch (selectedTab) {
            case 'recent':
                filtered = presets.recentPresets
                break
            case 'popular':
                filtered = presets.popularPresets
                break
            case 'system':
                filtered = presets.systemPresets
                break
            default:
                // 'all' - no additional filtering
                break
        }

        // Filter by search query
        if (searchQuery.trim()) {
            filtered = presets.searchPresets(searchQuery)
        }

        return filtered
    }, [presets, searchQuery, selectedTab])

    // Handle preset actions
    const handleLoadPreset = useCallback(async (presetId: string) => {
        try {
            const state = await presets.loadPreset(presetId)
            onLoadPreset?.(state)
        } catch (error) {
            console.error('Failed to load preset:', error)
        }
    }, [presets, onLoadPreset])

    const handleSavePreset = useCallback(async (options: any) => {
        if (!currentState) return
        await presets.savePreset(currentState, options)
    }, [presets, currentState])

    const handleDeletePreset = useCallback(async (presetId: string) => {
        if (confirm('Are you sure you want to delete this preset?')) {
            await presets.deletePreset(presetId)
        }
    }, [presets])

    const handleSharePreset = useCallback(async (presetId: string) => {
        try {
            const url = await presets.sharePreset(presetId)
            await navigator.clipboard.writeText(url)
            // You would show a toast notification here
        } catch (error) {
            console.error('Failed to share preset:', error)
        }
    }, [presets])

    const handleToggleFavorite = useCallback(async (presetId: string, isFavorite: boolean) => {
        await presets.setFavorite(presetId, !isFavorite)
    }, [presets])

    if (compact) {
        return (
            <div className={cn("space-y-3", className)}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Presets</h3>
                    <Button
                        size="sm"
                        onClick={() => setSaveDialogOpen(true)}
                        className="h-6 px-2 text-xs"
                    >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {filteredPresets.slice(0, 4).map((preset) => (
                        <Button
                            key={preset.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadPreset(preset.id)}
                            className="h-8 px-2 text-xs justify-start"
                        >
                            {preset.icon && <span className="mr-1">{preset.icon}</span>}
                            <span className="truncate">{preset.name}</span>
                        </Button>
                    ))}
                </div>

                <SavePresetDialog
                    currentState={currentState}
                    onSave={handleSavePreset}
                    isOpen={saveDialogOpen}
                    onOpenChange={setSaveDialogOpen}
                />
            </div>
        )
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bookmark className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Filter Presets</h2>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={() => setSaveDialogOpen(true)}
                        className="gap-1"
                    >
                        <Save className="h-4 w-4" />
                        Save Current
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <Upload className="h-4 w-4 mr-2" />
                                Import Presets
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Export All
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search presets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Tabs */}
            <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="recent">Recent</TabsTrigger>
                    <TabsTrigger value="popular">Popular</TabsTrigger>
                    <TabsTrigger value="system">System</TabsTrigger>
                </TabsList>

                <TabsContent value={selectedTab} className="mt-4">
                    <ScrollArea className="h-96">
                        {filteredPresets.length === 0 ? (
                            <div className="text-center py-12">
                                <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                                <h3 className="font-medium mb-1">No presets found</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {searchQuery 
                                        ? 'Try a different search term' 
                                        : 'Create your first preset by saving your current filters'
                                    }
                                </p>
                                {!searchQuery && (
                                    <Button onClick={() => setSaveDialogOpen(true)}>
                                        <Save className="h-4 w-4 mr-2" />
                                        Save First Preset
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredPresets.map((preset) => (
                                    <PresetCard
                                        key={preset.id}
                                        preset={preset}
                                        onLoad={() => handleLoadPreset(preset.id)}
                                        onEdit={() => {/* TODO: Edit dialog */}}
                                        onDelete={() => handleDeletePreset(preset.id)}
                                        onDuplicate={() => presets.duplicatePreset(preset.id)}
                                        onShare={() => handleSharePreset(preset.id)}
                                        onToggleFavorite={() => 
                                            handleToggleFavorite(preset.id, preset.tags.includes('favorite'))
                                        }
                                        isFavorite={preset.tags.includes('favorite')}
                                        isRecent={presets.recentPresets.some(p => p.id === preset.id)}
                                        isPopular={presets.popularPresets.some(p => p.id === preset.id)}
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
                onSave={handleSavePreset}
                isOpen={saveDialogOpen}
                onOpenChange={setSaveDialogOpen}
            />
        </div>
    )
} 