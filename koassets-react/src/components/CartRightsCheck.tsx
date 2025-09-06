import type { CalendarDate } from '@internationalized/date';
import React, { useCallback, useEffect, useState } from 'react';
import type { Asset, RequestDownloadStepData, RightsCheckStepData } from '../types';
import './CartRightsCheck.css';
import DownloadRenditionsContent from './DownloadRenditionsContent';
import ThumbnailImage from './ThumbnailImage';

interface CartRightsCheckProps {
    cartItems: Asset[];
    intendedUse: RequestDownloadStepData;
    onCancel: () => void;
    onOpenRequestRightsExtension: (restrictedAssets: Asset[], requestDownloadData: RequestDownloadStepData) => void;
    onBack: (stepData: RightsCheckStepData) => void;
    initialData?: RightsCheckStepData;
    onDownloadCompleted?: (success: boolean, successfulAssets?: Asset[]) => void;
}


interface DownloadOptions {
    assetId: string;
    originalAsset: boolean;
    allRenditions: boolean;
}


const CartRightsCheck: React.FC<CartRightsCheckProps> = ({
    cartItems,
    intendedUse,
    onCancel,
    onOpenRequestRightsExtension,
    onBack,
    initialData,
    onDownloadCompleted
}) => {
    const [downloadOptions] = useState<Record<string, DownloadOptions>>(initialData?.downloadOptions || {});

    // Local state for authorized assets (so we can modify it when downloads complete)
    const [authorizedAssets, setAuthorizedAssets] = useState<Asset[]>(() =>
        cartItems.filter(item => item?.readyToUse?.toLowerCase() === 'yes')
    );

    const restrictedAssets = cartItems.filter(item =>
        item?.readyToUse?.toLowerCase() !== 'yes'
    );

    // Sync authorized assets when cartItems changes (in case items are added/removed from outside)
    useEffect(() => {
        const newAuthorizedAssets = cartItems.filter(item =>
            item?.readyToUse?.toLowerCase() === 'yes'
        );
        setAuthorizedAssets(newAuthorizedAssets);
    }, [cartItems]);

    const formatDate = (calendarDate: CalendarDate | null | undefined): string => {
        if (!calendarDate) return '';
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[calendarDate.month - 1]} ${String(calendarDate.day).padStart(2, '0')}, ${calendarDate.year}`;
    };


    // Helper function to get current step data
    const getCurrentStepData = useCallback((): RightsCheckStepData => ({
        downloadOptions,
        agreesToTerms: true // DownloadRenditionsContent handles its own terms
    }), [downloadOptions]);

    // Handler function to request rights extension
    const handleOpenRightsExtension = useCallback(() => {
        onOpenRequestRightsExtension(restrictedAssets, intendedUse);
    }, [restrictedAssets, intendedUse, onOpenRequestRightsExtension]);

    return (
        <div className="cart-rights-check">
            <div className="cart-rights-check-content">
                {/* Intended Use Summary */}
                <div className="intended-use-summary">
                    <h3>Intended Use</h3>
                    <div className="intended-use-details">
                        <div className="intended-use-item">
                            <label>INTENDED AIR DATE</label>
                            <div>{formatDate(intendedUse.airDate)}</div>
                        </div>
                        <div className="intended-use-item">
                            <label>INTENDED PULL DATE</label>
                            <div>{formatDate(intendedUse.pullDate)}</div>
                        </div>
                        <div className="intended-use-item">
                            <label>INTENDED MARKETS</label>
                            <div>{intendedUse.countries.map(c => c.name).join(', ')}</div>
                        </div>
                        <div className="intended-use-item">
                            <label>INTENDED MEDIA</label>
                            <div>{intendedUse.mediaChannels.map(c => c.name).join(', ')}</div>
                        </div>
                    </div>
                </div>

                {/* Rights-free Assets Section */}
                {authorizedAssets.length > 0 && (
                    <div className="assets-section authorized-assets">
                        <h3>Assets Cleared - Available to Download</h3>
                        <div className="authorization-status authorized">
                            Usage Is Authorized For {authorizedAssets.length} Of {cartItems.length} Assets
                        </div>

                        <DownloadRenditionsContent
                            assets={authorizedAssets.map(asset => ({
                                asset,
                                renditionsLoading: false,
                                renditionsError: null
                            }))}
                            onClose={() => {
                                // Handle close action if needed
                                console.log('Download renditions closed');
                            }}
                            onDownloadCompleted={(success, successfulAssets) => {
                                console.log('Download completed:', success, 'Successful assets:', successfulAssets);
                                onDownloadCompleted?.(success, successfulAssets);
                            }}
                            showCancel={false}
                        />
                    </div>
                )}

                {/* Restricted Assets Section */}
                {restrictedAssets.length > 0 && (
                    <div className="assets-section restricted-assets">
                        <h3>Assets Restricted - Please Request Rights Extension</h3>
                        <div className="authorization-status restricted">
                            Rights Restricted For {restrictedAssets.length} Of {cartItems.length} Assets
                        </div>

                        <div className="assets-table">
                            <div className="table-header">
                                <div className="col-thumbnail">THUMBNAIL</div>
                                <div className="col-title">TITLE</div>
                                <div className="col-date">INTENDED AIR DATE</div>
                                <div className="col-date">INTENDED PULL DATE</div>
                                <div className="col-markets">INTENDED MARKETS</div>
                                <div className="col-media">INTENDED MEDIA</div>
                            </div>

                            {restrictedAssets.map((asset) => {

                                return (
                                    <div key={asset.assetId} className="table-row">
                                        <div className="col-thumbnail">
                                            <ThumbnailImage item={asset} />
                                        </div>
                                        <div className="col-title">
                                            <div className="asset-title">{asset.title || asset.name}</div>
                                        </div>
                                        <div className="col-date">
                                            <div className="date-with-icon">
                                                <span className="date-icon">📅</span>
                                                <span>SEP 03, 2025</span>
                                            </div>
                                        </div>
                                        <div className="col-date">
                                            <div className="date-with-icon">
                                                <span className="date-icon">📅</span>
                                                <span>SEP 04, 2025</span>
                                            </div>
                                        </div>
                                        <div className="col-markets">ALL</div>
                                        <div className="col-media">ALL</div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="section-actions">
                            <button
                                className="request-rights-extension-btn primary-button"
                                onClick={handleOpenRightsExtension}
                                type="button"
                            >
                                Request Rights Extension
                            </button>
                        </div>
                    </div>
                )}

                {/* Bottom Actions */}
                <div className="bottom-actions">
                    <button
                        className="back-btn secondary-button"
                        onClick={() => onBack(getCurrentStepData())}
                        type="button"
                    >
                        Back
                    </button>
                    <button
                        className="cancel-btn secondary-button"
                        onClick={onCancel}
                        type="button"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CartRightsCheck;
