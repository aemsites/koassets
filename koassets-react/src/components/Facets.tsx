import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DateValue } from 'react-aria-components';
import { CalendarDate } from '@internationalized/date';
import type { FacetsProps, FacetValue, RightsFilters, SavedSearch, SearchResult, RightsData } from '../types';
import DateRange, { DateRangeRef } from './DateRange';
import './Facets.css';
import Markets from './Markets';
import MediaChannels from './MediaChannels';
import MyDatePicker from './MyDatePicker';
import buildSavedSearchUrl from '../../../scripts/saved-search-utils.js';
import { getDisplayFacetName } from '../utils/displayUtils';
import { calendarDateToEpoch, epochToCalendarDate } from '../utils/formatters';

interface ExpandedFacetsState {
    [key: string]: boolean;
}

const HIERARCHY_PREFIX = 'TCCC.#hierarchy.lvl';

// Local storage functions for saved searches
const loadSavedSearches = (): SavedSearch[] => {
    try {
        const saved = localStorage.getItem('koassets-saved-searches');
        if (!saved) return [];
        
        const parsedSearches = JSON.parse(saved);
        
        // Convert Arrays back to Sets and epoch timestamps back to DateValues after JSON deserialization
        return parsedSearches.map((search: SavedSearch & {
            rightsFilters: Omit<RightsFilters, 'markets' | 'mediaChannels' | 'rightsStartDate' | 'rightsEndDate'> & {
                rightsStartDate: number | null;
                rightsEndDate: number | null;
                markets: RightsData[];
                mediaChannels: RightsData[];
            }
        }) => ({
            ...search,
            rightsFilters: {
                rightsStartDate: search.rightsFilters.rightsStartDate ? epochToCalendarDate(search.rightsFilters.rightsStartDate / 1000) : null,
                rightsEndDate: search.rightsFilters.rightsEndDate ? epochToCalendarDate(search.rightsFilters.rightsEndDate / 1000) : null,
                markets: new Set(search.rightsFilters.markets || []),
                mediaChannels: new Set(search.rightsFilters.mediaChannels || [])
            }
        }));
    } catch (error) {
        console.error('Error loading saved searches:', error);
        return [];
    }
};

const rightsFacets: Record<string, FacetValue> = {
    'tccc-rightsStartDate': {
        label: 'Rights Start Date',
        type: 'date'
    },
    'tccc-rightsEndDate': {
        label: 'Rights End Date',
        type: 'date'
    },
    'tccc-marketCovered': {
        label: 'Market Covered',
        type: 'checkbox'
    },
    'tccc-mediaCovered': {
        label: 'Media Covered',
        type: 'checkbox'
    }
}

const saveSavedSearches = (searches: SavedSearch[]): void => {
    try {
        // Convert Sets to Arrays and DateValues to epoch for JSON serialization
        const searchesForSaving = searches.map(search => ({
            ...search,
            rightsFilters: {
                rightsStartDate: search.rightsFilters.rightsStartDate ? calendarDateToEpoch(search.rightsFilters.rightsStartDate as CalendarDate) : null,
                rightsEndDate: search.rightsFilters.rightsEndDate ? calendarDateToEpoch(search.rightsFilters.rightsEndDate as CalendarDate) : null,
                markets: Array.from(search.rightsFilters.markets),
                mediaChannels: Array.from(search.rightsFilters.mediaChannels)
            }
        }));
        
        localStorage.setItem('koassets-saved-searches', JSON.stringify(searchesForSaving));
    } catch (error) {
        console.error('Error saving searches:', error);
    }
};

// Interface for FacetItem props
interface FacetItemProps {
    facetTechId: string;
    facet: FacetValue;
    label: string;
    isExpanded: boolean;
    isSearchMode: boolean;
    searchTerm: string;
    checkedCount: number;
    onToggle: (facetTechId: string) => void;
    onToggleSearch: (facetTechId: string, e: React.MouseEvent) => void;
    onSearchChange: (facetTechId: string, value: string) => void;
    onSearchEscape: (facetTechId: string) => void;
    renderContent: (facetTechId: string) => React.ReactNode;
}

