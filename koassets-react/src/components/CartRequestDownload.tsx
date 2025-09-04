import { CalendarDate } from '@internationalized/date';
import React, { useCallback, useEffect, useState } from 'react';
import { FadelClient, type RightsAttribute } from '../clients/fadel-client';
import type { Asset } from '../types';
import './CartRequestDownload.css';
import MyDatePicker from './MyDatePicker';
import ThumbnailImage from './ThumbnailImage';

interface CartRequestDownloadProps {
    cartItems: Asset[];
    onCancel: () => void;
    onRequestAuthorization: (intendedUse: IntendedUseData) => void;
    onSaveIntendedUse?: (intendedUse: IntendedUseData) => void;
}

interface IntendedUseData {
    airDate?: number | null;
    pullDate?: number | null;
    countries: number[];
    mediaChannels: number[];
}

interface RightsData {
    rightId: number;
    name: string;
    enabled: boolean;
    children?: RightsData[];
}

// Type aliases for clarity
type MarketData = RightsData;
type MediaChannelData = RightsData;

// Generic transform function for rights data
const transformRightsAttributesToRightsData = (rightsAttributes: RightsAttribute[]): RightsData[] => {
    if (!rightsAttributes || rightsAttributes.length === 0) {
        return [];
    }

    const rootAttribute = rightsAttributes[0]; // The root "All" element

    const transformAttribute = (attr: RightsAttribute): RightsData => ({
        rightId: attr.right.rightId,
        name: attr.right.shortDescription,
        enabled: attr.enabled,
        children: attr.childrenLst?.map(transformAttribute) || []
    });

    // First element is "All" from the root
    const allElement: RightsData = {
        rightId: rootAttribute.right.rightId,
        name: rootAttribute.right.shortDescription,
        enabled: rootAttribute.enabled,
        children: []
    };

    // Other elements are from root's childrenLst
    const childElements = rootAttribute.childrenLst?.map(transformAttribute) || [];

    return [allElement, ...childElements];
};

// Convenience functions for specific use cases
const transformMarketRightsToMarketData = (rightsAttributes: RightsAttribute[]): MarketData[] =>
    transformRightsAttributesToRightsData(rightsAttributes);

const transformMediaRightsToMediaChannelData = (rightsAttributes: RightsAttribute[]): MediaChannelData[] =>
    transformRightsAttributesToRightsData(rightsAttributes);

// Utility functions for date conversion
const calendarDateToEpoch = (date: CalendarDate | null): number | null => {
    if (!date) return null;
    return new Date(date.year, date.month - 1, date.day).getTime();
};

// Utility function for converting epoch back to CalendarDate (for future use if needed)
// const epochToCalendarDate = (epochTime: number | null): CalendarDate | null => {
//     if (!epochTime) return null;
//     const date = new Date(epochTime);
//     return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
// };


