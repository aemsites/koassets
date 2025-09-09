import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FacetCheckedState, FacetsProps, SavedSearch, SearchResult } from '../types';
import DateRange, { DateRangeRef } from './DateRange';
import './Facets.css';

interface ExpandedFacetsState {
    [key: string]: boolean;
}

const HIERARCHY_PREFIX = 'TCCC.#hierarchy.lvl';

// Local storage functions for saved searches
const loadSavedSearches = (): SavedSearch[] => {
    try {
        const saved = localStorage.getItem('koassets-saved-searches');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Error loading saved searches:', error);
        return [];
    }
};

const saveSavedSearches = (searches: SavedSearch[]): void => {
    try {
        localStorage.setItem('koassets-saved-searches', JSON.stringify(searches));
    } catch (error) {
        console.error('Error saving searches:', error);
    }
};

const Facets: React.FC<FacetsProps> = ({
    searchResults,
    selectedFacetFilters,
    setSelectedFacetFilters,
    search,
    excFacets = {},
    selectedNumericFilters = [],
    setSelectedNumericFilters,
    query,
    setQuery
}) => {
    const [expandedFacets, setExpandedFacets] = useState<ExpandedFacetsState>({}); // Keep track of expanded facets (from EXC)
    const [expandedHierarchyItems, setExpandedHierarchyItems] = useState<ExpandedFacetsState>({}); // Keep track of expanded hierarchy items
    const [facetSearchMode, setFacetSearchMode] = useState<ExpandedFacetsState>({}); // Keep track of search mode for each facet
    const [facetSearchTerms, setFacetSearchTerms] = useState<{ [key: string]: string }>({}); // Keep track of search terms for each facet
    const [checked, setChecked] = useState<FacetCheckedState>({}); // Keep track of checked state of facets and nested facets if any
    const [dateRanges, setDateRanges] = useState<{ [key: string]: [number | undefined, number | undefined] }>({});
    const dateRangeRef = useRef<DateRangeRef>(null);
    const isUpdatingFromExternalRef = useRef(false);

    // Saved search functionality state
    const [activeView, setActiveView] = useState<'filters' | 'saved'>('filters');
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches());
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveSearchName, setSaveSearchName] = useState('');

    // Memoized combined facets computation - merges facets from all search results
    const combinedFacets = useMemo((): SearchResult['facets'] => {
        const combined: SearchResult['facets'] = {};

        // Merge facets from all search results
        searchResults?.forEach(searchResult => {
            if (searchResult.facets) {
                Object.entries(searchResult.facets).forEach(([key, facetData]) => {
                    if (!combined[key]) {
                        combined[key] = {};
                    }
                    Object.entries(facetData as { [key: string]: number }).forEach(([facetName, count]) => {
                        combined[key]![facetName] = count;
                    });
                });
            }
        });

        return combined;
    }, [searchResults]);

    // Clean up checked state when facets are no longer available or have zero counts
    useEffect(() => {
        setChecked(prevChecked => {
            const updatedChecked = { ...prevChecked };
            let hasChanges = false;

            // For each entry of checked of (facetTechId, value)
            Object.entries(prevChecked).forEach(([facetTechId, value]) => {
                // For each entry of value of (facetName, isChecked)
                Object.entries(value).forEach(([facetName, isChecked]) => {
                    // If facetTechId not in combinedFacets.keys or facetName not in combinedFacets[facetTechId] or combinedFacets[facetTechId][facetName] === 0
                    if (!combinedFacets ||
                        !(facetTechId in combinedFacets) ||
                        !(facetName in (combinedFacets[facetTechId] || {})) ||
                        (combinedFacets[facetTechId] && combinedFacets[facetTechId][facetName] === 0)) {
                        // Set checked[facetTechId][facetName] to false
                        if (isChecked) {
                            updatedChecked[facetTechId] = {
                                ...updatedChecked[facetTechId],
                                [facetName]: false
                            };
                            hasChanges = true;
                        }
                    }
                });
            });

            return hasChanges ? updatedChecked : prevChecked;
        });
    }, [combinedFacets]);

    // Memoized hierarchy data computation for all facets
    const hierarchyDataByFacet = useMemo(() => {
        const hierarchyMap: { [facetTechId: string]: { [level: number]: { [key: string]: number } } } = {};

        Object.keys(excFacets).forEach(facetTechId => {
            // Check if this is a hierarchy facet by looking for hierarchy keys in search results
            const isHierarchyFacet = Object.keys(combinedFacets || {}).some(key =>
                key.startsWith(`${facetTechId}.${HIERARCHY_PREFIX}`)
            );

            if (isHierarchyFacet) {
                const hierarchyData: { [level: number]: { [key: string]: number } } = {};

                // Collect all hierarchy levels for this facet
                Object.keys(combinedFacets || {}).forEach(key => {
                    if (key.startsWith(`${facetTechId}.${HIERARCHY_PREFIX}`)) {
                        // Extract level number from key like "tccc-brand.TCCC.#hierarchy.lvl0"
                        const levelMatch = key.match(/\.lvl(\d+)$/);
                        if (levelMatch) {
                            const level = parseInt(levelMatch[1]);
                            hierarchyData[level] = (combinedFacets && combinedFacets[key]) as { [key: string]: number };
                        }
                    }
                });

                hierarchyMap[facetTechId] = hierarchyData;
            }
        });

        return hierarchyMap;
    }, [combinedFacets, excFacets]);

    const toggle = useCallback((key: string) => {
        setExpandedFacets(prev => {
            const newExpanded = { ...prev, [key]: !prev[key] };

            // If we're collapsing the facet (was expanded, now collapsed), close search mode and clear search terms
            if (prev[key] && !newExpanded[key]) {
                setFacetSearchMode(prevSearch => ({ ...prevSearch, [key]: false }));
                setFacetSearchTerms(prevTerms => ({ ...prevTerms, [key]: '' }));
            }

            return newExpanded;
        });
    }, []);

    const toggleHierarchyItem = useCallback((key: string, facetTechId: string, fullPath: string, hierarchyData: { [level: number]: { [key: string]: number } }) => {
        setExpandedHierarchyItems(prev => {
            const newExpanded = { ...prev };
            const isCurrentlyExpanded = prev[key];

            // Toggle the current item
            newExpanded[key] = !isCurrentlyExpanded;

            // If we're collapsing (was expanded, now collapsed), recursively collapse all children
            if (isCurrentlyExpanded && !newExpanded[key]) {
                // Find and collapse all descendant items
                const collapseDescendants = (parentPath: string, startLevel: number) => {
                    // Go through all levels starting from the next level
                    for (let level = startLevel + 1; level < 10; level++) { // Assume max 10 levels
                        const levelData = hierarchyData[level];
                        if (!levelData) continue;

                        Object.keys(levelData).forEach(facetName => {
                            // Check if this item is a descendant of the parent
                            if (facetName.startsWith(parentPath + ' / ')) {
                                const descendantKey = `${facetTechId}-${facetName}`;
                                newExpanded[descendantKey] = false;
                            }
                        });
                    }
                };

                // Find the level of the current item by checking hierarchy data
                let currentLevel = 1;
                for (let level = 1; level < 10; level++) {
                    const levelData = hierarchyData[level];
                    if (levelData && levelData[fullPath] !== undefined) {
                        currentLevel = level;
                        break;
                    }
                }

                collapseDescendants(fullPath, currentLevel);
            }

            return newExpanded;
        });
    }, []);

    const toggleFacetSearch = useCallback((facetTechId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setFacetSearchMode(prev => ({ ...prev, [facetTechId]: !prev[facetTechId] }));
        // Clear search term when exiting search mode
        if (facetSearchMode[facetTechId]) {
            setFacetSearchTerms(prev => ({ ...prev, [facetTechId]: '' }));
        }
    }, [facetSearchMode]);

    const handleFacetSearchChange = useCallback((facetTechId: string, searchTerm: string) => {
        setFacetSearchTerms(prev => ({ ...prev, [facetTechId]: searchTerm }));
    }, []);

    // Handler for checkbox change
    const handleCheckbox = useCallback((key: string, facet: string) => {
        setChecked(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [facet]: !prev[key]?.[facet]
            }
        }));
    }, []);

    // Handler for date range change
    const handleDateRangeChange = useCallback((key: string, startDate: Date | undefined, endDate: Date | undefined) => {
        setDateRanges(prev => ({
            ...prev,
            [key]: [startDate ? startDate.getTime() / 1000 : undefined, endDate ? endDate.getTime() / 1000 : undefined]
        }));
    }, []);

    // Memoized function to render hierarchy levels
    const renderHierarchyLevel = useCallback((
        hierarchyData: { [level: number]: { [key: string]: number } },
        facetTechId: string,
        level: number,
        parentPath: string = ''
    ): React.ReactNode[] => {
        const levelData = hierarchyData[level];
        if (!levelData) return [];

        const searchTerm = facetSearchTerms[facetTechId] || '';
        const items: React.ReactNode[] = [];

        Object.entries(levelData).forEach(([facetName, count]) => {
            // Extract the last part of the hierarchy path for display
            const pathParts = facetName.split(' / ');
            const displayName = pathParts[pathParts.length - 1].trim();

            // Filter based on search term
            if (searchTerm && !displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
                return; // Skip this item if it doesn't match search
            }

            // Only show items that match the parent path or are at the starting level (level 1)
            const currentPath = pathParts.slice(0, -1).join(' / ');
            if (level === 1 || currentPath === parentPath) {
                const fullPath = facetName;
                const itemKey = `${facetTechId}-${facetName}`;

                // Check if this item has sub-levels
                const hasSubLevels = hierarchyData[level + 1] &&
                    Object.keys(hierarchyData[level + 1]).some(subFacetName =>
                        subFacetName.startsWith(fullPath + ' / ')
                    );

                // Apply CSS classes based on level and sub-levels
                const containerClasses = [
                    'facet-hierarchy-container',
                    level > 1 ? 'facet-hierarchy-container-indented' : '',
                    hasSubLevels ? 'facet-hierarchy-container-with-sublevel' : ''
                ].filter(Boolean).join(' ');

                const checkboxKey = `${facetTechId}.${HIERARCHY_PREFIX}${level}`;
                const hierarchyItemKey = `${facetTechId}-${fullPath}`;
                const isHierarchyItemExpanded = expandedHierarchyItems[hierarchyItemKey];

                items.push(
                    <div key={itemKey} className={containerClasses}>
                        <div className="facet-filter-checkbox-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <label className="facet-filter-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer', flex: 1 }}>
                                <input
                                    className="facet-filter-checkbox-input"
                                    type="checkbox"
                                    checked={!!checked[checkboxKey]?.[facetName]}
                                    onChange={() => handleCheckbox(checkboxKey, facetName)}
                                /> {displayName}{count > 0 ? ` (${count})` : ''}
                            </label>
                            {hasSubLevels && (
                                <span
                                    className="facet-filter-arrow-sub-level"
                                    onClick={() => toggleHierarchyItem(hierarchyItemKey, facetTechId, fullPath, hierarchyData)}
                                >
                                    {isHierarchyItemExpanded ? '▼' : '▶'}
                                </span>
                            )}
                        </div>
                        {/* Render child levels only if expanded */}
                        {hasSubLevels && isHierarchyItemExpanded && renderHierarchyLevel(hierarchyData, facetTechId, level + 1, fullPath)}
                    </div>
                );
            }
        });

        return items;
    }, [checked, handleCheckbox, expandedHierarchyItems, toggleHierarchyItem, facetSearchTerms]);

    /**
     * Renders the facet checkboxes from search results
     * @param facetTechId - The technical ID of the facet
     * @returns JSX element with facet checkboxes or null
     */
    const renderFacetsFromSearchResult = useCallback((facetTechId: string) => {
        if (!expandedFacets[facetTechId]) {
            return null;
        }

        // Render date range for date facet
        if (facetTechId === 'repo-createDate') {
            return <DateRange
                ref={dateRangeRef}
                selectedNumericFilters={selectedNumericFilters}
                onDateRangeChange={(startDate, endDate) => handleDateRangeChange(facetTechId, startDate, endDate)}
            />;
        }

        // Update checked state with new combined facets


        // Get hierarchy data for this facet if it exists
        const hierarchyData = hierarchyDataByFacet[facetTechId];
        const isHierarchyFacet = !!hierarchyData;

        // Render hierarchy facets
        if (isHierarchyFacet) {
            return (
                <div className="facet-filter-checkbox-list">
                    {renderHierarchyLevel(hierarchyData, facetTechId, 1)}
                </div>
            );
        }

        // Render non-hierarchy facets
        if (!expandedFacets[facetTechId] || !combinedFacets || !combinedFacets[facetTechId] || Object.keys(combinedFacets[facetTechId] || {}).length === 0) {
            return null;
        }

        const searchTerm = facetSearchTerms[facetTechId] || '';
        const checkboxKey = `${facetTechId}`;

        // Filter facet entries based on search term
        const filteredEntries = Object.entries((combinedFacets && combinedFacets[facetTechId]) || {})
            .filter(([facetName]) => {
                if (!searchTerm) return true;
                return facetName.toLowerCase().includes(searchTerm.toLowerCase());
            });

        return (
            <div className="facet-filter-checkbox-list">
                {filteredEntries.map(([facetName, count]) => (
                    <label key={facetName} className="facet-filter-checkbox-label">
                        <input
                            type="checkbox"
                            checked={!!checked[checkboxKey]?.[facetName]}
                            onChange={() => handleCheckbox(checkboxKey, facetName)}
                        /> {facetName}{count > 0 ? ` (${count})` : ''}
                    </label>
                ))}
            </div>
        );
    }, [expandedFacets, selectedNumericFilters, handleDateRangeChange, hierarchyDataByFacet, renderHierarchyLevel, combinedFacets, checked, handleCheckbox, facetSearchTerms]);

    // Transform the checked object into an array of facet filters
    useEffect(() => {
        // Skip if we're currently updating from external source (like URL params)
        if (isUpdatingFromExternalRef.current) {
            isUpdatingFromExternalRef.current = false;
            return;
        }

        const newSelectedFacetFilters: string[][] = [];
        Object.keys(checked).forEach(key => {
            const facetFilter: string[] = [];
            Object.entries(checked[key]).forEach(([facet, isChecked]) => {
                if (isChecked) {
                    facetFilter.push(`${key}:${facet}`);
                }
            });
            facetFilter.length > 0 && newSelectedFacetFilters.push(facetFilter);
        });
        setSelectedFacetFilters(newSelectedFacetFilters);
    }, [checked, setSelectedFacetFilters]);

    // Convert date ranges to numeric filters for search
    useEffect(() => {
        if (Object.keys(dateRanges).length > 0) {
            // Use setTimeout to defer the numeric filters update
            setTimeout(() => {
                setSelectedNumericFilters(Object.entries(dateRanges).flatMap(([key, value]) => {
                    const filters = [];
                    if (value[0] !== undefined) {
                        filters.push(`${key} >= ${value[0]}`);
                    }
                    if (value[1] !== undefined) {
                        filters.push(`${key} <= ${value[1]}`);
                    }
                    return filters;
                }));
            }, 0);
        }
        // Note: When dateRanges is empty, we don't call setSelectedNumericFilters([])
        // because handleClearAllChecks handles this directly to avoid double searches
    }, [dateRanges, setSelectedNumericFilters]);

    // Sync internal checked state when selectedFacetFilters changes (e.g., from URL parameters)
    useEffect(() => {
        if (selectedFacetFilters !== undefined) {
            const newChecked: FacetCheckedState = {};

            if (selectedFacetFilters.length > 0) {
                selectedFacetFilters.forEach((filterGroup: string[]) => {
                    filterGroup.forEach((filter: string) => {
                        const [key, value] = filter.split(':');
                        if (key && value) {
                            if (!newChecked[key]) {
                                newChecked[key] = {};
                            }
                            newChecked[key][value] = true;
                        }
                    });
                });
            }

            // Set flag to indicate we're updating from external source
            isUpdatingFromExternalRef.current = true;
            setChecked(newChecked);
        }
    }, [selectedFacetFilters]);

    // Count checked facets for a specific facetTechId
    const getCheckedCount = useCallback((facetTechId: string): number => {
        let count = 0;
        Object.entries(checked).forEach(([key, facetChecked]) => {
            if (key === facetTechId || key.startsWith(`${facetTechId}.`)) {
                Object.values(facetChecked).forEach(isChecked => {
                    if (isChecked) count++;
                });
            }
        });
        return count;
    }, [checked]);

    // Count all checked facets across all categories
    const getTotalCheckedCount = useCallback((): number => {
        let totalCount = 0;
        Object.values(checked).forEach(facetChecked => {
            Object.values(facetChecked).forEach(isChecked => {
                if (isChecked) totalCount++;
            });
        });
        return totalCount;
    }, [checked]);

    const handleClearAllChecks = useCallback(() => {
        isUpdatingFromExternalRef.current = true;
        setChecked({});
        setSelectedFacetFilters([]);
        setDateRanges({});
        setExpandedFacets({}); // Collapse all facets
        setExpandedHierarchyItems({}); // Collapse all hierarchy items
        setFacetSearchMode({}); // Exit all search modes
        setFacetSearchTerms({}); // Clear all search terms
        setSelectedNumericFilters([]);
        dateRangeRef.current?.reset();
    }, [setSelectedFacetFilters, setSelectedNumericFilters]);

    const handleApplyFilters = useCallback(() => {
        search();
    }, [search]);

    // Save search functionality
    const handleSaveSearch = () => {
        setShowSaveModal(true);
    };

    const handleSaveSearchConfirm = () => {
        if (saveSearchName.trim()) {
            const facetFilterGroups = Object.keys(checked).map(key => {
                const facetFilter: string[] = [];
                Object.entries(checked[key]).forEach(([facet, isChecked]) => {
                    if (isChecked) {
                        facetFilter.push(`${key}:${facet}`);
                    }
                });
                return facetFilter;
            }).filter(filter => filter.length > 0);

            const now = Date.now();
            const newSearch: SavedSearch = {
                id: now.toString(),
                name: saveSearchName.trim(),
                searchTerm: query,
                facetFilters: [...facetFilterGroups],
                numericFilters: [...selectedNumericFilters],
                dateCreated: now,
                dateLastModified: now,
                dateLastUsed: now,
                favorite: false
            };

            const updatedSearches = [...savedSearches, newSearch];
            setSavedSearches(updatedSearches);
            saveSavedSearches(updatedSearches);

            // Show success toast notification
            ToastQueue.positive('SEARCH SAVED SUCCESSFULLY', { timeout: 3000 });

            setSaveSearchName('');
            setShowSaveModal(false);
        }
    };

    const handleSaveSearchCancel = () => {
        setSaveSearchName('');
        setShowSaveModal(false);
    };

    const handleLoadSavedSearch = (savedSearch: SavedSearch) => {
        // Dismiss any open tooltip
        handleHideTooltip();

        // Reset current filters
        setChecked({});
        setDateRanges({});
        setExpandedFacets({});
        setExpandedHierarchyItems({});
        setFacetSearchMode({});
        setFacetSearchTerms({});

        // Load saved facet filters
        const newChecked: FacetCheckedState = {};
        savedSearch.facetFilters.forEach((filterGroup: string[]) => {
            filterGroup.forEach((filter: string) => {
                const [key, value] = filter.split(':');
                if (!newChecked[key]) {
                    newChecked[key] = {};
                }
                newChecked[key][value] = true;
            });
        });

        // Load saved search term FIRST and ensure it's set before other updates
        const searchTerm = savedSearch.searchTerm || '';
        setQuery(searchTerm);

        // Use setTimeout to ensure query state update is processed before filter updates
        // This fixes the issue in block integration mode where state updates might be batched differently
        setTimeout(() => {
            // Set flag to indicate we're updating from saved search loading
            isUpdatingFromExternalRef.current = true;
            setChecked(newChecked);

            // Then update filters - this will trigger the auto-search useEffect in MainApp
            // which will use the updated query state
            setSelectedFacetFilters(savedSearch.facetFilters);
            setSelectedNumericFilters(savedSearch.numericFilters);

            // Switch back to filters view
            setActiveView('filters');

            // Update last used timestamp
            const now = Date.now();
            const usedUpdated = savedSearches.map(s => s.id === savedSearch.id ? { ...s, dateLastUsed: now } : s);
            setSavedSearches(usedUpdated);
            saveSavedSearches(usedUpdated);
        }, 0);
    };

    const handleDeleteSavedSearch = (searchId: string) => {
        const searchToDelete = savedSearches.find(s => s.id === searchId);
        const searchName = searchToDelete?.name || 'this saved search';

        setDeleteSearchId(searchId);
        setDeleteSearchName(searchName);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = () => {
        if (deleteSearchId) {
            const updatedSearches = savedSearches.filter(s => s.id !== deleteSearchId);
            setSavedSearches(updatedSearches);
            saveSavedSearches(updatedSearches);

            // Show success toast notification
            ToastQueue.positive('SAVED SEARCH DELETED SUCCESSFULLY', { timeout: 3000 });
        }
        setShowDeleteModal(false);
        setDeleteSearchId(null);
        setDeleteSearchName('');
    };

    const handleCancelDelete = () => {
        setShowDeleteModal(false);
        setDeleteSearchId(null);
        setDeleteSearchName('');
    };

    // Tooltip handlers
    const handleShowTooltip = (searchId: string, event: React.MouseEvent) => {
        setHoveredSearchId(searchId);
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
        });
    };

    const handleHideTooltip = () => {
        setHoveredSearchId(null);
    };

    // Format last used date
    const formatLastUsed = (timestamp?: number): string => {
        if (!timestamp) return 'Never used';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    // Count total filters in saved search
    const countFilters = (savedSearch: SavedSearch): number => {
        const facetFilterCount = savedSearch.facetFilters.reduce((total, filterGroup) => total + filterGroup.length, 0);
        const numericFilterCount = savedSearch.numericFilters.length;
        return facetFilterCount + numericFilterCount;
    };

    // Helpers to generate a shareable link-like string for a saved search
    const buildSavedSearchLink = (savedSearch: SavedSearch): string => {
        const params = new URLSearchParams();
        if (savedSearch.searchTerm) {
            params.set('fulltext', savedSearch.searchTerm);
        }
        if (savedSearch.facetFilters?.length) {
            params.set('facetFilters', encodeURIComponent(JSON.stringify(savedSearch.facetFilters)));
        }
        if (savedSearch.numericFilters?.length) {
            params.set('numericFilters', encodeURIComponent(JSON.stringify(savedSearch.numericFilters)));
        }

        // Build complete URL with current host and path
        const currentUrl = new URL(window.location.href);
        const baseUrl = `${currentUrl.protocol}//${currentUrl.host}${currentUrl.pathname}`;
        return `${baseUrl}?${params.toString()}`;
    };

    const handleCopySavedSearch = async (savedSearch: SavedSearch) => {
        try {
            const link = buildSavedSearchLink(savedSearch);
            await navigator.clipboard.writeText(link);
            const now = Date.now();
            const updated = savedSearches.map(s => s.id === savedSearch.id ? { ...s, dateLastUsed: now } : s);
            setSavedSearches(updated);
            saveSavedSearches(updated);

            // Show success toast notification
            ToastQueue.positive('SAVED SEARCH COPIED SUCCESSFULLY', { timeout: 3000 });
        } catch (e) {
            console.warn('[SavedSearch] clipboard copy failed, falling back to prompt');
            // Fallback
            window.prompt('Copy this link', buildSavedSearchLink(savedSearch));
            const now = Date.now();
            const updated = savedSearches.map(s => s.id === savedSearch.id ? { ...s, dateLastUsed: now } : s);
            setSavedSearches(updated);
            saveSavedSearches(updated);

            // Show success toast notification for fallback as well
            ToastQueue.positive('SAVED SEARCH COPIED SUCCESSFULLY', { timeout: 3000 });
        }
    };

    const [showEditLinkModal, setShowEditLinkModal] = useState(false);
    const [editLinkText, setEditLinkText] = useState('');
    const [editingSearchName, setEditingSearchName] = useState('');
    const [editingSearchId, setEditingSearchId] = useState<string | null>(null);

    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteSearchId, setDeleteSearchId] = useState<string | null>(null);
    const [deleteSearchName, setDeleteSearchName] = useState('');

    // Tooltip state
    const [hoveredSearchId, setHoveredSearchId] = useState<string | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    const handleOpenEditLink = (savedSearch: SavedSearch) => {
        const link = buildSavedSearchLink(savedSearch);
        setEditLinkText(link);
        setEditingSearchName(savedSearch.name);
        setEditingSearchId(savedSearch.id);
        setShowEditLinkModal(true);
    };

    const handleCloseEditLink = () => {
        setShowEditLinkModal(false);
        setEditLinkText('');
        setEditingSearchName('');
        setEditingSearchId(null);
    };

    const handleConfirmEditLink = () => {
        if (!editingSearchId) {
            setShowEditLinkModal(false);
            return;
        }
        // Build current search details from state
        const facetFilterGroups = Object.keys(checked).map(key => {
            const facetFilter: string[] = [];
            Object.entries(checked[key]).forEach(([facet, isChecked]) => {
                if (isChecked) {
                    facetFilter.push(`${key}:${facet}`);
                }
            });
            return facetFilter;
        }).filter(group => group.length > 0);

        const now = Date.now();
        const updated = savedSearches.map(s => (
            s.id === editingSearchId
                ? {
                    ...s,
                    name: editingSearchName.trim() || s.name, // Use new name or keep existing if empty
                    searchTerm: query,
                    facetFilters: [...facetFilterGroups],
                    numericFilters: [...selectedNumericFilters],
                    dateLastModified: now
                }
                : s
        ));

        setSavedSearches(updated);
        saveSavedSearches(updated);

        // Show success toast notification
        ToastQueue.positive('SAVED SEARCH UPDATED SUCCESSFULLY', { timeout: 3000 });

        setShowEditLinkModal(false);
        setEditLinkText('');
        setEditingSearchName('');
        setEditingSearchId(null);
    };

    return (
        <>
            <div className="facet-filter-container">
                <div className="facet-filter">
                    <div className="facet-filter-header">
                        <div className="facet-filter-tabs">
                            <div
                                className={`facet-filter-tab-group left ${activeView === 'filters' ? 'active' : ''}`}
                                onClick={() => setActiveView('filters')}
                                style={{ cursor: 'pointer' }}
                            >
                                <button
                                    className={`facet-filter-tab ${activeView === 'filters' ? 'active' : ''}`}
                                    onClick={() => setActiveView('filters')}
                                    type="button"
                                >
                                    Filters
                                    {getTotalCheckedCount() > 0 && (
                                        <div className="assets-details-tag tccc-tag facet-filter-count-tag">{getTotalCheckedCount()}</div>
                                    )}
                                </button>
                                <button
                                    className={`facet-filter-tab clear`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearAllChecks();
                                    }}
                                    type="button"
                                >
                                    CLEAR ALL
                                </button>
                            </div>
                            <div
                                className={`facet-filter-tab-group right ${activeView === 'saved' ? 'active' : ''}`}
                                onClick={() => setActiveView('saved')}
                                style={{ cursor: 'pointer' }}
                            >
                                <button
                                    className={`facet-filter-tab ${activeView === 'saved' ? 'active' : ''}`}
                                    onClick={() => setActiveView('saved')}
                                    type="button"
                                >
                                    My Saved Searches
                                </button>
                            </div>
                        </div>
                    </div>
                    {activeView === 'filters' ? (
                        <div className="facet-filter-list">
                            {/* Render facets that retrieved from EXC */}
                            {Object.entries(excFacets).map(([facetTechId, facet]) => {
                                const label = (facet as { label: string }).label || facetTechId;
                                const checkedCount = getCheckedCount(facetTechId);

                                return (
                                    <div key={facetTechId} className="facet-filter-section">
                                        {facetSearchMode[facetTechId] ? (
                                            <div className="facet-filter-button facet-filter-button-search">
                                                <div className="facet-search-container">
                                                    <div className="facet-search-input-wrapper">
                                                        <img
                                                            src="/icons/search.svg"
                                                            alt="Search"
                                                            className="facet-search-icon-inside"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="facet-search-input"
                                                            placeholder={`Search ${label}...`}
                                                            value={facetSearchTerms[facetTechId] || ''}
                                                            autoFocus
                                                            onChange={(e) => handleFacetSearchChange(facetTechId, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Escape') {
                                                                    setFacetSearchMode(prev => ({ ...prev, [facetTechId]: false }));
                                                                    setFacetSearchTerms(prev => ({ ...prev, [facetTechId]: '' }));
                                                                }
                                                            }}
                                                        />
                                                        <img
                                                            src="/icons/close-menu.svg"
                                                            alt="Close"
                                                            className="facet-search-close-icon"
                                                            onClick={(e) => toggleFacetSearch(facetTechId, e)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="facet-filter-right-section">
                                                    {checkedCount > 0 && (
                                                        <div className="assets-details-tag tccc-tag facet-filter-count-tag">{checkedCount}</div>
                                                    )}
                                                    <span
                                                        className={`facet-filter-arrow-top-level ${expandedFacets[facetTechId] ? 'expanded' : ''}`}
                                                        onClick={() => toggle(facetTechId)}
                                                    >
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="facet-filter-button"
                                                tabIndex={0}
                                                aria-expanded={!!expandedFacets[facetTechId]}
                                                onClick={() => toggle(facetTechId)}
                                            >
                                                <span
                                                    className="facet-filter-label"
                                                >{label}</span>
                                                <div className="facet-filter-right-section">
                                                    {checkedCount > 0 && (
                                                        <div className="assets-details-tag tccc-tag facet-filter-count-tag">{checkedCount}</div>
                                                    )}
                                                    {expandedFacets[facetTechId] && (
                                                        <img
                                                            src="/icons/search.svg"
                                                            alt="Search"
                                                            className="facet-search-trigger"
                                                            onClick={(e) => toggleFacetSearch(facetTechId, e)}
                                                        />
                                                    )}
                                                    <span
                                                        className={`facet-filter-arrow ${expandedFacets[facetTechId] ? 'expanded' : ''}`}
                                                    ></span>
                                                </div>
                                            </div>
                                        )}
                                        {/* For each facet retrieved from EXC, render the appropriate checkboxes and hierarchy if needed */}
                                        {renderFacetsFromSearchResult(facetTechId)}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="saved-searches-list">
                            {savedSearches.length === 0 ? (
                                <div className="saved-searches-empty">
                                    <p>No saved searches yet.</p>
                                    <p>Switch to Filters tab and click "Save Search" to save your first search.</p>
                                </div>
                            ) : (
                                [...savedSearches]
                                    .sort((a, b) => {
                                        const favA = a.favorite ? 1 : 0;
                                        const favB = b.favorite ? 1 : 0;
                                        if (favB !== favA) return favB - favA; // favorites first
                                        const usedA = a.dateLastUsed ?? 0;
                                        const usedB = b.dateLastUsed ?? 0;
                                        return usedB - usedA; // most recently used first
                                    })
                                    .map((savedSearch) => (
                                        <div
                                            key={savedSearch.id}
                                            className="saved-search-item"
                                            onMouseEnter={(e) => handleShowTooltip(savedSearch.id, e)}
                                            onMouseLeave={handleHideTooltip}
                                        >
                                            <div className="saved-search-info">
                                                <div className="saved-search-title">
                                                    <button
                                                        className="saved-search-name-link"
                                                        type="button"
                                                        onClick={(e) => {
                                                            handleLoadSavedSearch(savedSearch);
                                                            (e.currentTarget as HTMLButtonElement).blur();
                                                        }}
                                                        title="Load this saved search"
                                                    >
                                                        {savedSearch.name}
                                                    </button>
                                                    <button
                                                        className={`saved-search-fav-btn ${savedSearch.favorite ? 'favorite' : ''}`}
                                                        title="Favorite"
                                                        onClick={(e) => {
                                                            const updated = savedSearches.map(s => s.id === savedSearch.id ? { ...s, favorite: !s.favorite } : s);
                                                            setSavedSearches(updated);
                                                            saveSavedSearches(updated);
                                                            (e.currentTarget as HTMLButtonElement).blur();
                                                        }}
                                                        type="button"
                                                    >
                                                        <img src={savedSearch.favorite ? `${import.meta.env.BASE_URL}icons/star-yellow.svg` : `${import.meta.env.BASE_URL}icons/star-grey.svg`} alt="Favorite" />
                                                    </button>
                                                </div>
                                                <div className="saved-search-actions-left">
                                                    <button
                                                        className="saved-search-icon-btn"
                                                        title="Copy"
                                                        onClick={(e) => {
                                                            handleCopySavedSearch(savedSearch);
                                                            (e.currentTarget as HTMLButtonElement).blur();
                                                        }}
                                                        type="button"
                                                    >
                                                        <img src={`${import.meta.env.BASE_URL}icons/copy-circle.svg`} alt="Copy" />
                                                    </button>
                                                    <button
                                                        className="saved-search-icon-btn"
                                                        title="Edit"
                                                        onClick={(e) => {
                                                            handleOpenEditLink(savedSearch);
                                                            (e.currentTarget as HTMLButtonElement).blur();
                                                        }}
                                                        type="button"
                                                    >
                                                        <img src={`${import.meta.env.BASE_URL}icons/edit-circle.svg`} alt="Edit" />
                                                    </button>
                                                    <button
                                                        className="saved-search-delete-btn"
                                                        onClick={(e) => {
                                                            handleDeleteSavedSearch(savedSearch.id);
                                                            (e.currentTarget as HTMLButtonElement).blur();
                                                        }}
                                                        type="button"
                                                        title="Delete"
                                                    >
                                                        <img src={`${import.meta.env.BASE_URL}icons/delete-circle.svg`} alt="Delete" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Saved Search Modal */}
            {showEditLinkModal && (
                <div className="save-search-modal">
                    <div className="save-search-modal-content">
                        <div className="save-search-modal-header">
                            <h3>Edit Saved Search</h3>
                        </div>
                        <div className="save-search-modal-body">
                            <div className="save-search-field">
                                <label htmlFor="edit-search-name" className="save-search-field-label">Search Name:</label>
                                <input
                                    id="edit-search-name"
                                    type="text"
                                    value={editingSearchName}
                                    onChange={(e) => setEditingSearchName(e.target.value)}
                                    className="save-search-input"
                                    placeholder="Enter search name"
                                    autoFocus
                                />
                            </div>
                            <div className="save-search-field">
                                <label className="save-search-field-label">Generated Link:</label>
                                <textarea
                                    className="save-search-input save-search-link-display"
                                    value={editLinkText}
                                    readOnly
                                    rows={4}
                                />
                            </div>
                        </div>
                        <div className="save-search-modal-footer">
                            <button className="save-search-cancel-btn" onClick={handleCloseEditLink} type="button">Cancel</button>
                            <button
                                className="save-search-confirm-btn"
                                onClick={handleConfirmEditLink}
                                type="button"
                                disabled={!editingSearchName.trim()}
                            >
                                Update
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="save-search-modal">
                    <div className="save-search-modal-content">
                        <div className="save-search-modal-header">
                            <h3>Delete Saved Search</h3>
                        </div>
                        <div className="save-search-modal-body">
                            <p>Are you sure you want to delete "<strong>{deleteSearchName}</strong>"?</p>
                        </div>
                        <div className="save-search-modal-footer">
                            <button
                                className="save-search-cancel-btn"
                                onClick={handleCancelDelete}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="delete-search-confirm-btn"
                                onClick={handleConfirmDelete}
                                type="button"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tooltip */}
            {hoveredSearchId && (
                <div
                    className="saved-search-tooltip"
                    style={{
                        position: 'fixed',
                        left: `${tooltipPosition.x}px`,
                        top: `${tooltipPosition.y}px`,
                        transform: 'translate(-50%, -100%)',
                        pointerEvents: 'none',
                        zIndex: 1001
                    }}
                >
                    {(() => {
                        const search = savedSearches.find(s => s.id === hoveredSearchId);
                        if (!search) return null;
                        return (
                            <div className="tooltip-content">
                                <div className="tooltip-search-terms">
                                    {search.searchTerm || 'No search terms'}
                                </div>
                                <div className="tooltip-filter-count">
                                    {(() => {
                                        const filterCount = countFilters(search);
                                        if (filterCount === 0) return 'No filters';
                                        if (filterCount === 1) return '1 filter';
                                        return `${filterCount} filters`;
                                    })()}
                                </div>
                                <div className="tooltip-last-used">
                                    Last used: {formatLastUsed(search.dateLastUsed)}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Inline Save Form */}
            {activeView === 'filters' && showSaveModal && (
                <div className="save-search-inline-form">
                    <div className="save-search-inline-input-container">
                        <input
                            type="text"
                            placeholder="name for your saved search"
                            value={saveSearchName}
                            onChange={(e) => setSaveSearchName(e.target.value)}
                            className="save-search-inline-input"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSaveSearchConfirm();
                                } else if (e.key === 'Escape') {
                                    handleSaveSearchCancel();
                                }
                            }}
                        />
                        <button
                            className="save-search-inline-save-btn"
                            type="button"
                            onClick={handleSaveSearchConfirm}
                            disabled={!saveSearchName.trim()}
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            {activeView === 'filters' && (
                <div className="facet-filter-buttons">
                    <button
                        className="facet-filter-apply-btn"
                        type="button"
                        onClick={showSaveModal ? handleSaveSearchCancel : handleApplyFilters}
                    >
                        <span className="facet-filter-apply-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="3 4 21 4 14 14 14 21 10 21 10 14 3 4" />
                            </svg>
                        </span>
                        <span className="facet-filter-apply-text">Apply</span>
                    </button>
                    <button
                        className={`facet-filter-save-btn ${showSaveModal ? 'cancel-mode' : ''}`}
                        type="button"
                        onClick={showSaveModal ? handleSaveSearchCancel : handleSaveSearch}
                    >
                        <span className="facet-filter-save-icon">
                            <img src={`${import.meta.env.BASE_URL}icons/save-icon.svg`} alt="Save" />
                        </span>
                        <span className="facet-filter-save-text">{showSaveModal ? 'Cancel' : 'Save Search'}</span>
                    </button>
                </div>
            )}
        </>
    );
};

export default Facets; 