// Memoized FacetItem component to prevent unnecessary rerenders
const FacetItem = React.memo<FacetItemProps>(({
    facetTechId,
    facet,
    label,
    isExpanded,
    isSearchMode,
    searchTerm,
    checkedCount,
    onToggle,
    onToggleSearch,
    onSearchChange,
    onSearchEscape,
    renderContent
}) => {
    return (
        <>
            {facetTechId === 'tccc-rightsStartDate' && (
                <div className="facet-rights-section">
                    <label className="facet-rights-label">Check Rights Filters</label>
                </div>
            )}
            <div className="facet-filter-section">
                {/* Render each facetTechId's search button */}
                {isSearchMode ? (
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
                                    value={searchTerm}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => onSearchChange(facetTechId, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            onSearchEscape(facetTechId);
                                        }
                                    }}
                                />
                                <img
                                    src="/icons/close-menu.svg"
                                    alt="Close"
                                    className="facet-search-close-icon"
                                    onClick={(e) => onToggleSearch(facetTechId, e)}
                                />
                            </div>
                        </div>
                        <div className="facet-filter-right-section">
                            {checkedCount > 0 && (
                                <div className="assets-details-tag tccc-tag facet-filter-count-tag">{checkedCount}</div>
                            )}
                            <span
                                className={`facet-filter-arrow-top-level ${isExpanded ? 'expanded' : ''}`}
                                onClick={() => onToggle(facetTechId)}
                            >
                            </span>
                        </div>
                    </div>
                ) : (
                    // Render each facetTechId's button
                    <div
                        className="facet-filter-button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => onToggle(facetTechId)}
                    >
                        <span className="facet-filter-label">{label}</span>
                        <div className="facet-filter-right-section">
                            {checkedCount > 0 && (
                                <div className="assets-details-tag tccc-tag facet-filter-count-tag">{checkedCount}</div>
                            )}
                            {isExpanded && facet.type !== 'date' && (
                                <img
                                    src="/icons/search.svg"
                                    alt="Search"
                                    className="facet-search-trigger"
                                    onClick={(e) => onToggleSearch(facetTechId, e)}
                                />
                            )}
                            <span
                                className={`facet-filter-arrow ${isExpanded ? 'expanded' : ''}`}
                            ></span>
                        </div>
                    </div>
                )}

                {/* For each facet, render the appropriate checkboxes and hierarchy if needed */}
                {renderContent(facetTechId)}
            </div>
        </>
    );
});

FacetItem.displayName = 'FacetItem';

