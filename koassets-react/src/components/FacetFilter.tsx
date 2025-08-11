import React, { useEffect, useState } from 'react';
import type { FacetCheckedState, FacetFilterProps } from '../types';
import './FacetFilter.css';
import { FACETS_NAME_MAP, FACETS_WHITELIST } from './filterMaps';

interface OpenState {
    [key: string]: boolean;
}

const FacetFilter: React.FC<FacetFilterProps> = ({
    searchResult,
    setSelectedFacetFilters,
    search,
    excFacets = []
}) => {
    const [open, setOpen] = useState<OpenState>({});
    const [checked, setChecked] = useState<FacetCheckedState>({});

    const toggle = (key: string) => {
        setOpen(prev => ({ ...prev, [key]: !prev[key] }));
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
                    if (key.endsWith('Date')) {
                        // Date fields are currently not processed for facet filters
                    } else {
                        facetFilter.push(`${key}:${facet}`);
                    }
                }
            });
            facetFilter.length > 0 && newSelectedFacetFilters.push(facetFilter);
        });
        setSelectedFacetFilters(newSelectedFacetFilters);
    }, [checked, setSelectedFacetFilters]);

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
                        {/* Display the facets from the EXC */}
                        {excFacets.map(facetGroup => {
                            const label = FACETS_NAME_MAP[facetGroup as keyof typeof FACETS_NAME_MAP] || facetGroup;

                            // Render if facets exist for this group OR facetGroup is in whitelist
                            if (!searchResult?.facets?.[facetGroup] && !FACETS_WHITELIST.includes(facetGroup)) {
                                return null;
                            }

                            return (
                                <div key={facetGroup} className="facet-filter-section">
                                    <button
                                        className="facet-filter-button"
                                        tabIndex={0}
                                        onClick={() => toggle(facetGroup)}
                                        aria-expanded={!!open[facetGroup]}
                                    >
                                        <span className="facet-filter-label">{label}</span>
                                        <span className="facet-filter-arrow">{open[facetGroup] ? '\u25B2' : '\u25BC'}</span>
                                    </button>
                                    {open[facetGroup] && searchResult?.facets?.[facetGroup] && Object.keys(searchResult.facets[facetGroup] || {}).length > 0 && (
                                        <div className="facet-filter-checkbox-list">
                                            {Object.entries(searchResult.facets[facetGroup] || {}).map(([facetName, count]) => (
                                                <label key={facetName} className="facet-filter-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!checked[facetGroup]?.[facetName]}
                                                        onChange={() => handleCheckbox(facetGroup, facetName)}
                                                    /> {facetName} ({count})
                                                </label>
                                            ))}
                                        </div>
                                    )}
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

export default FacetFilter; 