const CartRequestDownload: React.FC<CartRequestDownloadProps> = ({
    cartItems,
    onCancel,
    onRequestAuthorization,
    onSaveIntendedUse
}) => {
    const [airDate, setAirDate] = useState<CalendarDate | null>(null);
    const [pullDate, setPullDate] = useState<CalendarDate | null>(null);
    const [selectedMarkets, setSelectedMarkets] = useState<Set<number>>(new Set());
    const [selectedMediaChannels, setSelectedMediaChannels] = useState<Set<number>>(new Set());
    const [marketSearchTerm, setMarketSearchTerm] = useState('');
    const [expandedRegions, setExpandedRegions] = useState<Set<number>>(new Set());

    // Market rights data state
    const [marketsData, setMarketsData] = useState<MarketData[]>([]);
    const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
    const [marketsError, setMarketsError] = useState<string>('');

    // Media channels data state
    const [mediaChannelsData, setMediaChannelsData] = useState<MediaChannelData[]>([]);
    const [isLoadingMediaChannels, setIsLoadingMediaChannels] = useState(true);
    const [mediaChannelsError, setMediaChannelsError] = useState<string>('');

    // Add validation error message state
    const [dateValidationError, setDateValidationError] = useState<string>('');

    // Fetch market rights data on component mount
    useEffect(() => {
        const fetchMarketRights = async () => {
            try {
                setIsLoadingMarkets(true);
                setMarketsError('');

                const client = new FadelClient();
                const response = await client.fetchMarketRights();

                // Transform the data (already includes "All" as first element)
                const transformedData = transformMarketRightsToMarketData(response.attribute);

                setMarketsData(transformedData);
            } catch (error) {
                console.error('Error fetching market rights:', error);
                setMarketsError('Failed to load markets data. Please try again later.');

                // Fallback to empty data with just "All" option
                setMarketsData([{ rightId: 0, name: 'All', enabled: true, children: [] }]);
            } finally {
                setIsLoadingMarkets(false);
            }
        };

        fetchMarketRights();
    }, []);

    // Fetch media channels data on component mount
    useEffect(() => {
        const fetchMediaChannels = async () => {
            try {
                setIsLoadingMediaChannels(true);
                setMediaChannelsError('');

                const client = new FadelClient();
                const response = await client.fetchMediaRights();

                // Transform the data (already includes "All" as first element)
                const transformedData = transformMediaRightsToMediaChannelData(response.attribute);

                setMediaChannelsData(transformedData);
            } catch (error) {
                console.error('Error fetching media channels:', error);
                setMediaChannelsError('Failed to load media channels data. Please try again later.');

                // Fallback to empty data with just "All" option
                setMediaChannelsData([{ rightId: 0, name: 'All', enabled: true, children: [] }]);
            } finally {
                setIsLoadingMediaChannels(false);
            }
        };

        fetchMediaChannels();
    }, []);

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

    // Get the "All" option ID (first item in the list)
    const getAllOptionId = useCallback(() => {
        return marketsData.length > 0 ? marketsData[0].rightId : 0;
    }, [marketsData]);

    // Filter markets based on search term
    const filteredMarkets = marketsData.filter(market =>
        market.name.toLowerCase().includes(marketSearchTerm.toLowerCase()) ||
        market.children?.some(child =>
            child.name.toLowerCase().includes(marketSearchTerm.toLowerCase())
        )
    );

    const handleMarketToggle = useCallback((marketId: number) => {
        // Find the market to check if it's enabled
        const market = marketsData.find(m => m.rightId === marketId) ||
            marketsData.find(m => m.children?.some(c => c.rightId === marketId))?.children?.find(c => c.rightId === marketId);

        // Don't allow toggling disabled items
        if (market && !market.enabled) {
            return;
        }

        const allOptionId = getAllOptionId();
        setSelectedMarkets(prev => {
            const newSet = new Set(prev);

            if (marketId === allOptionId) {
                // If selecting 'all', clear everything and only keep 'all'
                if (newSet.has(allOptionId)) {
                    newSet.delete(allOptionId);
                } else {
                    newSet.clear();
                    newSet.add(allOptionId);
                }
            } else {
                // If selecting any other market, remove 'all' if it's selected
                if (newSet.has(allOptionId)) {
                    newSet.delete(allOptionId);
                }

                // Toggle the selected market
                if (newSet.has(marketId)) {
                    newSet.delete(marketId);
                } else {
                    newSet.add(marketId);
                }
            }

            return newSet;
        });
    }, [getAllOptionId, marketsData]);

    // Get the "All" option ID for media channels (first item in the list)
    const getAllMediaChannelOptionId = useCallback(() => {
        return mediaChannelsData.length > 0 ? mediaChannelsData[0].rightId : 0;
    }, [mediaChannelsData]);

    const handleMediaChannelToggle = useCallback((channelId: number) => {
        // Find the channel to check if it's enabled
        const channel = mediaChannelsData.find(c => c.rightId === channelId);

        // Don't allow toggling disabled items
        if (channel && !channel.enabled) {
            return;
        }

        const allOptionId = getAllMediaChannelOptionId();
        setSelectedMediaChannels(prev => {
            const newSet = new Set(prev);

            if (channelId === allOptionId) {
                // If selecting 'All', clear everything and only keep 'All'
                if (newSet.has(allOptionId)) {
                    newSet.delete(allOptionId);
                } else {
                    newSet.clear();
                    newSet.add(allOptionId);
                }
            } else {
                // If selecting any other media channel, remove 'All' if it's selected
                if (newSet.has(allOptionId)) {
                    newSet.delete(allOptionId);
                }

                // Toggle the selected channel
                if (newSet.has(channelId)) {
                    newSet.delete(channelId);
                } else {
                    newSet.add(channelId);
                }
            }

            return newSet;
        });
    }, [getAllMediaChannelOptionId, mediaChannelsData]);

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

    const handleSaveIntendedUse = useCallback(() => {
        const intendedUseData: IntendedUseData = {
            airDate: calendarDateToEpoch(airDate),
            pullDate: calendarDateToEpoch(pullDate),
            countries: Array.from(selectedMarkets),
            mediaChannels: Array.from(selectedMediaChannels)
        };
        onSaveIntendedUse?.(intendedUseData);
    }, [airDate, pullDate, selectedMarkets, selectedMediaChannels, onSaveIntendedUse]);

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
        const intendedUseData: IntendedUseData = {
            airDate: calendarDateToEpoch(airDate),
            pullDate: calendarDateToEpoch(pullDate),
            countries: Array.from(selectedMarkets),
            mediaChannels: Array.from(selectedMediaChannels)
        };
        console.log('Requesting authorization with intended use data:', intendedUseData);
        onRequestAuthorization(intendedUseData);
    }, [airDate, pullDate, selectedMarkets, selectedMediaChannels, onRequestAuthorization]);

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
                                                            checked={selectedMarkets.has(market.rightId)}
                                                            disabled={!market.enabled || (market.rightId !== getAllOptionId() && selectedMarkets.has(getAllOptionId()))}
                                                            onChange={() => handleMarketToggle(market.rightId)}
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
                                                                <label key={child.rightId} className={`checkbox-label child-market ${!child.enabled ? 'disabled' : ''}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedMarkets.has(child.rightId)}
                                                                        disabled={!child.enabled || selectedMarkets.has(getAllOptionId())}
                                                                        onChange={() => handleMarketToggle(child.rightId)}
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
                                                    checked={selectedMediaChannels.has(channel.rightId)}
                                                    disabled={!channel.enabled || (channel.rightId !== getAllMediaChannelOptionId() && selectedMediaChannels.has(getAllMediaChannelOptionId()))}
                                                    onChange={() => handleMediaChannelToggle(channel.rightId)}
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
                            disabled={true}
                            className="save-intended-use-btn secondary-button"
                            onClick={handleSaveIntendedUse}
                            type="button"
                        >
                            Save Intended Use
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
