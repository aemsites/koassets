import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import { Asset, Rendition } from '../types';
import { formatDimensions, formatFileSize, formatFormatName } from '../utils/formatters';
import './DownloadRenditionsContent.css';
import ThumbnailImage from './ThumbnailImage';

interface AssetData {
    asset: Asset;
    renditionsLoading: boolean;
    renditionsError: string | null;
}

interface SelectAllRenditionsCheckboxProps {
    assetData: AssetData;
    selectedRenditions: Map<string, Set<Rendition>>;
    collapsedAssets: Set<string>;
    isRenditionSelected: (asset: Asset, rendition: Rendition) => boolean;
    handleToggleRendition: (asset: Asset, rendition: Rendition) => void;
    toggleAssetCollapse: (assetId: string) => void;
}

const SelectAllRenditionsCheckbox: React.FC<SelectAllRenditionsCheckboxProps> = ({
    assetData,
    selectedRenditions,
    collapsedAssets,
    isRenditionSelected,
    handleToggleRendition,
    toggleAssetCollapse
}) => {
    const assetId = assetData.asset.assetId || '';
    const allRenditions = [...(assetData.asset.renditions?.items || []), ...(assetData.asset.imagePresets?.items || [])];
    const nonOriginalRenditions = allRenditions.filter(rendition => rendition.name?.toLowerCase() !== 'original')
        .sort((a, b) => {
            const aIsWatermark = (a.name || '').toLowerCase().startsWith('watermark');
            const bIsWatermark = (b.name || '').toLowerCase().startsWith('watermark');

            // Watermark renditions first
            if (aIsWatermark && !bIsWatermark) return -1;
            if (!aIsWatermark && bIsWatermark) return 1;

            // Then alphabetical within each group
            return (a.name || '').localeCompare(b.name || '');
        });

    const assetSelectedRenditions = selectedRenditions.get(assetId) || new Set();
    const selectedNonOriginalRenditions = nonOriginalRenditions.filter(rendition =>
        Array.from(assetSelectedRenditions).some(r => r.name === rendition.name)
    );
    const isAllNonOriginalSelected = nonOriginalRenditions.length > 0 && selectedNonOriginalRenditions.length === nonOriginalRenditions.length;
    const isSomeNonOriginalSelected = selectedNonOriginalRenditions.length > 0 && selectedNonOriginalRenditions.length < nonOriginalRenditions.length;
    const isCollapsed = collapsedAssets.has(assetId);

    const checkboxRef = useRef<HTMLInputElement>(null);

    // Set indeterminate state when some but not all renditions are selected
    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = isSomeNonOriginalSelected;
        }
    }, [isSomeNonOriginalSelected]);

    if (nonOriginalRenditions.length === 0) return null;

    const handleToggleNonOriginalSelectAll = () => {
        if (isAllNonOriginalSelected) {
            // Deselect all non-original renditions for this asset
            nonOriginalRenditions.forEach(rendition => {
                if (isRenditionSelected(assetData.asset, rendition)) {
                    handleToggleRendition(assetData.asset, rendition);
                }
            });
        } else {
            // Select all non-original renditions for this asset
            nonOriginalRenditions.forEach(rendition => {
                if (!isRenditionSelected(assetData.asset, rendition)) {
                    handleToggleRendition(assetData.asset, rendition);
                }
            });
        }
    };

    return (
        <div className="select-all-item">
            <label
                className="select-all-checkbox-wrapper"
                onClick={(e) => {
                    e.stopPropagation();
                }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                }}
                onMouseUp={(e) => {
                    e.stopPropagation();
                }}
            >
                <input
                    ref={checkboxRef}
                    type="checkbox"
                    className="tccc-checkbox"
                    checked={isAllNonOriginalSelected}
                    onChange={handleToggleNonOriginalSelectAll}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                />
                <span className="select-all-label-clickable">
                    ALL AVAILABLE RENDITIONS
                </span>
            </label>
            <button
                type="button"
                className={`renditions-toggle-btn ${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleAssetCollapse(assetId);
                }}
            />
        </div>
    );
};

interface DownloadRenditionsContentProps {
    assets: AssetData[];
    onClose: () => void;
    onDownloadComplete?: (success: boolean) => void;
}

const DownloadRenditionsContent: React.FC<DownloadRenditionsContentProps> = ({
    assets,
    onClose,
    onDownloadComplete
}) => {
    // Get dynamicMediaClient from context instead of props
    const { dynamicMediaClient, fetchAssetRenditions } = useAppConfig();

    // Moved from DownloadRenditionsModal - all download-related states
    const [selectedRenditions, setSelectedRenditions] = useState<Map<string, Set<Rendition>>>(new Map());
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    // State to track which assets have had their renditions loaded (to handle race conditions)
    const [renditionsLoadedAssets, setRenditionsLoadedAssets] = useState<Set<string>>(new Set());

    // Moved from DownloadRenditionsModal - rendition selection functions
    const handleToggleRendition = useCallback((asset: Asset, rendition: Rendition) => {
        const assetId = asset.assetId || `asset-${asset.name}`;
        console.log(`Toggling rendition "${rendition.name}" for asset "${assetId}"`);

        setSelectedRenditions(prev => {
            const newMap = new Map(prev);
            const assetRenditions = newMap.get(assetId) || new Set();
            const newAssetRenditions = new Set(assetRenditions);

            const existingRendition = Array.from(newAssetRenditions).find(r => r.name === rendition.name);

            if (existingRendition) {
                newAssetRenditions.delete(existingRendition);
            } else {
                newAssetRenditions.add(rendition);
            }

            if (newAssetRenditions.size === 0) {
                newMap.delete(assetId);
            } else {
                newMap.set(assetId, newAssetRenditions);
            }

            return newMap;
        });
    }, []);

    const isRenditionSelected = useCallback((asset: Asset, rendition: Rendition) => {
        const assetId = asset.assetId || `asset-${asset.name}`;
        const assetRenditions = selectedRenditions.get(assetId) || new Set();
        return Array.from(assetRenditions).some(r => r.name === rendition.name);
    }, [selectedRenditions]);

    // Reset selectedRenditions and other states when assets change (e.g., modal reopens)
    useEffect(() => {
        setSelectedRenditions(new Map());
        setAcceptTerms(false);
        setIsDownloading(false);
        setRenditionsLoadedAssets(new Set()); // Clear loaded assets tracking
    }, [assets]);

    // Fetch asset renditions when component mounts or assets change
    useEffect(() => {
        if (assets.length > 0 && fetchAssetRenditions) {
            const fetchPromises = assets.map(async ({ asset }) => {
                const assetId = asset.assetId || '';

                try {
                    await fetchAssetRenditions(asset);
                    console.log(`Renditions fetched for asset ${assetId}:`, asset.renditions?.items?.length || 0);

                    // Mark this asset as having renditions loaded
                    setRenditionsLoadedAssets(prev => {
                        const newSet = new Set(prev);
                        newSet.add(assetId);
                        return newSet;
                    });
                } catch (error) {
                    console.error(`Failed to fetch renditions for asset ${assetId}:`, error);
                }
            });

            Promise.all(fetchPromises).then(() => {
                console.log('All renditions fetch requests completed');
            });
        }
    }, [assets, fetchAssetRenditions]);

    // Auto-select original renditions for assets that have just had their renditions loaded
    useEffect(() => {
        if (renditionsLoadedAssets.size > 0) {
            assets.forEach((assetData) => {
                const assetId = assetData.asset.assetId || '';

                // Only process assets that have had their renditions loaded
                if (renditionsLoadedAssets.has(assetId)) {
                    const allRenditions = [...(assetData.asset.renditions?.items || []), ...(assetData.asset.imagePresets?.items || [])];
                    const originalRendition = allRenditions.find(rendition =>
                        rendition.name?.toLowerCase() === 'original'
                    );

                    if (originalRendition && !isRenditionSelected(assetData.asset, originalRendition)) {
                        console.log(`Auto-selecting original rendition for asset ${assetId} (renditions loaded)`);
                        handleToggleRendition(assetData.asset, originalRendition);
                    }
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renditionsLoadedAssets]); // Intentionally excluding isRenditionSelected and handleToggleRendition to prevent re-running when selections change

    // Moved from DownloadRenditionsModal - download function
    const handleDownloadRenditions = useCallback(async () => {

        // Calculate total selected renditions count
        let totalSelectedCount = 0;
        selectedRenditions.forEach(assetRenditions => {
            totalSelectedCount += assetRenditions.size;
        });

        if (!dynamicMediaClient || (!acceptTerms) || isDownloading || totalSelectedCount === 0) {
            console.warn('Cannot download: missing requirements, already downloading, or no renditions selected');
            return;
        }

        const count = totalSelectedCount;
        setIsDownloading(true);
        let closeProcessingToast;

        try {
            if (count === 1) {
                // Find the single selected rendition and its asset directly
                let rendition: Rendition | null = null;
                let assetForRendition: Asset | null = null;

                for (const [assetId, assetRenditions] of selectedRenditions) {
                    if (assetRenditions.size > 0) {
                        rendition = Array.from(assetRenditions)[0];
                        assetForRendition = assets.find(assetData => assetData.asset.assetId === assetId)?.asset || null;
                        break;
                    }
                }

                if (rendition && assetForRendition) {
                    const isImagePreset = rendition && assetForRendition.imagePresets?.items?.some(preset => preset.name === rendition.name);
                    await dynamicMediaClient.downloadAsset(assetForRendition, rendition, isImagePreset);
                    onDownloadComplete?.(true);
                    onClose();
                } else {
                    console.error('Could not find asset or rendition for single download');
                    ToastQueue.negative('Error: Could not find asset or rendition for single download.', { timeout: 1000 });
                    onDownloadComplete?.(false);
                }
            } else {
                // Multiple assets archive download - show toast notifications
                closeProcessingToast = ToastQueue.info(`Processing download request for ${count} renditions. Refreshing the page will cancel the download.`);

                // Collect all assets with their selected renditions
                const assetsWithRenditions = [];
                for (const [assetId, assetRenditions] of selectedRenditions) {
                    const assetData = assets.find(assetData => assetData.asset.assetId === assetId);

                    if (assetData && assetRenditions.size > 0) {
                        const renditionsForThisAsset = Array.from(assetRenditions).map(rendition => {
                            const isImagePreset = rendition && assetData.asset.imagePresets?.items?.some(preset => preset.name === rendition.name);
                            const renditionName = isImagePreset ? `preset_${rendition.name}` : rendition.name;
                            return { name: renditionName };
                        });

                        assetsWithRenditions.push({
                            asset: assetData.asset,
                            renditions: renditionsForThisAsset
                        });
                    }
                }

                const success = await dynamicMediaClient.downloadAssetsArchive(assetsWithRenditions);

                if (success) {
                    closeProcessingToast?.();
                    ToastQueue.positive(`Successfully started downloading ${count} renditions.`, { timeout: 1000 });
                    onDownloadComplete?.(true);
                    onClose();
                } else {
                    closeProcessingToast?.();
                    ToastQueue.negative(`Failed to create archive for ${count} renditions.`, { timeout: 1000 });
                    onDownloadComplete?.(false);
                }
            }
        } catch (error) {
            console.error('Failed to download asset:', error);
            closeProcessingToast?.();
            ToastQueue.negative(`Unexpected error occurred while downloading ${count} renditions.`, { timeout: 1000 });
            onDownloadComplete?.(false);
        } finally {
            setIsDownloading(false);
        }
    }, [assets, dynamicMediaClient, acceptTerms, isDownloading, selectedRenditions, onClose, onDownloadComplete]);

    // Calculate total selected renditions count for UI
    const totalSelectedCount = React.useMemo(() => {
        let count = 0;
        selectedRenditions.forEach(assetRenditions => {
            count += assetRenditions.size;
        });
        return count;
    }, [selectedRenditions]);

    // State for collapsed/expanded per asset - collapsed by default
    const [collapsedAssets, setCollapsedAssets] = useState<Set<string>>(() => {
        // Initialize all assets as collapsed
        const initialCollapsed = new Set<string>();
        assets.forEach((assetData) => {
            const assetId = assetData.asset.assetId || '';
            initialCollapsed.add(assetId);
        });
        return initialCollapsed;
    });

    // Update collapsed state when assets change
    useEffect(() => {
        setCollapsedAssets(prev => {
            const newCollapsed = new Set(prev);
            assets.forEach((assetData) => {
                const assetId = assetData.asset.assetId || '';
                if (!newCollapsed.has(assetId)) {
                    newCollapsed.add(assetId); // New assets start collapsed
                }
            });
            return newCollapsed;
        });
    }, [assets]);

    // Note: Auto-selection of original renditions is now handled directly in the fetchAssetRenditions useEffect above

    const toggleAssetCollapse = (assetId: string) => {
        setCollapsedAssets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(assetId)) {
                newSet.delete(assetId);
            } else {
                newSet.add(assetId);
            }
            return newSet;
        });
    };
    return (
        <div className="download-renditions-content">
            <div className="download-renditions-table">
                <div className="download-renditions-table-header">
                    <span>THUMBNAIL</span>
                    <span>TITLE</span>
                    <span>DOWNLOAD OPTIONS</span>
                </div>

                {/* Asset Rows */}
                {assets.map((assetData, index) => (
                    <div key={assetData.asset.assetId || index} className="download-renditions-row">
                        <div className="download-renditions-thumbnail">
                            <ThumbnailImage
                                item={assetData.asset}
                            />
                        </div>
                        <div className="download-renditions-title">
                            {assetData.asset.name}
                        </div>
                        <div className="download-renditions-options">
                            {(() => {
                                const hasRenditions = (assetData.asset.renditions?.items && assetData.asset.renditions?.items.length > 0) ||
                                    (assetData.asset.imagePresets?.items && assetData.asset.imagePresets?.items.length > 0);

                                return (
                                    <>
                                        {/* Renditions status feedback */}
                                        {!hasRenditions && (
                                            <div className="renditions-status loading">
                                                <div className="loading-spinner"></div>
                                                Loading available renditions...
                                            </div>
                                        )}

                                        {/* Individual rendition checkboxes */}
                                        {hasRenditions && (
                                            <div className="renditions-list">
                                                {/* Original rendition - always visible */}
                                                {(() => {
                                                    const assetId = assetData.asset.assetId || '';
                                                    const allRenditions = [...(assetData.asset.renditions?.items || []), ...(assetData.asset.imagePresets?.items || [])];
                                                    const originalRendition = allRenditions.find(rendition => rendition.name?.toLowerCase() === 'original');

                                                    if (!originalRendition) return null;

                                                    return (
                                                        <label key={`${assetId}-original`} className="rendition-item">
                                                            <input
                                                                type="checkbox"
                                                                className="tccc-checkbox"
                                                                checked={isRenditionSelected(assetData.asset, originalRendition)}
                                                                onChange={() => handleToggleRendition(assetData.asset, originalRendition)}
                                                            />
                                                            <span className="rendition-name">ORIGINAL</span>
                                                            {formatDimensions(originalRendition.dimensions) && (
                                                                <>
                                                                    <span className="rendition-separator">|</span>
                                                                    <span className="rendition-dimensions">
                                                                        {formatDimensions(originalRendition.dimensions)}
                                                                    </span>
                                                                </>
                                                            )}
                                                            <span className="rendition-separator">|</span>
                                                            <span className="rendition-format">
                                                                {formatFormatName(originalRendition.format || '')}
                                                            </span>
                                                            {originalRendition?.size && originalRendition?.size > 0 && (
                                                                <>
                                                                    <span className="rendition-separator">|</span>
                                                                    <span className="rendition-size">
                                                                        {formatFileSize(originalRendition.size || 0)}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </label>
                                                    );
                                                })()}

                                                {/* Select All checkbox with collapse/expand button - only for non-original renditions */}
                                                <SelectAllRenditionsCheckbox
                                                    key={`select-all-${assetData.asset?.assetId}`}
                                                    assetData={assetData}
                                                    selectedRenditions={selectedRenditions}
                                                    collapsedAssets={collapsedAssets}
                                                    isRenditionSelected={isRenditionSelected}
                                                    handleToggleRendition={handleToggleRendition}
                                                    toggleAssetCollapse={toggleAssetCollapse}
                                                />

                                                {/* Individual non-original renditions - only show if not collapsed */}
                                                {!collapsedAssets.has(assetData.asset.assetId || '') && (() => {
                                                    const nonOriginalRenditions = [...(assetData.asset.renditions?.items || []), ...(assetData.asset.imagePresets?.items || [])]
                                                        .filter(rendition => rendition.name?.toLowerCase() !== 'original')
                                                        .sort((a, b) => {
                                                            const aIsWatermark = (a.name || '').toLowerCase().startsWith('watermark');
                                                            const bIsWatermark = (b.name || '').toLowerCase().startsWith('watermark');

                                                            // Watermark renditions first
                                                            if (aIsWatermark && !bIsWatermark) return -1;
                                                            if (!aIsWatermark && bIsWatermark) return 1;

                                                            // Then alphabetical within each group
                                                            return (a.name || '').localeCompare(b.name || '');
                                                        });

                                                    return nonOriginalRenditions.map((rendition) => (
                                                        <label key={`${assetData.asset.assetId}-${rendition.name}`} className="rendition-item">
                                                            <input
                                                                type="checkbox"
                                                                className="tccc-checkbox"
                                                                checked={isRenditionSelected(assetData.asset, rendition)}
                                                                onChange={() => handleToggleRendition(assetData.asset, rendition)}
                                                            />
                                                            <span className="rendition-name">{rendition.name}</span>
                                                            {formatDimensions(rendition.dimensions) && (
                                                                <>
                                                                    <span className="rendition-separator">|</span>
                                                                    <span className="rendition-dimensions">
                                                                        {formatDimensions(rendition.dimensions)}
                                                                    </span>
                                                                </>
                                                            )}
                                                            <span className="rendition-separator">|</span>
                                                            <span className="rendition-format">
                                                                {formatFormatName(rendition.format || '')}
                                                            </span>
                                                            {rendition?.size && rendition?.size > 0 && (
                                                                <>
                                                                    <span className="rendition-separator">|</span>
                                                                    <span className="rendition-size">
                                                                        {formatFileSize(rendition.size || 0)}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </label>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                ))}
            </div>

            <div className="download-renditions-terms">
                <label className="download-renditions-checkbox">
                    <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                    />
                    <span className="checkmark-checkbox"></span>
                    I agree to the <a href="#" className="terms-link">terms and conditions</a> of use.
                </label>
            </div>

            <div className="download-renditions-actions">
                <button
                    className="download-renditions-button cancel secondary-button"
                    onClick={onClose}
                    disabled={isDownloading}
                >
                    Cancel
                </button>
                <button
                    className={`download-renditions-button primary-button ${(!acceptTerms || isDownloading || totalSelectedCount === 0) ? 'disabled' : ''}`}
                    onClick={handleDownloadRenditions}
                    disabled={!acceptTerms || isDownloading || totalSelectedCount === 0}
                >
                    {isDownloading ? 'Downloading...' : 'Download'}
                </button>
            </div>
        </div>
    );
};

export type { AssetData };
export default DownloadRenditionsContent;