const Facets: React.FC<FacetsProps> = ({
    searchResults,
    search,
    excFacets = {},
    selectedNumericFilters = [],
    setSelectedNumericFilters,
    query,
    setQuery,
    searchDisabled,
    setSearchDisabled,
    setIsRightsSearch,
    rightsStartDate,
    setRightsStartDate,
    rightsEndDate,
    setRightsEndDate,
    selectedMarkets,
    setSelectedMarkets,
    selectedMediaChannels,
    setSelectedMediaChannels,
    facetCheckedState,
    setFacetCheckedState,
    onFacetCheckbox,
    onClearAllFacets
}) => {
    const [expandedFacets, setExpandedFacets] = useState<ExpandedFacetsState>({}); // Keep track of expanded facets (from EXC)
    const [expandedHierarchyItems, setExpandedHierarchyItems] = useState<ExpandedFacetsState>({}); // Keep track of expanded hierarchy items
    const [facetSearchMode, setFacetSearchMode] = useState<ExpandedFacetsState>({}); // Keep track of search mode for each facet
    const [facetSearchTerms, setFacetSearchTerms] = useState<{ [key: string]: string }>({}); // Keep track of search terms for each facet
    const [dateRanges, setDateRanges] = useState<{ [key: string]: [number | undefined, number | undefined] }>({});
    const dateRangeRef = useRef<DateRangeRef>(null);
    const isUpdatingFromExternalRef = useRef(false);

    // Rights date picker handlers
    const handleRightsStartDateChange = useCallback((date: DateValue | null) => {
        setRightsStartDate?.(date);
    }, [setRightsStartDate]);

    const handleClearRightsStartDate = useCallback(() => {
        setRightsStartDate?.(null);
    }, [setRightsStartDate]);

    const handleRightsEndDateChange = useCallback((date: DateValue | null) => {
        setRightsEndDate?.(date);
    }, [setRightsEndDate]);

    const handleClearRightsEndDate = useCallback(() => {
        setRightsEndDate?.(null);
    }, [setRightsEndDate]);

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

    // Note: Cleanup logic for checked state is now handled in the parent component (MainApp)

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

                // Sort each level based on facet's sortDirection setting
                const sortDirection = excFacets[facetTechId]?.sortDirection?.toLowerCase();
                if (sortDirection === 'asc' || sortDirection === 'desc') {
                    Object.keys(hierarchyData).forEach(level => {
                        const levelNum = parseInt(level);
                        const sortedEntries = Object.entries(hierarchyData[levelNum])
                            .sort(([facetNameA], [facetNameB]) => {
                                // Extract the last part of the hierarchy path for sorting
                                const lastTokenA = facetNameA.split(' / ').pop()?.trim() || '';
                                const lastTokenB = facetNameB.split(' / ').pop()?.trim() || '';
                                if (sortDirection === 'asc') {
                                    return lastTokenA.localeCompare(lastTokenB);
                                } else {
                                    return lastTokenB.localeCompare(lastTokenA);
                                }
                            });
                        hierarchyData[levelNum] = Object.fromEntries(sortedEntries);
                    });
                }

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

    const handleFacetSearchEscape = useCallback((facetTechId: string) => {
        setFacetSearchMode(prev => ({ ...prev, [facetTechId]: false }));
        setFacetSearchTerms(prev => ({ ...prev, [facetTechId]: '' }));
    }, []);


    // Handler for date range change
    const handleDateRangeChange = useCallback((key: string, startDate: Date | undefined, endDate: Date | undefined) => {
        setDateRanges(prev => ({
            ...prev,
            [key]: [startDate ? startDate.getTime() / 1000 : undefined, endDate ? endDate.getTime() / 1000 : undefined]
        }));
    }, []);

    // Helper function to check if hierarchy item should be shown based on search
    const shouldShowHierarchyItem = useCallback((
        hierarchyData: { [level: number]: { [key: string]: number } },
        facetTechId: string,
        facetName: string,
        searchTerm: string,
        level: number
    ): boolean => {
        if (!searchTerm) return true;

        const lowerSearchTerm = searchTerm.toLowerCase();

        // Check if the full hierarchy path contains the search term
        const displayedFacetName = getDisplayFacetName(facetTechId, facetName);
        if (displayedFacetName.toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }

        // Check if any descendant items at deeper levels match the search term
        for (let deeperLevel = level + 1; deeperLevel < 10; deeperLevel++) {
            const deeperLevelData = hierarchyData[deeperLevel];
            if (!deeperLevelData) continue;

            for (const [deeperFacetName] of Object.entries(deeperLevelData)) {
                // Check if this deeper item is a descendant of the current item
                if (deeperFacetName.startsWith(facetName + ' / ')) {
                    // Check if the descendant matches the search term
                    const displayedDeeperFacetName = getDisplayFacetName(facetTechId, deeperFacetName);
                    if (displayedDeeperFacetName.toLowerCase().includes(lowerSearchTerm)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }, []);

    /**
     * Helper function to deselect facet items that no longer exist in search results
     */
    const deselectFacetCheckedState = useCallback((checkboxKey: string, facetDataMap: Record<string, number>) => {
        if (facetCheckedState[checkboxKey]) {
            Object.entries(facetCheckedState[checkboxKey]).forEach(([key, value]) => {
                if (value === true) {
                    if (!(key in facetDataMap) || facetDataMap[key] === 0) {
                        onFacetCheckbox(checkboxKey, key);
                    }
                }
            });
        }
    }, [facetCheckedState, onFacetCheckbox]);
    

    // Memoized function to render hierarchy levels
    const renderHierarchyLevel = useCallback((
        facetTechIdHierarchyData: { [level: number]: { [key: string]: number } },
        facetTechId: string,
        level: number,
        parentPath: string = ''
    ): React.ReactNode[] => {
        const levelData = facetTechIdHierarchyData[level];
        if (!levelData) return [];

        const searchTerm = facetSearchTerms[facetTechId] || '';
        const items: React.ReactNode[] = [];
        const checkboxKey = `${facetTechId}.${HIERARCHY_PREFIX}${level}`;
        deselectFacetCheckedState(checkboxKey, levelData);

        Object.entries(levelData).forEach(([facetName, count]) => {
            // Extract the last part of the hierarchy path for display
            const pathParts = facetName.split(' / ');
            const baseFacetName = pathParts[pathParts.length - 1].trim();
            const displayName = getDisplayFacetName(facetTechId, baseFacetName);

            // Filter based on search term - check full hierarchy path and descendants
            if (searchTerm && !shouldShowHierarchyItem(facetTechIdHierarchyData, facetTechId, facetName, searchTerm, level)) {
                return; // Skip this item if it doesn't match search
            }

            // Only show items that match the parent path or are at the starting level (level 1)
            const currentPath = pathParts.slice(0, -1).join(' / ');
            if (level === 1 || currentPath === parentPath) {
                const fullPath = facetName;
                const itemKey = `${facetTechId}-${facetName}`;

                // Check if this item has sub-levels
                const hasSubLevels = facetTechIdHierarchyData[level + 1] &&
                    Object.keys(facetTechIdHierarchyData[level + 1]).some(subFacetName =>
                        subFacetName.startsWith(fullPath + ' / ')
                    );

                // Apply CSS classes based on level and sub-levels
                const containerClasses = [
                    'facet-hierarchy-container',
                    level > 1 ? 'facet-hierarchy-container-indented' : '',
                    hasSubLevels ? 'facet-hierarchy-container-with-sublevel' : ''
                ].filter(Boolean).join(' ');

                const hierarchyItemKey = `${facetTechId}-${fullPath}`;
                const isHierarchyItemExpanded = expandedHierarchyItems[hierarchyItemKey];

                items.push(
                    <div key={itemKey} className={containerClasses}>
                        <div className="facet-filter-checkbox-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <label className="facet-filter-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer', flex: 1 }}>
                                <input
                                    className="facet-filter-checkbox-input"
                                    type="checkbox"
                                    checked={!!facetCheckedState[checkboxKey]?.[facetName]}
                                    onChange={() => onFacetCheckbox(checkboxKey, facetName)}
                                /> {displayName}{count > 0 ? ` (${count})` : ''}
                            </label>
                            {hasSubLevels && (
                                <span
                                    className={`facet-filter-arrow-sub-level caret-icon ${isHierarchyItemExpanded ? 'expanded' : ''}`}
                                    onClick={() => toggleHierarchyItem(hierarchyItemKey, facetTechId, fullPath, facetTechIdHierarchyData)}
                                >
                                </span>
                            )}
                        </div>
                        {/* Render child levels only if expanded */}
                        {hasSubLevels && isHierarchyItemExpanded && renderHierarchyLevel(facetTechIdHierarchyData, facetTechId, level + 1, fullPath)}
                    </div>
                );
            }
        });

        return items;
    }, [facetCheckedState, onFacetCheckbox, expandedHierarchyItems, toggleHierarchyItem, facetSearchTerms, shouldShowHierarchyItem, deselectFacetCheckedState]);

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

        // Render date picker for rights start date facet
        if (facetTechId === 'tccc-rightsStartDate') {
            return <MyDatePicker<DateValue>
                className="rights-date-picker"
                value={rightsStartDate}
                onChange={handleRightsStartDateChange}
                label="From Rights Date"
                aria-label="From Rights Date"
                showClearButton={!!rightsStartDate}
                onClear={handleClearRightsStartDate}
            />;
        }

        // Render date picker for rights end date facet
        if (facetTechId === 'tccc-rightsEndDate') {
            return <MyDatePicker<DateValue>
                className="rights-date-picker"
                value={rightsEndDate}
                onChange={handleRightsEndDateChange}
                label="To Rights Date"
                aria-label="To Rights Date"
                showClearButton={!!rightsEndDate}
                onClear={handleClearRightsEndDate}
            />;
        }

        // Render Markets
        if (facetTechId === 'tccc-marketCovered') {
            return <Markets
                includeSearchBox={false}
                selectedMarkets={selectedMarkets}
                setSelectedMarkets={setSelectedMarkets}
            />;
        }

        // Render Media Channels
        if (facetTechId === 'tccc-mediaCovered') {
            return <MediaChannels
                selectedMediaChannels={selectedMediaChannels}
                setSelectedMediaChannels={setSelectedMediaChannels}
            />;
        }

        // Get hierarchy data for this facet if it exists
        const facetTechIdHierarchyData = hierarchyDataByFacet[facetTechId];
        const isHierarchyFacet = !!facetTechIdHierarchyData;

        // Render each facetTechId's hierarchy items, e.g. 'Brand', 'Asset Category & Asset Type Execution'
        if (isHierarchyFacet) {
            return (
                <div className="facet-filter-checkbox-list">
                    {renderHierarchyLevel(facetTechIdHierarchyData, facetTechId, 1)}
                </div>
            );
        }

        // Render each facetTechId's non-hierarchy items, e.g. 'Campaign', 'Rights Free'
        if (!expandedFacets[facetTechId] || !combinedFacets || !combinedFacets[facetTechId] || Object.keys(combinedFacets[facetTechId] || {}).length === 0) {
            return null;
        }

        const searchTerm = facetSearchTerms[facetTechId] || '';
        const checkboxKey = `${facetTechId}`;
        const facetTechIdDataMap = combinedFacets && combinedFacets[facetTechId] || {};
        
        deselectFacetCheckedState(checkboxKey, facetTechIdDataMap);

        // Filter facet entries based on search term
        let filteredEntries = Object.entries(facetTechIdDataMap)
            .filter(([facetName]) => {
                if (!searchTerm) return true;
                const displayFacetName = getDisplayFacetName(facetTechId, facetName);
                return displayFacetName.toLowerCase().includes(searchTerm.toLowerCase());
            });

        // Sort based on facet's sortDirection setting
        const sortDirection = excFacets[facetTechId]?.sortDirection?.toLowerCase();
        if (sortDirection === 'asc' || sortDirection === 'desc') {
            filteredEntries = filteredEntries.sort(([facetNameA], [facetNameB]) => {
                // Sort alphabetically by display name
                const displayNameA = getDisplayFacetName(facetTechId, facetNameA);
                const displayNameB = getDisplayFacetName(facetTechId, facetNameB);
                if (sortDirection === 'asc') {
                    return displayNameA.localeCompare(displayNameB);
                } else {
                    return displayNameB.localeCompare(displayNameA);
                }
            });
        }

        return (
            <div className="facet-filter-checkbox-list">
                {filteredEntries.map(([facetName, count]) => {
                    const displayName = getDisplayFacetName(facetTechId, facetName);
                    
                    return (
                        <label key={facetName} className="facet-filter-checkbox-label">
                            <input
                                type="checkbox"
                                checked={!!facetCheckedState[checkboxKey]?.[facetName]}
                                onChange={() => onFacetCheckbox(checkboxKey, facetName)}
                            /> {displayName}{count > 0 ? ` (${count})` : ''}
                        </label>
                    );
                })}
            </div>
        );
    }, [excFacets, expandedFacets, selectedNumericFilters, handleDateRangeChange, hierarchyDataByFacet, renderHierarchyLevel, combinedFacets, facetCheckedState, onFacetCheckbox, facetSearchTerms, handleClearRightsStartDate, handleRightsStartDateChange, rightsStartDate, handleClearRightsEndDate, handleRightsEndDateChange, rightsEndDate, selectedMarkets, selectedMediaChannels, setSelectedMarkets, setSelectedMediaChannels, deselectFacetCheckedState]);

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

    // Count checked facets for a specific facetTechId
    const getCheckedCount = useCallback((facetTechId: string): number => {
        let count = 0;
        Object.entries(facetCheckedState).forEach(([key, facetChecked]) => {
            if (key === facetTechId || key.startsWith(`${facetTechId}.`)) {
                Object.values(facetChecked).forEach(isChecked => {
                    if (isChecked) count++;
                });
            }
        });
        return count;
    }, [facetCheckedState]);

    // Count all checked facets across all categories
    const getTotalCheckedCount = useCallback((): number => {
        let totalCount = 0;
        Object.values(facetCheckedState).forEach(facetChecked => {
            Object.values(facetChecked).forEach(isChecked => {
                if (isChecked) totalCount++;
            });
        });
        return totalCount;
    }, [facetCheckedState]);

    const handleClearAllChecks = useCallback(() => {
        isUpdatingFromExternalRef.current = true;
        setFacetCheckedState({});
        setSelectedNumericFilters([]);
        setRightsStartDate?.(null);
        setRightsEndDate?.(null);
        setSelectedMarkets(new Set());
        setSelectedMediaChannels(new Set());
        
        // Clear Facets-specific UI state
        setDateRanges({});
        setExpandedFacets({}); // Collapse all facets
        setExpandedHierarchyItems({}); // Collapse all hierarchy items
        setFacetSearchMode({}); // Exit all search modes
        setFacetSearchTerms({}); // Clear all search terms
        dateRangeRef.current?.reset();
    }, [setFacetCheckedState, setSelectedNumericFilters, setRightsStartDate, setRightsEndDate, setSelectedMarkets, setSelectedMediaChannels]);

    // Pass handleClearAllChecks function to parent
    useEffect(() => {
        onClearAllFacets?.(handleClearAllChecks);
    }, [handleClearAllChecks, onClearAllFacets]);

    const handleApplyFilters = useCallback(() => {
        search();
    }, [search]);

    /* Check rights parameters state (none, incomplete, and complete)
       isNone: NO rights parameters have data
       isIncomplete: some but not all 4 parameters have data
       isComplete: ALL 4 parameters have data */
    const rightsValidationState = useMemo(() => {
        // Check if rights date parameters are complete (both set)
        const hasRightsStartDate = !!rightsStartDate;
        const hasRightsEndDate = !!rightsEndDate;
        const isRightsDateComplete = hasRightsStartDate && hasRightsEndDate;
        const hasAnyRightsDate = hasRightsStartDate || hasRightsEndDate;

        // Calculate states
        const hasAnyRightsData = selectedMarkets.size > 0 || selectedMediaChannels.size > 0 || hasAnyRightsDate;
        const isComplete = selectedMarkets.size > 0 && selectedMediaChannels.size > 0 && isRightsDateComplete;
        const isIncomplete = hasAnyRightsData && !isComplete;
        const isNone = !hasAnyRightsData;

        return { isNone, isIncomplete, isComplete };
    }, [selectedMarkets, selectedMediaChannels, rightsStartDate, rightsEndDate]);


    // Update parent's isRightsSearch state when rights parameters completeness changes
    useEffect(() => {
        setIsRightsSearch?.(rightsValidationState.isComplete);
    }, [rightsValidationState.isComplete, setIsRightsSearch]);

    // Update parent's searchDisabled state when rights parameters completeness changes
    useEffect(() => {
        if (setSearchDisabled) {
            const shouldDisable = activeView === 'filters' && rightsValidationState.isIncomplete;
            setSearchDisabled(shouldDisable);
        }
    }, [rightsValidationState.isIncomplete, setSearchDisabled, activeView]);

    // Save search functionality
    const handleSaveSearch = () => {
        setShowSaveModal(true);
    };

    const handleSaveSearchConfirm = useCallback(() => {
        if (saveSearchName.trim()) {
            // Capture current search type from URL path
            const currentPath = window.location.pathname;
            let searchType = '/search/all'; // default fallback
            if (currentPath.includes('/search/assets')) {
                searchType = '/search/assets';
            } else if (currentPath.includes('/search/products')) {
                searchType = '/search/products';
            } else if (currentPath.includes('/search/all')) {
                searchType = '/search/all';
            }

            const rightsFilters: RightsFilters = {
                rightsStartDate: rightsStartDate as DateValue,
                rightsEndDate: rightsEndDate as DateValue,
                markets: new Set(selectedMarkets),
                mediaChannels: new Set(selectedMediaChannels)
            };

            const now = Date.now();
            const newSearch: SavedSearch = {
                id: now.toString(),
                name: saveSearchName.trim(),
                searchTerm: query,
                facetFilters: facetCheckedState,
                numericFilters: [...selectedNumericFilters],
                rightsFilters: rightsFilters,
                dateCreated: now,
                dateLastModified: now,
                dateLastUsed: now,
                favorite: false,
                searchType: searchType
            };

            const updatedSearches = [...savedSearches, newSearch];
            setSavedSearches(updatedSearches);
            saveSavedSearches(updatedSearches);

            // Show success toast notification
            ToastQueue.positive('SEARCH SAVED SUCCESSFULLY', { timeout: 3000 });

            setSaveSearchName('');
            setShowSaveModal(false);
        }
    }, [saveSearchName, selectedMarkets, selectedMediaChannels, rightsStartDate, rightsEndDate, query, facetCheckedState, selectedNumericFilters, savedSearches]);

    const handleSaveSearchCancel = () => {
        setSaveSearchName('');
        setShowSaveModal(false);
    };

    const handleLoadSavedSearch = (savedSearch: SavedSearch) => {
        // If the saved search has a different search type, navigate to that URL
        if (savedSearch.searchType) {
            const currentPath = window.location.pathname;
            
            // Check if we need to navigate to a different search type
            if (!currentPath.includes(savedSearch.searchType)) {
                const searchUrl = buildSavedSearchUrl(savedSearch);
                window.location.href = searchUrl;
                return; // Exit early since we're navigating away
            }
        }
        
        // Dismiss any open tooltip
        handleHideTooltip();

        // Reset current filters
        handleClearAllChecks();

        // Load saved search term FIRST and ensure it's set before other updates
        const searchTerm = savedSearch.searchTerm || '';
        setQuery(searchTerm);

        // Use setTimeout to ensure query state update is processed before filter updates
        // This fixes the issue in block integration mode where state updates might be batched differently
        setTimeout(() => {
            // Set flag to indicate we're updating from saved search loading
            isUpdatingFromExternalRef.current = true;

            setFacetCheckedState(savedSearch.facetFilters); // populate the selected facets
            setSelectedNumericFilters(savedSearch.numericFilters); // populate the selected numeric filters (createDate)

            // populate the rights filters (start date, end date, markets and media channels)
            if (savedSearch.rightsFilters) {
                setRightsStartDate?.(savedSearch.rightsFilters.rightsStartDate);
                setRightsEndDate?.(savedSearch.rightsFilters.rightsEndDate);
                setSelectedMarkets(new Set(savedSearch.rightsFilters.markets));
                setSelectedMediaChannels(new Set(savedSearch.rightsFilters.mediaChannels));
            }

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
        let facetFilterCount = 0;
        Object.values(savedSearch.facetFilters).forEach(facetChecked => {
            Object.values(facetChecked).forEach(isChecked => {
                if (isChecked) facetFilterCount++;
            });
        });
        const numericFilterCount = savedSearch.numericFilters.length;
        return facetFilterCount + numericFilterCount;
    };


    const handleCopySavedSearch = async (savedSearch: SavedSearch) => {
        try {
            const link = buildSavedSearchUrl(savedSearch);
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
            window.prompt('Copy this link', buildSavedSearchUrl(savedSearch));
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
        const link = buildSavedSearchUrl(savedSearch);
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

    const handleConfirmEditLink = useCallback(() => {
        if (!editingSearchId) {
            setShowEditLinkModal(false);
            return;
        }

        const rightsFilters: RightsFilters = {
            rightsStartDate: rightsStartDate as DateValue,
            rightsEndDate: rightsEndDate as DateValue,
            markets: new Set(selectedMarkets),
            mediaChannels: new Set(selectedMediaChannels)
        };
        
        const now = Date.now();
        const updated = savedSearches.map(s => (
            s.id === editingSearchId
                ? {
                    ...s,
                    name: editingSearchName.trim() || s.name, // Use new name or keep existing if empty
                    searchTerm: query,
                    facetFilters: facetCheckedState,
                    numericFilters: [...selectedNumericFilters],
                    rightsFilters: rightsFilters,
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
    }, [editingSearchId, selectedMarkets, selectedMediaChannels, rightsStartDate, rightsEndDate, query, facetCheckedState, selectedNumericFilters, savedSearches, editingSearchName]);

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
                                        setActiveView('filters');
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
                            {(() => {
                                const excEntries = Object.entries(excFacets);

                                // Separate priority and regular facets
                                const regularFacets = excEntries.filter(([key]) => !Object.keys(rightsFacets).includes(key));

                                return [
                                    ...regularFacets,
                                    ...Object.entries(rightsFacets),
                                ];
                            })().map(([facetTechId, facet]) => {
                                const label = facet.label || facetTechId;
                                const checkedCount = getCheckedCount(facetTechId);

                                return (
                                    <FacetItem
                                        key={facetTechId}
                                        facetTechId={facetTechId}
                                        facet={facet}
                                        label={label}
                                        isExpanded={!!expandedFacets[facetTechId]}
                                        isSearchMode={!!facetSearchMode[facetTechId]}
                                        searchTerm={facetSearchTerms[facetTechId] || ''}
                                        checkedCount={checkedCount}
                                        onToggle={toggle}
                                        onToggleSearch={toggleFacetSearch}
                                        onSearchChange={handleFacetSearchChange}
                                        onSearchEscape={handleFacetSearchEscape}
                                        renderContent={renderFacetsFromSearchResult}
                                    />
                                );
                            })}
                        </div >
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
                </div >
            </div >

            {/* Edit Saved Search Modal */}
            {
                showEditLinkModal && (
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
                )
            }



            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && (
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
                )
            }

            {/* Tooltip */}
            {
                hoveredSearchId && (
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
                )
            }

            {/* Inline Save Form */}
            {
                activeView === 'filters' && showSaveModal && (
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
                )
            }

            {/* Action Buttons */}
            {
                activeView === 'filters' && (
                    <>
                        {(searchDisabled || rightsValidationState.isIncomplete) && (
                            <div className="rights-validation-warning" >
                                Select all rights parameters to enable the Apply button
                            </div>
                        )}
                        <div className="facet-filter-buttons">
                            <button
                                className="facet-filter-apply-btn"
                                type="button"
                                disabled={searchDisabled || rightsValidationState.isIncomplete}
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
                    </>
                )
            }
        </>
    );
};

export default Facets; 