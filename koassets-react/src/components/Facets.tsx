import React, { useEffect, useState } from 'react';
import type { FacetCheckedState, FacetsProps } from '../types';
import './Facets.css';

interface OpenState {
    [key: string]: boolean;
}

const HIERARCHY_PREFIX = 'TCCC.#hierarchy.lvl';

const Facets: React.FC<FacetsProps> = ({
    searchResult,
    setSelectedFacetFilters,
    search,
    excFacets = {}
}) => {
    const [open, setOpen] = useState<OpenState>({});
    const [checked, setChecked] = useState<FacetCheckedState>({});

    const toggle = (key: string) => {
        setOpen(prev => ({ ...prev, [key]: !prev[key] }));
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

    /**
     * Renders the facet checkboxes from search results
     * @param facetTechId - The technical ID of the facet
     * @returns JSX element with facet checkboxes or null
     */
    const renderFacetsFromSearchResult = (facetTechId: string) => {
        if (!open[facetTechId]) {
            return null;
        }

        // Check if this is a hierarchy facet by looking for hierarchy keys in search results
        const isHierarchyFacet = Object.keys(searchResult?.facets || {}).some(key =>
            key.startsWith(`${facetTechId}.${HIERARCHY_PREFIX}`)
        );

        if (isHierarchyFacet) {
            // For hierarchy facets, collect all levels that start with our facet pattern
            const hierarchyData: { [level: number]: { [key: string]: number } } = {};

            // Collect all hierarchy levels for this facet
            Object.keys(searchResult?.facets || {}).forEach(key => {
                if (key.startsWith(`${facetTechId}.${HIERARCHY_PREFIX}`)) {
                    // Extract level number from key like "tccc-brand.TCCC.#hierarchy.lvl0"
                    const levelMatch = key.match(/\.lvl(\d+)$/);
                    if (levelMatch) {
                        const level = parseInt(levelMatch[1]);
                        hierarchyData[level] = searchResult?.facets![key] as { [key: string]: number };
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
                                    /> {displayName} ({count})
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

        // Regular facet rendering (non-hierarchy)
        if (!open[facetTechId] || !searchResult?.facets?.[facetTechId] || Object.keys(searchResult.facets[facetTechId] || {}).length === 0) {
            return null;
        }

        const checkboxKey = `${facetTechId}`;
        return (
            <div className="facet-filter-checkbox-list">
                {Object.entries(searchResult.facets[facetTechId] || {}).map(([facetName, count]) => (
                    <label key={facetName} className="facet-filter-checkbox-label">
                        <input
                            type="checkbox"
                            checked={!!checked[checkboxKey]?.[facetName]}
                            onChange={() => handleCheckbox(checkboxKey, facetName)}
                        /> {facetName} ({count})
                    </label>
                ))}
            </div>
        );
    };

    // Sync searchResult?.facets with checked state
    useEffect(() => {
        const handler = setTimeout(() => {
            setChecked(prevChecked => {
                const newChecked: typeof prevChecked = {};
                Object.keys(prevChecked).forEach(key => {
                    if (searchResult?.facets?.[key]) {
                        const filtered = Object.fromEntries(
                            Object.entries(prevChecked[key]).filter(
                                ([facet, isChecked]) => isChecked && Object.keys(searchResult.facets![key]).includes(facet)
                            )
                        );
                        if (Object.keys(filtered).length > 0) {
                            newChecked[key] = filtered;
                        }
                    }
                });
                return newChecked;
            });
        }, 2000); // 2000ms debounce
        return () => clearTimeout(handler);
    }, [searchResult?.facets, setChecked]);

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

    const handleClearAllChecks = () => {
        setChecked({});
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
                                        aria-expanded={!!open[facetTechId]}
                                    >
                                        <span className="facet-filter-label">{label}</span>
                                        <span className="facet-filter-arrow">{open[facetTechId] ? '\u25B2' : '\u25BC'}</span>
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