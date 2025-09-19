import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useState } from 'react';
import { FadelClient, type RightsAttribute } from '../clients/fadel-client';
import type { RightsData } from '../types';

interface MarketsProps {
    includeSearchBox?: boolean;
    selectedMarkets: Set<RightsData>;
    setSelectedMarkets: React.Dispatch<React.SetStateAction<Set<RightsData>>>;
}

const Markets: React.FC<MarketsProps> = ({
    includeSearchBox = true,
    selectedMarkets,
    setSelectedMarkets
}) => {
    // Internal state for markets data
    const [marketsData, setMarketsData] = useState<RightsData[]>([]);
    const [isLoadingMarkets, setIsLoadingMarkets] = useState<boolean>(false);
    const [marketsError, setMarketsError] = useState<string>('');
    const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);

    // Local state for UI interactions
    const [marketSearchTerm, setMarketSearchTerm] = useState<string>('');
    const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());

    // Transform RightsAttribute[] to RightsData[]
    const transformRightsAttributesToRightsData = useCallback((rightsAttributes: RightsAttribute[]): RightsData[] => {
        if (!rightsAttributes || rightsAttributes.length === 0) {
            return [];
        }

        const rootAttribute = rightsAttributes[0]; // The root "All" element

        const transformAttribute = (attr: RightsAttribute): RightsData => ({
            id: attr.id,
            rightId: attr.right.rightId,
            name: attr.right.description,
            enabled: attr.enabled,
            children: attr.childrenLst?.map(transformAttribute) || []
        });

        // First element is "All" from the root
        const allElement: RightsData = {
            id: rootAttribute.id,
            rightId: rootAttribute.right.rightId,
            name: rootAttribute.right.description,
            enabled: rootAttribute.enabled,
            children: []
        };

        // Other elements are from root's childrenLst
        const childElements = rootAttribute.childrenLst?.map(transformAttribute) || [];

        return [allElement, ...childElements];
    }, []);

    // Fetch markets data
    const fetchMarketsData = useCallback(async () => {
        if (isDataLoaded) {
            return; // Already loaded, no need to fetch again
        }

        setIsLoadingMarkets(true);
        setMarketsError('');

        try {
            const fadelClient = FadelClient.getInstance();
            const marketRightsResponse = await fadelClient.fetchMarketRights();

            const transformedData = transformRightsAttributesToRightsData(marketRightsResponse.attribute);
            setMarketsData(transformedData);
            setIsDataLoaded(true);
        } catch (error) {
            console.error('Failed to fetch markets data:', error);
            setMarketsError('Failed to load markets');
            ToastQueue.negative('Failed to fetch Markets Data', { timeout: 2000 });

            // Set empty data but mark as loaded to prevent infinite retries
            setMarketsData([]);
            setIsDataLoaded(true);
        } finally {
            setIsLoadingMarkets(false);
        }
    }, [isDataLoaded, transformRightsAttributesToRightsData]);

    // Fetch data when component mounts
    useEffect(() => {
        if (!isDataLoaded) {
            fetchMarketsData();
        }
    }, [fetchMarketsData, isDataLoaded]);

    // Get the "All" option (first item in the list)
    const getAllOption = useCallback(() => {
        return marketsData.length > 0 ? marketsData[0] : null;
    }, [marketsData]);

    // Helper function to check if a parent market is selected
    const isParentMarketSelected = useCallback((childRightId: number) => {
        // Find which parent market contains this child
        const parentMarket = marketsData.find(market =>
            market.children?.some(child => child.rightId === childRightId)
        );

        if (!parentMarket) return false;

        // Check if the parent is selected
        return Array.from(selectedMarkets).some(m => m.rightId === parentMarket.rightId);
    }, [marketsData, selectedMarkets]);

    // Helper function to check if "All" is selected
    const isAllMarketsSelected = useCallback(() => {
        const allOption = getAllOption();
        return allOption ? Array.from(selectedMarkets).some(m => m.rightId === allOption.rightId) : false;
    }, [selectedMarkets, getAllOption]);

    // Filter markets based on search term
    const filteredMarkets = marketsData.filter(market =>
        market.name.toLowerCase().includes(marketSearchTerm.toLowerCase()) ||
        market.children?.some(child =>
            child.name.toLowerCase().includes(marketSearchTerm.toLowerCase())
        )
    );

    const handleMarketToggle = useCallback((market: RightsData) => {
        // Don't allow toggling disabled items
        if (!market.enabled) {
            return;
        }

        // Don't allow toggling children if their parent is selected
        if (isParentMarketSelected(market.rightId)) {
            return;
        }

        const allOption = getAllOption();
        setSelectedMarkets((prev: Set<RightsData>) => {
            const newSet = new Set(prev);

            if (allOption && market.rightId === allOption.rightId) {
                // If selecting 'all', clear everything and only keep 'all'
                const hasAllOption = Array.from(newSet).some(m => m.rightId === allOption.rightId);
                if (hasAllOption) {
                    // Remove all option
                    newSet.forEach(m => {
                        if (m.rightId === allOption.rightId) {
                            newSet.delete(m);
                        }
                    });
                } else {
                    newSet.clear();
                    newSet.add(allOption);
                }
            } else {
                // If selecting any other market, remove 'all' if it's selected
                if (allOption) {
                    newSet.forEach(m => {
                        if (m.rightId === allOption.rightId) {
                            newSet.delete(m);
                        }
                    });
                }

                // Toggle the selected market
                const existingMarket = Array.from(newSet).find(m => m.rightId === market.rightId);
                if (existingMarket) {
                    newSet.delete(existingMarket);
                } else {
                    // When selecting a parent market, remove any of its children that are selected
                    if (market.children && market.children.length > 0) {
                        market.children.forEach(child => {
                            const selectedChild = Array.from(newSet).find(m => m.rightId === child.rightId);
                            if (selectedChild) {
                                newSet.delete(selectedChild);
                            }
                        });
                    }

                    newSet.add(market);
                }
            }

            return newSet;
        });
    }, [getAllOption, isParentMarketSelected, setSelectedMarkets]);

    const handleRegionToggle = useCallback((regionId: number) => {
        setExpandedRegions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(regionId)) {
                newSet.delete(regionId);
            } else {
                newSet.add(regionId);
            }
            return newSet;
        });
    }, []);

    return (
        <>
            {/* Search Markets */}
            {includeSearchBox && (
                <div className="search-markets">
                    <input
                        type="text"
                        placeholder="Search Markets"
                        value={marketSearchTerm}
                        onChange={(e) => setMarketSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            )}

            {/* Markets List */}
            <div className="markets-list">
                {isLoadingMarkets ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <span>Loading markets...</span>
                    </div>
                ) : marketsError ? (
                    <div className="error-message">{marketsError}</div>
                ) : (
                    filteredMarkets.map((market, index) => (
                        <React.Fragment key={market.rightId}>
                            <div className="market-item">
                                <div className="market-main">
                                    <label className={`checkbox-label ${!market.enabled ? 'disabled' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={Array.from(selectedMarkets).some(m => m.rightId === market.rightId)}
                                            disabled={!market.enabled || (() => {
                                                const allOption = getAllOption();
                                                return Boolean(allOption && market.rightId !== allOption.rightId && isAllMarketsSelected());
                                            })()}
                                            onChange={() => handleMarketToggle(market)}
                                        />
                                        {market.name}
                                    </label>
                                    {market.children && market.children.length > 0 && (
                                        <button
                                            className="expand-button"
                                            onClick={() => handleRegionToggle(market.rightId)}
                                            type="button"
                                        >
                                            {expandedRegions.has(market.rightId) ? '▲' : '▼'}
                                        </button>
                                    )}
                                </div>

                                {/* Child Markets */}
                                {market.children && market.children.length > 0 && expandedRegions.has(market.rightId) && (
                                    <div className="market-children">
                                        {market.children
                                            .filter(child =>
                                                !marketSearchTerm ||
                                                child.name.toLowerCase().includes(marketSearchTerm.toLowerCase())
                                            )
                                            .map((child) => (
                                                <label key={child.rightId} className={`checkbox-label child-market ${!child.enabled || isParentMarketSelected(child.rightId) ? 'disabled' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={Array.from(selectedMarkets).some(m => m.rightId === child.rightId)}
                                                        disabled={!child.enabled || isAllMarketsSelected() || isParentMarketSelected(child.rightId)}
                                                        onChange={() => handleMarketToggle(child)}
                                                    />
                                                    {child.name}
                                                </label>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                            {index === 0 && <div className="horizontal-separator" />}
                        </React.Fragment>
                    ))
                )}
            </div>
        </>
    );
};

export default Markets;
