import { CalendarDate } from '@internationalized/date';
import React, { useCallback, useState } from 'react';
import type { Asset, RequestDownloadStepData, RightsData } from '../types';
import './CartRequestDownload.css';
import Markets from './Markets';
import MediaChannels from './MediaChannels';
import MyDatePicker from './MyDatePicker';
import ThumbnailImage from './ThumbnailImage';

interface CartRequestDownloadProps {
    cartItems: Asset[];
    onCancel: () => void;
    onOpenRightsCheck: (stepData: RequestDownloadStepData) => void;
    onBack: (stepData: RequestDownloadStepData) => void;
    initialData?: RequestDownloadStepData;
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
    initialData
}) => {
    const [airDate, setAirDate] = useState<CalendarDate | null>(initialData?.airDate || null);
    const [pullDate, setPullDate] = useState<CalendarDate | null>(initialData?.pullDate || null);
    const [selectedMarkets, setSelectedMarkets] = useState<Set<RightsData>>(
        initialData?.selectedMarkets ||
        (initialData?.markets ? new Set(initialData.markets) : new Set())
    );
    const [selectedMediaChannels, setSelectedMediaChannels] = useState<Set<RightsData>>(
        initialData?.selectedMediaChannels ||
        (initialData?.mediaChannels ? new Set(initialData.mediaChannels) : new Set())
    );

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


    // Helper function to get current step data
    const getCurrentStepData = useCallback((): RequestDownloadStepData => ({
        airDate,
        pullDate,
        markets: Array.from(selectedMarkets),
        mediaChannels: Array.from(selectedMediaChannels),
        selectedMarkets,
        selectedMediaChannels,
        marketSearchTerm: '',
        dateValidationError
    }), [airDate, pullDate, selectedMarkets, selectedMediaChannels, dateValidationError]);


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

                            <Markets
                                selectedMarkets={selectedMarkets}
                                setSelectedMarkets={setSelectedMarkets}
                            />
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

                            <MediaChannels
                                selectedMediaChannels={selectedMediaChannels}
                                setSelectedMediaChannels={setSelectedMediaChannels}
                            />
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
