import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FacetCheckedState, FacetsProps } from '../types';
import DateRange, { DateRangeRef } from './DateRange';
import './Facets.css';

interface ExpandedFacetsState {
    [key: string]: boolean;
}

const HIERARCHY_PREFIX = 'TCCC.#hierarchy.lvl';

const Facets: React.FC<FacetsProps> = ({
    searchResult,
    setSelectedFacetFilters,
    search,
    excFacets = {},
    selectedNumericFilters = [],
    setSelectedNumericFilters,
    unfilteredFacets
}) => {
    const [expandedFacets, setExpandedFacets] = useState<ExpandedFacetsState>({}); // Keep track of expanded facets (from EXC)
    const [checked, setChecked] = useState<FacetCheckedState>({}); // Keep track of checked state of facets and nested facets if any
    const [dateRanges, setDateRanges] = useState<{ [key: string]: [number | undefined, number | undefined] }>({});
    const dateRangeRef = useRef<DateRangeRef>(null);

    const toggle = (key: string) => {
        setExpandedFacets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Handler for checkbox change
    const handleCheckbox = (key: string, facet: string) => {
        setChecked(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [facet]: !prev[key]?.[facet]
            }
        }));
    };

    // Handler for date range change
    const handleDateRangeChange = useCallback((key: string, startDate: Date | undefined, endDate: Date | undefined) => {
        if (startDate || endDate) {
            setDateRanges(prev => ({
                ...prev,
                [key]: [startDate ? startDate.getTime() / 1000 : undefined, endDate ? endDate.getTime() / 1000 : undefined]
            }));
        }
    }, []);

    /**
     * Renders the facet checkboxes from search results
     * @param facetTechId - The technical ID of the facet
     * @returns JSX element with facet checkboxes or null
     */
    const renderFacetsFromSearchResult = (facetTechId: string) => {
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

        // Combine unfilteredFacets and searchResult.facets
        // Get all facetName from unfilteredFacets, use count from searchResult.facets if exists, otherwise set to 0
        const combinedFacets: { [key: string]: { [facetName: string]: number } } = {};

        if (unfilteredFacets) {
            Object.entries(unfilteredFacets).forEach(([key, unfilteredFacetData]) => {
                const searchResultFacetData = searchResult?.facets?.[key] || {};
                const combined: { [facetName: string]: number } = {};

                Object.keys(unfilteredFacetData).forEach(facetName => {
                    combined[facetName] = searchResultFacetData[facetName] ?? 0;
                });

                combinedFacets[key] = combined;
            });
        }

        // Check if this is a hierarchy facet by looking for hierarchy keys in search results
        const isHierarchyFacet = Object.keys(unfilteredFacets || {}).some(key =>
            key.startsWith(`${facetTechId}.${HIERARCHY_PREFIX}`)
        );

        // Render hierarchy facet
        if (isHierarchyFacet) {
            // For hierarchy facets, collect all levels that start with our facet pattern
            const hierarchyData: { [level: number]: { [key: string]: number } } = {};

            // Collect all hierarchy levels for this facet
            Object.keys(combinedFacets || {}).forEach(key => {
                if (key.startsWith(`${facetTechId}.${HIERARCHY_PREFIX}`)) {
                    // Extract level number from key like "tccc-brand.TCCC.#hierarchy.lvl0"
                    const levelMatch = key.match(/\.lvl(\d+)$/);
                    if (levelMatch) {
                        const level = parseInt(levelMatch[1]);
                        hierarchyData[level] = combinedFacets[key] as { [key: string]: number };
                    }
                }
            });

            // Build hierarchical structure
            const renderHierarchyLevel = (level: number, parentPath: string = ''): React.ReactNode[] => {
                const levelData = hierarchyData[level];
                if (!levelData) return [];

                const items: React.ReactNode[] = [];

                Object.entries(levelData).forEach(([facetName, count]) => {
                    // Extract the last part of the hierarchy path for display
                    const pathParts = facetName.split(' / ');
                    const displayName = pathParts[pathParts.length - 1].trim();

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

                        // Apply flex styles if this level has sub-levels
                        const containerStyle = {
                            paddingLeft: level > 1 ? `1.5ch` : '0',
                            ...(hasSubLevels ? {
                                display: 'flex',
                                flexDirection: 'column' as const,
                                gap: '8px'
                            } : {})
                        };

                        const checkboxKey = `${facetTechId}.${HIERARCHY_PREFIX}${level}`;
                        items.push(
                            <div key={itemKey} style={containerStyle}>
                                <label className="facet-filter-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={!!checked[checkboxKey]?.[facetName]}
                                        onChange={() => handleCheckbox(checkboxKey, facetName)}
                                    /> {displayName}{count > 0 ? ` (${count})` : ''}
                                </label>
                                {/* Render child levels */}
                                {renderHierarchyLevel(level + 1, fullPath)}
                            </div>
                        );
                    }
                });

                return items;
            };

            return (
                <div className="facet-filter-checkbox-list">
                    {renderHierarchyLevel(1)}
                </div>
            );
        }

        // Render non-hierarchy facet
        if (!expandedFacets[facetTechId] || !combinedFacets[facetTechId] || Object.keys(combinedFacets[facetTechId] || {}).length === 0) {
            return null;
        }

        const checkboxKey = `${facetTechId}`;
        return (
            <div className="facet-filter-checkbox-list">
                {Object.entries(combinedFacets[facetTechId] || {}).map(([facetName, count]) => (
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
    };

    // Transform the checked object into an array of facet filters
    useEffect(() => {
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

    // React to changes in unfilteredFacets
    useEffect(() => {
        if (unfilteredFacets) {
            console.log('Unfiltered facets updated:', unfilteredFacets);
            // Additional logic can be added here when unfilteredFacets changes
        }
    }, [unfilteredFacets]);

    // Convert date ranges to numeric filters for search
    useEffect(() => {
        if (Object.keys(dateRanges).length > 0) {
            console.log('Date ranges updated:', dateRanges);
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

    const handleClearAllChecks = () => {
        setChecked({});
        setSelectedFacetFilters([]);
        setDateRanges({});
        setExpandedFacets({}); // Collapse all facets
        setSelectedNumericFilters([]);
        dateRangeRef.current?.reset();
    };

    const handleApplyFilters = () => {
        search();
    };

    return (
        <>
            <div className="facet-filter-container">
                <div className="facet-filter">
                    <div className="facet-filter-header">
                        <span className="facet-filter-header-title">Filters</span>
                        <button className="facet-filter-header-clear" onClick={handleClearAllChecks} type="button">
                            CLEAR ALL
                        </button>
                    </div>
                    <div className="facet-filter-list">
                        {/* Render facets that retrieved from EXC */}
                        {Object.entries(excFacets).map(([facetTechId, facet]) => {
                            const label = (facet as { label: string }).label || facetTechId;

                            return (
                                <div key={facetTechId} className="facet-filter-section">
                                    <button
                                        className="facet-filter-button"
                                        tabIndex={0}
                                        onClick={() => toggle(facetTechId)}
                                        aria-expanded={!!expandedFacets[facetTechId]}
                                    >
                                        <span className="facet-filter-label">{label}</span>
                                        <span className="facet-filter-arrow">{expandedFacets[facetTechId] ? '\u25B2' : '\u25BC'}</span>
                                    </button>
                                    {/* For each facet retrieved from EXC, render the appropriate checkboxes and hierarchy if needed */}
                                    {renderFacetsFromSearchResult(facetTechId)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <button className="facet-filter-apply-btn" type="button" onClick={handleApplyFilters}>
                <span className="facet-filter-apply-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 4 21 4 14 14 14 21 10 21 10 14 3 4" />
                    </svg>
                </span>
                <span className="facet-filter-apply-text">Apply</span>
            </button>
        </>
    );
};

export default Facets; 