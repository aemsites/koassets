import type { CalendarDate } from '@internationalized/date';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthorizationStatus, FadelClient, type CheckRightsRequest } from '../clients/fadel-client';
import type { Asset, RequestDownloadStepData, RightsCheckStepData } from '../types';
import { calendarDateToEpoch } from '../utils/formatters';
import './CartRightsCheck.css';
import DownloadRenditionsContent from './DownloadRenditionsContent';
import ThumbnailImage from './ThumbnailImage';

interface CartRightsCheckProps {
    cartItems: Asset[];
    setCartItems: React.Dispatch<React.SetStateAction<Asset[]>>;
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
    setCartItems,
    intendedUse,
    onCancel,
    onOpenRequestRightsExtension,
    onBack,
    initialData,
    onDownloadCompleted
}) => {
    const [downloadOptions] = useState<Record<string, DownloadOptions>>(initialData?.downloadOptions || {});
    const isCheckingRightsRef = useRef(false);
    const hasPerformedRightsCheckRef = useRef(false);
    const previousRestrictedAssetsRef = useRef<Asset[]>([]);

    // Keep track of newly authorized asset IDs from rights check
    const [newlyAuthorizedAssetIds, setNewlyAuthorizedAssetIds] = useState<Set<string>>(new Set());

    // Loading state for rights check
    const [isRightsCheckLoading, setIsRightsCheckLoading] = useState<boolean>(true);

    // Local state for authorized assets (so we can modify it when downloads complete)
    const [authorizedAssets, setAuthorizedAssets] = useState<Asset[]>(() =>
        cartItems.filter(item => item?.readyToUse?.toLowerCase() === 'yes' || item?.authorized === AuthorizationStatus.AVAILABLE)
    );

    // Memoize restrictedAssets to prevent unnecessary re-renders, excluding newly authorized assets
    const restrictedAssets = useMemo(() =>
        cartItems.filter(item =>
            item?.readyToUse?.toLowerCase() !== 'yes' &&
            !newlyAuthorizedAssetIds.has(item.assetId || '')
        ),
        [cartItems, newlyAuthorizedAssetIds]
    );

    // Update authorization status for newly authorized assets
    useEffect(() => {
        if (newlyAuthorizedAssetIds.size > 0) {
            setCartItems(prevCartItems =>
                prevCartItems.map(item => {
                    if (item.assetId && newlyAuthorizedAssetIds.has(item.assetId)) {
                        return { ...item, authorized: AuthorizationStatus.AVAILABLE };
                    }
                    return item;
                })
            );
        }
    }, [newlyAuthorizedAssetIds, setCartItems]);

    // Sync authorized assets when cartItems changes (in case items are added/removed from outside)
    useEffect(() => {
        const newAuthorizedAssets = cartItems.filter(item =>
            item?.readyToUse?.toLowerCase() === 'yes' || item?.authorized === AuthorizationStatus.AVAILABLE
        );
        setAuthorizedAssets(newAuthorizedAssets);
    }, [cartItems]);

    // Call checkRights when component mounts or key data changes
    useEffect(() => {
        const performRightsCheck = async () => {
            // Prevent concurrent calls
            if (isCheckingRightsRef.current) {
                console.log('Rights check already in progress, skipping');
                return;
            }

            // Check if restrictedAssets have changed
            const restrictedAssetsChanged = JSON.stringify(previousRestrictedAssetsRef.current) !== JSON.stringify(restrictedAssets);

            // Only perform rights check on first change of restrictedAssets
            if (hasPerformedRightsCheckRef.current && restrictedAssetsChanged) {
                console.log('Rights check already performed and restrictedAssets changed, skipping subsequent checks');
                setIsRightsCheckLoading(false);
                return;
            }

            // Mark that we're about to perform the rights check
            if (restrictedAssetsChanged) {
                hasPerformedRightsCheckRef.current = true;
                previousRestrictedAssetsRef.current = [...restrictedAssets];
            }

            if (!intendedUse.airDate || !intendedUse.pullDate || restrictedAssets.length === 0) {
                console.log('Skipping rights check - missing required data');
                setIsRightsCheckLoading(false);
                return;
            }

            setIsRightsCheckLoading(true);

            isCheckingRightsRef.current = true;
            try {
                const fadelClient = FadelClient.getInstance();

                // Prepare the request data
                const request: CheckRightsRequest = {
                    inDate: calendarDateToEpoch(intendedUse.airDate),
                    outDate: calendarDateToEpoch(intendedUse.pullDate),
                    selectedExternalAssets: restrictedAssets.map(asset => asset.assetId).filter((id): id is string => Boolean(id)).map(id => id.replace('urn:aaid:aem:', '')),
                    selectedRights: {
                        "20": Array.from(intendedUse.selectedMediaChannels).map(channel => channel.id),
                        "30": Array.from(intendedUse.selectedMarkets).map(market => market.id)
                    }
                };

                console.log('Calling checkRights with request:', request);
                const response = await fadelClient.checkRights(request);
                console.log('Rights check response:', response);

                // Handle 204 No Content response - all assets are cleared
                if (response.status === 204) {
                    console.log('Rights check returned 204 - all assets cleared, moving to authorized');

                    // Move all restricted assets to authorized
                    if (restrictedAssets.length > 0) {
                        const allRestrictedAssetIds = new Set(
                            restrictedAssets
                                .map(asset => asset.assetId)
                                .filter((id): id is string => Boolean(id))
                        );

                        setAuthorizedAssets(prev => [...prev, ...restrictedAssets]);
                        setNewlyAuthorizedAssetIds(prev => new Set([...prev, ...allRestrictedAssetIds]));
                        console.log(`Moved all ${restrictedAssets.length} restricted assets to authorized status`);
                    }
                } else if (response.restOfAssets && response.restOfAssets.length > 0) {
                    // Process available assets and move them from restricted to authorized
                    const newlyAuthorizedAssets: Asset[] = [];
                    const newAuthorizedIds = new Set<string>();

                    // Create a Set of asset IDs that are in the response for quick lookup
                    const responseAssetIds = new Set(
                        response.restOfAssets.map(item => item.asset.assetExtId)
                    );

                    // Process assets that ARE in response.restOfAssets with available: true
                    response.restOfAssets.forEach(item => {
                        if (item.available === true) {
                            // Find the matching asset in restrictedAssets by comparing assetExtId with cleaned assetId
                            const matchingAsset = restrictedAssets.find(asset => {
                                const cleanedAssetId = asset.assetId?.replace('urn:aaid:aem:', '');
                                return cleanedAssetId === item.asset.assetExtId;
                            });

                            if (matchingAsset && matchingAsset.assetId) {
                                newlyAuthorizedAssets.push(matchingAsset);
                                newAuthorizedIds.add(matchingAsset.assetId);
                                console.log(`Moving asset ${matchingAsset.assetId} from restricted to authorized (available in response)`);
                            }
                        }
                    });

                    // Process assets that are NOT in response.restOfAssets - these should also be authorized
                    restrictedAssets.forEach(asset => {
                        const cleanedAssetId = asset.assetId?.replace('urn:aaid:aem:', '');
                        if (cleanedAssetId && !responseAssetIds.has(cleanedAssetId)) {
                            // Asset is not in the response, so it should be authorized
                            if (asset.assetId && !newAuthorizedIds.has(asset.assetId)) {
                                newlyAuthorizedAssets.push(asset);
                                newAuthorizedIds.add(asset.assetId);
                                console.log(`Moving asset ${asset.assetId} from restricted to authorized (not in response - presumed authorized)`);
                            }
                        }
                    });

                    // Add newly authorized assets to the authorized assets state and track their IDs
                    if (newlyAuthorizedAssets.length > 0) {
                        setAuthorizedAssets(prev => [...prev, ...newlyAuthorizedAssets]);
                        setNewlyAuthorizedAssetIds(prev => new Set([...prev, ...newAuthorizedIds]));
                        console.log(`Moved ${newlyAuthorizedAssets.length} assets to authorized status`);
                    }
                }

            } catch (error) {
                console.error('Rights check failed:', error);
                // TODO: Handle error state in UI
            } finally {
                isCheckingRightsRef.current = false;
                setIsRightsCheckLoading(false);
            }
        };

        performRightsCheck();
    }, [
        intendedUse.airDate,
        intendedUse.pullDate,
        intendedUse.selectedMediaChannels,
        intendedUse.selectedMarkets,
        restrictedAssets
    ]);

    const formatDate = (calendarDate: CalendarDate | null | undefined): string => {
        if (!calendarDate) return '';
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${months[calendarDate.month - 1]} ${String(calendarDate.day).padStart(2, '0')}, ${calendarDate.year}`;
    };


    // Helper function to get current step data
    const getCurrentStepData = useCallback((): RightsCheckStepData => ({
        downloadOptions,
        agreesToTerms: false
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
                            <div>{intendedUse.markets.map(c => c.name).join(', ')}</div>
                        </div>
                        <div className="intended-use-item">
                            <label>INTENDED MEDIA</label>
                            <div>{intendedUse.mediaChannels.map(c => c.name).join(', ')}</div>
                        </div>
                    </div>
                </div>

                {/* Loading Spinner */}
                {isRightsCheckLoading ? (
                    <div className="rights-check-loading">
                        <div className="loading-spinner" />
                        <div className="loading-text">Checking asset rights...</div>
                    </div>
                ) : (
                    <>
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
                    </>
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
