import { CalendarDate } from '@internationalized/date';
import React, { useCallback, useState } from 'react';
import type { Asset, CachedRightsData, RequestDownloadStepData, RightsData } from '../types';
import './CartRequestDownload.css';
import MyDatePicker from './MyDatePicker';
import ThumbnailImage from './ThumbnailImage';

interface CartRequestDownloadProps {
    cartItems: Asset[];
    onCancel: () => void;
    onOpenRightsCheck: (stepData: RequestDownloadStepData) => void;
    onBack: (stepData: RequestDownloadStepData) => void;
    initialData?: RequestDownloadStepData;
    cachedRightsData: CachedRightsData;
}




// Utility functions for date conversion
// Note: CalendarDate to epoch conversion removed as it's no longer needed

// Utility function for converting epoch back to CalendarDate (for future use if needed)
// const epochToCalendarDate = (epochTime: number | null): CalendarDate | null => {
//     if (!epochTime) return null;
//     const date = new Date(epochTime);
//     return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
// };



const CartRequestDownload: React.FC<CartRequestDownloadProps> = ({
    cartItems,
    onCancel,
    onOpenRightsCheck,
    onBack,
    initialData,
    cachedRightsData
}) => {
    const [airDate, setAirDate] = useState<CalendarDate | null>(initialData?.airDate || null);
    const [pullDate, setPullDate] = useState<CalendarDate | null>(initialData?.pullDate || null);
    const [selectedMarkets, setSelectedMarkets] = useState<Set<RightsData>>(
        initialData?.selectedMarkets ||
        (initialData?.countries ? new Set(initialData.countries) : new Set())
    );
    const [selectedMediaChannels, setSelectedMediaChannels] = useState<Set<RightsData>>(
        initialData?.selectedMediaChannels ||
        (initialData?.mediaChannels ? new Set(initialData.mediaChannels) : new Set())
    );
    const [marketSearchTerm, setMarketSearchTerm] = useState(initialData?.marketSearchTerm || '');
    const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());

    // Use cached rights data from parent
    const marketsData = cachedRightsData.marketsData;
    const mediaChannelsData = cachedRightsData.mediaChannelsData;
    const isLoadingMarkets = !cachedRightsData.isLoaded;
    const isLoadingMediaChannels = !cachedRightsData.isLoaded;
    const marketsError = '';
    const mediaChannelsError = '';

    // Add validation error message state
    const [dateValidationError, setDateValidationError] = useState<string>(initialData?.dateValidationError || '');

    // Validate date relationship and set error messages
    const validateDates = useCallback((air: CalendarDate | null, pull: CalendarDate | null) => {
        if (air && pull) {
            const airDateJS = new Date(air.year, air.month - 1, air.day);
            const pullDateJS = new Date(pull.year, pull.month - 1, pull.day);
            const nextDayAfterAir = new Date(airDateJS);
            nextDayAfterAir.setDate(airDateJS.getDate() + 1);

            if (pullDateJS < nextDayAfterAir) {
                setDateValidationError('Pull date must be at least 1 day after air date');
            } else {
                setDateValidationError('');
            }
        } else {
            setDateValidationError('');
        }
    }, []);

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
        setSelectedMarkets(prev => {
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
    }, [getAllOption, isParentMarketSelected]);

    // Get the "All" option for media channels (first item in the list)
    const getAllMediaChannelOption = useCallback(() => {
        return mediaChannelsData.length > 0 ? mediaChannelsData[0] : null;
    }, [mediaChannelsData]);

    // Helper functions to check if "All" is selected
    const isAllMarketsSelected = useCallback(() => {
        const allOption = getAllOption();
        return allOption ? Array.from(selectedMarkets).some(m => m.rightId === allOption.rightId) : false;
    }, [selectedMarkets, getAllOption]);

    const isAllMediaChannelsSelected = useCallback(() => {
        const allOption = getAllMediaChannelOption();
        return allOption ? Array.from(selectedMediaChannels).some(c => c.rightId === allOption.rightId) : false;
    }, [selectedMediaChannels, getAllMediaChannelOption]);

    const handleMediaChannelToggle = useCallback((channel: RightsData) => {
        // Don't allow toggling disabled items
        if (!channel.enabled) {
            return;
        }

        const allOption = getAllMediaChannelOption();
        setSelectedMediaChannels(prev => {
            const newSet = new Set(prev);

            if (allOption && channel.rightId === allOption.rightId) {
                // If selecting 'All', clear everything and only keep 'All'
                const hasAllOption = Array.from(newSet).some(c => c.rightId === allOption.rightId);
                if (hasAllOption) {
                    // Remove all option
                    newSet.forEach(c => {
                        if (c.rightId === allOption.rightId) {
                            newSet.delete(c);
                        }
                    });
                } else {
                    newSet.clear();
                    newSet.add(allOption);
                }
            } else {
                // If selecting any other media channel, remove 'All' if it's selected
                if (allOption) {
                    newSet.forEach(c => {
                        if (c.rightId === allOption.rightId) {
                            newSet.delete(c);
                        }
                    });
                }

                // Toggle the selected channel
                const existingChannel = Array.from(newSet).find(c => c.rightId === channel.rightId);
                if (existingChannel) {
                    newSet.delete(existingChannel);
                } else {
                    newSet.add(channel);
                }
            }

            return newSet;
        });
    }, [getAllMediaChannelOption]);

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

    // Helper function to get current step data
    const getCurrentStepData = useCallback((): RequestDownloadStepData => ({
        airDate,
        pullDate,
        countries: Array.from(selectedMarkets),
        mediaChannels: Array.from(selectedMediaChannels),
        selectedMarkets,
        selectedMediaChannels,
        marketSearchTerm,
        dateValidationError
    }), [airDate, pullDate, selectedMarkets, selectedMediaChannels, marketSearchTerm, dateValidationError]);


    // Validation logic for form completion
    const isFormValid = useCallback(() => {
        // Basic field validation
        if (selectedMarkets.size === 0 ||
            selectedMediaChannels.size === 0 ||
            airDate === null ||
            pullDate === null) {
            return false;
        }

        // Validate that pull date is at least 1 day after air date
        const airDateJS = new Date(airDate.year, airDate.month - 1, airDate.day);
        const pullDateJS = new Date(pullDate.year, pullDate.month - 1, pullDate.day);
        const nextDayAfterAir = new Date(airDateJS);
        nextDayAfterAir.setDate(airDateJS.getDate() + 1);

        return pullDateJS >= nextDayAfterAir;
    }, [selectedMarkets.size, selectedMediaChannels.size, airDate, pullDate]);

    const handleRequestAuthorization = useCallback(() => {
        const requestDownloadData = getCurrentStepData();
        console.log('Requesting authorization with request download data:', requestDownloadData);
        onOpenRightsCheck(requestDownloadData);
    }, [onOpenRightsCheck, getCurrentStepData]);

    return (
        <div className="cart-request-download">
            <div className="cart-request-download-content">
                {/* Asset List Column */}
                <div className="cart-request-download-assets">
                    <h3>Asset List</h3>
                    <div className="asset-list-items">
                        {cartItems.map((item: Asset) => (
                            <div key={item.assetId} className="asset-list-item">
                                <div className="asset-thumbnail">
                                    <ThumbnailImage item={item} />
                                </div>
                                <div className="asset-details">
                                    <div className="asset-title">{item.title || item.name}</div>
                                    <div className="asset-type">TYPE: {item.formatLabel?.toUpperCase()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Intended Use Form Column */}
                <div className="cart-request-download-form">
                    <div className="cart-request-download-form-content">
                        <h3>Intended Use</h3>

                        {/* Air Date */}
                        <div className="form-field">
                            <label>
                                When do you intend to air these assets? Select date:
                                <span className="gallery-title-icon" title="Select the intended air date"></span>
                            </label>
                            <MyDatePicker
                                value={airDate}
                                onChange={(date) => {
                                    setAirDate(date);
                                    validateDates(date, pullDate);
                                }}
                                showClearButton={!!airDate}
                                onClear={() => {
                                    setAirDate(null);
                                    validateDates(null, pullDate);
                                }}
                                aria-label="Select intended air date"
                            />
                        </div>

                        {/* Pull Date */}
                        <div className="form-field">
                            <label>
                                When do you intend to pull these assets? Select date:
                                <span className="gallery-title-icon" title="Select the intended pull date"></span>
                            </label>
                            <MyDatePicker
                                value={pullDate}
                                onChange={(date) => {
                                    setPullDate(date);
                                    validateDates(airDate, date);
                                }}
                                showClearButton={!!pullDate}
                                onClear={() => {
                                    setPullDate(null);
                                    validateDates(airDate, null);
                                }}
                                aria-label="Select intended pull date"
                            />
                            {dateValidationError && (
                                <div className="date-validation-error">
                                    {dateValidationError}
                                </div>
                            )}
                        </div>

                        {/* Markets Selection */}
                        <div className="form-field">
                            <label>
                                What specific markets will you air these assets in?
                                <span className="gallery-title-icon" title="Select markets"></span>
                            </label>
                            <div className="markets-warning">
                                Please do not select a region or Operating Unit unless you will be airing in all markets found within that region or operating unit. Selecting an OU will automatically disable its associated markets. You can choose either OUs or individual markets, but not both.
                            </div>

                            {/* Search Markets */}
                            <div className="search-markets">
                                <input
                                    type="text"
                                    placeholder="Search Markets"
                                    value={marketSearchTerm}
                                    onChange={(e) => setMarketSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>

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
                        </div>

                        {/* Media Channels Selection */}
                        <div className="form-field">
                            <label>
                                What specific TCCC media channels will you be airing these assets on?
                                <span className="gallery-title-icon" title="Select media channels"></span>
                            </label>
                            <div className="media-channels-warning">
                                Please refer to the TCCC media terms and definitions found on KO Assets to determine. Choosing other media types disables 'Internal Use'. Select either 'Internal Use' or others, not both.
                            </div>

                            <div className="media-channels-list">
                                {isLoadingMediaChannels ? (
                                    <div className="loading-container">
                                        <div className="loading-spinner"></div>
                                        <span>Loading media channels...</span>
                                    </div>
                                ) : mediaChannelsError ? (
                                    <div className="error-message">{mediaChannelsError}</div>
                                ) : (
                                    mediaChannelsData.map((channel, index) => (
                                        <React.Fragment key={channel.rightId}>
                                            <label className={`checkbox-label ${!channel.enabled ? 'disabled' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={Array.from(selectedMediaChannels).some(c => c.rightId === channel.rightId)}
                                                    disabled={!channel.enabled || (() => {
                                                        const allOption = getAllMediaChannelOption();
                                                        return Boolean(allOption && channel.rightId !== allOption.rightId && isAllMediaChannelsSelected());
                                                    })()}
                                                    onChange={() => handleMediaChannelToggle(channel)}
                                                />
                                                {channel.name}
                                            </label>
                                            {index === 0 && <div className="horizontal-separator" />}
                                        </React.Fragment>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons - Outside scrolling area */}
                    <div className="form-actions">
                        <button
                            className="back-btn secondary-button"
                            onClick={() => onBack(getCurrentStepData())}
                            type="button"
                        >
                            Back
                        </button>

                        <div className="form-actions-right">
                            <button
                                className="cancel-btn secondary-button"
                                onClick={onCancel}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                className="request-authorization-btn primary-button"
                                onClick={handleRequestAuthorization}
                                disabled={!isFormValid()}
                                type="button"
                            >
                                Request Authorization
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartRequestDownload;
