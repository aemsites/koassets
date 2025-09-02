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
    index: number;
    selectedRenditions: Map<string, Set<Rendition>>;
    collapsedAssets: Set<string>;
    isRenditionSelected: (asset: Asset, rendition: Rendition) => boolean;
    handleRenditionToggle: (asset: Asset, rendition: Rendition) => void;
    toggleAssetCollapse: (assetId: string) => void;
}

const SelectAllRenditionsCheckbox: React.FC<SelectAllRenditionsCheckboxProps> = ({
    assetData,
    index,
    selectedRenditions,
    collapsedAssets,
    isRenditionSelected,
    handleRenditionToggle,
    toggleAssetCollapse
}) => {
    const assetId = assetData.asset.assetId || `asset-${index}`;
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

    const handleNonOriginalSelectAllToggle = () => {
        if (isAllNonOriginalSelected) {
            // Deselect all non-original renditions for this asset
            nonOriginalRenditions.forEach(rendition => {
                if (isRenditionSelected(assetData.asset, rendition)) {
                    handleRenditionToggle(assetData.asset, rendition);
                }
            });
        } else {
            // Select all non-original renditions for this asset
            nonOriginalRenditions.forEach(rendition => {
                if (!isRenditionSelected(assetData.asset, rendition)) {
                    handleRenditionToggle(assetData.asset, rendition);
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
                    onChange={handleNonOriginalSelectAllToggle}
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
}

const DownloadRenditionsContent: React.FC<DownloadRenditionsContentProps> = ({
    assets,
    onClose
}) => {
    // Get dynamicMediaClient from context instead of props
    const { dynamicMediaClient, fetchAssetRenditions, imagePresets } = useAppConfig();

    // Moved from DownloadRenditionsModal - all download-related states
    const [selectedRenditions, setSelectedRenditions] = useState<Map<string, Set<Rendition>>>(new Map());
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    // State to track which assets have had their renditions loaded (to handle race conditions)
    const [renditionsLoadedAssets, setRenditionsLoadedAssets] = useState<Set<string>>(new Set());

    // Moved from DownloadRenditionsModal - rendition selection functions
    const handleRenditionToggle = useCallback((asset: Asset, rendition: Rendition) => {
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
                const assetId = asset.assetId || asset.name || `asset-${Math.random()}`;

                await fetchAssetRenditions(asset);
                console.log(`Renditions fetched for asset ${assetId}:`, asset.renditions?.items?.length || 0);

                // Mark this asset as having renditions loaded
                setRenditionsLoadedAssets(prev => {
                    const newSet = new Set(prev);
                    newSet.add(assetId);
                    return newSet;
                });
            });

            Promise.all(fetchPromises).then(() => {
                console.log('All renditions fetch requests completed');
            });
        }
    }, [assets, fetchAssetRenditions]);

    // Auto-select original renditions for assets that have just had their renditions loaded
    useEffect(() => {
        if (renditionsLoadedAssets.size > 0) {
            assets.forEach((assetData, index) => {
                const assetId = assetData.asset.assetId || assetData.asset.name || `asset-${index}`;

                // Only process assets that have had their renditions loaded
                if (renditionsLoadedAssets.has(assetId)) {
                    const allRenditions = [...(assetData.asset.renditions?.items || []), ...(assetData.asset.imagePresets?.items || [])];
                    const originalRendition = allRenditions.find(rendition =>
                        rendition.name?.toLowerCase() === 'original'
                    );

                    if (originalRendition && !isRenditionSelected(assetData.asset, originalRendition)) {
                        console.log(`Auto-selecting original rendition for asset ${assetId} (renditions loaded)`);
                        handleRenditionToggle(assetData.asset, originalRendition);
                    }
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renditionsLoadedAssets]); // Intentionally excluding isRenditionSelected and handleRenditionToggle to prevent re-running when selections change

    // Moved from DownloadRenditionsModal - download function
    const handleDownloadRenditions = useCallback(async () => {
        const asset = assets[0]?.asset; // Get first asset

        // Calculate total selected renditions count
        let totalSelectedCount = 0;
        selectedRenditions.forEach(assetRenditions => {
            totalSelectedCount += assetRenditions.size;
        });

        if (!asset || !dynamicMediaClient || (!acceptTerms) || isDownloading || totalSelectedCount === 0) {
            console.warn('Cannot download: missing requirements, already downloading, or no renditions selected');
            return;
        }

        if (!asset.readyToUse) {
            ToastQueue.negative(`This asset is not rights free.`, { timeout: 1000 });
            return;
        }

        const count = totalSelectedCount;
        setIsDownloading(true);
        let closeProcessingToast;

        try {
            // Collect all selected renditions from all assets
            const allSelectedRenditions: Rendition[] = [];
            selectedRenditions.forEach(assetRenditions => {
                allSelectedRenditions.push(...Array.from(assetRenditions));
            });

            if (count === 1) {
                const rendition = allSelectedRenditions[0];
                const isImagePreset = rendition && imagePresets?.items?.some(preset => preset.name === rendition.name);
                await dynamicMediaClient.downloadAsset(asset, rendition, isImagePreset);
                onClose();
            } else {
                // Create renditionsToDownload with preset prefix for image presets
                const renditionsToDownload = new Set(
                    allSelectedRenditions.map(rendition => {
                        const isImagePreset = rendition && imagePresets?.items?.some(preset => preset.name === rendition.name);
                        if (isImagePreset) {
                            return {
                                ...rendition,
                                name: `preset_${rendition.name}`
                            };
                        }
                        return rendition;
                    })
                );

                // Multiple assets archive download - show toast notifications
                closeProcessingToast = ToastQueue.info(`Processing download request for ${count} renditions. Refreshing the page will cancel the download.`);

                const success = await dynamicMediaClient.downloadAssetsArchive(
                    [{ asset, renditions: Array.from(renditionsToDownload).map(rendition => ({ name: rendition.name })) }]);

                if (success) {
                    closeProcessingToast?.();
                    ToastQueue.positive(`Successfully started downloading ${count} renditions.`, { timeout: 1000 });
                    onClose();
                } else {
                    closeProcessingToast?.();
                    ToastQueue.negative(`Failed to create archive for ${count} renditions.`, { timeout: 1000 });
                }
            }
        } catch (error) {
            console.error('Failed to download asset:', error);
            closeProcessingToast?.();
            ToastQueue.negative(`Unexpected error occurred while downloading ${count} renditions.`, { timeout: 1000 });
        } finally {
            setIsDownloading(false);
        }
    }, [assets, dynamicMediaClient, acceptTerms, isDownloading, selectedRenditions, onClose, imagePresets]);

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
        assets.forEach((assetData, index) => {
            const assetId = assetData.asset.assetId || `asset-${index}`;
            initialCollapsed.add(assetId);
        });
        return initialCollapsed;
    });

    // Update collapsed state when assets change
    useEffect(() => {
        setCollapsedAssets(prev => {
            const newCollapsed = new Set(prev);
            assets.forEach((assetData, index) => {
                const assetId = assetData.asset.assetId || `asset-${index}`;
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
                            {/* Renditions status feedback */}
                            {assetData.renditionsLoading && (
                                <div className="renditions-status loading">
                                    Loading available renditions...
                                </div>
                            )}
                            {assetData.renditionsError && (
                                <div className="renditions-status error">
                                    {assetData.renditionsError}
                                </div>
                            )}

                            {/* Individual rendition checkboxes */}
                            {!assetData.renditionsLoading && !assetData.renditionsError &&
                                (assetData.asset.renditions?.items && assetData.asset.renditions?.items.length > 0 ||
                                    assetData.asset.imagePresets?.items && assetData.asset.imagePresets?.items.length > 0) && (
                                    <div className="renditions-list">
                                        {/* Original rendition - always visible */}
                                        {(() => {
                                            const assetId = assetData.asset.assetId || `asset-${index}`;
                                            const allRenditions = [...(assetData.asset.renditions?.items || []), ...(assetData.asset.imagePresets?.items || [])];
                                            const originalRendition = allRenditions.find(rendition => rendition.name?.toLowerCase() === 'original');

                                            if (!originalRendition) return null;

                                            return (
                                                <label key={`${assetId}-original`} className="rendition-item">
                                                    <input
                                                        type="checkbox"
                                                        className="tccc-checkbox"
                                                        checked={isRenditionSelected(assetData.asset, originalRendition)}
                                                        onChange={() => handleRenditionToggle(assetData.asset, originalRendition)}
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
                                            key={`select-all-${assetData.asset.assetId || index}`}
                                            assetData={assetData}
                                            index={index}
                                            selectedRenditions={selectedRenditions}
                                            collapsedAssets={collapsedAssets}
                                            isRenditionSelected={isRenditionSelected}
                                            handleRenditionToggle={handleRenditionToggle}
                                            toggleAssetCollapse={toggleAssetCollapse}
                                        />

                                        {/* Individual non-original renditions - only show if not collapsed */}
                                        {!collapsedAssets.has(assetData.asset.assetId || `asset-${index}`) && (() => {
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
                                                        onChange={() => handleRenditionToggle(assetData.asset, rendition)}
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
