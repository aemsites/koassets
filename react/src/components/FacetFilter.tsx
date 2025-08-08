import React, { useEffect, useMemo, useState } from 'react';
import type { FacetCheckedState, FacetFilterProps } from '../types';
import './FacetFilter.css';

interface FiltersMap {
    [key: string]: string;
}

interface FacetsFromHits {
    [key: string]: string[];
}

interface OpenState {
    [key: string]: boolean;
}

export const FILTERS_MAP: FiltersMap = {
    'dc-format-label': 'File Format',
    'dc-subject': 'Subject',
    'repo-modifyDate': 'Modified Date', // TODO
    'xcm-colorDistribution': 'Color Distribution', // TODO
    'xcm-machineKeywords': 'Machine Keywords',
    'xdm-activeDates': 'Active Dates',
    'xdm-campaignName': 'Campaign Name',
    'xdm-channelName': 'Channel Name',
    'xdm-region': 'Region'
};

const FacetFilter: React.FC<FacetFilterProps> = ({
    hits = [],
    setSelectedFacets,
    search
}) => {
    const [open, setOpen] = useState<OpenState>({});
    const [checked, setChecked] = useState<FacetCheckedState>({});

    const toggle = (key: string) => {
        setOpen(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // 'hits' changed --> 'facetsFromHits' changed --> 'checked' state updated --> 'selectedFacets' updated
    const facetsFromHits = useMemo<FacetsFromHits>(() => {
        const facets: FacetsFromHits = {};
        Object.keys(FILTERS_MAP).forEach(key => {
            const values = new Set<string>();
            hits?.forEach(hit => {
                const value = hit[key];
                if (key.toLowerCase().includes('date')) {
                    // skip
                } else if (typeof value === 'string') {
                    value && values.add(value);
                } else if (Array.isArray(value)) {
                    value.forEach(v => typeof v === 'string' && v && values.add(v));
                }
            });
            facets[key] = Array.from(values);
        });
        return facets;
    }, [hits]);

    // Sync facetsFromHits with checked state
    useEffect(() => {
        const handler = setTimeout(() => {
            setChecked(prevChecked => {
                const newChecked: typeof prevChecked = {};
                Object.keys(prevChecked).forEach(key => {
                    if (facetsFromHits[key]) {
                        const filtered = Object.fromEntries(
                            Object.entries(prevChecked[key]).filter(
                                ([facet, isChecked]) => isChecked && facetsFromHits[key].includes(facet)
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
    }, [facetsFromHits, setChecked]);

    // Transform the checked object into an array of facet filters
    useEffect(() => {
        const newSelectedFacets: string[][] = [];
        Object.keys(checked).forEach(key => {
            const facetFilter: string[] = [];
            Object.entries(checked[key]).forEach(([facet, isChecked]) => {
                if (isChecked) {
                    if (key.endsWith('Date')) {
                    } else {
                        facetFilter.push(`${key}:${facet}`);
                    }
                }
            });
            facetFilter.length > 0 && newSelectedFacets.push(facetFilter);
        });
        setSelectedFacets(newSelectedFacets);
    }, [checked, setSelectedFacets]);

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
                        {Object.entries(FILTERS_MAP).map(([key, label]) => (
                            <div key={key} className="facet-filter-section">
                                <button
                                    className="facet-filter-button"
                                    tabIndex={0}
                                    onClick={() => toggle(key)}
                                    aria-expanded={!!open[key]}
                                >
                                    <span className="facet-filter-label">{label}</span>
                                    <span className="facet-filter-arrow">{open[key] ? '\u25B2' : '\u25BC'}</span>
                                </button>
                                {open[key] && facetsFromHits[key]?.length > 0 && (
                                    <div className="facet-filter-checkbox-list">
                                        {facetsFromHits[key].map(facet => (
                                            <label key={facet} className="facet-filter-checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={!!checked[key]?.[facet]}
                                                    onChange={() => handleCheckbox(key, facet)}
                                                /> {facet}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
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